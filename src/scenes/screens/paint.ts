// Shared painting helpers for the shop, cutscene and result screens.
// Same palette and chunky style as the fight stage (src/scenes/fight/stage.ts),
// drawn locally so the screens do not depend on the fight or ocean modules.

export const W = 960;
export const KANJI_FONT = "'Hiragino Mincho ProN', 'Yu Mincho', 'Noto Serif JP', serif";
export const INK = '#1a0a0a';
export const GOLD = '#ffdd22';
export const PAPER = '#f3e6c4';
export const VERMILION = '#c8281e';

/** Dusk palette, top to bottom (matches the fight stage sky). */
export const SKY = ['#1c0f3a', '#4a1d5c', '#a33a5a', '#f07a3a', '#ffc65a'];

/** Fish id -> kanji, for banners and emblems. */
export const FISH_KANJI: Record<string, string> = {
  sardine: '鰯', mackerel: '鯖', piranha: '牙魚', eel: '鰻', pufferfish: '河豚',
  swordfish: '旗魚', anglerfish: '鮟鱇', shark: '鮫', squid: '烏賊',
};

/** Swap a trailing gold unit ("12 G") for the ryo used on these screens. */
export function ryo(s: string): string {
  return s.replace(/(\d+)\s*G\b/g, '$1 RYO');
}

/** Draw kanji in a mincho face, optionally outlined. */
export function kanji(
  ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number,
  color: string, outline?: string, weight = 'bold',
): void {
  ctx.save();
  ctx.font = `${weight} ${size}px ${KANJI_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (outline) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, size / 7);
    ctx.strokeStyle = outline;
    ctx.strokeText(s, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
  ctx.restore();
}

/** Vertical kanji column, centred on (x, y). */
export function kanjiColumn(
  ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, outline?: string,
): void {
  const chars = [...s];
  const step = size * 1.05;
  const top = y - ((chars.length - 1) * step) / 2;
  chars.forEach((c, i) => kanji(ctx, c, x, top + i * step, size, color, outline));
}

/** Plain ink text (no outline), for writing on paper and wood. */
export function inkText(
  ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number,
  color = INK, align: CanvasTextAlign = 'center', font = "Impact, 'Arial Black', sans-serif",
): void {
  ctx.save();
  ctx.font = `${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
  ctx.restore();
}

/** Split text into at most `max` lines that fit `width` in the given font. */
export function wrap(ctx: CanvasRenderingContext2D, s: string, width: number, font: string, max = 2): string[] {
  ctx.save();
  ctx.font = font;
  const words = s.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width > width && cur) { lines.push(cur); cur = w; } else cur = next;
  }
  if (cur) lines.push(cur);
  ctx.restore();
  if (lines.length > max) return [...lines.slice(0, max - 1), lines.slice(max - 1).join(' ')];
  return lines;
}

// ---------- sky, sun, sea ----------

export function duskSky(ctx: CanvasRenderingContext2D, t: number, horizon: number, sunX = 610, sunR = 92): void {
  const g = ctx.createLinearGradient(0, 0, 0, horizon);
  SKY.forEach((c, i) => g.addColorStop(i / (SKY.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, horizon);
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 26; i++) {
    ctx.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(t * 1.3 + i));
    ctx.fillRect((i * 337) % W, (i * 53) % Math.max(40, horizon * 0.4), 2, 2);
  }
  ctx.globalAlpha = 1;
  if (sunR <= 0) return;
  const cy = horizon - sunR * 0.33;
  const glow = ctx.createRadialGradient(sunX, cy, sunR * 0.6, sunX, cy, sunR * 3.2);
  glow.addColorStop(0, 'rgba(255,214,120,0.55)');
  glow.addColorStop(1, 'rgba(255,140,80,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, horizon);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, horizon);
  ctx.clip();
  const sg = ctx.createLinearGradient(0, cy - sunR, 0, horizon);
  sg.addColorStop(0, '#fff2b0');
  sg.addColorStop(0.6, '#ffb347');
  sg.addColorStop(1, '#ff5e3a');
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.arc(sunX, cy, sunR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = SKY[3];
  for (let i = 0; i < 6; i++) {
    const y = cy + sunR * 0.2 + i * (sunR / 7) + ((t * 6) % (sunR / 7));
    ctx.fillRect(sunX - sunR, y, sunR * 2, 2 + i * 0.9);
  }
  ctx.restore();
}

export function duskSea(ctx: CanvasRenderingContext2D, t: number, top: number, bottom: number, sunX = 610): void {
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, '#5a3a7a');
  g.addColorStop(0.35, '#2a2a6a');
  g.addColorStop(1, '#101a40');
  ctx.fillStyle = g;
  ctx.fillRect(0, top, W, bottom - top);
  for (let i = 0; i < 10; i++) {
    const y = top + 4 + i * 9;
    if (y > bottom) break;
    const w = 150 * (1 - i / 12) * (0.6 + 0.4 * Math.sin(t * 2.2 + i * 1.7));
    ctx.fillStyle = `rgba(255,200,110,${0.5 - i * 0.04})`;
    ctx.fillRect(sunX - w / 2 + Math.sin(t * 1.5 + i) * 8, y, w, 3);
  }
  ctx.lineWidth = 2;
  const rows = 6;
  for (let r = 0; r < rows; r++) {
    const k = r / (rows - 1);
    const y = top + 10 + k * k * (bottom - top - 16);
    const amp = 1.5 + k * 4;
    const len = 40 + k * 70;
    const speed = 10 + k * 26;
    ctx.strokeStyle = `rgba(170,190,255,${0.15 + k * 0.2})`;
    ctx.beginPath();
    for (let x = -len; x <= W + len; x += 8) {
      const yy = y + Math.sin(((x + t * speed * (r % 2 ? 1 : -1)) / len) * Math.PI * 2) * amp;
      if (x === -len) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,210,150,0.7)';
  ctx.fillRect(0, top - 1, W, 2);
}

/** Rising-sun rays around (cx, cy), alternating two colours, slowly turning. */
export function sunRays(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, t: number, a: string, b: string, n = 16, r = 1400,
): void {
  ctx.save();
  ctx.fillStyle = a;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = b;
  const step = (Math.PI * 2) / n;
  const rot = t * 0.12;
  for (let i = 0; i < n; i++) {
    const a0 = rot + i * step;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, a0, a0 + step / 2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// ---------- patterns ----------

const patternCache = new Map<string, CanvasPattern | null>();

/** Seigaiha (overlapping wave scallops) pattern tile, cached per colour pair. */
export function seigaiha(ctx: CanvasRenderingContext2D, r: number, bg: string, line: string): CanvasPattern | null {
  const key = `${r}|${bg}|${line}`;
  if (patternCache.has(key)) return patternCache.get(key)!;
  const c = document.createElement('canvas');
  c.width = r * 2;
  c.height = r;
  const p = c.getContext('2d');
  if (!p) { patternCache.set(key, null); return null; }
  p.fillStyle = bg;
  p.fillRect(0, 0, c.width, c.height);
  p.lineWidth = Math.max(1, r / 9);
  const rings = 4;
  for (let j = -4; j <= 4; j++) {
    const y = j * (r / 2);
    for (let i = -1; i <= 2; i++) {
      const x = i * 2 * r + (j % 2 ? r : 0);
      for (let k = 0; k < rings; k++) {
        const rr = r * (1 - k / rings) - p.lineWidth / 2;
        if (rr <= 0) continue;
        p.beginPath();
        p.arc(x, y + r, rr, Math.PI, Math.PI * 2);
        p.fillStyle = bg;
        if (k === 0) p.fill();
        p.strokeStyle = line;
        p.stroke();
      }
    }
  }
  const pat = ctx.createPattern(c, 'repeat');
  patternCache.set(key, pat);
  return pat;
}

/** Fill a rect with a pattern, scrolled by (ox, oy). */
export function fillPattern(
  ctx: CanvasRenderingContext2D, pat: CanvasPattern | null, x: number, y: number, w: number, h: number,
  alpha = 1, ox = 0, oy = 0,
): void {
  if (!pat) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.translate(ox, oy);
  ctx.fillStyle = pat;
  ctx.fillRect(x - ox, y - oy, w, h);
  ctx.restore();
}

// ---------- wood, paper, ink ----------

/** A chunky wooden plank or board with grain lines and a dark outline. */
export function wood(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  base = '#8a4e28', seed = 0, outline = true,
): void {
  ctx.save();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, shade(base, 0.18));
  g.addColorStop(1, shade(base, -0.25));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.strokeStyle = 'rgba(40,18,6,0.28)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < Math.max(2, h / 9); i++) {
    const yy = y + 5 + i * 9 + ((seed * 7 + i * 3) % 5);
    ctx.beginPath();
    ctx.moveTo(x, yy);
    for (let xx = x; xx <= x + w; xx += 12) ctx.lineTo(xx, yy + Math.sin((xx + seed * 31 + i * 17) / 23) * 1.6);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,220,170,0.22)';
  ctx.fillRect(x, y, w, 3);
  ctx.restore();
  if (outline) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  }
}

/** Lighten (k > 0) or darken (k < 0) a #rrggbb colour. */
export function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k));
  return `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

/** Horizontal paper scroll with wooden rollers on both ends. */
export function scroll(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, paper = PAPER): void {
  const x = cx - w / 2;
  const y = cy - h / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(x + 6, y + 6, w, h);
  ctx.fillStyle = paper;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(160,110,60,0.18)';
  ctx.fillRect(x, y + h - 6, w, 6);
  ctx.fillRect(x, y, w, 3);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, h);
  for (const rx of [x - 8, x + w - 6]) {
    ctx.fillStyle = '#5a3018';
    ctx.fillRect(rx, y - 8, 14, h + 16);
    ctx.fillStyle = '#c07a44';
    ctx.fillRect(rx + 3, y - 8, 3, h + 16);
    ctx.strokeStyle = INK;
    ctx.strokeRect(rx, y - 8, 14, h + 16);
    ctx.fillStyle = INK;
    ctx.fillRect(rx + 2, y - 14, 10, 6);
    ctx.fillRect(rx + 2, y + h + 8, 10, 6);
  }
  ctx.restore();
}

/** Hanging scroll (kakejiku): brocade border, paper centre, wooden rods. */
export function hangingScroll(
  ctx: CanvasRenderingContext2D, cx: number, top: number, w: number, h: number, nailY: number,
): void {
  const x = cx - w / 2;
  ctx.save();
  ctx.strokeStyle = '#2a1a10';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 30, top);
  ctx.lineTo(cx, nailY);
  ctx.lineTo(x + w - 30, top);
  ctx.stroke();
  ctx.fillStyle = '#d9c08a';
  ctx.beginPath();
  ctx.arc(cx, nailY, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(x + 8, top + 8, w, h);
  ctx.fillStyle = '#2c2a5a';
  ctx.fillRect(x, top, w, h);
  const pat = seigaiha(ctx, 12, '#2c2a5a', '#3f3c7a');
  fillPattern(ctx, pat, x, top, w, h);
  ctx.fillStyle = '#c9a24a';
  ctx.fillRect(x + 10, top + 12, w - 20, h - 24);
  ctx.fillStyle = PAPER;
  ctx.fillRect(x + 14, top + 16, w - 28, h - 32);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.strokeRect(x, top, w, h);
  for (const ry of [top - 6, top + h - 6]) {
    ctx.fillStyle = '#5a3018';
    ctx.fillRect(x - 12, ry, w + 24, 12);
    ctx.fillStyle = '#c07a44';
    ctx.fillRect(x - 12, ry + 2, w + 24, 2);
    ctx.strokeStyle = INK;
    ctx.strokeRect(x - 12, ry, w + 24, 12);
  }
  ctx.restore();
}

/** Red hanko seal: a rounded square with a kanji, optionally rotated. */
export function hanko(
  ctx: CanvasRenderingContext2D, x: number, y: number, size: number, glyph: string, alpha = 1, rot = 0, round = false,
): void {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = VERMILION;
  ctx.strokeStyle = '#7a0e08';
  ctx.lineWidth = Math.max(2, size / 14);
  ctx.beginPath();
  if (round) ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
  else ctx.roundRect(-size / 2, -size / 2, size, size, size * 0.14);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = Math.max(1.5, size / 22);
  ctx.beginPath();
  if (round) ctx.arc(0, 0, size * 0.4, 0, Math.PI * 2);
  else ctx.roundRect(-size * 0.4, -size * 0.4, size * 0.8, size * 0.8, size * 0.08);
  ctx.stroke();
  const chars = [...glyph];
  if (chars.length === 1) kanji(ctx, glyph, 0, size * 0.03, size * 0.6, PAPER);
  else kanjiColumn(ctx, glyph, 0, size * 0.03, size * 0.36, PAPER);
  ctx.restore();
}

/** A tapered, ragged ink brush stroke from (x1, y1) to (x2, y2). */
export function brush(
  ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, width: number, color = INK, seed = 1,
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const nx = -dy / len;
  const ny = dx / len;
  const steps = 28;
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    // Fat at the start, thinning to a dry tail.
    const taper = Math.pow(Math.sin(Math.min(1, u * 1.4 + 0.08) * Math.PI * 0.5), 0.6) * (1 - 0.65 * u * u);
    const jag = 1 + 0.12 * Math.sin(u * 47 + seed * 3) + 0.08 * Math.sin(u * 113 + seed);
    const hw = (width / 2) * taper * jag;
    const px = x1 + dx * u;
    const py = y1 + dy * u;
    left.push([px + nx * hw, py + ny * hw]);
    right.push([px - nx * hw, py - ny * hw]);
  }
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(left[0][0], left[0][1]);
  for (const [px, py] of left) ctx.lineTo(px, py);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
  ctx.closePath();
  ctx.fill();
  // Dry-brush streaks near the tail.
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  for (let k = -2; k <= 2; k++) {
    const off = (k / 2.5) * width * 0.35;
    ctx.beginPath();
    ctx.moveTo(x1 + dx * 0.7 + nx * off, y1 + dy * 0.7 + ny * off);
    ctx.lineTo(x1 + dx * (0.97 - Math.abs(k) * 0.03) + nx * off * 0.6, y1 + dy * (0.97 - Math.abs(k) * 0.03) + ny * off * 0.6);
    ctx.stroke();
  }
  ctx.restore();
}

/** Paper lantern (chochin) hanging from (x, y), swaying, with a glow and an optional kanji. */
export function lantern(
  ctx: CanvasRenderingContext2D, x: number, y: number, t: number, size = 1, glyph = '', cord = 12,
): void {
  const swing = Math.sin(t * 1.6) * 0.07;
  const flick = 0.85 + 0.15 * Math.sin(t * 9) * Math.sin(t * 5.3);
  const rw = 22 * size;
  const rh = 30 * size;
  const cy = cord + rh + 6 * size;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(swing);
  const glow = ctx.createRadialGradient(0, cy, 4, 0, cy, rh * 3.2);
  glow.addColorStop(0, `rgba(255,170,80,${0.5 * flick})`);
  glow.addColorStop(1, 'rgba(255,120,60,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-rh * 3.2, cy - rh * 3.2, rh * 6.4, rh * 6.4);
  ctx.strokeStyle = '#2a1a10';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, cord + 2); ctx.stroke();
  ctx.fillStyle = INK;
  ctx.fillRect(-rw * 0.6, cord, rw * 1.2, 6 * size);
  ctx.fillRect(-rw * 0.6, cy + rh - 2 * size, rw * 1.2, 6 * size);
  ctx.fillStyle = `rgb(${Math.round(230 * flick)},${Math.round(70 * flick)},40)`;
  ctx.beginPath();
  ctx.ellipse(0, cy, rw, rh, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(255,220,140,${0.55 * flick})`;
  ctx.beginPath();
  ctx.ellipse(-rw * 0.3, cy - rh * 0.15, rw * 0.3, rh * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(60,10,10,0.55)';
  ctx.lineWidth = 1;
  for (let i = -3; i <= 3; i++) {
    const yy = cy + (i / 3.6) * rh;
    const hw = rw * Math.sqrt(Math.max(0, 1 - Math.pow((yy - cy) / rh, 2)));
    ctx.beginPath(); ctx.moveTo(-hw, yy); ctx.lineTo(hw, yy); ctx.stroke();
  }
  if (glyph) kanji(ctx, glyph, 0, cy + 1, rh * 0.9, INK);
  ctx.fillStyle = '#2a1a10';
  ctx.fillRect(-1.5 * size, cy + rh + 4 * size, 3 * size, 8 * size);
  ctx.restore();
}

/** Wooden deck planks from `top` down to `bottom`, like the fight stage floor. */
export function deck(ctx: CanvasRenderingContext2D, top: number, bottom: number): void {
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, '#b8743f');
  g.addColorStop(1, '#5a3018');
  ctx.fillStyle = g;
  ctx.fillRect(0, top, W, bottom - top);
  for (let row = 0, y = top; y < bottom; row++, y += 17 + row) {
    ctx.fillStyle = 'rgba(40,18,6,0.55)';
    ctx.fillRect(0, y, W, 2);
    ctx.fillStyle = 'rgba(255,220,170,0.12)';
    ctx.fillRect(0, y + 2, W, 1);
    const off = (row * 173) % 240;
    for (let x = off; x < W; x += 240) {
      ctx.fillStyle = 'rgba(40,18,6,0.5)';
      ctx.fillRect(x, y, 2, 17 + row);
      ctx.fillStyle = '#2a1408';
      ctx.fillRect(x + 8, y + 6, 3, 3);
    }
  }
  ctx.fillStyle = '#e0a060';
  ctx.fillRect(0, top, W, 3);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(0, top + 3, W, 3);
}

/** Soft elliptical ground shadow. */
export function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number): void {
  ctx.save();
  ctx.fillStyle = 'rgba(20,8,4,0.45)';
  ctx.beginPath();
  ctx.ellipse(x, y, rx, rx * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Samurai sprite scale and centre y so his feet land on `ground`. Sprite frame is 173 px tall at scale 1. */
export function feetY(ground: number, scale: number, frameH = 173): number {
  return ground - (frameH * scale) / 2;
}
