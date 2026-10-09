import type { Game, UpdateApi } from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import * as C from "./constants";
import { render } from "./render";

export type Screen =
  "title" | "howto" | "countdown" | "playing" | "paused" | "matchover";

export type Mode = "solo" | "versus";

export type Side = "left" | "right";

export interface PaddleState {
  readonly cy: number;
  readonly vy: number;
  readonly driven: boolean;
  readonly drivenVy: number;
}

export interface AiState {
  readonly tracking: boolean;
  readonly movement: boolean;
}

export interface TrailSample {
  readonly x: number;
  readonly y: number;
  readonly t: number;
}

export interface BallState {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly spin: number;
  readonly held: boolean;
  readonly holdTimer: number;
  readonly serveSign: 1 | -1;
  readonly trail: readonly TrailSample[];
}

export interface ObstacleState {
  readonly index: number;
  readonly cx: number;
  readonly cy: number;
}

export interface CaromState {
  readonly screen: Screen;
  readonly mode: Mode;
  readonly menuIndex: number;
  readonly titleIndex: number;
  readonly resumeScreen: "countdown" | "playing";

  readonly score: { readonly p1: number; readonly p2: number };
  readonly winner: Side | null;

  readonly paddles: { readonly left: PaddleState; readonly right: PaddleState };
  readonly ai: AiState;

  readonly receiver: Side;
  readonly ball: BallState | null;
  readonly obstacles: readonly ObstacleState[];

  readonly simTime: number;
  readonly muted: boolean;
  /** Origins of active menu gestures, keyed by pointer id. */
  readonly menuPresses?: Readonly<Record<number, number>>;
}

export const BACKGROUND = "#0b141c";
type State = DeepReadonly<CaromState>;
export interface MenuRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}
export interface CaromSnapshot extends Omit<
  CaromState,
  "ball" | "menuPresses"
> {
  readonly version: number;
  readonly ball: (BallState & { readonly speed: number }) | null;
}
export interface CaromDebugApi {
  readonly version: number;
  clearWorld(s: State): CaromState;
  spawnBall(s: State): CaromState;
  spawnObstacle(s: State, index: number): CaromState;
  reset(s: State): CaromState;
  reconcile(s: State): CaromState;
  snapshot(s: State): CaromSnapshot;
  menuItemRect(s: State, index: number): MenuRect | null;
  drawBallServeSign(s: State): CaromState;
  setScreen(s: State, value: Screen): CaromState;
  setMode(s: State, value: Mode): CaromState;
  setMenuIndex(s: State, value: number): CaromState;
  setTitleIndex(s: State, value: number): CaromState;
  setResumeScreen(s: State, value: "countdown" | "playing"): CaromState;
  setWinner(s: State, value: Side | null): CaromState;
  setReceiver(s: State, value: Side): CaromState;
  setMuted(s: State, value: boolean): CaromState;
  setBallPosition(s: State, x: number, y: number): CaromState;
  setBallVelocity(s: State, vx: number, vy: number): CaromState;
  setBallSpin(s: State, spin: number): CaromState;
  setBallHeld(s: State, held: boolean): CaromState;
  setBallHoldTimer(s: State, holdTimer: number): CaromState;
  setBallServeSign(s: State, serveSign: 1 | -1): CaromState;
  setScore(s: State, p1: number, p2: number): CaromState;
  setPaddleCy(s: State, side: Side, cy: number): CaromState;
  setPaddleVy(s: State, side: Side, vy: number): CaromState;
  setPaddleDriven(s: State, side: Side, driven: boolean): CaromState;
  setAiTracking(s: State, enabled: boolean): CaromState;
  setAiMovement(s: State, enabled: boolean): CaromState;
}
const sign = (): 1 | -1 => (Math.random() < 0.5 ? -1 : 1);
const paddle = (): PaddleState => ({
  cy: C.FIELD_CY,
  vy: 0,
  driven: false,
  drivenVy: 0,
});
const parked = (): BallState => ({
  x: C.FIELD_CX,
  y: C.FIELD_CY,
  vx: 0,
  vy: 0,
  spin: 0,
  held: true,
  holdTimer: C.HOLD_TIME,
  serveSign: sign(),
  trail: [],
});
function initial(muted = false): CaromState {
  return {
    screen: "title",
    mode: "solo",
    menuIndex: 0,
    titleIndex: 0,
    resumeScreen: "playing",
    score: { p1: 0, p2: 0 },
    winner: null,
    paddles: { left: paddle(), right: paddle() },
    ai: { tracking: true, movement: true },
    receiver: "left",
    ball: parked(),
    obstacles: C.OBSTACLE_CENTERS.map((c, index) => ({
      index,
      cx: c.x,
      cy: c.y,
    })),
    simTime: 0,
    muted,
  };
}
export function menuItems(s: State): readonly string[] {
  switch (s.screen) {
    case "title":
      return C.TITLE_ITEMS;
    case "paused":
      return C.PAUSE_ITEMS;
    case "matchover":
      return C.MATCHOVER_ITEMS;
    case "howto":
      return ["BACK TO MENU"];
    default:
      return [];
  }
}
export function menuItemRect(s: State, index: number): MenuRect | null {
  if (!Number.isInteger(index) || index < 0 || index >= menuItems(s).length)
    return null;
  return {
    x: 460,
    y: (s.screen === "howto" ? 590 : 368) + index * 66,
    w: 360,
    h: 54,
  };
}
function ballPatch(s: State, patch: Partial<BallState>): CaromState {
  if (!s.ball) throw new Error("Carom: no ball is present");
  return { ...s, ball: { ...s.ball, ...patch } };
}
const debug: CaromDebugApi = {
  version: C.CAROM_DEBUG_VERSION,
  clearWorld: (s) => ({ ...s, ball: null, obstacles: [] }),
  spawnBall: (s) => ({ ...s, ball: parked() }),
  spawnObstacle: (s, index) => {
    const c = C.OBSTACLE_CENTERS[index];
    if (!Number.isInteger(index) || !c)
      throw new Error("Carom: invalid obstacle index");
    return {
      ...s,
      obstacles: [
        ...s.obstacles.filter((o) => o.index !== index),
        { index, cx: c.x, cy: c.y },
      ].sort((a, b) => a.index - b.index),
    };
  },
  reset: (s) => initial(s.muted),
  reconcile: (s) => ({ ...s }),
  snapshot: (s) => {
    const { menuPresses: _gestures, ...declared } = s;
    return {
      ...declared,
      version: C.CAROM_DEBUG_VERSION,
      ball: s.ball
        ? { ...s.ball, speed: Math.hypot(s.ball.vx, s.ball.vy) }
        : null,
    };
  },
  menuItemRect,
  drawBallServeSign: (s) => ballPatch(s, { serveSign: sign() }),
  setScreen: (s, value) => ({ ...s, screen: value }),
  setMode: (s, value) => ({ ...s, mode: value }),
  setMenuIndex: (s, value) => ({ ...s, menuIndex: value }),
  setTitleIndex: (s, value) => ({ ...s, titleIndex: value }),
  setResumeScreen: (s, value) => ({ ...s, resumeScreen: value }),
  setWinner: (s, value) => ({ ...s, winner: value }),
  setReceiver: (s, value) => ({ ...s, receiver: value }),
  setMuted: (s, value) => ({ ...s, muted: value }),
  setBallPosition: (s, x, y) => ballPatch(s, { x, y }),
  setBallVelocity: (s, vx, vy) => ballPatch(s, { vx, vy }),
  setBallSpin: (s, spin) => ballPatch(s, { spin }),
  setBallHeld: (s, held) => ballPatch(s, { held }),
  setBallHoldTimer: (s, holdTimer) => ballPatch(s, { holdTimer }),
  setBallServeSign: (s, serveSign) => ballPatch(s, { serveSign }),
  setScore: (s, p1, p2) => ({ ...s, score: { p1, p2 } }),
  setPaddleCy: (s, side, cy) => ({
    ...s,
    paddles: { ...s.paddles, [side]: { ...s.paddles[side], cy } },
  }),
  setPaddleVy: (s, side, vy) => ({
    ...s,
    paddles: { ...s.paddles, [side]: { ...s.paddles[side], drivenVy: vy } },
  }),
  setPaddleDriven: (s, side, driven) => ({
    ...s,
    paddles: { ...s.paddles, [side]: { ...s.paddles[side], driven } },
  }),
  setAiTracking: (s, tracking) => ({ ...s, ai: { ...s.ai, tracking } }),
  setAiMovement: (s, movement) => ({ ...s, ai: { ...s.ai, movement } }),
};
const clamp = (x: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, x));
function move(p: PaddleState, vy: number, dt: number): PaddleState {
  const raw = p.cy + vy * dt,
    cy = clamp(raw, C.PADDLE_MIN_CY, C.PADDLE_MAX_CY);
  return { ...p, cy, vy: cy !== raw && dt > 0 ? (cy - p.cy) / dt : vy };
}
function start(s: State, mode: Mode): CaromState {
  return {
    ...s,
    mode,
    screen: "countdown",
    resumeScreen: "playing",
    menuIndex: 0,
    score: { p1: 0, p2: 0 },
    winner: null,
    receiver: "left",
    ball: parked(),
    paddles: {
      left: { ...s.paddles.left, cy: C.FIELD_CY, vy: 0 },
      right: { ...s.paddles.right, cy: C.FIELD_CY, vy: 0 },
    },
    menuPresses: {},
  };
}
function title(s: State): CaromState {
  return {
    ...initial(s.muted),
    titleIndex: s.titleIndex,
    menuIndex: s.titleIndex,
    simTime: s.simTime,
  };
}
function confirm(s: State): CaromState {
  if (s.screen === "title") {
    const next = { ...s, titleIndex: s.menuIndex };
    return s.menuIndex === 2
      ? { ...next, screen: "howto", menuIndex: 0, menuPresses: {} }
      : start(next, s.menuIndex === 1 ? "versus" : "solo");
  }
  if (s.screen === "howto") return title(s);
  if (s.screen === "paused")
    return s.menuIndex === 0
      ? { ...s, screen: s.resumeScreen, menuPresses: {} }
      : s.menuIndex === 1
        ? start(s, s.mode)
        : title(s);
  if (s.screen === "matchover")
    return s.menuIndex === 0 ? start(s, s.mode) : title(s);
  return { ...s };
}
function input(s: State, api: UpdateApi): CaromState {
  const edges = Object.fromEntries(
    C.ACTIONS.map((a) => [a, api.input.pressed(a)]),
  );
  // The runtime owns audio; state poses request its bit on the next update.
  api.audio.setMuted(edges.mute ? !s.muted : s.muted);
  let next: CaromState = { ...s, muted: api.audio.muted() };
  const samples = api.input.pointerSamples();
  const contacts = api.input.pointerContacts();
  if (s.screen === "playing" || s.screen === "countdown")
    return edges.pause
      ? {
          ...next,
          screen: "paused",
          resumeScreen: s.screen,
          menuIndex: 0,
          menuPresses: {},
        }
      : next;
  if (s.screen === "paused" && (edges.pause || edges.back))
    return { ...next, screen: s.resumeScreen, menuPresses: {} };
  if ((s.screen === "howto" || s.screen === "matchover") && edges.back)
    return title(next);
  const count = menuItems(s).length;
  const up = edges["p1-up"] || edges["p2-up"],
    down = edges["p1-down"] || edges["p2-down"];
  if (up || down)
    next = {
      ...next,
      menuIndex: (s.menuIndex + (up ? -1 : 1) + count) % count,
    };
  const keyboardConfirm = edges.confirm && !up && !down;
  if (keyboardConfirm) next = confirm(next);
  const origins = { ...s.menuPresses };
  const hit = (x: number, y: number) =>
    Array.from({ length: count }, (_, i) => i).find((i) => {
      const r = menuItemRect(s, i)!;
      return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    });
  let pointerConfirm = false;
  for (const sample of samples) {
    const i = hit(sample.x, sample.y);
    if (i !== undefined && !keyboardConfirm) next = { ...next, menuIndex: i };
    if (sample.type === "down") origins[sample.id] = i ?? -1;
    if (sample.type === "up") {
      if (i !== undefined && origins[sample.id] === i) pointerConfirm = true;
      delete origins[sample.id];
    }
  }
  for (const contact of contacts) {
    const i = hit(contact.x, contact.y);
    if (i !== undefined && !keyboardConfirm) next = { ...next, menuIndex: i };
  }
  if (pointerConfirm && !keyboardConfirm) next = confirm(next);
  return { ...next, menuPresses: next.screen === s.screen ? origins : {} };
}
/** Minimum-penetration rectangle contact, with deterministic face tie breaking. */
function rectangle(
  b: BallState,
  r: C.Rect,
): { ball: BallState; face: number; reflected: boolean } | null {
  if (!(
    b.x > r.x0 - C.BALL_R &&
    b.x < r.x1 + C.BALL_R &&
    b.y > r.y0 - C.BALL_R &&
    b.y < r.y1 + C.BALL_R
  ))
    return null;
  const depths = [
    b.x - r.x0 + C.BALL_R,
    r.x1 + C.BALL_R - b.x,
    b.y - r.y0 + C.BALL_R,
    r.y1 + C.BALL_R - b.y,
  ];
  const face = depths.indexOf(Math.min(...depths));
  const reflected = [b.vx > 0, b.vx < 0, b.vy > 0, b.vy < 0][face];
  const ball = { ...b };
  if (face === 0) ball.x = r.x0 - C.BALL_R;
  if (face === 1) ball.x = r.x1 + C.BALL_R;
  if (face === 2) ball.y = r.y0 - C.BALL_R;
  if (face === 3) ball.y = r.y1 + C.BALL_R;
  if (reflected) {
    if (face < 2) ball.vx = -ball.vx;
    else ball.vy = -ball.vy;
  }
  return { ball, face, reflected };
}
export function simulate(
  s: State,
  dt: number,
  held: Readonly<Record<string, boolean>>,
  cue: (name: C.CueName) => void,
): CaromState {
  if (s.screen !== "countdown" && s.screen !== "playing") return { ...s };
  const axis = (up: boolean, down: boolean) =>
    (Number(down) - Number(up)) * C.PADDLE_SPEED;
  const p1up = held["p1-up"] || (s.mode === "solo" && held["p2-up"]),
    p1down = held["p1-down"] || (s.mode === "solo" && held["p2-down"]);
  let target = C.AI_HOME_Y,
    deadzone = C.AI_HOME_DEADZONE;
  if (s.ai.tracking && s.screen === "playing" && s.ball && s.ball.vx > 0) {
    target = s.ball.y - s.ball.vy * C.AI_REACT;
    deadzone = C.AI_DEADZONE;
  }
  const diff = target - s.paddles.right.cy;
  const aiVy =
    s.ai.movement && Math.abs(diff) > deadzone && dt > 0
      ? Math.sign(diff) * Math.min(C.AI_SPEED, Math.abs(diff) / dt)
      : 0;
  const paddles = {
    left: move(
      s.paddles.left,
      s.paddles.left.driven ? s.paddles.left.drivenVy : axis(p1up, p1down),
      dt,
    ),
    right: move(
      s.paddles.right,
      s.paddles.right.driven
        ? s.paddles.right.drivenVy
        : s.mode === "solo"
          ? aiVy
          : axis(held["p2-up"], held["p2-down"]),
      dt,
    ),
  };
  let next: CaromState = { ...s, paddles };
  if (!s.ball) return next;
  let b: BallState = { ...s.ball };
  if (s.screen === "countdown") {
    const holdTimer = b.holdTimer - dt;
    if (holdTimer <= 0) {
      b = {
        ...b,
        holdTimer: 0,
        held: false,
        vx:
          (s.receiver === "left" ? -1 : 1) *
          C.SERVE_SPEED *
          Math.cos(C.SERVE_ANGLE),
        vy: b.serveSign * C.SERVE_SPEED * Math.sin(C.SERVE_ANGLE),
        trail: [],
      };
      next = { ...next, screen: "playing" };
    } else b = { ...b, holdTimer };
  } else if (!b.held) {
    const n = Math.max(
        1,
        Math.ceil((Math.hypot(b.vx, b.vy) * dt) / C.MAX_SUBSTEP),
      ),
      h = dt / n;
    for (let i = 0; i < n; i++) {
      const speed = Math.hypot(b.vx, b.vy),
        angle = speed > 0 ? (b.spin / speed) * h : 0;
      const vx = b.vx * Math.cos(angle) - b.vy * Math.sin(angle),
        vy = b.vx * Math.sin(angle) + b.vy * Math.cos(angle);
      b = {
        ...b,
        vx,
        vy,
        spin: b.spin * Math.pow(0.5, h / C.SPIN_HALFLIFE),
        x: b.x + vx * h,
        y: b.y + vy * h,
      };
      if (b.y - C.BALL_R < 0 && b.vy < 0) {
        b = { ...b, y: C.BALL_R, vy: -b.vy };
        cue(C.CUES.wallBounce);
      } else if (b.y + C.BALL_R > C.FIELD_H && b.vy > 0) {
        b = { ...b, y: C.FIELD_H - C.BALL_R, vy: -b.vy };
        cue(C.CUES.wallBounce);
      }
      for (const side of ["left", "right"] as const) {
        const p = paddles[side],
          left = side === "left";
        const hit = rectangle(b, {
          x0: left ? C.P1_X0 : C.P2_X0,
          x1: left ? C.P1_X1 : C.P2_X1,
          y0: p.cy - C.PADDLE_HALF,
          y1: p.cy + C.PADDLE_HALF,
        });
        if (!hit) continue;
        b = hit.ball;
        if (hit.face < 2) {
          const theta =
              clamp((b.y - p.cy) / C.PADDLE_HALF, -1, 1) * C.MAX_BOUNCE_ANGLE,
            sp = Math.min(Math.hypot(b.vx, b.vy) * C.SPEED_MULT, C.SPEED_CAP);
          b = {
            ...b,
            x: left ? C.P1_X1 + C.BALL_R : C.P2_X0 - C.BALL_R,
            vx: (left ? 1 : -1) * sp * Math.cos(theta),
            vy: sp * Math.sin(theta),
            spin: clamp(
              b.spin + p.vy * C.SPIN_FROM_PADDLE,
              -C.SPIN_CLAMP,
              C.SPIN_CLAMP,
            ),
          };
          cue(C.CUES.paddleHit);
        } else if (hit.reflected) cue(C.CUES.wallBounce);
      }
      for (const o of s.obstacles) {
        const hit = rectangle(b, C.OBSTACLES[o.index]);
        if (hit) {
          b = hit.ball;
          if (hit.reflected) cue(C.CUES.obstacleBounce);
        }
      }
    }
  }
  b = {
    ...b,
    trail: [
      ...b.trail.filter((t) => s.simTime - t.t <= C.TRAIL_TIME),
      { x: b.x, y: b.y, t: s.simTime },
    ],
  };
  next = { ...next, ball: b };
  if (
    s.screen === "playing" &&
    (b.x - C.BALL_R > C.FIELD_W || b.x + C.BALL_R < 0)
  ) {
    const left = b.x > C.FIELD_W,
      score = { p1: s.score.p1 + Number(left), p2: s.score.p2 + Number(!left) };
    const won = left
      ? score.p1 >= C.WIN_SCORE && score.p1 - score.p2 >= C.WIN_LEAD
      : score.p2 >= C.WIN_SCORE && score.p2 - score.p1 >= C.WIN_LEAD;
    cue(C.CUES.score);
    next = {
      ...next,
      score,
      ...(won
        ? {
            screen: "matchover" as const,
            winner: left ? ("left" as const) : ("right" as const),
            menuIndex: 0,
          }
        : {
            screen: "countdown" as const,
            receiver: left ? ("right" as const) : ("left" as const),
            ball: parked(),
          }),
    };
  }
  return next;
}
export const game: Game<CaromState, CaromDebugApi> = {
  initialize(api) {
    // The engine pins an element when its CSS size matches its backing store.
    // Preserve the supplied page's viewport sizing across that pin; the engine
    // still owns all measurements, backing-store sizes, and logical transforms.
    if (
      typeof document !== "undefined" &&
      !document.getElementById("carom-fit")
    ) {
      const style = document.createElement("style");
      style.id = "carom-fit";
      style.textContent =
        "#stage { width: 100vw !important; height: 100vh !important; }";
      document.head.append(style);
    }
    for (const a of C.ACTIONS)
      api.input.register(a, { keys: [...C.BINDINGS[a]] });
    api.audio.define(C.CUES.paddleHit, {
      wave: "triangle",
      freq: 620,
      freqTo: 310,
      durationMs: 70,
      gain: 0.16,
    });
    api.audio.define(C.CUES.wallBounce, {
      freq: 230,
      freqTo: 170,
      durationMs: 45,
      gain: 0.1,
    });
    api.audio.define(C.CUES.obstacleBounce, {
      wave: "square",
      freq: 410,
      freqTo: 820,
      durationMs: 55,
      gain: 0.07,
    });
    api.audio.define(C.CUES.score, {
      wave: "triangle",
      freq: 880,
      freqTo: 220,
      durationMs: 250,
      gain: 0.2,
    });
    api.diagnostics.register("screen", (s) => s.screen);
    api.diagnostics.register("mode", (s) => s.mode);
    api.diagnostics.register("p1 score", (s) => s.score.p1);
    api.diagnostics.register("p2 score", (s) => s.score.p2);
    for (const key of ["x", "y", "vx", "vy", "spin"] as const)
      api.diagnostics.register(`ball ${key}`, (s) => s.ball?.[key] ?? "absent");
    api.diagnostics.register("ball speed", (s) =>
      s.ball ? Math.hypot(s.ball.vx, s.ball.vy) : "absent",
    );
    for (const side of ["left", "right"] as const)
      for (const key of ["cy", "vy"] as const)
        api.diagnostics.register(`${side} ${key}`, (s) => s.paddles[side][key]);
    return [initial(), debug];
  },
  update(s, api, dt) {
    const next = input({ ...s, simTime: s.simTime + dt }, api);
    const held = Object.fromEntries(
      C.ACTIONS.map((a) => [a, api.input.value(a) > 0]),
    );
    const cues = new Set<C.CueName>();
    const result = simulate(next, dt, held, (c) => cues.add(c));
    for (const cue of cues) api.audio.play(cue);
    return result;
  },
  render,
};
