#!/usr/bin/env node
// Draws the original swordfish and anglerfish sprites (made for SamuraiHook)
// in the style of the CC0 "Fish DB32" fish: side view facing LEFT, 1 px black
// outline, DawnBringer-32 palette colours, no anti-aliasing.
//
//   node tools/fish-sprites.mjs           writes public/assets/fish/{swordfish,anglerfish}.png
//   node tools/fish-sprites.mjs --preview also writes candidates/preview.png (6x, next to
//                                         the shark and piranha, plus a game-size row)
//
// Each fish is built from filled polygons ("parts"), shaded per column, then
// outlined automatically; small details (eye, teeth, lure) are set per pixel.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pngjs from 'pngjs';

const { PNG } = pngjs;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FISH_DIR = join(ROOT, 'public/assets/fish');

// DawnBringer 32 colours used here.
const C = {
  black: '#000000', navy: '#222034', plum: '#45283c', brown: '#663931', rust: '#8f563b',
  orange: '#df7126', tan: '#d9a066', yellow: '#fbf236', indigo: '#3f3f74', sea: '#306082',
  royal: '#5b6ee1', sky: '#639bff', cyan: '#5fcde4', ice: '#cbdbfc', white: '#ffffff',
  silver: '#9badb7', grey: '#847e87', dgrey: '#696a6a', slate: '#595652', dslate: '#323c39',
  purple: '#76428a', red: '#ac3232', olive: '#8f974a',
};

// ---------- tiny raster ----------

class Sprite {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.part = new Array(w * h).fill(null); // which part covers the pixel
    this.col = new Array(w * h).fill(null);  // final colour
  }
  in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  getPart(x, y) { return this.in(x, y) ? this.part[y * this.w + x] : null; }
  setPart(x, y, p) { if (this.in(x, y)) this.part[y * this.w + x] = p; }
  get(x, y) { return this.in(x, y) ? this.col[y * this.w + x] : null; }
  set(x, y, c) { if (this.in(x, y)) this.col[y * this.w + x] = c; }

  /** Fill a polygon (pixel centres inside, even-odd rule). */
  poly(pts, part) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (inside(pts, x + 0.5, y + 0.5)) this.setPart(x, y, part);
    }
  }
  ellipse(cx, cy, rx, ry, part) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) this.setPart(x, y, part);
    }
  }
  /** Column extent of a set of parts: [top, bottom] or null. */
  extent(x, parts) {
    let top = -1, bot = -1;
    for (let y = 0; y < this.h; y++) if (parts.includes(this.getPart(x, y))) { if (top < 0) top = y; bot = y; }
    return top < 0 ? null : [top, bot];
  }
  /** Colour every pixel of the given part with fn(x, y). */
  shade(part, fn) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.getPart(x, y) === part) this.set(x, y, fn(x, y));
    }
  }
  /** 1 px dark line where part `a` meets one of `others` (drawn on the `a` side). */
  seam(a, others, color = C.black, keep = () => true) {
    const mark = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.getPart(x, y) !== a) continue;
      for (const [dx, dy] of N4) if (others.includes(this.getPart(x + dx, y + dy))) { mark.push([x, y]); break; }
    }
    for (const [x, y] of mark) if (keep(x, y)) this.set(x, y, color);
  }
  /** Black outline on transparent pixels touching the sprite (4-neighbourhood). */
  outline() {
    const mark = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.get(x, y)) continue;
      for (const [dx, dy] of N4) if (this.get(x + dx, y + dy) && this.get(x + dx, y + dy) !== C.black) { mark.push([x, y]); break; }
    }
    for (const [x, y] of mark) this.set(x, y, C.black);
  }
  toPNG() {
    const png = new PNG({ width: this.w, height: this.h });
    for (let i = 0; i < this.w * this.h; i++) {
      const c = this.col[i];
      const [r, g, b] = c ? hex(c) : [0, 0, 0];
      png.data.set([r, g, b, c ? 255 : 0], i * 4);
    }
    return png;
  }
}

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const checker = (x, y) => (x + y) % 2 === 0;

function inside(pts, px, py) {
  let ins = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}

/** Pixels of a quadratic Bezier, 8-connected. */
function bezierPixels(p0, p1, p2) {
  const out = [];
  let last = null;
  for (let i = 0; i <= 400; i++) {
    const t = i / 400, u = 1 - t;
    const x = Math.floor(u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0]);
    const y = Math.floor(u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]);
    if (last && last[0] === x && last[1] === y) continue;
    // Drop corner pixels so the line stays 1 px thin.
    if (out.length >= 2) {
      const a = out[out.length - 2];
      if (Math.abs(a[0] - x) <= 1 && Math.abs(a[1] - y) <= 1) out.pop();
    }
    out.push([x, y]);
    last = [x, y];
  }
  return out;
}

/** Back-to-belly band colour; t = 0 at the back, 1 at the belly. Dithers band edges. */
function bands(t, x, y, stops) {
  for (let i = 0; i < stops.length; i++) {
    const [edge, col, dither = true] = stops[i];
    if (t < edge) {
      const next = stops[i + 1];
      if (dither && next && t > edge - 0.06 && checker(x, y)) return next[1];
      return col;
    }
  }
  return stops[stops.length - 1][1];
}

// ---------- swordfish (Kajiki) ----------

export const SWORDFISH = { w: 75, h: 28 };

function swordfish() {
  const s = new Sprite(SWORDFISH.w, SWORDFISH.h);
  // Body: bill base at x 22, peduncle at x 63.
  s.poly([
    [21, 12.2], [24, 10.4], [28, 9.0], [33, 8.3], [40, 8.4], [46, 9.2], [52, 10.6], [57, 12.0], [61, 13.2], [64.5, 13.6],
    [64.5, 16.4], [61, 16.8], [57, 17.8], [52, 19.2], [46, 20.4], [40, 21.0], [33, 21.0], [28, 20.4], [24, 19.0], [21, 17.0],
  ], 'body');
  // Tall sickle dorsal fin, just behind the head.
  s.poly([[26, 10], [27.4, 6.5], [29, 3.4], [30.6, 1.2], [32.2, 1.0], [32, 3.2], [32.6, 5.6], [34.2, 7.6], [37, 9.2]], 'dorsal');
  // Small second dorsal and anal finlets near the tail.
  s.poly([[56.5, 12.6], [58.6, 10.9], [60, 13.4]], 'fin');
  s.poly([[56.5, 17.4], [58.6, 19.2], [60, 16.8]], 'fin');
  // First anal fin.
  s.poly([[45, 20.4], [47.5, 23.6], [49.8, 23.4], [50.5, 19.6]], 'fin');
  // Crescent tail: two swept lobes.
  s.poly([[62, 13.8], [65, 10.2], [68, 6.4], [71, 3.2], [73.8, 1.1], [73.6, 2.6], [72.3, 5.4], [70.2, 9.2], [68.6, 12.4], [67.6, 15.0], [64, 15.0]], 'tail');
  s.poly([[62, 16.2], [65, 19.4], [68, 22.4], [71, 24.8], [73.6, 26.6], [73.4, 25.2], [72.2, 22.8], [70.2, 19.8], [68.6, 17.2], [67.6, 14.6], [64, 14.6]], 'tail');
  // Long sickle pectoral fin, low behind the head (drawn over the body).
  s.poly([[26.6, 17.2], [29.6, 17.0], [33, 19.8], [37.6, 24.6], [35.6, 24.6], [30.6, 21.6], [26.6, 19.4]], 'pec');
  // The bill: a long flat sword from the upper jaw, tapering to a point.
  for (let x = 1; x <= 22; x++) {
    const rows = x >= 18 ? [12, 13, 14] : x >= 8 ? [13, 14] : [13];
    for (const y of rows) if (!s.getPart(x, y)) s.setPart(x, y, 'bill');
  }

  // Shading.
  const bodyParts = ['body', 'pec'];
  const stops = [[0.1, C.navy, false], [0.4, C.indigo], [0.52, C.sea], [0.78, C.silver], [2, C.ice]];
  s.shade('body', (x, y) => {
    const [top, bot] = s.extent(x, bodyParts);
    return bands((y - top) / Math.max(1, bot - top), x, y, stops);
  });
  s.shade('dorsal', (x, y) => (y > 8 || x <= 28 ? C.navy : (x + y) % 3 === 0 ? C.navy : C.indigo));
  s.shade('fin', () => C.indigo);
  s.shade('tail', (x, y) => (Math.abs(y - 14.5) < 3 ? C.navy : C.indigo));
  s.shade('pec', (x, y) => (y - x * 0.75 < -3.4 ? C.sea : C.indigo));
  s.shade('bill', (x, y) => {
    const [top, bot] = s.extent(x, ['bill']);
    if (top === bot) return C.grey;
    return y === top ? C.dgrey : y === bot ? C.silver : C.grey;
  });
  s.seam('pec', ['body']);

  // Mouth line under the bill and gill arc.
  for (const [x, y] of [[22, 15], [23, 15], [24, 16]]) s.set(x, y, C.black);
  for (const [x, y] of [[27, 11], [28, 12], [28, 13], [28, 14], [27, 15]]) s.set(x, y, C.navy);
  // Eye: pale ring, black pupil.
  for (const [x, y] of [[24, 12], [25, 11], [26, 12], [25, 13]]) s.set(x, y, C.silver);
  s.set(25, 12, C.black);
  s.set(24, 11, C.white);
  s.outline();
  return s;
}

// ---------- anglerfish (Anko) ----------

export const ANGLERFISH = { w: 55, h: 44 };
/** Centre of the glowing bulb, in native pixels (also used by the fight's lure glow). */
export const ANGLER_BULB = { x: 7, y: 8 };

function anglerfish() {
  const s = new Sprite(ANGLERFISH.w, ANGLERFISH.h);
  s.ellipse(27, 26, 18, 14, 'body');
  // Snout above the mouth.
  s.poly([[6.5, 18.5], [10, 15], [15, 14.5], [15, 23], [6.5, 21.5]], 'body');
  // Tail stalk and fan tail.
  s.poly([[40, 21], [47, 23], [47, 30], [40, 33]], 'body');
  s.poly([[46, 23], [50, 17.5], [53.6, 16.6], [53.8, 22], [53.8, 31], [53.6, 36.4], [50, 35.6], [46, 30]], 'tail');
  // Soft dorsal fin near the rear and an arm-like pectoral fin.
  s.poly([[33, 13.2], [36, 9.6], [40, 9.8], [43, 14.6], [39, 15]], 'fin');
  s.poly([[30, 29.5], [33, 26.5], [36, 24.8], [39.4, 25.2], [38.6, 28], [39.6, 30.5], [38.6, 33], [35.5, 34.2], [32, 32.2], [30, 31]], 'pec');
  // Jutting lower jaw (underbite): the chin sits well ahead of the snout.
  s.poly([[2.5, 26], [4.4, 25.4], [6.5, 29], [14, 31.5], [22, 31.5], [25, 38], [14, 38.8], [6, 37], [2.8, 33.4], [2, 29]], 'jaw');
  // Mouth interior.
  s.poly([[7, 21.4], [13, 24.6], [22.6, 28.6], [14, 31.2], [6.5, 29], [4.4, 25.6]], 'mouth');

  const bodyParts = ['body', 'jaw', 'pec', 'mouth'];
  const stops = [[0.16, C.navy, false], [0.84, C.plum], [2, C.brown]];
  s.shade('body', (x, y) => {
    const [top, bot] = s.extent(x, bodyParts);
    const c = bands((y - top) / Math.max(1, bot - top), x, y, stops);
    // A few pale spots on the back.
    if (c === C.plum && (x * 7 + y * 13) % 23 === 0) return C.purple;
    return c;
  });
  s.shade('jaw', (x, y) => {
    const [top, bot] = s.extent(x, ['jaw']);
    const t = (y - top) / Math.max(1, bot - top);
    return y === top ? C.purple : t < 0.6 ? C.plum : C.brown;
  });
  s.shade('mouth', (x, y) => {
    const [, bot] = s.extent(x, ['mouth']);
    return y === bot && x > 9 && x < 20 ? C.red : C.black;
  });
  s.shade('tail', (x, y) => (x % 2 === 0 && x < 53 ? C.navy : C.plum));
  s.shade('fin', (x) => (x % 2 === 1 ? C.navy : C.plum));
  // Pectoral fan: rays spread from the root, paler at the rim.
  s.shade('pec', (x, y) => {
    const dx = x + 0.5 - 30, dy = y + 0.5 - 30.5;
    if (Math.hypot(dx, dy) > 8.2) return C.purple;
    return Math.floor((Math.atan2(dy, dx) + 2) / 0.3) % 2 ? C.navy : C.plum;
  });
  s.seam('pec', ['body']);
  s.seam('jaw', ['body'], C.navy, (x, y) => y < 35); // jaw hinge behind the mouth corner

  // Teeth: needles down from the upper jaw, up from the lower jaw.
  const tooth = (x, y0, len, dir) => {
    for (let i = 0; i < len; i++) { s.set(x, y0 + i * dir, i === len - 1 ? C.ice : C.white); s.setPart(x, y0 + i * dir, 'tooth'); }
  };
  tooth(8, 22, 3, 1); tooth(11, 24, 3, 1); tooth(14, 25, 3, 1); tooth(17, 26, 2, 1); tooth(20, 27, 2, 1);
  tooth(4, 25, 4, -1); tooth(7, 28, 3, -1); tooth(10, 29, 3, -1); tooth(13, 30, 3, -1); tooth(16, 30, 2, -1);

  // Small pale eye above the mouth corner.
  for (const [x, y] of [[18, 20], [19, 19], [20, 20], [19, 21]]) s.set(x, y, C.silver);
  s.set(19, 20, C.black);
  s.set(18, 19, C.white);

  // Lure: a stalk from the forehead arcing forward to a bright bulb.
  for (const [x, y] of bezierPixels([17.5, 13.5], [12, -2], [7.5, 6])) if (!s.get(x, y)) s.set(x, y, C.olive);
  const b = ANGLER_BULB;
  const bulb = [
    ' yyy ',
    'yWWWy',
    'yWWyo',
    'yWyyo',
    ' ooo ',
  ];
  const bc = { y: C.yellow, W: C.white, o: C.orange };
  bulb.forEach((row, dy) => [...row].forEach((ch, dx) => { if (bc[ch]) s.set(b.x - 2 + dx, b.y - 2 + dy, bc[ch]); }));
  // Warm light from the lure catching the top edge of the snout and forehead.
  for (let x = 7; x <= 15; x++) {
    const [top] = s.extent(x, ['body']);
    s.set(x, top, x < 13 ? C.rust : C.brown);
    if (x < 10) s.set(x, top + 1, C.brown);
  }
  s.outline();
  return s;
}

// ---------- preview ----------

function readPNG(path) { return PNG.sync.read(readFileSync(path)); }

function blit(dst, src, ox, oy, k) {
  for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
    const i = (y * src.width + x) * 4;
    if (src.data[i + 3] === 0) continue;
    for (let yy = 0; yy < k; yy++) for (let xx = 0; xx < k; xx++) {
      const X = ox + x * k + xx, Y = oy + y * k + yy;
      if (X < 0 || Y < 0 || X >= dst.width || Y >= dst.height) continue;
      dst.data.set(src.data.subarray(i, i + 4), (Y * dst.width + X) * 4);
    }
  }
}

function preview(sword, angler) {
  const shark = readPNG(join(FISH_DIR, 'shark.png'));
  const piranha = readPNG(join(FISH_DIR, 'piranha.png'));
  const K = 6, pad = 24;
  // Row 1: shark | swordfish. Row 2: piranha | anglerfish. Row 3: game size (shark 2x, piranha 5x, new fish 2x).
  const W = pad * 3 + shark.width * K + sword.width * K;
  const row1 = Math.max(shark.height, sword.height) * K;
  const row2 = Math.max(piranha.height, angler.height) * K;
  const row3 = 100;
  const H = pad * 4 + row1 + row2 + row3;
  const out = new PNG({ width: W, height: H });
  const [r, g, b] = hex('#3a6ea5');
  for (let i = 0; i < W * H; i++) out.data.set([r, g, b, 255], i * 4);
  blit(out, shark, pad, pad, K);
  blit(out, sword, pad * 2 + shark.width * K, pad, K);
  blit(out, piranha, pad, pad * 2 + row1, K);
  blit(out, angler, pad * 2 + shark.width * K, pad * 2 + row1, K);
  let x = pad;
  const y3 = pad * 3 + row1 + row2;
  for (const [img, k] of [[shark, 2], [sword, 2], [piranha, 5], [angler, 2]]) {
    blit(out, img, x, y3 + (row3 - img.height * k) / 2 | 0, k);
    x += img.width * k + pad;
  }
  return out;
}

// ---------- main ----------

const sword = swordfish().toPNG();
const angler = anglerfish().toPNG();
writeFileSync(join(FISH_DIR, 'swordfish.png'), PNG.sync.write(sword));
writeFileSync(join(FISH_DIR, 'anglerfish.png'), PNG.sync.write(angler));
console.log('wrote public/assets/fish/swordfish.png and anglerfish.png');
if (process.argv.includes('--preview')) {
  mkdirSync(join(ROOT, 'candidates'), { recursive: true });
  writeFileSync(join(ROOT, 'candidates/preview.png'), PNG.sync.write(preview(sword, angler)));
  console.log('wrote candidates/preview.png');
}
