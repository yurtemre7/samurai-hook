import type { Assets, DrawOpts, SpriteDef } from '../types';

/** Resolves a manifest path against the site base, so the game also works under a sub-path (GitHub Pages). */
export function assetUrl(src: string): string {
  return `${import.meta.env.BASE_URL}${src.replace(/^\//, '')}`;
}

/** Loads sprite images from the manifest and draws them, or a placeholder if missing. */
let scratch: HTMLCanvasElement | null = null;

export function createAssets(defs: Record<string, SpriteDef>): Assets {
  const images = new Map<string, HTMLImageElement>();

  function load(): Promise<void> {
    const jobs = Object.entries(defs)
      .filter(([, d]) => d.src)
      .map(([id, d]) => new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => { images.set(id, img); resolve(); };
        img.onerror = () => { console.warn(`[assets] missing ${d.src}; using placeholder for "${id}"`); resolve(); };
        img.src = assetUrl(d.src!);
      }));
    return Promise.all(jobs).then(() => undefined);
  }

  /** Draws the sprite straight onto ctx. A tint here fills the whole sprite rectangle, so only call it with a tint on a clean canvas. */
  function paint(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, opts: DrawOpts): void {
    const def = defs[id];
    if (!def) {
      drawPlaceholder(ctx, { src: null, w: 48, h: 48, placeholder: { shape: 'box', color: '#f0f', label: id } });
      return;
    }
    const scale = opts.scale ?? 1;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    if (opts.rotation) ctx.rotate(opts.rotation);
    ctx.globalAlpha *= opts.alpha ?? 1;
    const img = images.get(id);
    // Unflipped always faces right; art that natively faces left is mirrored.
    const nativeLeft = (def.facing ?? 'right') === 'left';
    const mirror = (opts.flipX ?? false) !== (img ? nativeLeft : false);
    ctx.scale(mirror ? -scale : scale, scale);
    if (img) {
      const frames = def.frames ?? 1;
      const fw = img.width / frames;
      const frame = Math.floor((opts.time ?? 0) * (def.fps ?? 8)) % frames;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, frame * fw, 0, fw, img.height, -def.w / 2, -def.h / 2, def.w, def.h);
    } else {
      drawPlaceholder(ctx, def, opts.time ?? 0);
      if (def.placeholder.label) {
        // Keep the label readable when mirrored.
        ctx.scale(mirror ? -1 : 1, 1);
        ctx.fillStyle = '#000';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(def.placeholder.label, 0, 0);
        ctx.scale(mirror ? -1 : 1, 1);
      }
    }
    if (opts.tint) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = opts.tint;
      ctx.fillRect(-def.w / 2, -def.h / 2, def.w, def.h);
    }
    ctx.restore();
  }

  /**
   * Draws the sprite centred on (x, y). A tint only colours the sprite's own
   * pixels: the tinted sprite is drawn to a scratch canvas ('source-atop' there
   * cannot touch what is behind it) and then blitted.
   */
  function draw(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, opts: DrawOpts = {}): void {
    if (!opts.tint) { paint(ctx, id, x, y, opts); return; }
    const d = defs[id];
    const size = Math.ceil(Math.max(d?.w ?? 64, d?.h ?? 64) * (opts.scale ?? 1) * 1.5) + 4;
    if (!scratch) scratch = document.createElement('canvas');
    if (scratch.width < size || scratch.height < size) { scratch.width = size; scratch.height = size; }
    const s = scratch.getContext('2d')!;
    s.setTransform(1, 0, 0, 1, 0, 0);
    s.globalCompositeOperation = 'source-over';
    s.globalAlpha = 1;
    s.clearRect(0, 0, size, size);
    paint(s, id, size / 2, size / 2, { ...opts, alpha: 1 });
    ctx.save();
    ctx.globalAlpha *= opts.alpha ?? 1;
    ctx.drawImage(scratch, 0, 0, size, size, x - size / 2, y - size / 2, size, size);
    ctx.restore();
  }

  return { load, has: (id) => images.has(id), draw };
}

/** Simple code-drawn stand-ins, centred on the origin, facing right. */
function drawPlaceholder(ctx: CanvasRenderingContext2D, def: SpriteDef, time = 0): void {
  const { w, h } = def;
  const { shape, color } = def.placeholder;
  ctx.fillStyle = color;
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 2;
  switch (shape) {
    case 'fish': {
      ctx.beginPath();
      ctx.ellipse(w * 0.08, 0, w * 0.38, h * 0.42, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-w * 0.26, 0); ctx.lineTo(-w * 0.5, -h * 0.4); ctx.lineTo(-w * 0.5, h * 0.4);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(w * 0.3, -h * 0.12, Math.max(3, h * 0.1), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(w * 0.32, -h * 0.12, Math.max(1.5, h * 0.05), 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'samurai': {
      ctx.fillRect(-w * 0.22, -h * 0.2, w * 0.44, h * 0.7); // robe
      ctx.strokeRect(-w * 0.22, -h * 0.2, w * 0.44, h * 0.7);
      ctx.fillStyle = '#f1c9a5';
      ctx.beginPath(); ctx.arc(0, -h * 0.3, w * 0.16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#d9b36c'; // straw hat
      ctx.beginPath(); ctx.moveTo(-w * 0.4, -h * 0.34); ctx.lineTo(0, -h * 0.5); ctx.lineTo(w * 0.4, -h * 0.34);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#ecf0f1'; ctx.lineWidth = 4; // katana
      ctx.beginPath(); ctx.moveTo(w * 0.2, h * 0.05); ctx.lineTo(w * 0.5, -h * 0.25); ctx.stroke();
      break;
    }
    case 'boat':
      drawWasen(ctx, w, h, time);
      break;
    case 'hook':
      drawPixelHook(ctx, w, h, color);
      break;
    case 'nigiri': {
      ctx.fillStyle = '#fafafa';
      ctx.beginPath(); ctx.ellipse(0, h * 0.15, w * 0.42, h * 0.3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.ellipse(0, -h * 0.12, w * 0.48, h * 0.24, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      break;
    }
    default:
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
  }
}

// ---------- Boat: an old wooden wasen, in chunky pixel art ----------
// Local frame: centred on the origin, prow to the right. The hull is cached
// (it never changes); the lantern flickers and is drawn every frame.

/** Boat hull geometry in px; the ocean scene reads it to stand the samurai behind the gunwale. */
export const BOAT_GEOM = {
  /** Gunwale height above the keel, px. */
  gunwaleFromBottom: 40,
  /** How far the prow sweeps up above the gunwale, px. */
  prowRise: 32,
  /** Stern (transom) inset from the left edge of the box, px. */
  sternInset: 10,
};

const BP = 2; // boat pixel size
const WOOD = {
  outline: '#1a0a05', seam: '#2a1408', dark: '#3a1d0e', rib: '#4a2612',
  planks: ['#7a4a26', '#6b3f20', '#74462a', '#5e3820'],
  grain: '#4e2c14', light: '#9a6238', weathered: '#7d6a5a', wet: '#33291f',
  cap: '#8a4e28', capLight: '#c07a44', patch: '#a3703f', tar: '#2e2620',
  rope: '#d9c08a', ropeDark: '#8f7448', bamboo: '#c8a860', bambooDark: '#7f6430', nail: '#120804',
};
const boatCache = new Map<string, HTMLCanvasElement>();

function hash2(a: number, b: number): number {
  let n = (a * 374761393 + b * 668265263) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function hullProfile(w: number, h: number) {
  const hw = w / 2;
  const keel = h / 2 - 2;
  const gun = h / 2 - BOAT_GEOM.gunwaleFromBottom;
  const tipTop = gun - BOAT_GEOM.prowRise;
  const xs = -hw + BOAT_GEOM.sternInset;
  const xb = hw * 0.3;
  const top = (x: number): number => {
    if (x >= xb) return gun - BOAT_GEOM.prowRise * Math.pow((x - xb) / (hw - xb), 2);
    return gun - 4 * Math.pow(Math.max(0, 1 - (x - xs) / 40), 2); // slight stern lift
  };
  const bottom = (x: number): number => {
    let b = keel - 10 * Math.pow(Math.max(0, 1 - (x - xs) / 44), 2);
    if (x > 0) b = keel - (keel - (tipTop + 8)) * Math.pow(x / hw, 1.8);
    return Math.max(b, top(x) + 6);
  };
  return { hw, keel, gun, xs, top, bottom };
}

function buildHull(w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const pad = 8;
  const c = document.createElement('canvas');
  c.width = w + pad * 2;
  c.height = h + pad * 2;
  const g = c.getContext('2d');
  if (!g) return null;
  g.translate(w / 2 + pad, h / 2 + pad);
  const P = BP;
  const { hw, xs, top, bottom } = hullProfile(w, h);
  const snap = (v: number): number => Math.round(v / P) * P;
  const cell = (x: number, y: number, col: string, cw = P, ch = P): void => { g.fillStyle = col; g.fillRect(x, y, cw, ch); };
  const x0 = snap(xs);
  const x1 = snap(hw - 2);
  const PLANKS = 4;

  // Silhouette outline one pixel larger all round.
  for (let x = x0 - P; x <= x1 + P; x += P) {
    const xc = Math.min(x1, Math.max(x0, x));
    cell(x, snap(top(xc)) - P, WOOD.outline, P, snap(bottom(xc)) - snap(top(xc)) + 3 * P);
  }

  // Planks, column by column, following the sheer of the hull.
  for (let x = x0; x <= x1; x += P) {
    const t = snap(top(x));
    const b = snap(bottom(x));
    const span = Math.max(P, b - t);
    for (let y = t; y <= b; y += P) {
      const f = (y - t) / span;
      const pi = Math.min(PLANKS - 1, Math.floor(f * PLANKS));
      const plankTop = t + Math.round((pi * span) / PLANKS / P) * P;
      const row = (y - plankTop) / P;
      let col = WOOD.planks[pi];
      const gx = Math.floor((x + pi * 23) / 12);
      if (hash2(gx, y) < 0.22) col = WOOD.grain;               // grain streaks
      if (hash2(Math.floor(x / 20), pi * 31 + 7) < 0.18 && hash2(x, y) < 0.5) col = WOOD.weathered; // sun-bleached
      if (row === 1) col = WOOD.light;                          // top-lit edge of each plank
      if (f > 0.78) col = hash2(x, y + 3) < 0.3 ? WOOD.dark : WOOD.wet; // wet, darkened bottom
      if (row === 0 && pi > 0) col = WOOD.seam;                 // caulked seam
      cell(x, y, col);
    }
  }

  // Ribs with a nail head on every plank.
  for (let x = snap(xs + 26); x < hw - 30; x += 36) {
    const t = snap(top(x));
    const b = snap(bottom(x));
    cell(x, t, WOOD.rib, P, b - t);
    for (let pi = 0; pi < PLANKS; pi++) {
      const ny = snap(t + ((pi + 0.55) * (b - t)) / PLANKS);
      cell(x, ny, WOOD.nail);
      cell(x, ny - P, WOOD.capLight, P / 2, P / 2);
    }
  }

  // A newer patch plank nailed over a rotten bit, and a tarred patch near the bow.
  const patch = (px: number, pw: number, pi: number, fillCol: string): void => {
    const t = snap(top(px));
    const span = snap(bottom(px)) - t;
    const py = t + snap((pi * span) / PLANKS) + P;
    const ph = snap(span / PLANKS) - P;
    cell(px - P, py - P, WOOD.outline, pw + 2 * P, ph + 2 * P);
    cell(px, py, fillCol, pw, ph);
    cell(px, py, 'rgba(255,230,180,0.25)', pw, P);
    for (const [nx, ny] of [[px, py], [px + pw - P, py], [px, py + ph - P], [px + pw - P, py + ph - P]]) cell(nx, ny, WOOD.nail);
  };
  patch(snap(-hw * 0.42), 26, 1, WOOD.patch);
  patch(snap(hw * 0.2), 14, 2, WOOD.tar);

  // Transom at the stern.
  for (let y = snap(top(x0)); y <= snap(bottom(x0)); y += P) cell(x0, y, WOOD.dark, P * 2);

  // Gunwale cap rail following the sheer, then the stem post at the prow.
  for (let x = x0; x <= x1; x += P) {
    const t = snap(top(x));
    cell(x, t - P, WOOD.outline);
    cell(x, t, WOOD.capLight);
    cell(x, t + P, WOOD.cap);
    cell(x, t + 2 * P, WOOD.seam);
  }
  const tipY = snap(top(x1));
  cell(x1 - P, tipY - 10, WOOD.outline, 3 * P, 12);
  cell(x1, tipY - 8, WOOD.cap, P, 8);

  // Worn rope coil on the stern deck.
  const rx = snap(xs + 10);
  const ry = snap(top(xs + 10));
  const coil = [5, 8, 9, 9]; // rope turns, top to bottom, in pixels wide
  coil.forEach((n, i) => {
    const yy = ry - (coil.length - i) * P;
    const xx = rx + Math.round((9 - n) / 2) * P;
    cell(xx - P, yy - (i === 0 ? P : 0), WOOD.outline, (n + 2) * P, P + (i === 0 ? P : 0));
    for (let k = 0; k < n; k++) cell(xx + k * P, yy, (k + i) % 3 === 0 ? WOOD.ropeDark : WOOD.rope);
  });
  cell(rx + 9 * P, ry - 2 * P, WOOD.outline, P, 4 * P); // loose end over the side
  cell(rx + 9 * P, ry - P, WOOD.rope, P, 2 * P);

  // Bamboo basket (biku) hanging off the side by a cord.
  const bx = snap(xs + 54);
  const by = snap(top(xs + 54)) + 2 * P;
  cell(bx + 3 * P, by - 2 * P, WOOD.ropeDark, P, 3 * P);
  const bw = [4, 6, 7, 7, 7, 6, 5];
  bw.forEach((n, i) => {
    const xx = bx + Math.round((7 - n) / 2) * P;
    cell(xx - P, by + i * P, WOOD.outline, (n + 2) * P, P);
    for (let k = 0; k < n; k++) cell(xx + k * P, by + i * P, (k + i) % 2 ? WOOD.bambooDark : WOOD.bamboo);
  });
  cell(bx, by + 7 * P, WOOD.outline, 7 * P, P);

  // Lantern pole near the prow.
  const lx = snap(hw - 44);
  const lt = snap(top(lx));
  cell(lx - P, -h / 2 + 2, WOOD.outline, 3 * P, lt - (-h / 2 + 2));
  cell(lx, -h / 2 + 2, WOOD.cap, P, lt - (-h / 2 + 2));
  cell(lx - P, -h / 2 + 2, WOOD.outline, 9 * P, 2 * P); // little yard arm
  cell(lx, -h / 2 + 2, WOOD.cap, 7 * P, P);
  return c;
}

/** Where the boat's lantern hangs, in the boat's local frame. */
export function boatLanternPos(w: number, h: number): { x: number; y: number } {
  return { x: Math.round((w / 2 - 44) / BP) * BP + 6 * BP, y: -h / 2 + 2 + 3 * BP };
}

function drawWasen(ctx: CanvasRenderingContext2D, w: number, h: number, time: number): void {
  const key = `${w}x${h}`;
  let hull = boatCache.get(key);
  if (!hull) {
    const built = buildHull(w, h);
    if (!built) return;
    hull = built;
    boatCache.set(key, hull);
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(hull, -hull.width / 2, -hull.height / 2);

  // Paper lantern (chochin) hanging from the yard arm, flickering.
  const { x, y } = boatLanternPos(w, h);
  const flick = 0.85 + 0.15 * Math.sin(time * 9) * Math.sin(time * 5.3);
  const sway = Math.round(Math.sin(time * 1.6) * 1);
  const glow = ctx.createRadialGradient(x, y + 14, 2, x, y + 14, 40);
  glow.addColorStop(0, `rgba(255,170,80,${0.45 * flick})`);
  glow.addColorStop(1, 'rgba(255,120,60,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 40, y - 26, 80, 80);
  const P = BP;
  const lx = x + sway * P;
  ctx.fillStyle = WOOD.outline;
  ctx.fillRect(lx - P / 2, y, P, 2 * P);
  const rows = [3, 5, 6, 6, 6, 6, 5, 3];
  rows.forEach((n, i) => {
    const yy = y + (i + 2) * P;
    ctx.fillStyle = WOOD.outline;
    ctx.fillRect(lx - (n / 2 + 1) * P, yy, (n + 2) * P, P);
    const band = i === 0 || i === rows.length - 1;
    ctx.fillStyle = band ? '#1a0a05' : (i % 2 ? `rgb(${Math.round(225 * flick)},${Math.round(64 * flick)},40)` : `rgb(${Math.round(240 * flick)},${Math.round(90 * flick)},50)`);
    ctx.fillRect(lx - (n / 2) * P, yy, n * P, P);
  });
  ctx.fillStyle = `rgba(255,225,150,${0.7 * flick})`;
  ctx.fillRect(lx - 2 * P, y + 4 * P, P, 3 * P);
}

// ---------- Hook: a small pixel-art iron hook with a red silk whipping ----------

const HOOK_ART = [
  '....XXX...',
  '....X.X...',
  '....XXX...',
  '....rrr...',
  '.....X....',
  '.....X....',
  '.....X....',
  '.....X....',
  '.....X....',
  'X....X....',
  'XX...X....',
  'X....X....',
  '.X..X.....',
  '..XX......',
];

function drawPixelHook(ctx: CanvasRenderingContext2D, w: number, h: number, color: string): void {
  const P = Math.max(1, Math.round(Math.min(w / HOOK_ART[0].length, h / HOOK_ART.length)));
  const ox = -(HOOK_ART[0].length * P) / 2;
  const oy = -(HOOK_ART.length * P) / 2;
  ctx.fillStyle = '#10131a';
  HOOK_ART.forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch !== '.') ctx.fillRect(ox + i * P - 1, oy + j * P - 1, P + 2, P + 2);
  }));
  HOOK_ART.forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch === '.') return;
    ctx.fillStyle = ch === 'r' ? '#d8343a' : (i >= 5 ? color : '#a9b4ba');
    ctx.fillRect(ox + i * P, oy + j * P, P, P);
  }));
}
