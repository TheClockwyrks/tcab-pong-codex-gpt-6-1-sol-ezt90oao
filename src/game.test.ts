import { afterEach, describe, expect, it } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { ConstantClock, createEngine } from "@clockwyrks/simple-2d";
import type { Engine } from "@clockwyrks/simple-2d";
import { BACKGROUND, game } from "./game";
import type { CaromDebugApi, CaromState } from "./game";
import * as C from "./constants";

const engines: Engine<CaromState, CaromDebugApi>[] = [];
afterEach(() => {
  engines.splice(0).forEach((e) => e.destroy());
});
async function setup(ms = 10) {
  const events = new EventTarget();
  const canvas = createCanvas(C.FIELD_W, C.FIELD_H);
  const engine = createEngine({
    canvas: canvas as unknown as HTMLCanvasElement,
    width: C.FIELD_W,
    height: C.FIELD_H,
    game,
    background: BACKGROUND,
    layout: C.LAYOUT,
    clock: new ConstantClock(ms),
    surface: {
      cssWidth: () => C.FIELD_W,
      cssHeight: () => C.FIELD_H,
      dpr: () => 1,
      events: () => events,
    },
  });
  engines.push(engine);
  await engine.initialize();
  const key = (code: string, type = "keydown") =>
    events.dispatchEvent(
      Object.assign(new Event(type), { code, repeat: false }),
    );
  const pointer = (
    type: string,
    x: number,
    y: number,
    id = 1,
    device = "mouse",
  ) =>
    events.dispatchEvent(
      Object.assign(new Event(`pointer${type}`), {
        clientX: x,
        clientY: y,
        pointerId: id,
        pointerType: device,
        isPrimary: true,
        button: 0,
        buttons: type === "up" ? 0 : 1,
      }),
    );
  const d = engine.debug;
  const pose = (fn: (s: CaromState) => CaromState) => engine.apply(fn);
  const flight = (x: number, y: number, vx: number, vy: number, spin = 0) =>
    pose((s) =>
      d.setBallSpin(
        d.setBallVelocity(
          d.setBallPosition(
            d.setBallHeld(d.setScreen(s, "playing"), false),
            x,
            y,
          ),
          vx,
          vy,
        ),
        spin,
      ),
    );
  return { engine, d, key, pointer, pose, flight };
}

describe("screens and input", () => {
  it("opens complete and immutable, with live diagnostics", async () => {
    const { engine, d, pose } = await setup();
    const before = engine.state;
    expect(before.screen).toBe("title");
    expect(before.ball?.held).toBe(true);
    pose((s) => d.setBallVelocity(s, 300, 400));
    expect(d.snapshot(engine.state).ball?.speed).toBe(500);
    expect(before.ball?.vx).toBe(0);
    expect(
      engine.diagnostics().find((v) => v.name === "ball speed")?.value,
    ).toBe(500);
    expect(d.reconcile(engine.state)).toEqual(engine.state);
  });
  it("navigates with movement priority, remembers title, starts and pauses once", async () => {
    const { engine, key } = await setup();
    key("ArrowDown");
    key("Enter");
    await engine.advance(1);
    expect(engine.state.screen).toBe("title");
    expect(engine.state.menuIndex).toBe(1);
    key("ArrowDown", "keyup");
    key("Enter", "keyup");
    await engine.advance(1);
    key("Enter");
    await engine.advance(1);
    key("Enter", "keyup");
    expect(engine.state.mode).toBe("versus");
    expect(engine.state.titleIndex).toBe(1);
    key("Escape");
    await engine.advance(1);
    expect(engine.state.screen).toBe("paused");
    const timer = engine.state.ball?.holdTimer;
    await engine.advance(5);
    expect(engine.state.ball?.holdTimer).toBe(timer);
    key("Escape", "keyup");
    await engine.advance(1);
    key("Escape");
    await engine.advance(1);
    expect(engine.state.screen).toBe("countdown");
  });
  it("confirms same-frame pointer edges and rejects cross-item gestures", async () => {
    const { engine, d, pointer } = await setup();
    const a = d.menuItemRect(engine.state, 1)!;
    pointer("down", a.x + 20, a.y + 20);
    pointer("up", a.x + 20, a.y + 20);
    await engine.advance(1);
    expect(engine.state.mode).toBe("versus");
    engine.apply((s) => d.reset(s));
    const b = d.menuItemRect(engine.state, 2)!;
    pointer("down", a.x + 20, a.y + 20);
    await engine.advance(1);
    pointer("up", b.x + 20, b.y + 20);
    await engine.advance(1);
    expect(engine.state.screen).toBe("title");
    expect(engine.state.menuIndex).toBe(2);
    pointer("down", b.x + 20, b.y + 20, 2, "touch");
    await engine.advance(1);
    pointer("up", b.x + 20, b.y + 20, 2, "touch");
    await engine.advance(1);
    expect(engine.state.screen).toBe("howto");
  });
  it("howto, restart, quit, matchover and mute work on their own screens", async () => {
    const { engine, d, key, pose } = await setup();
    pose((s) => d.setMenuIndex(s, 2));
    key("Enter");
    await engine.advance(1);
    key("Enter", "keyup");
    key("Escape");
    await engine.advance(1);
    key("Escape", "keyup");
    expect(engine.state.screen).toBe("title");
    expect(engine.state.menuIndex).toBe(2);
    pose((s) => d.setMenuIndex(d.setScreen(s, "paused"), 1));
    key("Enter");
    await engine.advance(1);
    key("Enter", "keyup");
    expect(engine.state.screen).toBe("countdown");
    pose((s) => d.setMenuIndex(d.setScreen(s, "paused"), 2));
    await engine.advance(1);
    key("Enter");
    await engine.advance(1);
    key("Enter", "keyup");
    expect(engine.state.screen).toBe("title");
    pose((s) => d.setMenuIndex(d.setScreen(s, "matchover"), 0));
    key("Enter");
    await engine.advance(1);
    key("Enter", "keyup");
    expect(engine.state.screen).toBe("countdown");
    key("KeyM");
    await engine.advance(1);
    expect(engine.state.muted).toBe(true);
    key("KeyM", "keyup");
    pose((s) => d.setMuted(s, false));
    await engine.advance(1);
    expect(engine.state.muted).toBe(false);
  });
});

describe("simulation", () => {
  it("serves at the exact hold edge without moving on the serve frame", async () => {
    const { engine, d, pose } = await setup(10);
    pose((s) => d.setBallServeSign(d.setScreen(s, "countdown"), -1));
    await engine.advance(100);
    expect(engine.state.screen).toBe("playing");
    expect(engine.state.ball?.x).toBe(C.FIELD_CX);
    expect(engine.state.ball?.vy).toBeLessThan(0);
    expect(d.snapshot(engine.state).ball?.speed).toBeCloseTo(C.SERVE_SPEED);
    await engine.advance(1);
    expect(engine.state.ball?.x).toBeLessThan(C.FIELD_CX);
  });
  it("integrates input and driven paddles, including actual clamped velocity", async () => {
    const { engine, d, key, pose } = await setup();
    pose((s) => d.setScreen(s, "countdown"));
    key("ArrowDown");
    await engine.advance(1);
    expect(engine.state.paddles.left.cy).toBeCloseTo(
      C.FIELD_CY + C.PADDLE_SPEED * 0.01,
    );
    pose((s) =>
      d.setPaddleVy(
        d.setPaddleDriven(
          d.setPaddleCy(s, "left", C.PADDLE_MAX_CY - 1),
          "left",
          true,
        ),
        "left",
        500,
      ),
    );
    await engine.advance(1);
    expect(engine.state.paddles.left.vy).toBeCloseTo(100);
    await engine.advance(1);
    expect(engine.state.paddles.left.vy).toBe(0);
    expect(engine.state.paddles.left.drivenVy).toBe(500);
  });
  it("adds paddle spin and speed, and caps repeated hits", async () => {
    const { engine, d, pose, flight } = await setup();
    pose((s) => d.setPaddleVy(d.setPaddleDriven(s, "left", true), "left", 400));
    flight(78, C.FIELD_CY, -520, 0);
    await engine.advance(1);
    expect(engine.state.ball?.vx).toBeGreaterThan(0);
    expect(engine.state.ball?.spin).toBeGreaterThan(300);
    expect(d.snapshot(engine.state).ball?.speed).toBeCloseTo(
      520 * C.SPEED_MULT,
    );
    flight(78, engine.state.paddles.left.cy, -C.SPEED_CAP, 0);
    await engine.advance(1);
    expect(d.snapshot(engine.state).ball?.speed).toBeCloseTo(C.SPEED_CAP);
  });
  it("wall and obstacle contacts preserve speed and spin except decay, with one cue per frame", async () => {
    const { engine, flight } = await setup(16);
    const cues: string[] = [];
    engine.events.on("cue:played", (e) => cues.push(e.cue));
    flight(300, 12, 0, -900, 400);
    await engine.advance(1);
    expect(engine.state.ball?.vy).toBeGreaterThan(0);
    expect(
      Math.hypot(engine.state.ball!.vx, engine.state.ball!.vy),
    ).toBeCloseTo(900);
    expect(cues).toEqual([C.CUES.wallBounce]);
    cues.length = 0;
    flight(465, 220, 900, 0, 0);
    await engine.advance(1);
    expect(engine.state.ball?.vx).toBeLessThan(0);
    expect(cues).toEqual([C.CUES.obstacleBounce]);
  });
  it("paddle end caps are ordinary reflections", async () => {
    const { engine, flight } = await setup();
    flight(56, 293, 0, 520, 100);
    await engine.advance(1);
    expect(engine.state.ball?.vy).toBeLessThan(0);
    expect(
      Math.hypot(engine.state.ball!.vx, engine.state.ball!.vy),
    ).toBeCloseTo(520);
  });
  it("scores only completely beyond goals, parks and wins with a two point lead", async () => {
    const { engine, d, pose, flight } = await setup();
    pose((s) => d.setScore(s, 10, 10));
    flight(1290, 300, 520, 0);
    await engine.advance(1);
    expect(engine.state.score).toEqual({ p1: 11, p2: 10 });
    expect(engine.state.screen).toBe("countdown");
    expect(engine.state.receiver).toBe("right");
    expect(engine.state.ball?.trail).toEqual([]);
    flight(1290, 300, 520, 0);
    await engine.advance(1);
    expect(engine.state.screen).toBe("matchover");
    expect(engine.state.winner).toBe("left");
    pose((s) => d.setScore(s, 0, 10));
    flight(-10, 300, -520, 0);
    await engine.advance(1);
    expect(engine.state.winner).toBe("right");
  });
  it("AI tracking, movement and driven overrides are independent", async () => {
    const { engine, d, pose, flight } = await setup();
    flight(900, 550, 520, 0);
    await engine.advance(1);
    expect(engine.state.paddles.right.vy).toBe(C.AI_SPEED);
    pose((s) => d.setAiMovement(s, false));
    await engine.advance(1);
    expect(engine.state.paddles.right.vy).toBe(0);
    pose((s) =>
      d.setAiTracking(
        d.setAiMovement(d.setPaddleCy(s, "right", 550), true),
        false,
      ),
    );
    await engine.advance(1);
    expect(engine.state.paddles.right.vy).toBe(-C.AI_SPEED);
    pose((s) =>
      d.setPaddleVy(d.setPaddleDriven(s, "right", true), "right", 100),
    );
    await engine.advance(1);
    expect(engine.state.paddles.right.vy).toBe(100);
  });
  it("world poses fail loudly for absent entities and reset restores everything", async () => {
    const { engine, d, pose } = await setup();
    pose((s) => d.clearWorld(s));
    expect(() => d.setBallSpin(engine.state, 1)).toThrow();
    expect(() => d.spawnObstacle(engine.state, 9)).toThrow();
    pose((s) => d.setScreen(s, "playing"));
    await engine.advance(1);
    expect(engine.state.ball).toBeNull();
    expect(engine.state.obstacles).toEqual([]);
    pose((s) => d.spawnObstacle(d.spawnBall(s), 1));
    pose((s) => d.spawnObstacle(s, 0));
    expect(engine.state.obstacles.map((o) => o.index)).toEqual([0, 1]);
    pose((s) => d.reset(d.setMuted(s, true)));
    expect(engine.state.simTime).toBe(0);
    expect(engine.state.muted).toBe(true);
  });
  it("spin decay and free flight agree across 2ms and 16ms frames", async () => {
    const run = async (ms: number) => {
      const { engine, flight, pose, d } = await setup(ms);
      pose((s) => d.clearWorld(s));
      pose((s) => d.spawnBall(s));
      flight(640, 360, 500, -50, 500);
      await engine.advance(800 / ms);
      return d.snapshot(engine.state).ball!;
    };
    const a = await run(2),
      b = await run(16);
    expect(a.spin).toBeCloseTo(250);
    expect(b.spin).toBeCloseTo(a.spin);
    expect(a.speed).toBeCloseTo(b.speed);
    expect(Math.abs(a.vx - b.vx)).toBeLessThan(10);
    expect(Math.abs(a.vy - b.vy)).toBeLessThan(10);
  });
  it("trails retain only the configured time window and menus freeze the world", async () => {
    const { engine, flight, pose, d } = await setup();
    flight(300, 350, 200, 0);
    await engine.advance(30);
    expect(engine.state.ball!.trail.length).toBeLessThanOrEqual(14);
    const ball = engine.state.ball;
    pose((s) => d.setScreen(s, "paused"));
    await engine.advance(20);
    expect(engine.state.ball).toEqual(ball);
    expect(engine.state.simTime).toBeCloseTo(0.5);
  });
});
