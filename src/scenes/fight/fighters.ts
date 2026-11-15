// Drawing the two fighters plus all the juice that makes them read:
// slash trails, charge glow, shield, dash ghosts, fish slip-state tells.
import { fight as F, sprites } from '../../manifest';
import type { FightState } from '../../fight/sim';
import type { Assets, FishInstance } from '../../types';
import { drawOutlinedText } from '../../ui/hud';

// ---------- look-and-feel constants ----------
/** Fish on-screen size: its longest side is this many times its body diameter (2 * size). */
export const FISH_DRAW_SIZE = 1.55;
/** How far the fish leans back from horizontal when "standing", radians. */
const FISH_STAND_TILT = 1.1;
export const FISH_TILT_BY_MODE: Record<FightState['fish']['mode'], number> = {
  roam: FISH_STAND_TILT, slip: 0.45, vulnerable: 0.55, tell: 1.35, attack: 0.12, stunned: 0.8, puffed: 0.2,
  aim: 1.35, charge: 0.05, shoot: 0.9,
};
/** Rotation per px/s of horizontal fish speed (lean into the movement). */
const FISH_MOVE_LEAN = 0.0011;
const FISH_MOVE_LEAN_MAX = 0.4;
const PUFF_SCALE = 1.6;
/** Sprites whose art already stands upright: drawn without the standing tilt. */
const UPRIGHT_SPRITES = new Set(['fish.squid']);
const ATTACK_STRETCH = { x: 1.35, y: 0.78 };
const GHOSTS = 5;
const QUICK_TRAIL = { radius: 165, thick: 30, color: '#9ff0ff', core: '#ffffff' };
const HEAVY_TRAIL = { radius: 200, thick: 54, color: '#ff9a1a', core: '#fff3b0' };
const TRAIL_FADE = 0.12;
const SLASH_FROM = -1.6; // radians, canvas angle at the start of the sweep (facing right)
const SLASH_TO = 0.85;
const SAMURAI_SHOULDER = 80; // px above the floor where the sword arc is centred

const SAM_SPRITE: Record<FightState['samurai']['move'], string> = {
  idle: 'samuraiIdle', walk: 'samuraiWalk', dash: 'samuraiWalk', quick: 'samuraiQuick',
  heavy: 'samuraiHeavy', block: 'samuraiBlock', hurt: 'samuraiHurt', crouch: 'samuraiCrouch',
  // Rising; drawSamurai swaps in samuraiFall on the way down.
  jump: 'samuraiJump',
};

/** A remembered past pose; `on` = draw it (dashing samurai, slipping fish). */
export interface Ghost { x: number; y: number; rot: number; flip: boolean; on: boolean }

/** Per-frame visual memory the scene keeps for the fighters. */
export interface Look {
  /** Samurai height last drawn, and whether he was last going up (picks the jump or the fall art). */
  samAir: { y: number; rising: boolean };
  /** World animation clock (frozen during hit-stop). */
  wt: number;
  /** Real clock. */
  rt: number;
  samGhosts: Ghost[];
  fishGhosts: Ghost[];
  fishTilt: number;
  fishVx: number;
  puff: number;
  blockFlash: number;
}

export function createLook(): Look {
  return {
    samAir: { y: 0, rising: true },
    wt: 0, rt: 0, samGhosts: [], fishGhosts: [], fishTilt: FISH_STAND_TILT, fishVx: 0,
    puff: 0, blockFlash: 0,
  };
}

export function fishScale(fish: FishInstance): number {
  const d = sprites[fish.def.sprite];
  return d ? (FISH_DRAW_SIZE * fish.def.size * 2) / Math.max(d.w, d.h) : 1;
}

/** Visual geometry of the fish this frame: centre, scale, rotation, half height. */
export function fishPose(state: FightState, fish: FishInstance, look: Look) {
  const f = state.fish;
  const d = sprites[fish.def.sprite] ?? { w: 64, h: 32 };
  const scale = fishScale(fish) * (1 + (PUFF_SCALE - 1) * look.puff);
  const tilt = UPRIGHT_SPRITES.has(fish.def.sprite) ? 0 : look.fishTilt;
  const hw = (d.w * scale) / 2;
  const hh = (d.h * scale) / 2;
  const ext = Math.abs(hw * Math.sin(tilt)) + Math.abs(hh * Math.cos(tilt));
  const lift = Math.max(0, ext - fish.def.size);
  const cx = f.x;
  const cy = F.arena.floorY - fish.def.size - f.y - lift;
  const lean = Math.max(-FISH_MOVE_LEAN_MAX, Math.min(FISH_MOVE_LEAN_MAX, look.fishVx * FISH_MOVE_LEAN));
  let wobble = Math.sin(look.wt * 7) * 0.07;
  if (f.mode === 'vulnerable') wobble = Math.sin(look.wt * 2.6) * 0.28;
  if (f.mode === 'stunned') wobble = Math.sin(look.wt * 70) * 0.08;
  const rot = -f.facing * tilt + lean + wobble;
  return { cx, cy, scale, rot, ext, hw, hh };
}

/**
 * Lure bulb centre per sprite, in the sprite's draw box (manifest w x h, origin
 * at the centre, fish facing right). The anglerfish value is ANGLER_BULB in
 * tools/fish-sprites.mjs: native pixel (7.5, 8.5) of the 55x44 art at 2x, mirrored.
 */
const LURE_ANCHOR: Record<string, { x: number; y: number }> = {
  'fish.anglerfish': { x: 40, y: -27 },
};

/** The fish sprite's breathing scale this frame (same as drawFish uses). */
function fishBreathe(state: FightState, look: Look): number {
  return state.fish.mode === 'puffed' ? 1 + 0.04 * Math.sin(look.wt * 9) : 1 + 0.03 * Math.sin(look.wt * 5);
}

/**
 * Where the anglerfish's lure glows. With the sprite drawn (`onSprite`), this
 * is the bulb in the art, following the fish's pose and facing; otherwise a
 * point above and in front of the placeholder's head.
 */
export function lurePos(state: FightState, fish: FishInstance, look: Look, onSprite = true): { x: number; y: number } {
  const p = fishPose(state, fish, look);
  const a = LURE_ANCHOR[fish.def.sprite];
  if (!a || !onSprite) {
    return {
      x: p.cx + state.fish.facing * p.hw * 0.5 + Math.sin(look.wt * 3) * 4,
      y: p.cy - p.ext - 26 + Math.cos(look.wt * 2.3) * 5,
    };
  }
  // Same transform as drawFish: translate, (attack stretch), rotate, scale and mirror.
  const k = p.scale * fishBreathe(state, look);
  const lx = state.fish.facing * a.x * k;
  const ly = a.y * k;
  const c = Math.cos(p.rot), s = Math.sin(p.rot);
  let x = lx * c - ly * s;
  let y = lx * s + ly * c;
  if (state.fish.mode === 'attack') { x *= ATTACK_STRETCH.x; y *= ATTACK_STRETCH.y; }
  return { x: p.cx + x, y: p.cy + y };
}

// ---------- shadows ----------

export function drawShadow(ctx: CanvasRenderingContext2D, x: number, radius: number, height: number): void {
  const k = Math.max(0.35, 1 - height / 260);
  ctx.save();
  ctx.fillStyle = `rgba(20,6,0,${0.42 * k})`;
  ctx.beginPath();
  ctx.ellipse(x, F.arena.floorY + 3, radius * k, 7 * k, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---------- samurai ----------

function samuraiTransform(s: FightState['samurai'], wt: number) {
  let rot = 0;
  let sx = 1;
  let sy = 1;
  let dy = 0;
  const cfgH = F.samurai.heavy;
  switch (s.move) {
    case 'idle': sy = 1 + 0.018 * Math.sin(wt * 3); break;
    case 'walk': dy = -Math.abs(Math.sin(wt * 11)) * 4; rot = s.facing * 0.04; break;
    case 'dash': rot = s.facing * 0.22; sx = 1.12; sy = 0.92; break;
    case 'block': sy = 0.95; sx = 1.03; break;
    case 'hurt': rot = -s.facing * 0.25; break;
    case 'jump': break; // the jump and fall art carry the pose; only lifted by s.y below
    case 'crouch': break; // the crouch art is already low and breathes on its own
    case 'quick':
      if (s.stage === 'startup') { rot = -s.facing * 0.08; }
      else if (s.stage === 'active') { rot = s.facing * 0.16; sx = 1.1; }
      else rot = s.facing * 0.06;
      break;
    case 'heavy':
      if (s.stage === 'startup') {
        const p = Math.min(1, s.moveTime / cfgH.startup);
        rot = -s.facing * 0.18 * p; sy = 1 - 0.08 * p; sx = 1 + 0.05 * p;
        rot += Math.sin(wt * 60) * 0.02 * p; // trembling with power
      } else if (s.stage === 'active') { rot = s.facing * 0.26; sx = 1.18; sy = 0.94; }
      else rot = s.facing * 0.1;
      break;
  }
  dy -= s.y;
  return { rot, sx, sy, dy };
}

function drawSamuraiSprite(
  ctx: CanvasRenderingContext2D, assets: Assets, id: string, x: number, flip: boolean,
  tr: { rot: number; sx: number; sy: number; dy: number }, time: number, alpha: number, tint?: string,
): void {
  const h = sprites[id]?.h ?? 128;
  ctx.save();
  ctx.translate(x, F.arena.floorY + tr.dy);
  ctx.rotate(tr.rot);
  ctx.scale(tr.sx, tr.sy);
  assets.draw(ctx, id, 0, -h / 2, { flipX: flip, time, alpha, tint });
  ctx.restore();
}

export function drawSamurai(ctx: CanvasRenderingContext2D, assets: Assets, state: FightState, look: Look): void {
  const s = state.samurai;
  // The sim has no vertical speed: compare with the height last drawn. Unchanged
  // (hit-stop) keeps the last direction; on the deck the next way is up.
  const air = look.samAir;
  if (s.y <= 0) air.rising = true;
  else if (s.y !== air.y) air.rising = s.y > air.y;
  air.y = s.y;
  const id = s.move === 'jump' && !air.rising ? 'samuraiFall' : SAM_SPRITE[s.move];
  const flip = s.facing === -1;
  const tr = samuraiTransform(s, look.wt);
  const animTime = s.move === 'quick' || s.move === 'heavy' || s.move === 'hurt' ? s.moveTime : look.wt;

  drawShadow(ctx, s.x, 34, s.y);

  // Dash after-images.
  const ghosts = look.samGhosts;
  for (let i = 0; i < ghosts.length; i++) {
    const g = ghosts[i];
    if (!g.on) continue;
    const a = 0.45 * ((i + 1) / ghosts.length);
    drawSamuraiSprite(ctx, assets, SAM_SPRITE.dash, g.x, g.flip, { rot: g.rot, sx: 1.12, sy: 0.92, dy: 0 }, look.wt, a, '#5ad8ff');
  }

  // Heavy charge glow behind the samurai.
  if (s.move === 'heavy' && s.stage === 'startup') drawCharge(ctx, s, look);

  let alpha = 1;
  if (s.invulnerable) alpha = Math.floor(look.rt * 30) % 2 ? 0.3 : 0.85;
  let tint: string | undefined;
  if (s.move === 'hurt') tint = Math.floor(look.rt * 20) % 2 ? '#ffffff' : '#ff6060';
  else if (s.move === 'heavy' && s.stage === 'startup' && s.moveTime > F.samurai.heavy.startup * 0.75) tint = '#fff2a0';
  drawSamuraiSprite(ctx, assets, id, s.x, flip, tr, animTime, alpha, tint);

  if (s.move === 'block') drawShield(ctx, s, look);
  if (s.move === 'quick' || s.move === 'heavy') drawSlash(ctx, s);
}

function drawCharge(ctx: CanvasRenderingContext2D, s: FightState['samurai'], look: Look): void {
  const p = Math.min(1, s.moveTime / F.samurai.heavy.startup);
  const x = s.x - s.facing * 22;
  const y = F.arena.floorY - SAMURAI_SHOULDER - 20;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const r = 20 + 60 * p;
  const g = ctx.createRadialGradient(x, y, 2, x, y, r);
  g.addColorStop(0, `rgba(255,240,180,${0.9 * p})`);
  g.addColorStop(0.4, `rgba(255,150,30,${0.6 * p})`);
  g.addColorStop(1, 'rgba(255,80,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  // Energy streaks converging on the blade.
  ctx.strokeStyle = `rgba(255,220,120,${0.8 * p})`;
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + look.rt * 3;
    const k = 1 - ((look.rt * 3 + i * 0.37) % 1);
    const d0 = 20 + 70 * k;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * d0, y + Math.sin(a) * d0);
    ctx.lineTo(x + Math.cos(a) * (d0 - 16), y + Math.sin(a) * (d0 - 16));
    ctx.stroke();
  }
  ctx.restore();
}

function drawShield(ctx: CanvasRenderingContext2D, s: FightState['samurai'], look: Look): void {
  const x = s.x + s.facing * 40;
  const y = F.arena.floorY - 62;
  const pulse = 0.5 + 0.2 * Math.sin(look.rt * 14) + look.blockFlash;
  const fresh = Math.max(0, 1 - s.moveTime / 0.12); // flash as the guard goes up
  const a = Math.min(1, pulse + fresh);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(x, y);
  ctx.scale(s.facing, 1);
  const g = ctx.createLinearGradient(-10, 0, 14, 0);
  g.addColorStop(0, 'rgba(90,180,255,0)');
  g.addColorStop(1, `rgba(140,210,255,${0.55 * a})`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, 18, 62, 0, -Math.PI / 2, Math.PI / 2);
  ctx.ellipse(0, 0, 6, 62, 0, Math.PI / 2, -Math.PI / 2, true);
  ctx.fill();
  ctx.strokeStyle = `rgba(220,245,255,${a})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, 0, 18, 62, 0, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  // Hexagon glints.
  ctx.strokeStyle = `rgba(200,235,255,${0.5 * a})`;
  ctx.lineWidth = 1;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.arc(10, i * 22, 6, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSlash(ctx: CanvasRenderingContext2D, s: FightState['samurai']): void {
  const heavy = s.move === 'heavy';
  const cfg = heavy ? F.samurai.heavy : F.samurai.quick;
  const look = heavy ? HEAVY_TRAIL : QUICK_TRAIL;
  const t = s.moveTime - cfg.startup;
  if (t < 0) return;
  const sweep = Math.min(1, t / cfg.active);
  const fade = t <= cfg.active ? 1 : 1 - (t - cfg.active) / TRAIL_FADE;
  if (fade <= 0) return;
  const cx = s.x + s.facing * 12;
  const cy = F.arena.floorY - SAMURAI_SHOULDER;
  const head = SLASH_FROM + (SLASH_TO - SLASH_FROM) * (0.15 + 0.85 * sweep);
  const tail = SLASH_FROM;
  const N = 18;
  const outer: [number, number][] = [];
  const inner: [number, number][] = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const a = tail + (head - tail) * u;
    const ax = s.facing === 1 ? a : Math.PI - a;
    const th = look.thick * Math.pow(u, 0.7);
    outer.push([cx + Math.cos(ax) * look.radius, cy + Math.sin(ax) * look.radius]);
    inner.push([cx + Math.cos(ax) * (look.radius - th), cy + Math.sin(ax) * (look.radius - th)]);
  }
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.globalCompositeOperation = 'lighter';
  ctx.shadowColor = look.color;
  ctx.shadowBlur = heavy ? 30 : 16;
  ctx.fillStyle = look.color;
  ctx.beginPath();
  outer.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  for (let i = inner.length - 1; i >= 0; i--) ctx.lineTo(inner[i][0], inner[i][1]);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = look.core;
  ctx.lineWidth = heavy ? 6 : 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  outer.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.restore();
}

// ---------- fish ----------

export function drawFish(
  ctx: CanvasRenderingContext2D, assets: Assets, state: FightState, fish: FishInstance, look: Look,
): void {
  const f = state.fish;
  const def = fish.def;
  const pose = fishPose(state, fish, look);
  const flip = f.facing === -1;

  drawShadow(ctx, f.x, def.size * 1.2 * (1 + look.puff * 0.5), f.y);

  // Biter tell: a red danger strip on the deck showing the lunge reach.
  if (f.mode === 'tell' && def.attack) {
    const p = f.tellProgress;
    ctx.save();
    ctx.fillStyle = `rgba(255,30,30,${0.18 + 0.25 * p * (0.5 + 0.5 * Math.sin(look.rt * 30))})`;
    const reach = def.attack.reach;
    const x0 = f.facing === 1 ? f.x : f.x - reach;
    ctx.fillRect(x0, F.arena.floorY - 2, reach, 8);
    ctx.restore();
  }

  // Special tell: a danger band at the height that will be hit, toward the samurai.
  if (f.mode === 'aim' && def.special) {
    const p = f.tellProgress;
    const a = 0.3 + 0.35 * p * (0.5 + 0.5 * Math.sin(look.rt * 30));
    const dir = state.samurai.x >= f.x ? 1 : -1;
    const x0 = dir === 1 ? f.x : F.arena.left;
    const w = dir === 1 ? F.arena.right - f.x : f.x - F.arena.left;
    ctx.save();
    if (def.special.kind === 'charge') {
      ctx.fillStyle = `rgba(255,30,30,${a})`;
      const h = def.size * F.fish.special.clearScale;
      ctx.fillRect(x0, F.arena.floorY - h, w, h);
      ctx.fillStyle = `rgba(255,220,200,${a + 0.2})`;
      ctx.fillRect(x0, F.arena.floorY - h - 2, w, 3);
    } else {
      for (const height of new Set<'low' | 'high'>(def.special.pattern ?? ['high'])) {
        const P = F.fish.special.projectile[height];
        ctx.fillStyle = height === 'low' ? `rgba(90,220,255,${a})` : `rgba(200,90,255,${a})`;
        ctx.fillRect(x0, F.arena.floorY - P.y - P.r, w, P.r * 2);
      }
    }
    ctx.restore();
  }

  // Slip after-images.
  const ghosts = look.fishGhosts;
  for (let i = 0; i < ghosts.length; i++) {
    const g = ghosts[i];
    if (!g.on) continue;
    const a = 0.5 * ((i + 1) / ghosts.length);
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.rotate(g.rot);
    assets.draw(ctx, def.sprite, 0, 0, { flipX: g.flip, scale: pose.scale, alpha: a, tint: '#9fe8ff', time: look.wt });
    ctx.restore();
  }

  // Attack speed lines trailing the lunge.
  if (f.mode === 'attack' || f.mode === 'charge') {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 7; i++) {
      const jitter = ((Math.sin(look.rt * 50 + i * 7.1) + 1) / 2);
      const y = pose.cy + (i - 3) * 11;
      const x0 = pose.cx - f.facing * (pose.hw * 0.7 + 10 + jitter * 20);
      const len = 40 + jitter * 60;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x0 - f.facing * len, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Puffed spikes, under the body so they poke out around it.
  if (look.puff > 0.05) drawSpikes(ctx, pose.cx, pose.cy, def.size * 1.5 * (1 + look.puff * 0.6), look);

  let tint: string | undefined;
  if (f.mode === 'stunned') tint = '#ffffff';
  else if (f.mode === 'tell' || f.mode === 'aim') {
    const rate = 10 + 30 * f.tellProgress;
    tint = Math.sin(look.rt * rate) > -0.2 ? (f.mode === 'aim' ? '#c06cff' : '#ff1a1a') : undefined;
  } else if (f.mode === 'attack' || f.mode === 'charge') tint = '#ff5a3a';

  ctx.save();
  ctx.translate(pose.cx, pose.cy);
  if (f.mode === 'attack' || f.mode === 'charge') ctx.scale(ATTACK_STRETCH.x, ATTACK_STRETCH.y);
  ctx.rotate(pose.rot);
  assets.draw(ctx, def.sprite, 0, 0, { flipX: flip, scale: pose.scale * fishBreathe(state, look), time: look.wt, tint });
  ctx.restore();

  if (f.slipReady && f.mode !== 'puffed') drawWetShine(ctx, pose, look);
}

/** State markers above the fish ("!", the open-window ring). Drawn above darkness and ink. */
export function drawFishMarks(ctx: CanvasRenderingContext2D, state: FightState, fish: FishInstance, look: Look): void {
  const f = state.fish;
  const pose = fishPose(state, fish, look);
  if (f.mode === 'vulnerable') drawDizzy(ctx, pose, f.facing, f.vulnLeft, f.vulnTotal, look);
  if (f.mode === 'tell') {
    const p = f.tellProgress;
    const size = 34 + 58 * p;
    const col = Math.floor(look.rt * 16) % 2 ? '#ff2a1a' : '#ffdd22';
    drawOutlinedText(ctx, '!', pose.cx, pose.cy - pose.ext - 24 - size * 0.35, { size, color: col });
  }
  // Special tell: says which dodge each hit needs, in order.
  if (f.mode === 'aim' && fish.def.special) {
    const sp = fish.def.special;
    const words = sp.kind === 'charge' ? ['JUMP!'] : (sp.pattern ?? ['high']).map((h) => (h === 'low' ? 'JUMP!' : 'DUCK!'));
    const size = 26 + 14 * f.tellProgress;
    const col = Math.floor(look.rt * 16) % 2 ? '#ffffff' : '#ffdd22';
    drawOutlinedText(ctx, words.join(' '), pose.cx, pose.cy - pose.ext - 30, { size, color: col });
  }
}

/** Special-attack projectiles: a crackling wave along the floor (low) or a ball at head height (high). */
export function drawProjectiles(ctx: CanvasRenderingContext2D, state: FightState, look: Look): void {
  ctx.save();
  for (const p of state.projectiles) {
    const y = F.arena.floorY - p.y;
    const back = -Math.sign(p.vx);
    ctx.globalCompositeOperation = 'lighter';
    if (p.height === 'low') {
      // Shock wave: a jagged crest hugging the floor.
      ctx.strokeStyle = '#8ff4ff';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#5ad8ff';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      for (let i = 0; i <= 8; i++) {
        const u = i / 8;
        const x = p.x + back * u * p.r * 3;
        const h = p.r * 2 * (1 - u) * (0.6 + 0.4 * Math.abs(Math.sin(look.rt * 40 + i * 1.7)));
        if (i === 0) ctx.moveTo(x, F.arena.floorY);
        ctx.lineTo(x, F.arena.floorY - h);
      }
      ctx.stroke();
      ctx.fillStyle = 'rgba(140,240,255,0.35)';
      ctx.beginPath();
      ctx.ellipse(p.x, F.arena.floorY - 2, p.r * 1.4, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Head-high shot with a streak behind it.
      const g = ctx.createLinearGradient(p.x, y, p.x + back * p.r * 5, y);
      g.addColorStop(0, 'rgba(200,110,255,0.8)');
      g.addColorStop(1, 'rgba(200,110,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(Math.min(p.x, p.x + back * p.r * 5), y - p.r * 0.6, p.r * 5, p.r * 1.2);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#2a0a3a';
      ctx.strokeStyle = '#e8b8ff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

function drawSpikes(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, look: Look): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(look.wt * 2) * 0.1);
  ctx.globalAlpha = Math.min(1, look.puff * 1.5);
  ctx.fillStyle = '#fff4c0';
  ctx.strokeStyle = '#3a2a00';
  ctx.lineWidth = 2;
  const n = 16;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const len = r * (1.25 + 0.08 * Math.sin(look.wt * 12 + i));
    ctx.beginPath();
    ctx.moveTo(Math.cos(a - 0.12) * r * 0.85, Math.sin(a - 0.12) * r * 0.85);
    ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
    ctx.lineTo(Math.cos(a + 0.12) * r * 0.85, Math.sin(a + 0.12) * r * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

type Pose = ReturnType<typeof fishPose>;

function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.25, y - r * 0.25); ctx.lineTo(x + r, y);
  ctx.lineTo(x + r * 0.25, y + r * 0.25); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.25, y + r * 0.25);
  ctx.lineTo(x - r, y); ctx.lineTo(x - r * 0.25, y - r * 0.25);
  ctx.closePath();
  ctx.fill();
}

/** Slip ready: a gloss sweeping over the body plus twinkling sparkles. */
function drawWetShine(ctx: CanvasRenderingContext2D, pose: Pose, look: Look): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(pose.cx, pose.cy);
  ctx.rotate(pose.rot);
  const sweep = ((look.rt * 0.9) % 1) * 2 - 1; // -1..1 across the body
  ctx.fillStyle = `rgba(220,250,255,${0.55 * (1 - Math.abs(sweep))})`;
  ctx.beginPath();
  ctx.ellipse(sweep * pose.hw * 0.7, -pose.hh * 0.35, pose.hw * 0.18, pose.hh * 0.22, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, -pose.hh * 0.45, pose.hw * 0.55, pose.hh * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#9ff0ff';
  ctx.shadowBlur = 8;
  for (let i = 0; i < 4; i++) {
    const ph = look.rt * 2.2 + i * 1.7;
    const k = Math.max(0, Math.sin(ph));
    if (k <= 0) continue;
    const a = i * 2.1 + Math.floor(ph / Math.PI) * 1.3;
    const x = pose.cx + Math.cos(a) * pose.hw * 0.9;
    const y = pose.cy + Math.sin(a) * pose.ext * 0.8;
    sparkle(ctx, x, y, 3 + 6 * k);
  }
  ctx.restore();
}

/** Vulnerable: sweat drop, orbiting dizzy stars and a shrinking window ring. */
function drawDizzy(ctx: CanvasRenderingContext2D, pose: Pose, facing: number, vulnLeft: number, vulnTotal: number, look: Look): void {
  const topY = pose.cy - pose.ext - 14;
  // Sweat drop sliding down beside the head.
  const sx = pose.cx - facing * pose.hw * 0.55;
  const sy = topY + 18 + ((look.rt * 30) % 18);
  ctx.save();
  ctx.fillStyle = '#8fd8ff';
  ctx.strokeStyle = '#0a2a4a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sx, sy - 13);
  ctx.quadraticCurveTo(sx + 8, sy, sx, sy + 5);
  ctx.quadraticCurveTo(sx - 8, sy, sx, sy - 13);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Dizzy stars.
  ctx.save();
  ctx.fillStyle = '#ffe14a';
  for (let i = 0; i < 3; i++) {
    const a = look.wt * 4 + (i / 3) * Math.PI * 2;
    sparkle(ctx, pose.cx + Math.cos(a) * 26, topY - 2 + Math.sin(a) * 7, 6);
  }
  ctx.restore();

  // Window ring: how long the fish stays open.
  const frac = vulnTotal > 0 ? Math.max(0, Math.min(1, vulnLeft / vulnTotal)) : 0;
  const rx = pose.cx;
  const ry = topY - 28;
  ctx.save();
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath(); ctx.arc(rx, ry, 13, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = frac > 0.35 ? '#ffe14a' : '#ff4a2a';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(rx, ry, 13, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); ctx.stroke();
  ctx.restore();
  drawOutlinedText(ctx, 'OPEN', rx, ry - 24, { size: 13, color: '#ffe14a' });
}
