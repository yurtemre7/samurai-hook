#!/usr/bin/env node
// Builds the samurai's crouch strip from his idle strip (LuizMelo's CC0
// "Martial Hero", see CREDITS.md). The pack has no crouch, so this one is made
// here: the hat, head, scarf, shoulders and hands are cut from each idle frame
// and moved down 1:1 (no scaling), the head piece sunk into the shoulders and
// leaning forward; the folded legs, the coat on the deck and the katana are
// redrawn in colours taken from the idle strip.
//
//   node tools/samurai-sprites.mjs            writes public/assets/samurai/crouch.png
//   node tools/samurai-sprites.mjs --pack <dir>
//                                             also writes jump.png and fall.png, cut from
//                                             Jump.png and Fall.png of the original pack;
//                                             <dir> is the pack's Sprites folder (not in
//                                             the repository: download Martial Hero from
//                                             https://luizmelo.itch.io/martial-hero)
//   node tools/samurai-sprites.mjs --preview  also writes candidates/samurai-preview.png:
//                                             idle, the old squashed crouch and the new
//                                             frames at 5x, mirrored, and at 2x, with the
//                                             floor and the 60 px / 98 px game-height guides;
//                                             then the old and new jump at a few heights
//                                             (if jump.png and fall.png exist) with the
//                                             36 px low-shot guide
//
// Same format as the other strips: 190x72 frames at 1x, facing right, feet on
// the bottom row. Each crouch frame comes from the idle frame with the same
// index, so the breathing (and the scarf) keeps moving. The pack's frames are
// 200x200; the strips are 190x72 crops of them, at the offset found by matching
// idle.png against the pack's Idle.png (and walk.png against Run.png). Edit this
// script and re-run it; do not hand-edit the generated PNGs.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pngjs from 'pngjs';

const { PNG } = pngjs;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SAM_DIR = join(ROOT, 'public/assets/samurai');
const CAND = join(ROOT, 'candidates');

/** Frame size of every samurai strip (1x pixels; the game draws them at 2.4x). */
const FW = 190, FH = 72;

// Colours of the idle strip, one letter each, for the hand-drawn parts below.
const PAL = {
  A: '#331a19', // hakama, darkest brown
  E: '#4d2d2c', // hakama, lit folds
  B: '#97828a', // coat, shade
  C: '#beacb3', // coat, light
  M: '#341a25', // coat lining / sleeve shadow
  J: '#5f4181', // blade, upper edge
  L: '#442b61', // blade, lower edge
};
const RED = new Set(['#ce2038', '#8a0b41']); // scarf
const BLADE = new Set([PAL.J, PAL.L]);

// ---------- tiny raster ----------

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const hexAt = (d, i) => '#' + [0, 1, 2].map((k) => d[i + k].toString(16).padStart(2, '0')).join('');

class Frame {
  constructor(w = FW, h = FH) { this.w = w; this.h = h; this.col = new Array(w * h).fill(null); }
  in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { return this.in(x, y) ? this.col[y * this.w + x] : null; }
  set(x, y, c) { if (this.in(x, y)) this.col[y * this.w + x] = c; }
  /** First and last row with an opaque pixel. */
  rows() {
    let top = -1, bottom = -1;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.get(x, y)) { if (top < 0) top = y; bottom = y; }
    }
    return [top, bottom];
  }
}

function readStrip(path) {
  const png = PNG.sync.read(readFileSync(path));
  const frames = [];
  for (let f = 0; f < png.width / FW; f++) {
    const fr = new Frame();
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
      const i = (y * png.width + f * FW + x) * 4;
      if (png.data[i + 3] > 0) fr.set(x, y, hexAt(png.data, i));
    }
    frames.push(fr);
  }
  return frames;
}

function stripPNG(frames) {
  const png = new PNG({ width: FW * frames.length, height: FH });
  png.data.fill(0);
  frames.forEach((fr, n) => {
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
      const c = fr.get(x, y);
      if (c) png.data.set([...hex(c), 255], (y * png.width + n * FW + x) * 4);
    }
  });
  return png;
}

/** Paint letter art (PAL letters, '.' = leave as is) with its top-left at (x0, y0). */
function art(out, rows, x0, y0) {
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (PAL[ch]) out.set(x0 + x, y0 + y, PAL[ch]); }));
}

// ---------- crouch ----------

// Idle frame 0 rows (the others breathe up to 3 rows lower): hat 20-33, head and
// scarf 29-37, shoulders and chest 37-47, arms, hands and hilt 44-52, coat and
// hakama 53-71 (feet on row 71), blade from the hilt down to the back.
const HEAD_LAST = 43;            // head piece: hat, head, scarf, shoulders (rows up to here)
const HANDS = [44, 51];          // hands piece: arms and hands on the hilt (no scarf, no blade)
const HEAD_MOVE = { dx: 2, dy: 21 }; // 4 rows deeper than the hands: hunched, leaning forward
const HANDS_MOVE = { dx: 1, dy: 17 };

/** Back of the coat spread on the deck, the hakama on the deck, front foot. Drawn behind. */
const DECK_AT = [80, 67];
const DECK = [
  '..........CCBB............................',
  '........CCCCBB............................',
  '......CCCCCBBBA...........................',
  '....CCCCCCBBBAAAAAAAAAAAAAAAAAAEEAAABCC...',
  '..BCCCCCCBBBBAAAAAAAAAAAAAAAAAAAAAAABCCCB.',
];

/** Near thigh rising to the raised front knee, shin going down to the foot; over the hands. */
const LAP_AT = [80, 64];
const LAP = [
  '..............................AEEA........',
  '.............................AEEEEEA......',
  '.......................AAAAAAEEEEEEA......',
  '..................AAAAAEEEEEEEEEEEEA......',
  '...............AAAEEEEEEEEAAAAEEEEA.......',
  '...............AAAAAAAAAAAAAAAAEEAA.......',
];

/** The katana held low and back, drawn like the blade in the walk frames. */
const BLADE_HILT = [97, 67], BLADE_TIP = [71, 69];
function blade(out) {
  const [x1, y1] = BLADE_HILT, [x0, y0] = BLADE_TIP;
  for (let x = x0; x <= x1; x++) {
    const y = Math.round(y0 + ((x - x0) * (y1 - y0)) / (x1 - x0));
    out.set(x, y, PAL.J);
    out.set(x, y + 1, PAL.L);
  }
}

/**
 * One crouch frame from one idle frame. `b` = how many rows this idle frame's
 * upper body sits below frame 0's (its breath); the crouch breathes less.
 */
function crouch(src, b) {
  const out = new Frame();
  const headBob = Math.round((b * 2) / 3), handsBob = Math.floor(b / 2);
  const copy = (pick, move, bob) => {
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
      const c = src.get(x, y);
      if (c && pick(c, y - b)) out.set(x + move.dx, y - b + move.dy + bob, c);
    }
  };
  // The scarf tail below the head piece flies behind the body: drawn first.
  copy((c, y) => y > HEAD_LAST && RED.has(c), HEAD_MOVE, headBob);
  art(out, DECK, ...DECK_AT);
  blade(out);
  copy((c, y) => y >= HANDS[0] && y <= HANDS[1] && !RED.has(c) && !BLADE.has(c), HANDS_MOVE, handsBob);
  art(out, LAP, ...LAP_AT);
  copy((c, y) => y <= HEAD_LAST, HEAD_MOVE, headBob);
  return out;
}

function buildCrouch(idle) {
  const top0 = Math.min(...idle.map((fr) => fr.rows()[0]));
  return idle.map((fr) => crouch(fr, fr.rows()[0] - top0));
}

// ---------- jump and fall, from the original pack ----------

const PACK_FW = 200; // frame width of the pack's sheets (frames are 200x200)

function readSheet(dir, name) {
  const png = PNG.sync.read(readFileSync(join(dir, name + '.png')));
  const frames = [];
  for (let f = 0; f < png.width / PACK_FW; f++) {
    const fr = new Frame(PACK_FW, png.height);
    for (let y = 0; y < png.height; y++) for (let x = 0; x < PACK_FW; x++) {
      const i = (y * png.width + f * PACK_FW + x) * 4;
      if (png.data[i + 3] > 0) fr.set(x, y, hexAt(png.data, i));
    }
    frames.push(fr);
  }
  return frames;
}

/** Every (x, y) at which the 190x72 strip frame equals the pack frame pixel for pixel. */
function findCrop(strip, sheet) {
  const hits = [];
  for (let oy = 0; oy <= sheet.h - FH; oy++) for (let ox = 0; ox <= sheet.w - FW; ox++) {
    let same = true;
    for (let y = 0; same && y < FH; y++) for (let x = 0; x < FW; x++) {
      if (strip.get(x, y) !== sheet.get(ox + x, oy + y)) { same = false; break; }
    }
    if (same) hits.push([ox, oy]);
  }
  return hits;
}

/**
 * Jump and Fall cut at the same crop as the other strips, then moved up or down
 * so the lowest pixel of each strip is on the idle feet row: the game lifts the
 * sprite by the jump height, so the feet in the picture are where the hurtbox starts.
 */
function packStrips(dir, idle) {
  const crop = findCrop(idle[0], readSheet(dir, 'Idle')[0]);
  const check = findCrop(readStrip(join(SAM_DIR, 'walk.png'))[0], readSheet(dir, 'Run')[0]);
  if (crop.length !== 1 || check.length !== 1 || String(crop[0]) !== String(check[0])) {
    throw new Error(`no single crop offset: idle ${JSON.stringify(crop)}, walk ${JSON.stringify(check)}`);
  }
  const [ox, oy] = crop[0];
  console.log(`crop offset in the pack frames: (${ox}, ${oy}) (idle = Idle, walk = Run)`);
  const feet = idle[0].rows()[1];
  const strips = {};
  for (const name of ['Jump', 'Fall']) {
    const sheet = readSheet(dir, name);
    const dy = feet - (Math.max(...sheet.map((fr) => fr.rows()[1])) - oy);
    strips[name] = sheet.map((fr) => {
      const out = new Frame();
      for (let y = 0; y < fr.h; y++) for (let x = 0; x < fr.w; x++) {
        const c = fr.get(x, y);
        if (!c) continue;
        if (!out.in(x - ox, y - oy + dy)) throw new Error(`${name}: pixel (${x}, ${y}) falls outside the 190x72 box`);
        out.set(x - ox, y - oy + dy, c);
      }
      return out;
    });
    console.log(`${name}: ${sheet.length} frames, shifted ${dy} px to put the lowest pixel on the feet row`);
  }
  return strips;
}

// ---------- preview ----------

// 3x5 pixel font for the labels (same as tools/prop-sprites.mjs).
const FONT = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
  E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
  I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111', M: '101111111101101',
  N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101',
  S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101',
  X: '101101010101101', Y: '101101010010010', Z: '111001010100111', 0: '111101101101111', 1: '010110010010111',
  2: '110001010100111', 3: '110001010001110', 4: '101101111001001', 5: '111100110001110',
  6: '011100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001110',
  '.': '000000000000010', '-': '000000111000000', '(': '010100100100010', ')': '010001001001010',
  '/': '001001010100100', ',': '000000000010100', ':': '000010000010000', ' ': '000000000000000', '?': '110001010000010',
};

function rect(dst, x, y, w, h, rgb) {
  for (let yy = Math.max(0, y); yy < Math.min(dst.height, y + h); yy++) {
    for (let xx = Math.max(0, x); xx < Math.min(dst.width, x + w); xx++) dst.data.set([...rgb, 255], (yy * dst.width + xx) * 4);
  }
}

function text(dst, str, x, y, k = 2, color = '#ffffff') {
  for (const ch of str) {
    const glyph = FONT[ch] ?? FONT['?'];
    for (let i = 0; i < 15; i++) if (glyph[i] === '1') rect(dst, x + (i % 3) * k, y + Math.floor(i / 3) * k, k, k, hex(color));
    x += 4 * k;
  }
}

/**
 * A frame as the game draws it, as a sampler in source px: rotated and scaled
 * about the feet (centre bottom) like samuraiTransform, lifted `lift` source px.
 */
function posed(fr, { rot = 0, sx = 1, sy = 1, lift = 0 } = {}) {
  const c = Math.cos(rot), s = Math.sin(rot);
  return (X, Y) => {
    const dx = X - FW / 2, dy = Y - (FH - lift);
    const u = (dx * c + dy * s) / sx, v = (-dx * s + dy * c) / sy;
    return fr.get(Math.floor(FW / 2 + u), Math.floor(FH + v));
  };
}

const BG = hex('#6e6878'), BELOW = hex('#4a3c34');
const FLOOR = [0, hex('#f0e0c0')];
const CROUCH_GUIDES = [
  FLOOR,
  [25, hex('#5ee07a')],   // 60 px on screen: the crouch hurtbox
  [40.8, hex('#ff6ad5')], // 98 px on screen: bottom of the high shot
];
const JUMP_GUIDES = [FLOOR, [15, hex('#5ad8ff')]]; // 36 px on screen: top of the low shot

/**
 * One cell: `sample(x, y)` gives the colour at source position (x, y) (floats;
 * frame coordinates, feet on row 71) or null. Drawn at k px per source px.
 */
function cell(dst, ox, oy, k, view, sample, label, guides = CROUCH_GUIDES) {
  const { x0, y0, w, h } = view;
  for (let y = 0; y < h * k; y++) for (let x = 0; x < w * k; x++) {
    const sx = x0 + x / k, sy = y0 + y / k;
    const c = sample(sx, sy);
    dst.data.set([...(c ? hex(c) : sy >= FH ? BELOW : BG), 255], ((oy + y) * dst.width + ox + x) * 4);
  }
  for (const [above, rgb] of guides) {
    const y = Math.round((FH - above - y0) * k);
    if (y >= 0 && y < h * k) rect(dst, ox, oy + y - 1, w * k, 2, rgb);
  }
  if (label) text(dst, label, ox + 4, oy + 4, 2, '#ffffff');
}

// Jump physics and the old jump look, as in src/manifest.ts and the old samuraiTransform.
const GAME_SCALE = 2.4, JUMP_SPEED = 690, JUMP_GRAVITY = 1980;
const JUMP_AIRTIME = (2 * JUMP_SPEED) / JUMP_GRAVITY;
/** Seconds into the jump at which the samurai is `y` game px up, rising or falling. */
function jumpTime(y, rising) {
  const r = Math.sqrt(Math.max(0, JUMP_SPEED ** 2 - 2 * JUMP_GRAVITY * y));
  return (JUMP_SPEED + (rising ? -r : r)) / JUMP_GRAVITY;
}
function oldJump(walk0, y, rising) {
  const p = Math.min(1, jumpTime(y, rising) / JUMP_AIRTIME);
  return posed(walk0, { rot: -0.12 + 0.3 * p, sy: p < 0.2 ? 1.08 : 0.9, sx: p < 0.2 ? 0.94 : 1.05, lift: y / GAME_SCALE });
}

function preview(idle, frames, air) {
  const pick = (fr) => (x, y) => fr.get(Math.floor(x), Math.floor(y));
  const mirror = (fr) => (x, y) => fr.get(FW - 1 - Math.floor(x), Math.floor(y));
  const oldCrouch = posed(idle[0], { sx: 1.12, sy: 0.58 });
  const view = { x0: 62, y0: 14, w: 64, h: 62 };
  const mview = { ...view, x0: FW - view.x0 - view.w };
  const big = [
    [view, pick(idle[0]), 'IDLE 0'],
    [view, oldCrouch, 'OLD CROUCH'],
    ...frames.slice(0, 4).map((fr, i) => [view, pick(fr), `CROUCH ${i}`]),
    ...frames.slice(4).map((fr, i) => [view, pick(fr), `CROUCH ${i + 4}`]),
    [mview, mirror(frames[0]), 'CROUCH 0 FLIPPED'],
    [mview, mirror(idle[0]), 'IDLE 0 FLIPPED'],
  ];
  const k = 5, gap = 8, perRow = 6;
  const small = [pick(idle[0]), oldCrouch, pick(frames[0]), mirror(frames[0])];
  const sk = 2, sview = { x0: 50, y0: 10, w: 90, h: 66 };
  // Jump cells: [label, sampler]; a tall view so the top of the jump (120 px = 50 source px up) fits.
  const jk = 4, jview = { x0: 62, y0: -38, w: 64, h: 114 };
  const jump = [];
  if (air) {
    const walk0 = readStrip(join(SAM_DIR, 'walk.png'))[0];
    const at = (fr, y) => posed(fr, { lift: y / GAME_SCALE });
    jump.push(
      ['OLD UP 36', oldJump(walk0, 36, true)], ['OLD TOP 120', oldJump(walk0, 120, true)], ['OLD DOWN 36', oldJump(walk0, 36, false)],
      ['JUMP 0 AT 0', at(air.jump[0], 0)], ['JUMP 1 UP 36', at(air.jump[1], 36)],
      ['FALL 0 TOP 120', at(air.fall[0], 120)], ['FALL 1 DOWN 36', at(air.fall[1], 36)],
    );
  }
  const W = Math.max(perRow * (view.w * k + gap), jump.length * (jview.w * jk + gap)) + gap;
  const bigH = Math.ceil(big.length / perRow) * (view.h * k + gap);
  const smallH = 24 + sview.h * sk + gap;
  const jumpH = jump.length ? 24 + jview.h * jk + gap : 0;
  const out = new PNG({ width: W, height: gap + bigH + smallH + jumpH });
  for (let i = 0; i < out.width * out.height; i++) out.data.set([26, 26, 34, 255], i * 4);
  big.forEach(([v, s, label], i) => {
    const ox = gap + (i % perRow) * (v.w * k + gap), oy = gap + Math.floor(i / perRow) * (v.h * k + gap);
    cell(out, ox, oy, k, v, s, label);
  });
  let y = gap + bigH;
  text(out, 'AT 2X (THE GAME DRAWS 2.4X): IDLE, OLD CROUCH, CROUCH 0, FLIPPED.  LINES: FLOOR, 60 PX HURTBOX, 98 PX HIGH SHOT', gap, y + 4, 2, '#ffe9b0');
  small.forEach((s, i) => {
    const v = i === 3 ? { ...sview, x0: FW - sview.x0 - sview.w } : sview;
    cell(out, gap + i * (sview.w * sk + gap), y + 22, sk, v, s);
  });
  y += smallH;
  if (jump.length) {
    text(out, 'JUMP AT 4X, LIFTED BY THE JUMP HEIGHT IN GAME PX. OLD: A WALK FRAME BENT BY THE OLD TRANSFORM. LINES: FLOOR, 36 PX LOW SHOT', gap, y + 4, 2, '#ffe9b0');
    jump.forEach(([label, s], i) => cell(out, gap + i * (jview.w * jk + gap), y + 22, jk, jview, s, label, JUMP_GUIDES));
  }
  return out;
}

// ---------- main ----------

const idle = readStrip(join(SAM_DIR, 'idle.png'));
const used = new Set(idle.flatMap((fr) => fr.col.filter(Boolean)));
for (const c of Object.values(PAL)) if (!used.has(c)) throw new Error(`${c} is not an idle colour`);
const frames = buildCrouch(idle);
for (const fr of frames) if (fr.rows()[1] !== idle[0].rows()[1]) throw new Error('crouch feet are not on the idle feet row');
writeFileSync(join(SAM_DIR, 'crouch.png'), PNG.sync.write(stripPNG(frames)));
const tall = (fr) => fr.rows()[1] - fr.rows()[0] + 1;
console.log(`wrote public/assets/samurai/crouch.png: ${frames.length} frames, ${frames.map(tall).join('/')} px tall (idle ${idle.map(tall).join('/')})`);

const packAt = process.argv.indexOf('--pack');
if (packAt > 0) {
  const dir = process.argv[packAt + 1];
  if (!dir || dir.startsWith('--')) throw new Error('--pack needs the Sprites folder of the Martial Hero pack');
  const strips = packStrips(dir, idle);
  writeFileSync(join(SAM_DIR, 'jump.png'), PNG.sync.write(stripPNG(strips.Jump)));
  writeFileSync(join(SAM_DIR, 'fall.png'), PNG.sync.write(stripPNG(strips.Fall)));
  console.log('wrote public/assets/samurai/jump.png and fall.png');
}

if (process.argv.includes('--preview')) {
  const air = ['jump', 'fall'].every((n) => existsSync(join(SAM_DIR, n + '.png')))
    ? { jump: readStrip(join(SAM_DIR, 'jump.png')), fall: readStrip(join(SAM_DIR, 'fall.png')) }
    : null;
  mkdirSync(CAND, { recursive: true });
  writeFileSync(join(CAND, 'samurai-preview.png'), PNG.sync.write(preview(idle, frames, air)));
  console.log('wrote candidates/samurai-preview.png');
}
