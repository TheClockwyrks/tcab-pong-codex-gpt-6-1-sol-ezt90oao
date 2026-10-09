import type { RenderApi } from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import type { CaromState } from "./game";
import { menuItems, menuItemRect } from "./game";
import * as C from "./constants";

const mint = "#91f3cd",
  coral = "#ff8d79",
  gold = "#e9be77",
  white = "#eaf0e9",
  muted = "#71838f";
export function render(
  s: DeepReadonly<CaromState>,
  { ctx: c }: RenderApi,
): void {
  const text = (
    copy: string,
    x: number,
    y: number,
    size = 14,
    color = muted,
    align: CanvasTextAlign = "center",
    weight = 500,
  ) => {
    c.fillStyle = color;
    c.font = `${weight} ${size}px ${size > 40 ? "Arial, sans-serif" : "monospace"}`;
    c.textAlign = align;
    c.textBaseline = "middle";
    c.fillText(copy, x, y);
  };
  const bar = (
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    r = 6,
  ) => {
    c.fillStyle = color;
    c.beginPath();
    c.roundRect(x, y, w, h, r);
    c.fill();
  };
  c.save();
  const wash = c.createRadialGradient(
    C.FIELD_CX,
    C.FIELD_CY,
    30,
    C.FIELD_CX,
    C.FIELD_CY,
    760,
  );
  wash.addColorStop(0, "#162730");
  wash.addColorStop(1, "#0b141c");
  c.fillStyle = wash;
  c.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
  c.strokeStyle = "#20323b";
  c.lineWidth = 1;
  for (let x = 96; x < C.FIELD_W; x += 64) {
    c.beginPath();
    c.moveTo(x, 90);
    c.lineTo(x, 630);
    c.stroke();
  }
  for (let y = 104; y < 630; y += 64) {
    c.beginPath();
    c.moveTo(32, y);
    c.lineTo(1248, y);
    c.stroke();
  }
  const menu = menuItems(s).length > 0;
  c.save();
  if (menu) c.globalAlpha = 0.24;
  c.strokeStyle = "#42535c";
  c.lineWidth = 2;
  c.setLineDash([6, 14]);
  c.beginPath();
  c.moveTo(C.NET_X, 112);
  c.lineTo(C.NET_X, 618);
  c.stroke();
  c.setLineDash([]);
  c.strokeStyle = "#40515a";
  c.beginPath();
  c.moveTo(32, 1);
  c.lineTo(1248, 1);
  c.moveTo(32, 719);
  c.lineTo(1248, 719);
  c.stroke();
  for (const o of s.obstacles) {
    c.shadowColor = gold;
    c.shadowBlur = 18;
    bar(
      o.cx - C.OBSTACLE_HW,
      o.cy - C.OBSTACLE_HH,
      C.OBSTACLE_W,
      C.OBSTACLE_H,
      gold,
    );
    c.shadowBlur = 0;
    text(`0${o.index + 1}`, o.cx, o.cy + C.OBSTACLE_HH + 20, 10, gold);
  }
  for (const side of ["left", "right"] as const) {
    const x = side === "left" ? C.P1_X0 : C.P2_X0,
      color = side === "left" ? mint : coral;
    c.shadowBlur = 22;
    c.shadowColor = color;
    bar(x, s.paddles[side].cy - C.PADDLE_HALF, C.PADDLE_W, C.PADDLE_H, color);
    c.shadowBlur = 0;
  }
  if (s.ball) {
    const b = s.ball;
    for (let i = 1; i < b.trail.length; i++) {
      const a = b.trail[i - 1],
        z = b.trail[i];
      c.globalAlpha = (((menu ? 0.24 : 1) * i) / b.trail.length) * 0.48;
      c.strokeStyle = mint;
      c.lineWidth = (C.BALL_R * 1.6 * i) / b.trail.length;
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(a.x, a.y);
      c.lineTo(z.x, z.y);
      c.stroke();
    }
    c.globalAlpha = menu ? 0.24 : 1;
    c.shadowColor = white;
    c.shadowBlur = 20;
    c.fillStyle = white;
    c.beginPath();
    c.arc(b.x, b.y, C.BALL_R, 0, Math.PI * 2);
    c.fill();
    c.shadowBlur = 0;
  }
  c.restore();
  text("C /", 36, 38, 22, mint, "left", 700);
  text("CAROM  /  PADDLE CLUB", 76, 38, 12, white, "left");
  text(s.muted ? "M  SOUND OFF" : "M  SOUND ON", 1244, 38, 12, muted, "right");
  if (menu) {
    text("SPIN. BANK. REPEAT.", 36, 682, 11, muted, "left");
    text("FIRST TO 11 · WIN BY 2", 1244, 682, 11, muted, "right");
  }
  if (!menu) {
    text("PLAYER 01", 480, 39, 11, mint);
    text(s.mode === "solo" ? "COMPUTER" : "PLAYER 02", 800, 39, 11, coral);
    text(
      String(s.score.p1).padStart(2, "0"),
      480,
      88,
      62,
      white,
      "center",
      700,
    );
    text(
      String(s.score.p2).padStart(2, "0"),
      800,
      88,
      62,
      white,
      "center",
      700,
    );
    text(
      s.mode === "solo" ? "SOLO / HUMAN × MACHINE" : "VERSUS / LOCAL DUEL",
      640,
      37,
      10,
      muted,
    );
    text("W / S  ·  PLAYER 01", 36, 682, 12, mint, "left");
    text(
      s.mode === "solo" ? "COMPUTER" : "PLAYER 02  ·  ↑ / ↓",
      1244,
      682,
      12,
      coral,
      "right",
    );
    text("P / ESC  PAUSE", 640, 682, 11, muted);
    if (s.screen === "countdown") {
      text("GET READY", 640, 302, 13, mint);
      text("SERVE", 640, 407, 18, white);
      text(
        s.receiver === "left" ? "← PLAYER 01" : "PLAYER 02 →",
        640,
        437,
        11,
        muted,
      );
    }
  } else {
    // An opaque central reading area leaves the actual court visible around it.
    const panel = c.createLinearGradient(380, 0, 900, 0);
    panel.addColorStop(0, "#0b141c00");
    panel.addColorStop(0.2, "#0b141cee");
    panel.addColorStop(0.8, "#0b141cee");
    panel.addColorStop(1, "#0b141c00");
    c.fillStyle = panel;
    c.fillRect(350, 100, 580, 540);
    if (s.screen === "title") {
      text("A GAME OF ANGLES", 640, 157, 12, gold);
      text(C.TITLE_TEXT, 640, 245, 112, white, "center", 800);
      text("Put a new spin on the duel.", 640, 319, 17, muted);
      text("01 / MOVE", 255, 420, 11, mint);
      text("02 / CURVE", 1025, 260, 11, gold);
      text("03 / SCORE", 1025, 564, 11, coral);
    } else if (s.screen === "howto") {
      text("THE PLAYBOOK", 640, 154, 12, gold);
      text("Make every angle count.", 640, 215, 42, white, "center", 700);
      const rows = [
        [
          "01",
          "TAKE YOUR SIDE",
          "Solo: W / S or ↑ / ↓. Versus: W / S and ↑ / ↓.",
        ],
        [
          "02",
          "PUT SPIN ON IT",
          "Move as you strike. Your paddle motion curves the ball.",
        ],
        [
          "03",
          "PLAY THE BANK",
          "Use the amber obstacles to send a shot around your rival.",
        ],
        [
          "04",
          "FINISH THE DUEL",
          "First to 11, ahead by two. P / Esc pauses. M mutes.",
        ],
      ];
      rows.forEach(([n, t, d], i) => {
        const y = 302 + i * 65;
        text(n, 401, y, 13, mint);
        text(t, 435, y, 13, white, "left", 700);
        text(d, 435, y + 24, 11, muted, "left");
      });
    } else if (s.screen === "paused") {
      text("TIME OUT", 640, 172, 12, gold);
      text("PAUSED", 640, 252, 74, white, "center", 800);
      text(
        `${s.score.p1} — ${s.score.p2}  /  ${s.mode.toUpperCase()}`,
        640,
        320,
        16,
        muted,
      );
    } else {
      text("MATCH COMPLETE", 640, 164, 12, gold);
      text(
        s.winner === "left"
          ? "PLAYER 01 WINS"
          : s.mode === "solo"
            ? "COMPUTER WINS"
            : "PLAYER 02 WINS",
        640,
        235,
        48,
        s.winner === "left" ? mint : coral,
        "center",
        800,
      );
      text(`${s.score.p1} — ${s.score.p2}`, 640, 308, 38, white, "center", 700);
    }
    menuItems(s).forEach((item, i) => {
      const r = menuItemRect(s, i)!;
      const active = s.menuIndex === i;
      bar(r.x, r.y, r.w, r.h, active ? mint : "#17252d", 5);
      c.strokeStyle = active ? mint : "#293a43";
      c.lineWidth = 1;
      c.beginPath();
      c.roundRect(r.x, r.y, r.w, r.h, 5);
      c.stroke();
      text(
        item,
        r.x + 24,
        r.y + r.h / 2,
        14,
        active ? "#10241d" : white,
        "left",
        700,
      );
      text(
        active ? "↗" : `0${i + 1}`,
        r.x + r.w - 25,
        r.y + r.h / 2,
        17,
        active ? "#10241d" : muted,
      );
    });
    if (s.screen !== "howto")
      text("↑ ↓ / W S  SELECT     ENTER  PLAY", 640, 613, 11, muted);
  }
  c.restore();
}
