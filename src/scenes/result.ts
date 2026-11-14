import { drawPrompts } from '../input/prompts';
import { text } from '../manifest';
import { drawSlamText, fill } from '../ui/hud';
import type { Game, Scene, SceneParams } from '../types';
import {
  INK, PAPER, VERMILION, W, deck, duskSea, duskSky, hangingScroll, hanko, inkText, lantern, ryo, shadow, sunRays,
} from './screens/paint';

const LOCK = 0.5;
const AUTO = 5;
const GOLD_AT = 1.2;
const COUNT_TIME = 0.8;
const DROP_AT = 0.3;
const GRAVITY = 1800;
const GROUND = 290;
const START_Y = -100;

// ---------- look ----------
const NIGIRI_Y_OFFSET = 40;     // nigiri centre sits this far below its bounce position
const TRAY_Y = 384;             // top of the lacquer tray the nigiri lands on
const RECEIPT_Y = 446;          // centre of the paper receipt
const HORIZON = 262;
const RAIL_Y = 372;
const FLOOR_Y = 452;
const SAM_SCALE = 1.6;
const UNROLL = 0.22;

function nigiriY(t: number): number {
  const dt = Math.max(0, t - DROP_AT);
  const fall = Math.sqrt(((GROUND - START_Y) * 2) / GRAVITY);
  if (dt < fall) return START_Y + 0.5 * GRAVITY * dt * dt;
  const tt = dt - fall;
  return GROUND - Math.abs(Math.sin(tt * 9)) * 70 * Math.exp(-tt * 3);
}

export function createResultScene(game: Game, params: SceneParams['result']): Scene {
  const { fish, outcome, goldEarned } = params;
  let t = 0;
  let left = false;
  let coined = false;
  const total = game.state.gold;
  const before = total - goldEarned;

  const leave = () => { if (!left) { left = true; game.go('ocean', undefined); } };

  return {
    enter() {
      if (outcome === 'win') {
        game.audio.play('ko');
        game.audio.announce(params.perfect ? text.announce.perfect : text.announce.win);
      } else {
        game.audio.play('lose');
        game.audio.announce(outcome === 'timeout' ? text.announce.timeout : text.announce.ko);
      }
    },
    update(dt) {
      t += dt;
      if (outcome === 'win' && !coined && t >= GOLD_AT) { coined = true; game.audio.play('coin'); }
      if ((t > LOCK && game.input.pressed('confirm')) || t >= AUTO) leave();
    },
    render(ctx) {
      if (outcome === 'win') {
        drawWinBackdrop(ctx, t);
        drawSlamText(ctx, text.win.banner, W / 2, 90, t, { size: 110, color: '#ff3b2f' });
        if (params.perfect) drawSlamText(ctx, text.win.perfect, W / 2, 170, t - 0.4, { size: 54 });
        drawTray(ctx, W / 2, TRAY_Y);
        const ny = nigiriY(t) + NIGIRI_Y_OFFSET;
        const landed = Math.max(0, Math.min(1, (ny - 200) / (GROUND + NIGIRI_Y_OFFSET - 200)));
        shadow(ctx, W / 2, TRAY_Y + 2, 40 + 50 * landed);
        game.assets.draw(ctx, 'nigiri', W / 2, ny, { scale: 2.5 });
        if (t >= GOLD_AT) {
          const k = Math.min(1, (t - GOLD_AT) / COUNT_TIME);
          drawReceipt(
            ctx, t - GOLD_AT,
            ryo(fill(text.win.sold, { gold: Math.round(goldEarned * k) })),
            fill(text.shop.gold, { gold: Math.round(before + goldEarned * k) }),
            k >= 1 ? t - GOLD_AT - COUNT_TIME : -1,
          );
        }
      } else if (outcome === 'timeout') {
        drawDusk(ctx, t);
        drawBannerScroll(ctx, t, text.timeout.banner, text.timeout.sub, 110, '#ffdd22');
        shadow(ctx, 300, FLOOR_Y + 18, 50);
        game.assets.draw(ctx, 'samuraiIdle', 300, FLOOR_Y + 20 - (173 * SAM_SCALE) / 2, { scale: SAM_SCALE });
        game.assets.draw(ctx, fish.def.sprite, 600 + Math.max(0, t - 0.5) ** 2 * 450, 360 - t * 10, { scale: 1.6, time: t * 3 });
        lantern(ctx, 40, 0, t, 1.1, '時', 30);
      } else {
        drawDusk(ctx, t);
        drawBannerScroll(ctx, t, text.ko.banner, fill(text.ko.sub, { fish: fish.name }), 80, '#ff3b2f');
        shadow(ctx, 300, FLOOR_Y + 10, 90);
        game.assets.draw(ctx, 'samuraiHurt', 300, FLOOR_Y - 42, { scale: SAM_SCALE, rotation: Math.PI / 2 });
        game.assets.draw(ctx, fish.def.sprite, 560 + t * 40, 330 + Math.sin(t * 2) * 8, { flipX: true, scale: 1.8, time: t });
        lantern(ctx, 40, 0, t, 1.1, '負', 30);
      }
      drawPrompts(ctx, game.input, [{ action: 'confirm', label: 'CONTINUE' }]);
    },
  };
}

// ---------- win ----------

function drawWinBackdrop(ctx: CanvasRenderingContext2D, t: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, 540);
  sky.addColorStop(0, '#4a1d5c');
  sky.addColorStop(0.55, '#a33a5a');
  sky.addColorStop(1, '#f07a3a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, 540);
  ctx.save();
  ctx.globalAlpha = 0.5;
  sunRays(ctx, W / 2, 320, t, 'rgba(0,0,0,0)', '#ffc65a', 20, 900);
  ctx.restore();
  const glow = ctx.createRadialGradient(W / 2, 320, 60, W / 2, 320, 330);
  glow.addColorStop(0, 'rgba(255,240,190,0.95)');
  glow.addColorStop(1, 'rgba(255,150,90,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, 540);
  ctx.fillStyle = VERMILION;
  ctx.beginPath();
  ctx.arc(W / 2, 300, 150, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,214,120,0.3)';
  for (let i = 0; i < 6; i++) ctx.fillRect(W / 2 - 150, 330 + i * 18 + ((t * 10) % 18), 300, 3 + i);
  // Hanging lanterns in the corners.
  lantern(ctx, 70, 0, t, 1.2, '祝', 26);
  lantern(ctx, W - 70, 0, t + 1.4, 1.2, '寿', 26);
}

/** Black lacquer tray with a vermilion rim, on two little feet. */
function drawTray(ctx: CanvasRenderingContext2D, cx: number, top: number): void {
  const w = 300;
  const h = 18;
  ctx.save();
  ctx.fillStyle = 'rgba(30,8,4,0.45)';
  ctx.beginPath();
  ctx.ellipse(cx, top + h + 22, w * 0.55, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a0a0a';
  ctx.fillRect(cx - w / 2 + 30, top + h, 30, 18);
  ctx.fillRect(cx + w / 2 - 60, top + h, 30, 18);
  ctx.fillStyle = VERMILION;
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, top, w, h, 6);
  ctx.fill();
  ctx.fillStyle = '#1a0a0a';
  ctx.beginPath();
  ctx.roundRect(cx - w / 2 + 6, top + 4, w - 12, h - 7, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,220,200,0.35)';
  ctx.fillRect(cx - w / 2 + 14, top + 5, w - 28, 2);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, top, w, h, 6);
  ctx.stroke();
  // A sprig of decorative leaf (baran) on the tray.
  ctx.fillStyle = '#3fae4a';
  ctx.beginPath();
  ctx.moveTo(cx + 92, top + 2);
  ctx.lineTo(cx + 140, top - 16);
  ctx.lineTo(cx + 132, top + 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

/** The sale as a paper receipt that slides up, with a red stamp once the count finishes. */
function drawReceipt(ctx: CanvasRenderingContext2D, age: number, sold: string, totalLine: string, stampAge: number): void {
  const k = Math.min(1, age / 0.2);
  const ease = 1 - Math.pow(1 - k, 3);
  const w = 470;
  const h = 76;
  const cy = RECEIPT_Y + (1 - ease) * 60;
  ctx.save();
  ctx.translate(W / 2, cy);
  ctx.rotate(-0.015);
  ctx.globalAlpha *= ease;
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(-w / 2, -h / 2);
    ctx.lineTo(w / 2, -h / 2);
    ctx.lineTo(w / 2, h / 2 - 6);
    // Torn zigzag bottom edge.
    for (let x = w / 2, i = 0; x >= -w / 2; x -= 6, i++) ctx.lineTo(x, h / 2 + (i % 2 ? 4 : -2));
    ctx.lineTo(-w / 2, h / 2 - 6);
    ctx.closePath();
  };
  ctx.save();
  ctx.translate(5, 5);
  path();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fill();
  ctx.restore();
  path();
  ctx.fillStyle = PAPER;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(26,10,10,0.25)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(-w / 2 + 16, 4); ctx.lineTo(w / 2 - 16, 4); ctx.stroke();
  ctx.setLineDash([]);
  inkText(ctx, sold, -14, -16, 28, '#8a1a10');
  inkText(ctx, totalLine, -14, 22, 24, INK);
  if (stampAge >= 0) {
    const s = Math.min(1, stampAge / 0.12);
    const scale = 2.2 - 1.2 * (1 - Math.pow(1 - s, 3));
    ctx.save();
    ctx.translate(w / 2 - 40, 6);
    ctx.scale(scale, scale);
    hanko(ctx, 0, 0, 50, '売', Math.min(1, s * 1.5) * 0.92, 0.2, true);
    ctx.restore();
  }
  ctx.restore();
}

// ---------- timeout and knockout ----------

function drawDusk(ctx: CanvasRenderingContext2D, t: number): void {
  duskSky(ctx, t, HORIZON, 700, 80);
  duskSea(ctx, t, HORIZON, RAIL_Y + 20, 700);
  // Rail and deck, as on the fight stage, a little darker: the mood has turned.
  const bob = Math.sin(t * 1.1) * 2;
  const top = RAIL_Y + bob;
  const g = ctx.createLinearGradient(0, top, 0, FLOOR_Y);
  g.addColorStop(0, '#6b3a1e');
  g.addColorStop(1, '#3a1d0e');
  ctx.fillStyle = g;
  ctx.fillRect(0, top + 22, W, FLOOR_Y - top - 22);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  for (let y = top + 36; y < FLOOR_Y; y += 14) ctx.fillRect(0, y, W, 2);
  for (let x = 20; x < W; x += 96) {
    ctx.fillStyle = '#4a2612';
    ctx.fillRect(x, top, 12, FLOOR_Y - top);
    ctx.fillStyle = 'rgba(255,200,140,0.18)';
    ctx.fillRect(x, top, 3, FLOOR_Y - top);
  }
  ctx.fillStyle = '#8a4e28';
  ctx.fillRect(0, top, W, 12);
  ctx.fillStyle = '#c07a44';
  ctx.fillRect(0, top, W, 3);
  ctx.fillStyle = '#2a1408';
  ctx.fillRect(0, top + 12, W, 3);
  ctx.strokeStyle = '#d9c08a';
  ctx.lineWidth = 2;
  for (let x = 26; x < W; x += 96) {
    ctx.beginPath();
    ctx.moveTo(x, top + 26);
    ctx.quadraticCurveTo(x + 48, top + 40 + Math.sin(t * 1.4 + x) * 2, x + 96, top + 26);
    ctx.stroke();
  }
  deck(ctx, FLOOR_Y, 540);
  ctx.fillStyle = 'rgba(20,10,40,0.28)';
  ctx.fillRect(0, 0, W, 540);
}

/** The loss banner on a hanging scroll that unrolls from the top. */
function drawBannerScroll(
  ctx: CanvasRenderingContext2D, t: number, banner: string, sub: string, size: number, color: string,
): void {
  ctx.save();
  ctx.font = `${size}px Impact, 'Arial Black', sans-serif`;
  const bw = ctx.measureText(banner).width;
  ctx.font = "30px Impact, 'Arial Black', sans-serif";
  const sw = ctx.measureText(sub).width;
  ctx.restore();
  const w = Math.min(900, Math.max(bw + 110, sw + 170));
  const top = 34;
  const h = 210;
  const k = Math.min(1, t / UNROLL);
  const ease = 1 - Math.pow(1 - k, 3);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, top + 12 + h * ease);
  ctx.clip();
  hangingScroll(ctx, W / 2, top, w, h, 8);
  ctx.restore();
  drawSlamText(ctx, banner, W / 2, 110, t, { size, color });
  if (t > UNROLL) inkText(ctx, sub, W / 2, 200, 30, INK);
  if (t > UNROLL + 0.25) hanko(ctx, W / 2 + w / 2 - 46, 196, 36, '無念', 0.9, 0.15);
}
