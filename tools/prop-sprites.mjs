#!/usr/bin/env node
// Draws original candidate sprites for the props that are still code-drawn
// (nigiri, hook), made for SamuraiHook in the style of the CC0 "Fish DB32"
// fish: 1 px black outline, DawnBringer-32 palette colours, no anti-aliasing,
// drawn small and scaled up by an integer factor in the game.
//
//   node tools/prop-sprites.mjs            writes candidates/original/*.png (native size)
//   node tools/prop-sprites.mjs --preview  also writes candidates/props-preview.png:
//                                          per sprite a row "current | found | original"
//                                          at in-game size on a matching background
//
// Nothing here touches public/ or the manifest: the owner picks an option first.
// The preview reads the captured code-drawn sprites from candidates/current/ and
// the downloaded third-party art from candidates/found/ (see SOURCES.txt there);
// missing files are skipped.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pngjs from 'pngjs';

const { PNG } = pngjs;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CAND = join(ROOT, 'candidates');
const OUT_DIR = join(CAND, 'original');

// DawnBringer 32 colours used here (same names as tools/fish-sprites.mjs, plus a few).
const C = {
  black: '#000000', navy: '#222034', plum: '#45283c', brown: '#663931', rust: '#8f563b',
  orange: '#df7126', tan: '#d9a066', peach: '#eec39a', yellow: '#fbf236', indigo: '#3f3f74',
  sea: '#306082', royal: '#5b6ee1', sky: '#639bff', cyan: '#5fcde4', ice: '#cbdbfc',
  white: '#ffffff', silver: '#9badb7', grey: '#847e87', dgrey: '#696a6a', slate: '#595652',
  dslate: '#323c39', moss: '#4b692f', purple: '#76428a', red: '#ac3232', rose: '#d95763',
  olive: '#8f974a',
};

// ---------- tiny raster (same approach as tools/fish-sprites.mjs) ----------

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

  /** Mark every pixel whose centre passes test(x + 0.5, y + 0.5). */
  fill(test, part) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (test(x + 0.5, y + 0.5)) this.setPart(x, y, part);
    }
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
  /** Black outline on transparent pixels touching the sprite (4-neighbourhood), except `holes`. */
  outline(holes = []) {
    const skip = new Set(holes.map(([x, y]) => y * this.w + x));
    const mark = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.get(x, y) || skip.has(y * this.w + x)) continue;
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
/** Fixed pseudo-random 0..1 per pixel, so the output is reproducible. */
function grain(a, b) {
  let n = (a * 374761393 + b * 668265263) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

// ---------- nigiri (salmon on rice), 36x24, shown at 2x = 72x48 ----------

export const NIGIRI = { w: 36, h: 24 };

/** Top and bottom edge of the salmon slab at column x (pixel centres). */
function slab(x) {
  const u = (x - 18) / 16.5;                // -1 .. 1 across the slab
  const top = 3.2 + 4.4 * u ** 2 + 0.6 * u;           // arched, right end a touch lower (3/4 view)
  const bot = 10.6 + 4.2 * u ** 4 + 0.6 * u;          // flat on the rice, then drapes down its ends
  return [top, bot];
}

function nigiri({ nori = true } = {}) {
  const s = new Sprite(NIGIRI.w, NIGIRI.h);
  // Rice: a soft rounded block (superellipse) under the fish.
  s.fill((x, y) => {
    const dx = (x - 18) / 14.2, dy = (y - 16.4) / 5.6;
    return dx ** 4 + dy ** 4 <= 1;
  }, 'rice');
  // Salmon slab: arched, rounded ends.
  s.fill((x, y) => {
    if (x < 1.6 || x > 34.4) return false;
    const [t, b] = slab(x);
    const end = Math.min(x - 1.6, 34.4 - x);          // round the two tips
    const cut = end < 2.5 ? (2.5 - end) * 0.8 : 0;
    return y > t + cut && y < b - cut * 0.6;
  }, 'fish');
  if (nori) {
    // A strip of nori wrapped round the middle, over the fish and down the rice.
    s.fill((x, y) => {
      if (x < 16 || x >= 20) return false;
      const [t] = slab(x);
      return y > t - 0.6 && s.getPart(Math.floor(x), Math.floor(y)) !== null;
    }, 'nori');
  }

  // Rice: lit from the top left, grains as short pale/shadow ticks.
  s.shade('rice', (x, y) => {
    const t = (y - 9) / 13;
    let col = t < 0.58 ? C.white : t < 0.82 ? C.ice : C.silver;
    if (x > 29 && t > 0.3 && col === C.white) col = C.ice; // right side turns away
    const g = grain(x, y);                                // scattered grains
    if (col === C.white && g < 0.14) col = C.ice;
    else if (col === C.ice && g < 0.2) col = C.white;
    else if (col === C.silver && g < 0.25) col = C.ice;
    return col;
  });
  // Shadow the fish casts on the rice right under it.
  for (let x = 0; x < s.w; x++) for (let y = 0; y < s.h; y++) {
    if (s.getPart(x, y) === 'rice' && s.getPart(x, y - 1) === 'fish') {
      s.set(x, y, C.silver);
      if (s.getPart(x, y + 1) === 'rice' && checker(x, y)) s.set(x, y + 1, C.ice);
    }
  }

  // Salmon: orange flesh with pale diagonal fat lines, a sheen on top, darker underside.
  s.shade('fish', (x, y) => {
    const [t, b] = slab(x + 0.5);
    const f = (y + 0.5 - t) / (b - t);                  // 0 top .. 1 bottom of the slab
    const stripe = ((x - Math.round(y * 0.8)) % 6 + 6) % 6;
    let col = C.orange;
    if (stripe === 0) col = C.peach;                    // fat line
    else if (stripe === 1 && f < 0.6) col = C.tan;      // soft edge of the fat line
    if (f < 0.2 && x > 6 && x < 24 && stripe !== 0) col = checker(x, y) ? C.tan : C.orange; // sheen
    if (f > 0.78) col = stripe === 0 ? C.rose : C.red;  // underside in shadow
    return col;
  });

  if (nori) {
    s.shade('nori', (x, y) => {
      if (x === 16) return C.moss;                      // lit edge
      if (x === 19) return C.navy;                      // shadow edge
      return (x + y) % 5 === 0 ? C.slate : C.dslate;    // a little texture
    });
  }
  s.seam('fish', ['rice'], C.black, (x) => x < 6 || x > 29); // fish tips overlap the rice: outline them
  s.outline();
  return s;
}

// ---------- hook: steel, with an eye and a barb, 10x14, shown at 2x = 20x28 ----------

export const HOOK = { w: 10, h: 14 };
// W white highlight, L light steel, M mid steel, D dark steel; o = eye hole (kept open).
const HOOK_ART = [
  '..........',
  '.....LL...',
  '....Wo.M..',
  '....Lo.M..',
  '.....MM...',
  '......L...',
  '......L...',
  '..W...L...',
  '..L...L...',
  '..LM..L...',
  '..L...M...',
  '..M..M....',
  '...MD.....',
  '..........',
];

function hook() {
  const s = new Sprite(HOOK.w, HOOK.h);
  const col = { W: C.white, L: C.ice, M: C.silver, D: C.grey };
  const holes = [];
  HOOK_ART.forEach((row, y) => [...row].forEach((ch, x) => {
    if (col[ch]) s.set(x, y, col[ch]);
    if (ch === 'o') holes.push([x, y]);
  }));
  // The hole is 1x2 in the art; open the pixel next to it as well so water shows through.
  holes.push([6, 2], [6, 3]);
  s.outline(holes);
  return s;
}

// ---------- found art: crops from candidates/found (third-party, see SOURCES.txt) ----------

function readPNG(path) {
  // Some OpenGameArt PNGs carry junk after IEND; cut the buffer there.
  let buf = readFileSync(path);
  const iend = buf.indexOf(Buffer.from('IEND'));
  if (iend > 0) buf = buf.subarray(0, iend + 8);
  return PNG.sync.read(buf);
}

/** Copy a w x h region (optionally keying out one colour) into a new PNG of size ow x oh, offset by (dx, dy). */
function crop(src, x0, y0, w, h, { key = null, ow = w, oh = h, dx = 0, dy = 0 } = {}) {
  const out = new PNG({ width: ow, height: oh });
  out.data.fill(0);
  const k = key && hex(key);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = ((y0 + y) * src.width + x0 + x) * 4;
    if (src.data[i + 3] < 128) continue;
    if (k && src.data[i] === k[0] && src.data[i + 1] === k[1] && src.data[i + 2] === k[2]) continue;
    out.data.set(src.data.subarray(i, i + 4), ((y + dy) * ow + x + dx) * 4);
  }
  return out;
}

/** Third-party candidates, cropped to a usable sprite. Each entry: [label, file, crop()]. */
function foundCrops() {
  const F = join(CAND, 'found');
  const list = [];
  const add = (name, file, make) => {
    const p = join(F, file);
    if (!existsSync(p)) return;
    const img = make(readPNG(p));
    mkdirSync(join(F, 'crops'), { recursive: true });
    writeFileSync(join(F, 'crops', name + '.png'), PNG.sync.write(img));
    list.push([name, img]);
  };
  // "Sushi set" by somebodylarr (CC-BY 3.0): salmon nigiri with nori, 24x12 at (4,42) of sushi_3.png.
  add('nigiri-sushiset', 'sushi_3.png', (p) => crop(p, 4, 42, 24, 12));
  // "Pixel Food Icons" by hoanglam.bk57 (CC-BY 4.0): 13x13 salmon nigiri icon.
  add('nigiri-pixelfoodicons', 'pixel-food-icons/food-icons/1x/salmon-nigiri.png', (p) => crop(p, 0, 0, p.width, p.height));
  // "Foodies" by maruki (CC0): 16x16 frames, the salmon nigiri is frame 1 of the borderless sheet.
  add('nigiri-foodies', 'foodies/foodies_sheet_borderless.png', (p) => crop(p, 16, 0, 16, 16));
  // "8x8 Sushi Sprites" by 1j01 (CC0): nigiri tiles on an opaque sheet; not cropped (see SOURCES.txt).
  // "Exreme Fishing" by retrowolf (CC0): modern rowboat with outboard motor, white background keyed out.
  add('boat-exremefishing', 'AmateurFishingExtreme.png', (p) => crop(p, 12, 109, 105, 39, { key: '#ffffff' }));
  return Object.fromEntries(list);
}

// ---------- preview ----------

// 3x5 pixel font for the labels.
const FONT = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
  E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
  I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100',
  Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111', 0: '111101101101111', 1: '010110010010111',
  2: '110001010100111', 3: '110001010001110', 4: '101101111001001', 5: '111100110001110',
  6: '011100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001110',
  '.': '000000000000010', ',': '000000000010100', '-': '000000111000000', '(': '010100100100010',
  ')': '010001001001010', '/': '001001010100100', ':': '000010000010000', x: '000101010101000',
  '+': '000010111010000', '?': '110001010000010', ' ': '000000000000000',
};

function text(dst, str, x, y, k = 2, color = '#ffffff') {
  const [r, g, b] = hex(color);
  for (const ch of str) {
    const glyph = FONT[ch] ?? FONT[ch.toUpperCase()] ?? FONT['?'];
    for (let i = 0; i < 15; i++) {
      if (glyph[i] !== '1') continue;
      rect(dst, x + (i % 3) * k, y + Math.floor(i / 3) * k, k, k, [r, g, b]);
    }
    x += 4 * k;
  }
}

function rect(dst, x, y, w, h, rgb) {
  for (let yy = Math.max(0, y); yy < Math.min(dst.height, y + h); yy++) {
    for (let xx = Math.max(0, x); xx < Math.min(dst.width, x + w); xx++) dst.data.set([...rgb, 255], (yy * dst.width + xx) * 4);
  }
}

/** Nearest-neighbour blit of src scaled to tw x th (the game draws with smoothing off). */
function blitTo(dst, src, ox, oy, tw, th) {
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    const sx = Math.floor((x * src.width) / tw), sy = Math.floor((y * src.height) / th);
    const i = (sy * src.width + sx) * 4;
    const a = src.data[i + 3] / 255;
    if (a === 0) continue;
    const X = ox + x, Y = oy + y;
    if (X < 0 || Y < 0 || X >= dst.width || Y >= dst.height) continue;
    const o = (Y * dst.width + X) * 4;
    for (let c = 0; c < 3; c++) dst.data[o + c] = Math.round(src.data[i + c] * a + dst.data[o + c] * (1 - a));
  }
}

/** Background painters for each row (colours sampled from the running game). */
const BG = {
  // Win screen: the nigiri lands in front of the big red sun on warm rays.
  nigiri: (dst, x, y, w, h) => {
    rect(dst, x, y, w, h, hex('#e29669'));
    const cx = x + w / 2, cy = y + h / 2 + 6, r = Math.min(w, h) * 0.47;
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      if ((xx - cx) ** 2 + (yy - cy) ** 2 <= r * r) dst.data.set([...hex('#c8281e'), 255], (yy * dst.width + xx) * 4);
    }
  },
  // Deep water under the boat.
  hook: (dst, x, y, w, h) => {
    for (let yy = 0; yy < h; yy++) {
      const t = yy / h;
      const c = hex('#564690').map((v, i) => Math.round(v + (hex('#483b80')[i] - v) * t));
      rect(dst, x, y + yy, w, 1, c);
    }
  },
  // Sunset sky, the far sea band and the near water, as in the ocean scene.
  boat: (dst, x, y, w, h, waterY) => {
    const sky = ['#4f2152', '#78355a', '#9b435a', '#bb5357', '#d66b4c', '#f08142', '#f8a34e', '#febc59'];
    const skyH = waterY - 30 - y;
    for (let yy = 0; yy < skyH; yy++) rect(dst, x, y + yy, w, 1, hex(sky[Math.min(sky.length - 1, Math.floor((yy / skyH) * sky.length))]));
    const sea = ['#523777', '#423a7a', '#272865', '#1f2359'];
    for (let yy = 0; yy < 30; yy++) rect(dst, x, waterY - 30 + yy, w, 1, hex(sea[Math.floor(yy / 7.5)]));
    rect(dst, x, waterY, w, 2, hex('#d2b0a0'));
    rect(dst, x, waterY + 2, w, y + h - waterY - 2, hex('#56448d'));
  },
};

function preview(orig) {
  const found = foundCrops();
  const cur = (f) => (existsSync(join(CAND, 'current', f)) ? readPNG(join(CAND, 'current', f)) : null);
  const pad = 16, labelH = 30, cellPad = 12;
  // Each cell: [label lines, image, target w, target h] (target = on-screen size in the game).
  const rows = [
    {
      title: 'NIGIRI - WIN SCREEN, 72X48 DRAWN AT 2.5X: 180X120',
      bg: 'nigiri', h: 160,
      cells: [
        ['CURRENT (CODE-DRAWN)', cur('nigiri-x2.5.png'), 200, 140], // captured already at 2.5x with 12px padding
        ['A1 FOUND: SUSHI SET', found['nigiri-sushiset'], 180, 90, 'SOMEBODYLARR CC-BY 3.0, 24X12 AT 7.5X'],
        ['A2 FOUND: PIXEL FOOD', found['nigiri-pixelfoodicons'], 130, 130, 'HOANGLAM.BK57 CC-BY 4.0, 13X13 AT 10X'],
        ['A3 FOUND: FOODIES', found['nigiri-foodies'], 120, 120, 'MARUKI CC0, 16X16 AT 7.5X'],
        ['B1 ORIGINAL + NORI', orig.nigiri, 180, 120, '36X24 AT 5X'],
        ['B2 ORIGINAL PLAIN', orig.nigiriPlain, 180, 120, '36X24 AT 5X'],
      ],
    },
    {
      title: 'HOOK - OCEAN SCENE, 20X28 AT 1X (AND 4X ZOOM BELOW EACH)',
      bg: 'hook', h: 160, zoom: 4,
      cells: [
        // Captured with 12 px padding; the code-drawn outline reaches 1 px past the 20x28 box.
        ['CURRENT (CODE-DRAWN)', cur('hook.png') && crop(cur('hook.png'), 11, 11, 22, 30), 22, 30],
        ['FOUND: NONE', null, 20, 28, 'NOTHING CC0/CC-BY FOUND'],
        ['B ORIGINAL', orig.hook, 20, 28, '10X14 AT 2X'],
      ],
    },
    {
      title: 'BOAT - OCEAN SCENE, 280X110 AT 1X, MIRRORED (PROW LEFT) AS IN THE GAME',
      bg: 'boat', h: 170, waterLine: 118,
      cells: [
        // Captured with 12 px padding; in the game the 110 px box ends 10 px below the water line.
        ['CURRENT (CODE-DRAWN)', cur('boat-ingame-flipped.png'), 304, 134, 'LANTERN FLICKERS IN GAME', 112],
        ['A FOUND: EXREME FISHING', found['boat-exremefishing'] && mirror(found['boat-exremefishing']), 210, 78, 'RETROWOLF CC0, 105X39 AT 2X', 58],
        ['B ORIGINAL: NOT MADE', null, 280, 110, 'SEE REPORT'],
      ],
    },
  ];

  const cellW = (c, row) => Math.max(c[2], (c[0].length * 4 - 1) * 2, ((c[4] ?? '').length * 4 - 1) * 1) + cellPad * 2 + (row.zoom ? 0 : 0);
  const rowH = (row) => labelH + row.h + 14 + (row.zoom ? 30 * row.zoom + 24 : 0);
  const W = Math.max(...rows.map((r) => r.cells.reduce((a, c) => a + cellW(c, r) + pad, pad)), 900);
  const H = rows.reduce((a, r) => a + rowH(r) + 20, pad);
  const out = new PNG({ width: W, height: H });
  for (let i = 0; i < W * H; i++) out.data.set([...hex('#1a1a22'), 255], i * 4);

  let y = pad;
  for (const row of rows) {
    text(out, row.title, pad, y, 2, '#ffe9b0');
    let x = pad;
    const top = y + 18;
    for (const c of row.cells) {
      const [label, img, tw, th, sub] = c;
      const w = cellW(c, row);
      const ch = rowH(row) - 18;
      BG[row.bg](out, x, top, w, ch, top + labelH + (row.waterLine ?? 0));
      rect(out, x, top, w, labelH - 4, [26, 26, 34]);
      text(out, label, x + 4, top + 3, 2, '#ffffff');
      if (sub) text(out, sub, x + 4, top + 17, 1, '#c8c8d0');
      const areaTop = top + labelH;
      if (img) {
        const ix = x + Math.round((w - tw) / 2);
        // Boats: c[5] is the image row (at target size) that sits on the water line.
        const iy = row.waterLine !== undefined
          ? areaTop + row.waterLine - c[5]
          : areaTop + Math.round((row.h - th) / 2);
        blitTo(out, img, ix, iy, tw, th);
        if (row.zoom) {
          const zw = tw * row.zoom, zh = th * row.zoom;
          blitTo(out, img, x + Math.round((w - zw) / 2), areaTop + row.h + 4, zw, zh);
        }
      } else {
        text(out, '-', x + w / 2 - 3, areaTop + row.h / 2, 3, '#ffffff');
      }
      x += w + pad;
    }
    y += rowH(row) + 20;
  }
  return out;
}

function mirror(src) {
  const out = new PNG({ width: src.width, height: src.height });
  for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
    const i = (y * src.width + x) * 4, o = (y * src.width + (src.width - 1 - x)) * 4;
    out.data.set(src.data.subarray(i, i + 4), o);
  }
  return out;
}

// ---------- main ----------

mkdirSync(OUT_DIR, { recursive: true });
const orig = {
  nigiri: nigiri({ nori: true }).toPNG(),
  nigiriPlain: nigiri({ nori: false }).toPNG(),
  hook: hook().toPNG(),
};
writeFileSync(join(OUT_DIR, 'nigiri.png'), PNG.sync.write(orig.nigiri));
writeFileSync(join(OUT_DIR, 'nigiri-plain.png'), PNG.sync.write(orig.nigiriPlain));
writeFileSync(join(OUT_DIR, 'hook.png'), PNG.sync.write(orig.hook));
// The game ships the plain nigiri (chosen by Rhaveen, 2026-11-15).
const PROPS_DIR = join(ROOT, 'public', 'assets', 'props');
mkdirSync(PROPS_DIR, { recursive: true });
writeFileSync(join(PROPS_DIR, 'nigiri.png'), PNG.sync.write(orig.nigiriPlain));
console.log('wrote public/assets/props/nigiri.png and candidates/original/nigiri.png, nigiri-plain.png, hook.png');
if (process.argv.includes('--preview')) {
  writeFileSync(join(CAND, 'props-preview.png'), PNG.sync.write(preview(orig)));
  console.log('wrote candidates/props-preview.png');
}
