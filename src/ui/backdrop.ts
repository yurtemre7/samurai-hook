// Shared sunset backdrop: sky, striped sun, clouds, the far sea with the sun's
// reflection and wave crests, plus small Japanese decorations. Used by both the
// fight stage and the ocean scene so the two cannot drift apart.
// Every function is pure drawing, animated by `t` (seconds).

/** Sky gradient, top to horizon. */
export const SUNSET_SKY = ['#1c0f3a', '#4a1d5c', '#a33a5a', '#f07a3a', '#ffc65a'];
/** Far-sea gradient stops, horizon to foreground. */
export const SUNSET_SEA = ['#5a3a7a', '#2a2a6a', '#101a40'];
/** Silhouette colour for distant shapes on the horizon. */
const DISTANT = '#2a1440';

/** Sky height the fight stage was designed at; other heights scale star and cloud rows. */
const REF_SKY_H = 262;
/** Sun radius the stripe spacing was designed at. */
const REF_SUN_R = 92;

interface Cloud { x: number; y: number; w: number; speed: number }
const CLOUDS: Cloud[] = [
  { x: 120, y: 92, w: 220, speed: 6 },
  { x: 520, y: 60, w: 300, speed: 4 },
  { x: 800, y: 150, w: 180, speed: 8 },
  { x: 330, y: 190, w: 260, speed: 5 },
];

export interface SkyOpts {
  width: number;
  /** Screen y where the sky gradient starts (0 on a fixed stage; scrolls in the ocean). */
  top: number;
  horizonY: number;
  sunX: number;
  sunR: number;
}

export function drawSunsetSky(ctx: CanvasRenderingContext2D, t: number, o: SkyOpts): void {
  const { width: W, top, horizonY: HY, sunX, sunR } = o;
  const s = (HY - top) / REF_SKY_H;
  const k = sunR / REF_SUN_R;
  const g = ctx.createLinearGradient(0, top, 0, HY);
  SUNSET_SKY.forEach((c, i) => g.addColorStop(i / (SUNSET_SKY.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(0, top, W, HY - top);

  // A few stars still visible high up.
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 26; i++) {
    const x = (i * 337) % W;
    const y = top + ((i * 53) % 110) * s;
    ctx.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(t * 1.3 + i));
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.globalAlpha = 1;

  // Sun glow.
  const sunY = HY - 30 * k;
  const glow = ctx.createRadialGradient(sunX, sunY, sunR * 0.6, sunX, sunY, sunR * 3.2);
  glow.addColorStop(0, 'rgba(255,214,120,0.55)');
  glow.addColorStop(1, 'rgba(255,140,80,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, top, W, HY - top);

  // Retro striped sun, sitting on the horizon.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, top, W, HY - top);
  ctx.clip();
  const sg = ctx.createLinearGradient(0, sunY - sunR, 0, HY);
  sg.addColorStop(0, '#fff2b0');
  sg.addColorStop(0.6, '#ffb347');
  sg.addColorStop(1, '#ff5e3a');
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();
  // Horizontal cuts across the lower half, drifting slowly downward.
  ctx.fillStyle = SUNSET_SKY[3];
  for (let i = 0; i < 6; i++) {
    const y = HY - 72 * k + i * 13 * k + ((t * 6 * k) % (13 * k));
    ctx.fillRect(sunX - sunR, y, sunR * 2, (2 + i * 0.9) * k);
  }
  ctx.restore();

  // Long thin clouds drifting across.
  for (const c of CLOUDS) {
    const x = ((c.x + t * c.speed) % (W + c.w)) - c.w / 2;
    const y = top + c.y * s;
    ctx.fillStyle = 'rgba(60,20,70,0.45)';
    roundBar(ctx, x, y, c.w, 9);
    ctx.fillStyle = 'rgba(255,170,120,0.35)';
    roundBar(ctx, x + 18, y - 5, c.w * 0.6, 5);
  }
}

export function roundBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.beginPath();
  ctx.moveTo(x + h / 2, y);
  ctx.lineTo(x + w - h / 2, y);
  ctx.arc(x + w - h / 2, y + h / 2, h / 2, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(x + h / 2, y + h);
  ctx.arc(x + h / 2, y + h / 2, h / 2, Math.PI / 2, -Math.PI / 2);
  ctx.fill();
}

export interface SeaOpts {
  width: number;
  horizonY: number;
  /** Bottom of the filled sea band. */
  bottomY: number;
  /** Where the nearest wave crest row sits. */
  crestY: number;
  sunX: number;
  sunR: number;
  waveRows: number;
  glintRows: number;
}

/** The far sea under a sunset: gradient, broken sun reflection, wave crests, horizon line. */
export function drawSunsetSea(ctx: CanvasRenderingContext2D, t: number, o: SeaOpts): void {
  const { width: W, horizonY: HY, bottomY, crestY, sunX, sunR } = o;
  const g = ctx.createLinearGradient(0, HY, 0, bottomY);
  g.addColorStop(0, SUNSET_SEA[0]);
  g.addColorStop(0.35, SUNSET_SEA[1]);
  g.addColorStop(1, SUNSET_SEA[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, HY, W, bottomY - HY);

  // Sun reflection: broken horizontal glints below the sun.
  for (let i = 0; i < o.glintRows; i++) {
    const y = HY + 4 + i * 9;
    const w = (sunR * 1.6) * (1 - i / 14) * (0.6 + 0.4 * Math.sin(t * 2.2 + i * 1.7));
    ctx.fillStyle = `rgba(255,200,110,${0.55 - i * 0.04})`;
    ctx.fillRect(sunX - w / 2 + Math.sin(t * 1.5 + i) * 8, y, w, 3);
  }

  // Rows of wave crests, faster and bigger toward the viewer.
  drawWaveCrests(ctx, t, W, HY + 10, crestY, o.waveRows);

  // Horizon line.
  ctx.fillStyle = 'rgba(255,210,150,0.7)';
  ctx.fillRect(0, HY - 1, W, 2);
}

/** Pale wave-crest rows between y0 (far, small) and y1 (near, big). */
export function drawWaveCrests(
  ctx: CanvasRenderingContext2D, t: number, W: number, y0: number, y1: number, rows: number, alpha = 1,
): void {
  ctx.lineWidth = 2;
  for (let r = 0; r < rows; r++) {
    const k = rows > 1 ? r / (rows - 1) : 1;
    const y = y0 + k * k * (y1 - y0);
    const amp = 1.5 + k * 4;
    const len = 40 + k * 70;
    const speed = 10 + k * 26;
    ctx.strokeStyle = `rgba(170,190,255,${(0.15 + k * 0.2) * alpha})`;
    ctx.beginPath();
    for (let x = -len; x <= W + len; x += 8) {
      const yy = y + Math.sin((x + t * speed * (r % 2 ? 1 : -1)) / len * Math.PI * 2) * amp;
      if (x === -len) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
}

// ---------- Japanese touches ----------

/** A small rocky island with a windswept pine, sitting on the horizon. */
export function drawPineIsland(ctx: CanvasRenderingContext2D, x: number, horizonY: number, scale = 1): void {
  const p = Math.max(1, Math.round(2 * scale)); // pixel size
  const px = (cx: number, cy: number, w: number, h: number): void =>
    ctx.fillRect(Math.round(x + cx * p), Math.round(horizonY + cy * p), w * p, h * p);
  ctx.save();
  ctx.fillStyle = DISTANT;
  // Rock, wider at the waterline.
  px(-16, -3, 32, 3); px(-12, -5, 22, 2); px(-8, -7, 13, 2);
  // Trunk leaning right.
  px(-2, -12, 2, 5); px(-1, -16, 2, 4); px(0, -20, 2, 4);
  // Flat layered canopies, the classic matsu silhouette.
  px(-8, -14, 9, 2); px(-6, -15, 5, 1);
  px(-2, -19, 12, 2); px(0, -20, 7, 1);
  px(-3, -23, 9, 2); px(-1, -24, 5, 1);
  ctx.fillStyle = 'rgba(255,170,120,0.25)'; // sunset rim light
  px(-8, -7, 13, 1); px(-2, -20, 7, 1); px(-1, -24, 5, 1);
  ctx.restore();
}

/** A torii gate standing in the sea, in hazy vermilion. */
export function drawTorii(ctx: CanvasRenderingContext2D, x: number, horizonY: number, h = 26): void {
  const k = h / 26;
  const r = (cx: number, cy: number, w: number, hh: number): void =>
    ctx.fillRect(Math.round(x + cx * k), Math.round(horizonY + cy * k), Math.max(1, Math.round(w * k)), Math.max(1, Math.round(hh * k)));
  ctx.save();
  ctx.fillStyle = '#7a2638';
  r(-9, -22, 3, 22); r(6, -22, 3, 22);   // pillars (hashira)
  r(-12, -17, 24, 2);                    // tie beam (nuki)
  r(-13, -24, 26, 3);                    // top beam (kasagi)
  r(-15, -26, 4, 2); r(11, -26, 4, 2);   // upturned ends
  r(-1, -21, 2, 4);                      // centre strut (gakuzuka)
  ctx.fillStyle = 'rgba(255,190,130,0.35)';
  r(-13, -24, 26, 1);
  ctx.restore();
}

/**
 * A tile of seigaiha (overlapping wave scallops), `rows` scallop rows tall,
 * repeating every `r` px vertically. Returns null outside a browser.
 */
export function makeSeigaiha(w: number, h: number, r: number, bg: string, line: string): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h + 2 * r;
  const g = c.getContext('2d');
  if (!g) return null;
  g.lineWidth = 1;
  const rows = Math.ceil(c.height / (r / 2)) + 2;
  for (let j = -1; j < rows; j++) {
    const cy = j * (r / 2);
    const off = (j & 1) ? r : 0;
    for (let cx = -2 * r + off; cx <= w + r; cx += 2 * r) {
      g.fillStyle = bg;
      g.beginPath(); g.arc(cx, cy, r, Math.PI, 0); g.lineTo(cx + r, cy + r); g.lineTo(cx - r, cy + r); g.closePath(); g.fill();
      g.strokeStyle = line;
      for (const f of [1, 0.7, 0.4]) {
        g.beginPath(); g.arc(cx, cy, r * f - 0.5, Math.PI, 0); g.stroke();
      }
    }
  }
  return c;
}
