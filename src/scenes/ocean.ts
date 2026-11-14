import { drawPrompts } from '../input/prompts';
import { fish as fishDefs, ocean, sprites, text, tiers } from '../manifest';
import type { FishInstance, Game, Prompt, Scene, SceneParams } from '../types';

// Named constants local to this scene (candidates for the manifest).
const FISH_TOP_M = 3;                 // shallowest depth fish are spawned at
const FISH_BEYOND_PX = 200;           // fish seen below the max depth (the tease)
const FISH_MIN_GAP_PX = 40;           // vertical spacing when spawning a chunk
const FISH_SPEED_VARIATION = 0.2;     // +-20% swim speed
const FISH_BOB_PX = 5;
const FISH_WRAP_MARGIN = 30;
const UNREACHABLE_ALPHA = 0.35;
const HOOK_ANCHOR_Y = 255;            // screen y the camera tries to keep the hook at
const CAMERA_LERP = 8;
const HOOK_STEER_MARGIN = 16;
const BOAT_X = 380;
const BOAT_BOB_PX = 3;
const ROD_DX = 100;                   // rod tip relative to boat centre
const ROD_DY = -62;
const HOOK_IDLE_DY = -22;             // idle hook height relative to the water line
const BUBBLE_COUNT = 22;
const GAUGE_X = 898;
const GAUGE_LANE_W = 10;
const GAUGE_LANES = 3;
const DEEP_STOPS: Array<[number, [number, number, number]]> = [
  [0, [64, 170, 220]], [30, [26, 112, 172]], [80, [9, 52, 104]], [150, [3, 15, 38]],
];

interface SwimFish {
  fish: FishInstance;
  x: number;
  baseY: number;
  dir: 1 | -1;
  speed: number;
  phase: number;
}

interface Bubble { x: number; wy: number; speed: number; r: number; }

type Mode = 'idle' | 'sinking' | 'reeling';

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

function waterColour(depthM: number): string {
  const d = Math.max(0, depthM);
  let i = 0;
  while (i < DEEP_STOPS.length - 2 && d > DEEP_STOPS[i + 1][0]) i++;
  const [d0, c0] = DEEP_STOPS[i];
  const [d1, c1] = DEEP_STOPS[i + 1];
  const t = clamp((d - d0) / (d1 - d0), 0, 1);
  return `rgb(${Math.round(lerp(c0[0], c1[0], t))},${Math.round(lerp(c0[1], c1[1], t))},${Math.round(lerp(c0[2], c1[2], t))})`;
}

export function createOceanScene(game: Game, _params: SceneParams['ocean']): Scene {
  const W = game.width;
  const H = game.height;
  const PLAY_H = H - 30;
  const surfaceY = ocean.surfaceY;
  const ppm = ocean.pxPerMetre;
  const rodX = BOAT_X + ROD_DX;

  let mode: Mode = 'idle';
  let hx = rodX;
  let hy = surfaceY + HOOK_IDLE_DY;
  let camY = 0;
  let boatBob = 0;
  const swimmers: SwimFish[] = [];
  const spawnedChunks = new Set<number>();
  const bubbles: Bubble[] = [];

  const limitY = (): number => surfaceY + game.state.maxDepth * ppm;
  const depthOf = (worldY: number): number => (worldY - surfaceY) / ppm;
  const sy = (worldY: number): number => worldY - camY;
  const spriteW = (f: FishInstance): number => sprites[f.def.sprite]?.w ?? 64;

  for (let i = 0; i < BUBBLE_COUNT; i++) {
    bubbles.push({ x: Math.random() * W, wy: Math.random() * H, speed: 20 + Math.random() * 30, r: 1.5 + Math.random() * 2.5 });
  }

  // ---------- Fish spawning ----------

  function spawnChunk(c: number): void {
    const top = surfaceY + FISH_TOP_M * ppm + c * H;
    const bottom = Math.min(top + H, limitY() + FISH_BEYOND_PX);
    if (bottom <= top) return;
    const count = Math.max(1, Math.round(ocean.fishPerScreen * ((bottom - top) / H)));
    const used: number[] = [];
    for (let n = 0; n < count; n++) {
      for (let attempt = 0; attempt < 6; attempt++) {
        const y = lerp(top, bottom, Math.random());
        if (used.some((u) => Math.abs(u - y) < FISH_MIN_GAP_PX)) continue;
        const f = game.state.pickFish(depthOf(y));
        if (!f) continue;
        used.push(y);
        const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
        swimmers.push({
          fish: f, x: Math.random() * W, baseY: y, dir,
          speed: f.def.swimSpeed * (1 + (Math.random() * 2 - 1) * FISH_SPEED_VARIATION),
          phase: Math.random() * Math.PI * 2,
        });
        break;
      }
    }
  }

  function ensureChunks(): void {
    const first = Math.floor((camY - surfaceY - FISH_TOP_M * ppm) / H) - 1;
    const last = Math.floor((camY + H - surfaceY - FISH_TOP_M * ppm) / H) + 1;
    for (let c = Math.max(0, first); c <= last; c++) {
      if (spawnedChunks.has(c)) continue;
      spawnedChunks.add(c);
      spawnChunk(c);
    }
  }

  const fishY = (s: SwimFish): number => s.baseY + Math.sin(game.time * 1.5 + s.phase) * FISH_BOB_PX;

  // ---------- Update ----------

  function updateFish(dt: number): void {
    for (const s of swimmers) {
      s.x += s.dir * s.speed * dt;
      const half = spriteW(s.fish) / 2 + FISH_WRAP_MARGIN;
      if ((s.dir === 1 && s.x > W + half) || (s.dir === -1 && s.x < -half)) {
        s.x = s.dir === 1 ? -half : W + half;
        const again = game.state.pickFish(depthOf(s.baseY));
        if (again) {
          s.fish = again;
          s.speed = again.def.swimSpeed * (1 + (Math.random() * 2 - 1) * FISH_SPEED_VARIATION);
        }
      }
    }
  }

  function checkHook(): boolean {
    const lim = limitY();
    for (const s of swimmers) {
      if (s.baseY > lim) continue;
      const reach = ocean.hook.radius + (spriteW(s.fish) / 2) * ocean.catchRadiusScale;
      const dx = s.x - hx;
      const dy = fishY(s) - hy;
      if (dx * dx + dy * dy <= reach * reach) {
        game.audio.play('hooked');
        game.go('cutscene', { fish: s.fish });
        return true;
      }
    }
    return false;
  }

  function updateBubbles(dt: number): void {
    for (const b of bubbles) {
      b.wy -= b.speed * dt;
      const s = b.wy - camY;
      if (s < -10) { b.wy += H + 20; b.x = Math.random() * W; }
      else if (s > H + 10) { b.wy -= H + 20; b.x = Math.random() * W; }
    }
  }

  return {
    enter() {
      game.audio.music('ocean');
      ensureChunks();
    },

    update(dt) {
      const input = game.input;
      boatBob = Math.sin(game.time * 1.6) * BOAT_BOB_PX;

      if (mode === 'idle') {
        if (input.pressed('confirm')) {
          game.audio.play('splash');
          mode = 'sinking';
        } else if (input.pressed('shop')) {
          game.go('shop', undefined);
          return;
        }
      } else {
        const h = ocean.hook;
        hx = clamp(hx + input.moveX() * h.steerSpeed * dt, HOOK_STEER_MARGIN, W - HOOK_STEER_MARGIN);
        const my = input.moveY();
        if (mode === 'sinking') {
          if (input.pressed('confirm')) {
            mode = 'reeling';
          } else {
            const v = my > 0 ? lerp(h.sinkSpeed, h.fastSinkSpeed, my) : lerp(h.sinkSpeed, h.brakeSpeed, -my);
            hy += v * dt;
            if (hy >= limitY()) { hy = limitY(); mode = 'reeling'; }
          }
        } else {
          hy -= h.reelSpeed * dt;
          if (hy <= surfaceY + HOOK_IDLE_DY) {
            hy = surfaceY + HOOK_IDLE_DY;
            hx = rodX;
            mode = 'idle';
          }
        }
        updateFish(dt);
        if (checkHook()) return;
      }
      if (mode === 'idle') updateFish(dt);

      const target = Math.max(0, hy - HOOK_ANCHOR_Y);
      camY += (target - camY) * Math.min(1, dt * CAMERA_LERP);
      updateBubbles(dt);
      ensureChunks();
    },

    render(ctx) {
      const t = game.time;
      const waterY = sy(surfaceY);
      const camDepth = Math.max(0, depthOf(camY));
      const waveAt = (x: number, phase: number): number =>
        waterY + Math.sin(x * 0.03 + t * 1.6 + phase) * 3 + Math.sin(x * 0.07 - t * 2.3 + phase) * 1.5;

      // Sky
      if (waterY > 0) {
        const sky = ctx.createLinearGradient(0, 0, 0, waterY);
        sky.addColorStop(0, '#9bd8f5');
        sky.addColorStop(1, '#e6f6ff');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, Math.min(H, waterY + 8));
        ctx.fillStyle = '#fff6b8';
        ctx.beginPath();
        ctx.arc(780, waterY - 90, 34, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        for (let i = 0; i < 3; i++) {
          const cx = ((i * 380 + t * (8 + i * 3)) % (W + 240)) - 120;
          const cy = waterY - 120 + i * 22;
          ctx.beginPath();
          ctx.ellipse(cx, cy, 60, 16, 0, 0, Math.PI * 2);
          ctx.ellipse(cx + 34, cy - 8, 36, 14, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Water body
      const topY = Math.max(0, waterY);
      const dTop = Math.max(0, depthOf(camY + topY));
      const dBot = depthOf(camY + H);
      const grad = ctx.createLinearGradient(0, topY, 0, H);
      grad.addColorStop(0, waterColour(dTop));
      grad.addColorStop(1, waterColour(dBot));
      ctx.fillStyle = grad;
      if (waterY > -10) {
        ctx.beginPath();
        ctx.moveTo(0, waveAt(0, 0));
        for (let x = 8; x <= W; x += 8) ctx.lineTo(x, waveAt(x, 0));
        ctx.lineTo(W, H);
        ctx.lineTo(0, H);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillRect(0, 0, W, H);
      }

      // Light rays near the surface
      const rayStrength = clamp(1 - (camDepth + (H / ppm) * 0.3) / 40, 0, 1) * 0.16;
      if (rayStrength > 0.005) {
        ctx.save();
        ctx.fillStyle = `rgba(255,255,230,${rayStrength})`;
        for (let i = 0; i < 6; i++) {
          const bx = i * 170 - 40 + Math.sin(t * 0.4 + i * 1.7) * 30;
          const top = Math.max(0, waterY);
          ctx.beginPath();
          ctx.moveTo(bx, top);
          ctx.lineTo(bx + 46, top);
          ctx.lineTo(bx + 46 + 150, H);
          ctx.lineTo(bx + 150 - 30, H);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      // Bubbles
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1.5;
      for (const b of bubbles) {
        const y = b.wy - camY;
        if (y < waterY + 4) continue;
        ctx.beginPath();
        ctx.arc(b.x + Math.sin(t * 2 + b.wy * 0.05) * 3, y, b.r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      // Boat, samurai, line, hook
      const boatY = surfaceY - 8 + boatBob;
      if (sy(boatY) > -120) {
        game.assets.draw(ctx, 'boat', BOAT_X, sy(boatY));
        game.assets.draw(ctx, 'samuraiSit', BOAT_X - 10, sy(boatY - 54));
      }
      const rodTipY = sy(surfaceY + ROD_DY + boatBob);
      ctx.save();
      ctx.strokeStyle = 'rgba(240,240,240,0.85)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(rodX, rodTipY);
      ctx.lineTo(hx, sy(hy) - 12);
      ctx.stroke();
      ctx.restore();
      game.assets.draw(ctx, 'hook', hx, sy(hy));

      // Fish
      const lim = limitY();
      for (const s of swimmers) {
        const y = sy(fishY(s));
        if (y < -80 || y > H + 80) continue;
        const dim = s.baseY > lim;
        const movingLeft = s.dir === -1;
        game.assets.draw(ctx, s.fish.def.sprite, s.x, y, {
          flipX: movingLeft, time: t, alpha: dim ? UNREACHABLE_ALPHA : 1,
        });
        if (s.fish.tier > 0) {
          ctx.save();
          ctx.globalAlpha = dim ? UNREACHABLE_ALPHA : 1;
          ctx.font = 'bold 11px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.lineWidth = 3;
          ctx.strokeStyle = 'rgba(0,0,0,0.7)';
          const ly = y - (sprites[s.fish.def.sprite]?.h ?? 40) / 2 - 3;
          ctx.strokeText(s.fish.name, s.x, ly);
          ctx.fillStyle = '#ffe27a';
          ctx.fillText(s.fish.name, s.x, ly);
          ctx.restore();
        }
      }

      // Front wave strip over the boat's hull
      if (waterY > -20 && waterY < H) {
        ctx.save();
        ctx.fillStyle = 'rgba(40,140,200,0.55)';
        ctx.beginPath();
        ctx.moveTo(0, waveAt(0, 1.3) + 2);
        for (let x = 8; x <= W; x += 8) ctx.lineTo(x, waveAt(x, 1.3) + 2);
        ctx.lineTo(W, waterY + 18);
        ctx.lineTo(0, waterY + 18);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, waveAt(0, 0));
        for (let x = 8; x <= W; x += 8) ctx.lineTo(x, waveAt(x, 0));
        ctx.stroke();
        ctx.restore();
      }

      // Max depth limit
      const limScreen = sy(lim);
      if (limScreen > -20 && limScreen < H) {
        ctx.save();
        ctx.strokeStyle = '#ff6b6b';
        ctx.lineWidth = 2;
        ctx.setLineDash([14, 10]);
        ctx.beginPath();
        ctx.moveTo(0, limScreen);
        ctx.lineTo(GAUGE_X - 4, limScreen);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        const label = `MAX DEPTH ${game.state.maxDepth} M — BUY A LONGER LINE`;
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        ctx.strokeText(label, 16, limScreen - 6);
        ctx.fillStyle = '#ff9b9b';
        ctx.fillText(label, 16, limScreen - 6);
        ctx.restore();
      }

      drawGauge(ctx, lim);
      drawHud(ctx);

      const prompts: Prompt[] =
        mode === 'idle'
          ? [{ action: 'confirm', label: 'DROP HOOK' }, { action: 'shop', label: 'SHOP' }]
          : mode === 'sinking'
            ? [{ action: 'move', label: 'STEER' }, { action: 'confirm', label: 'REEL IN' }]
            : [{ action: 'move', label: 'STEER' }];
      drawPrompts(ctx, game.input, prompts);
    },
  };

  // ---------- Overlays ----------

  function drawHud(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 26px monospace';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.strokeText(text.title, 16, 12);
    ctx.fillStyle = '#fff';
    ctx.fillText(text.title, 16, 12);
    const gold = `GOLD ${game.state.gold}`;
    ctx.font = 'bold 20px monospace';
    ctx.strokeText(gold, 16, 46);
    ctx.fillStyle = '#ffd34d';
    ctx.fillText(gold, 16, 46);
    ctx.restore();
  }

  function drawGauge(ctx: CanvasRenderingContext2D, lim: number): void {
    const maxM = game.state.maxDepth;
    const viewTopM = depthOf(camY);
    const viewBotM = depthOf(camY + PLAY_H);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,20,0.35)';
    ctx.fillRect(GAUGE_X - 2, 0, W - GAUGE_X + 2, PLAY_H);
    ctx.beginPath();
    ctx.rect(GAUGE_X - 2, 0, W - GAUGE_X + 2, PLAY_H);
    ctx.clip();

    // Bands for unlocked fish, repeated per tier
    ctx.font = '9px monospace';
    ctx.textBaseline = 'middle';
    fishDefs.forEach((def, idx) => {
      const lane = idx % GAUGE_LANES;
      const colour = sprites[def.sprite]?.placeholder.color ?? '#ccc';
      for (let k = 0; ; k++) {
        const a = def.depthMin + k * tiers.depth;
        const b = def.depthMax + k * tiers.depth;
        if (a > maxM) break;
        if (b < viewTopM || a > viewBotM) continue;
        const y0 = sy(surfaceY + a * ppm);
        const y1 = sy(surfaceY + b * ppm);
        const x = GAUGE_X + lane * GAUGE_LANE_W;
        ctx.fillStyle = colour;
        ctx.globalAlpha = 0.9;
        ctx.fillRect(x, y0, GAUGE_LANE_W - 1, y1 - y0);
        ctx.globalAlpha = 1;
        const my = clamp((y0 + y1) / 2, 8, PLAY_H - 8);
        ctx.textAlign = 'right';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0,0,0,0.75)';
        ctx.strokeText(def.name.toUpperCase(), GAUGE_X - 5, my);
        ctx.fillStyle = colour;
        ctx.fillText(def.name.toUpperCase(), GAUGE_X - 5, my);
      }
    });

    // Beyond max depth is out of reach
    const limS = sy(lim);
    if (limS < PLAY_H) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(GAUGE_X - 2, Math.max(0, limS), W - GAUGE_X + 2, PLAY_H);
    }

    // Ruler
    const tickX = GAUGE_X + GAUGE_LANES * GAUGE_LANE_W + 1;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let m = Math.max(0, Math.ceil(viewTopM / 10) * 10); m <= viewBotM; m += 10) {
      const y = sy(surfaceY + m * ppm);
      ctx.fillRect(tickX - 3, y, 3, 1);
      ctx.fillText(String(m), tickX + 1, y);
    }

    // Max marker
    if (limS > -10 && limS < PLAY_H + 10) {
      ctx.fillStyle = '#ff6b6b';
      ctx.fillRect(GAUGE_X - 2, limS - 1, W - GAUGE_X + 2, 2);
      ctx.textAlign = 'right';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(`MAX ${maxM}`, W - 3, limS - 7);
    }

    // Hook marker
    const hookM = Math.max(0, depthOf(hy));
    const hs = sy(hy);
    ctx.fillStyle = '#fff';
    ctx.fillRect(GAUGE_X - 2, hs - 1, W - GAUGE_X + 2, 2);
    ctx.restore();

    const label = `${hookM.toFixed(1)} M`;
    ctx.save();
    ctx.font = 'bold 13px monospace';
    const tw = ctx.measureText(label).width + 12;
    const py = clamp(hs, 12, PLAY_H - 12);
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(GAUGE_X - 8 - tw, py - 10, tw, 20);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, GAUGE_X - 14, py);
    ctx.restore();
  }
}
