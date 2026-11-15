// Always-visible prompt bar in the bottom 30 px band (y 510..540) of the 960x540 canvas.
// Glyphs follow the last-used device. Everything is drawn with canvas calls.
import type { Action, Input, Prompt } from '../types';

const W = 960;
const BAND_Y = 510;
const BAND_H = 30;
const MID_Y = BAND_Y + BAND_H / 2;
const ITEM_GAP = 26;
const GLYPH_LABEL_GAP = 7;
const LABEL_FONT = 'bold 13px system-ui, -apple-system, "Segoe UI", sans-serif';
const KEY_FONT = 'bold 11px system-ui, -apple-system, "Segoe UI", sans-serif';
const KEY_H = 20;

const FACE_COLORS: Record<string, { fill: string; text: string }> = {
  A: { fill: '#3bb54a', text: '#fff' },
  B: { fill: '#e0403a', text: '#fff' },
  X: { fill: '#3a7be0', text: '#fff' },
  Y: { fill: '#f0c419', text: '#2a2200' },
};

const DIRS: readonly Action[] = ['left', 'right', 'up', 'down'];
type Dir = 'left' | 'right' | 'up' | 'down';

interface Item {
  glyphW: number;
  labelW: number;
  draw(x: number): void;
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function keycapWidth(ctx: CanvasRenderingContext2D, text: string): number {
  ctx.font = KEY_FONT;
  return Math.max(20, Math.ceil(ctx.measureText(text).width) + 12);
}

function drawKeycap(ctx: CanvasRenderingContext2D, x: number, text: string, w: number) {
  const y = MID_Y - KEY_H / 2;
  // Bottom edge (depth), then the face.
  ctx.fillStyle = '#7d7564';
  roundRectPath(ctx, x, y, w, KEY_H, 4);
  ctx.fill();
  ctx.fillStyle = '#f1ece0';
  roundRectPath(ctx, x, y, w, KEY_H - 3, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 1;
  roundRectPath(ctx, x + 0.5, y + 0.5, w - 1, KEY_H - 1, 4);
  ctx.stroke();
  ctx.fillStyle = '#1d1b17';
  ctx.font = KEY_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + (KEY_H - 3) / 2 + 1);
}

function drawFaceButton(ctx: CanvasRenderingContext2D, x: number, letter: string) {
  const c = FACE_COLORS[letter] ?? { fill: '#888', text: '#fff' };
  const r = 10;
  const cx = x + r;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.arc(cx, MID_Y + 1.5, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = c.fill;
  ctx.beginPath();
  ctx.arc(cx, MID_Y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = c.text;
  ctx.font = 'bold 12px system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, cx, MID_Y + 1);
}

/** A 20x20 d-pad cross with one arm lit (or none). */
function drawDpad(ctx: CanvasRenderingContext2D, x: number, lit: Dir | null) {
  const cx = x + 10;
  const cy = MID_Y;
  const arm = 6; // half-width of an arm
  const len = 10;
  ctx.fillStyle = '#2b2b30';
  ctx.strokeStyle = '#bbb';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.rect(cx - arm / 2 - 0.5, cy - len, arm + 1, len * 2);
  ctx.rect(cx - len, cy - arm / 2 - 0.5, len * 2, arm + 1);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#2b2b30';
  ctx.fillRect(cx - arm / 2, cy - arm / 2, arm, arm); // hide stroke overlap in the centre
  if (lit) {
    ctx.fillStyle = '#ffd34d';
    const s = arm - 1;
    if (lit === 'up') ctx.fillRect(cx - s / 2, cy - len + 1, s, len - arm / 2 - 1);
    if (lit === 'down') ctx.fillRect(cx - s / 2, cy + arm / 2, s, len - arm / 2 - 1);
    if (lit === 'left') ctx.fillRect(cx - len + 1, cy - s / 2, len - arm / 2 - 1, s);
    if (lit === 'right') ctx.fillRect(cx + arm / 2, cy - s / 2, len - arm / 2 - 1, s);
  }
}

/** Left stick: a ring with a knob and four small ticks. */
function drawStick(ctx: CanvasRenderingContext2D, x: number) {
  const cx = x + 10;
  const cy = MID_Y;
  ctx.fillStyle = '#2b2b30';
  ctx.strokeStyle = '#bbb';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ddd';
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
    ctx.beginPath();
    ctx.arc(cx + dx * 7.5, cy + dy * 7.5, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#6a6a73';
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#eee';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function makeItem(ctx: CanvasRenderingContext2D, input: Input, p: Prompt): Item {
  ctx.font = LABEL_FONT;
  const labelW = Math.ceil(ctx.measureText(p.label).width);
  const pad = input.device === 'gamepad';

  if (p.action === 'move') {
    if (pad) return { glyphW: 20, labelW, draw: (x) => drawStick(ctx, x) };
    // The player's own keys, in the order W A S D / A D.
    const order: Action[] = p.keys === 'horizontal' ? ['left', 'right'] : ['up', 'left', 'down', 'right'];
    const keys = order.map((a) => input.keyName(input.binding(a, 0)));
    const widths = keys.map((k) => Math.max(18, keycapWidth(ctx, k) - 2));
    const gap = 2;
    return {
      glyphW: widths.reduce((s, w) => s + w, 0) + (keys.length - 1) * gap,
      labelW,
      draw: (x) => {
        let cx = x;
        keys.forEach((k, i) => { drawKeycap(ctx, cx, k, widths[i]); cx += widths[i] + gap; });
      },
    };
  }

  const action = p.action;
  if (pad && DIRS.includes(action)) {
    return { glyphW: 20, labelW, draw: (x) => drawDpad(ctx, x, action as Dir) };
  }
  const g = input.glyph(action);
  if (pad && FACE_COLORS[g]) return { glyphW: 20, labelW, draw: (x) => drawFaceButton(ctx, x, g) };
  const kw = keycapWidth(ctx, g);
  return { glyphW: kw, labelW, draw: (x) => drawKeycap(ctx, x, g, kw) };
}

/** Draws the always-visible prompt bar along the bottom of the screen. */
export function drawPrompts(ctx: CanvasRenderingContext2D, input: Input, prompts: Prompt[]): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(8,10,16,0.62)';
  ctx.fillRect(0, BAND_Y, W, BAND_H);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(0, BAND_Y, W, 1);

  const items = prompts.map((p) => makeItem(ctx, input, p));
  const widths = items.map((it) => it.glyphW + GLYPH_LABEL_GAP + it.labelW);
  const total = widths.reduce((s, w) => s + w, 0) + ITEM_GAP * Math.max(0, items.length - 1);
  const maxW = W - 24;
  const scale = total > maxW ? maxW / total : 1;
  if (scale < 1) {
    // Squeeze horizontally around the centre rather than overflow the band.
    ctx.translate(W / 2, 0);
    ctx.scale(scale, 1);
    ctx.translate(-W / 2, 0);
  }

  let x = Math.round(W / 2 - total / 2);
  items.forEach((it, i) => {
    it.draw(x);
    ctx.fillStyle = '#f4f1ea';
    ctx.font = LABEL_FONT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(prompts[i].label, x + it.glyphW + GLYPH_LABEL_GAP, MID_Y + 1);
    x += widths[i] + ITEM_GAP;
  });
  ctx.restore();
}
