// The fight stage: a boat deck at sea at sunset. Drawn entirely in code.
// Everything here is cosmetic and animated by `t` (seconds).

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

const SKY = ['#1c0f3a', '#4a1d5c', '#a33a5a', '#f07a3a', '#ffc65a'];

interface Cloud { x: number; y: number; w: number; speed: number }
const CLOUDS: Cloud[] = [
  { x: 120, y: 92, w: 220, speed: 6 },
  { x: 520, y: 60, w: 300, speed: 4 },
  { x: 800, y: 150, w: 180, speed: 8 },
  { x: 330, y: 190, w: 260, speed: 5 },
];

export function drawStage(ctx: CanvasRenderingContext2D, t: number, floorY: number, height: number): void {
  drawSky(ctx, t);
  drawSea(ctx, t);
  drawRail(ctx, t);
  drawDeck(ctx, floorY, height);
  drawMast(ctx, t, floorY);
}

function drawSky(ctx: CanvasRenderingContext2D, t: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, HORIZON_Y);
  SKY.forEach((c, i) => g.addColorStop(i / (SKY.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, HORIZON_Y);

  // A few stars still visible high up.
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 26; i++) {
    const x = (i * 337) % W;
    const y = (i * 53) % 110;
    ctx.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(t * 1.3 + i));
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.globalAlpha = 1;

  // Sun glow.
  const glow = ctx.createRadialGradient(SUN_X, HORIZON_Y - 30, SUN_R * 0.6, SUN_X, HORIZON_Y - 30, SUN_R * 3.2);
  glow.addColorStop(0, 'rgba(255,214,120,0.55)');
  glow.addColorStop(1, 'rgba(255,140,80,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, HORIZON_Y);

  // Retro striped sun, sitting on the horizon.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, HORIZON_Y);
  ctx.clip();
  const sg = ctx.createLinearGradient(0, HORIZON_Y - 30 - SUN_R, 0, HORIZON_Y);
  sg.addColorStop(0, '#fff2b0');
  sg.addColorStop(0.6, '#ffb347');
  sg.addColorStop(1, '#ff5e3a');
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.arc(SUN_X, HORIZON_Y - 30, SUN_R, 0, Math.PI * 2);
  ctx.fill();
  // Horizontal cuts across the lower half, drifting slowly downward.
  ctx.fillStyle = SKY[3];
  for (let i = 0; i < 6; i++) {
    const y = HORIZON_Y - 72 + i * 13 + ((t * 6) % 13);
    ctx.fillRect(SUN_X - SUN_R, y, SUN_R * 2, 2 + i * 0.9);
  }
  ctx.restore();

  // Long thin clouds drifting across.
  for (const c of CLOUDS) {
    const x = ((c.x + t * c.speed) % (W + c.w)) - c.w / 2;
    ctx.fillStyle = 'rgba(60,20,70,0.45)';
    roundBar(ctx, x, c.y, c.w, 9);
    ctx.fillStyle = 'rgba(255,170,120,0.35)';
    roundBar(ctx, x + 18, c.y - 5, c.w * 0.6, 5);
  }
}

function roundBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.beginPath();
  ctx.moveTo(x + h / 2, y);
  ctx.lineTo(x + w - h / 2, y);
  ctx.arc(x + w - h / 2, y + h / 2, h / 2, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(x + h / 2, y + h);
  ctx.arc(x + h / 2, y + h / 2, h / 2, Math.PI / 2, -Math.PI / 2);
  ctx.fill();
}

function drawSea(ctx: CanvasRenderingContext2D, t: number): void {
  const g = ctx.createLinearGradient(0, HORIZON_Y, 0, RAIL_Y + 20);
  g.addColorStop(0, '#5a3a7a');
  g.addColorStop(0.35, '#2a2a6a');
  g.addColorStop(1, '#101a40');
  ctx.fillStyle = g;
  ctx.fillRect(0, HORIZON_Y, W, RAIL_Y + 20 - HORIZON_Y);

  // Sun reflection: broken horizontal glints below the sun.
  for (let i = 0; i < 12; i++) {
    const y = HORIZON_Y + 4 + i * 9;
    const w = (SUN_R * 1.6) * (1 - i / 14) * (0.6 + 0.4 * Math.sin(t * 2.2 + i * 1.7));
    ctx.fillStyle = `rgba(255,200,110,${0.55 - i * 0.04})`;
    ctx.fillRect(SUN_X - w / 2 + Math.sin(t * 1.5 + i) * 8, y, w, 3);
  }

  // Rows of wave crests, faster and bigger toward the viewer.
  ctx.lineWidth = 2;
  for (let r = 0; r < WAVE_ROWS; r++) {
    const k = r / (WAVE_ROWS - 1);
    const y = HORIZON_Y + 10 + k * k * (RAIL_Y - HORIZON_Y - 10);
    const amp = 1.5 + k * 4;
    const len = 40 + k * 70;
    const speed = 10 + k * 26;
    ctx.strokeStyle = `rgba(170,190,255,${0.15 + k * 0.2})`;
    ctx.beginPath();
    for (let x = -len; x <= W + len; x += 8) {
      const yy = y + Math.sin((x + t * speed * (r % 2 ? 1 : -1)) / len * Math.PI * 2) * amp;
      if (x === -len) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }

  // Horizon line.
  ctx.fillStyle = 'rgba(255,210,150,0.7)';
  ctx.fillRect(0, HORIZON_Y - 1, W, 2);
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
