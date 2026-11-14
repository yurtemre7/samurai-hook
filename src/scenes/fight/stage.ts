// The fight stage: a boat deck at sea at sunset. Drawn entirely in code.
// Everything here is cosmetic and animated by `t` (seconds).
// Sky, sun and far sea are shared with the ocean scene (src/ui/backdrop.ts).
import { drawSunsetSea, drawSunsetSky } from '../../ui/backdrop';

const W = 960;

/** Screen y of the sea horizon. */
export const HORIZON_Y = 262;
/** Screen y of the top of the deck rail (the sea is visible above it). */
const RAIL_Y = 372;
const SUN_X = 610;
const SUN_R = 92;
const MAST_X = 34;
const WAVE_ROWS = 7;
const PLANK_H = 17;

export function drawStage(ctx: CanvasRenderingContext2D, t: number, floorY: number, height: number): void {
  drawSunsetSky(ctx, t, { width: W, top: 0, horizonY: HORIZON_Y, sunX: SUN_X, sunR: SUN_R });
  drawSunsetSea(ctx, t, {
    width: W, horizonY: HORIZON_Y, bottomY: RAIL_Y + 20, crestY: RAIL_Y,
    sunX: SUN_X, sunR: SUN_R, waveRows: WAVE_ROWS, glintRows: 12,
  });
  drawRail(ctx, t);
  drawDeck(ctx, floorY, height);
  drawMast(ctx, t, floorY);
}

function drawRail(ctx: CanvasRenderingContext2D, t: number): void {
  // The boat gently rolls: the rail bobs a couple of pixels.
  const bob = Math.sin(t * 1.1) * 2;
  const top = RAIL_Y + bob;
  // Bulwark planks behind the fighters.
  const g = ctx.createLinearGradient(0, top, 0, 440);
  g.addColorStop(0, '#6b3a1e');
  g.addColorStop(1, '#3a1d0e');
  ctx.fillStyle = g;
  ctx.fillRect(0, top + 22, W, 440 - top - 22);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  for (let y = top + 36; y < 440; y += 14) ctx.fillRect(0, y, W, 2);
  // Posts.
  for (let x = 20; x < W; x += 96) {
    ctx.fillStyle = '#4a2612';
    ctx.fillRect(x, top, 12, 440 - top);
    ctx.fillStyle = 'rgba(255,200,140,0.18)';
    ctx.fillRect(x, top, 3, 440 - top);
  }
  // Top rail.
  ctx.fillStyle = '#8a4e28';
  ctx.fillRect(0, top, W, 12);
  ctx.fillStyle = '#c07a44';
  ctx.fillRect(0, top, W, 3);
  ctx.fillStyle = '#2a1408';
  ctx.fillRect(0, top + 12, W, 3);
  // Rope swag between posts.
  ctx.strokeStyle = '#d9c08a';
  ctx.lineWidth = 2;
  for (let x = 26; x < W; x += 96) {
    ctx.beginPath();
    ctx.moveTo(x, top + 26);
    ctx.quadraticCurveTo(x + 48, top + 40 + Math.sin(t * 1.4 + x) * 2, x + 96, top + 26);
    ctx.stroke();
  }
}

function drawDeck(ctx: CanvasRenderingContext2D, floorY: number, height: number): void {
  const g = ctx.createLinearGradient(0, floorY, 0, height);
  g.addColorStop(0, '#b8743f');
  g.addColorStop(1, '#5a3018');
  ctx.fillStyle = g;
  ctx.fillRect(0, floorY, W, height - floorY);
  // Plank seams with staggered butt joints.
  for (let row = 0, y = floorY; y < height; row++, y += PLANK_H + row) {
    ctx.fillStyle = 'rgba(40,18,6,0.55)';
    ctx.fillRect(0, y, W, 2);
    ctx.fillStyle = 'rgba(255,220,170,0.12)';
    ctx.fillRect(0, y + 2, W, 1);
    const off = (row * 173) % 240;
    for (let x = off; x < W; x += 240) {
      ctx.fillStyle = 'rgba(40,18,6,0.5)';
      ctx.fillRect(x, y, 2, PLANK_H + row);
      ctx.fillStyle = '#2a1408';
      ctx.fillRect(x + 8, y + 6, 3, 3); // nail
    }
  }
  // Deck edge highlight where the fighters stand.
  ctx.fillStyle = '#e0a060';
  ctx.fillRect(0, floorY, W, 3);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(0, floorY + 3, W, 3);
}

function drawMast(ctx: CanvasRenderingContext2D, t: number, floorY: number): void {
  // Mast on the left edge with a yard and two swinging lanterns along a rope.
  const mg = ctx.createLinearGradient(MAST_X - 12, 0, MAST_X + 12, 0);
  mg.addColorStop(0, '#3a1d0e');
  mg.addColorStop(0.5, '#7a4422');
  mg.addColorStop(1, '#2a1408');
  ctx.fillStyle = mg;
  ctx.fillRect(MAST_X - 12, 0, 24, floorY);
  ctx.fillStyle = '#5a3018';
  ctx.fillRect(MAST_X - 30, 120, 60, 10);

  // Rope from the mast to off-screen right, sagging.
  ctx.strokeStyle = '#2a1a10';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(MAST_X, 130);
  ctx.quadraticCurveTo(480, 230, W + 10, 110);
  ctx.stroke();

  const lanterns = [0.22, 0.48, 0.76];
  lanterns.forEach((u, i) => {
    // Point on the quadratic rope.
    const x = (1 - u) * (1 - u) * MAST_X + 2 * (1 - u) * u * 480 + u * u * (W + 10);
    const y = (1 - u) * (1 - u) * 130 + 2 * (1 - u) * u * 230 + u * u * 110;
    const swing = Math.sin(t * 1.6 + i * 1.3) * 0.18;
    drawLantern(ctx, x, y, swing, t + i);
  });
}

function drawLantern(ctx: CanvasRenderingContext2D, x: number, y: number, swing: number, t: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(swing);
  const flick = 0.85 + 0.15 * Math.sin(t * 9) * Math.sin(t * 5.3);
  const glow = ctx.createRadialGradient(0, 30, 4, 0, 30, 70);
  glow.addColorStop(0, `rgba(255,170,80,${0.5 * flick})`);
  glow.addColorStop(1, 'rgba(255,120,60,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-70, -40, 140, 140);
  ctx.strokeStyle = '#2a1a10';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 12); ctx.stroke();
  ctx.fillStyle = '#1a0a05';
  ctx.fillRect(-9, 10, 18, 4);
  ctx.fillRect(-9, 46, 18, 4);
  ctx.fillStyle = `rgb(${Math.round(230 * flick)},${Math.round(70 * flick)},40)`;
  ctx.beginPath();
  ctx.ellipse(0, 30, 15, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(255,220,140,${0.6 * flick})`;
  ctx.beginPath();
  ctx.ellipse(-4, 26, 5, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(60,10,10,0.6)';
  ctx.lineWidth = 1;
  for (const yy of [22, 30, 38]) {
    ctx.beginPath(); ctx.moveTo(-14, yy); ctx.lineTo(14, yy); ctx.stroke();
  }
  ctx.restore();
}
