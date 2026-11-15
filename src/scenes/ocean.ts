import { BOAT_GEOM, boatLanternPos } from '../core/assets';
import { KANJI_FONT } from '../core/fonts';
import { drawPrompts } from '../input/prompts';
import { fish as fishDefs, ocean, sprites, text, tiers } from '../manifest';
import type { FishInstance, Game, Prompt, Scene, SceneParams } from '../types';
import { drawPineIsland, drawSunsetSea, drawSunsetSky, drawTorii, makeSeigaiha } from '../ui/backdrop';
import { drawOutlinedText } from '../ui/hud';

const L = ocean.layout;
// Underwater palette: the fight scene's dusk violets sinking into deep indigo.
const DEEP_STOPS: Array<[number, [number, number, number]]> = [
  [0, [92, 74, 148]], [30, [50, 46, 116]], [80, [24, 22, 72]], [150, [7, 5, 24]],
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
  const rodX = L.boatX + L.rodDx;

  let mode: Mode = 'idle';
  let hx = rodX;
  let hy = surfaceY + L.hookIdleDy;
  let camY = 0;
  let boatBob = 0;
  const swimmers: SwimFish[] = [];
  const spawnedChunks = new Set<number>();
  const bubbles: Bubble[] = [];

  const limitY = (): number => surfaceY + game.state.maxDepth * ppm;
  const depthOf = (worldY: number): number => (worldY - surfaceY) / ppm;
  const sy = (worldY: number): number => worldY - camY;
  const spriteW = (f: FishInstance): number => sprites[f.def.sprite]?.w ?? 64;

  const seigaiha = makeSeigaiha(W - L.gaugeX + 2, PLAY_H, L.seigaihaR, '#241538', 'rgba(150,130,220,0.45)');

  for (let i = 0; i < L.bubbleCount; i++) {
    bubbles.push({ x: Math.random() * W, wy: Math.random() * H, speed: 20 + Math.random() * 30, r: 1.5 + Math.random() * 2.5 });
  }

  // ---------- Fish spawning ----------

  function spawnChunk(c: number): void {
    const top = surfaceY + L.fishTopM * ppm + c * H;
    const bottom = Math.min(top + H, limitY() + L.fishBeyondPx);
    if (bottom <= top) return;
    const count = Math.max(1, Math.round(ocean.fishPerScreen * ((bottom - top) / H)));
    const used: number[] = [];
    for (let n = 0; n < count; n++) {
      for (let attempt = 0; attempt < 6; attempt++) {
        const y = lerp(top, bottom, Math.random());
        if (used.some((u) => Math.abs(u - y) < L.fishMinGapPx)) continue;
        const f = game.state.pickFish(depthOf(y));
        if (!f) continue;
        used.push(y);
        const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
        swimmers.push({
          fish: f, x: Math.random() * W, baseY: y, dir,
          speed: f.def.swimSpeed * (1 + (Math.random() * 2 - 1) * L.fishSpeedVariation),
          phase: Math.random() * Math.PI * 2,
        });
        break;
      }
    }
  }

  function ensureChunks(): void {
    const first = Math.floor((camY - surfaceY - L.fishTopM * ppm) / H) - 1;
    const last = Math.floor((camY + H - surfaceY - L.fishTopM * ppm) / H) + 1;
    for (let c = Math.max(0, first); c <= last; c++) {
      if (spawnedChunks.has(c)) continue;
      spawnedChunks.add(c);
      spawnChunk(c);
    }
  }

  const fishY = (s: SwimFish): number => s.baseY + Math.sin(game.time * 1.5 + s.phase) * L.fishBobPx;

  // ---------- Update ----------

  function updateFish(dt: number): void {
    for (const s of swimmers) {
      s.x += s.dir * s.speed * dt;
      const half = spriteW(s.fish) / 2 + L.fishWrapMargin;
      if ((s.dir === 1 && s.x > W + half) || (s.dir === -1 && s.x < -half)) {
        s.x = s.dir === 1 ? -half : W + half;
        const again = game.state.pickFish(depthOf(s.baseY));
        if (again) {
          s.fish = again;
          s.speed = again.def.swimSpeed * (1 + (Math.random() * 2 - 1) * L.fishSpeedVariation);
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
      boatBob = Math.sin(game.time * 1.6) * L.boatBobPx;

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
        hx = clamp(hx + input.moveX() * h.steerSpeed * dt, L.hookSteerMargin, W - L.hookSteerMargin);
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
          if (hy <= surfaceY + L.hookIdleDy) {
            hy = surfaceY + L.hookIdleDy;
            hx = rodX;
            mode = 'idle';
          }
        }
        updateFish(dt);
        if (checkHook()) return;
      }
      if (mode === 'idle') updateFish(dt);

      const target = Math.max(0, hy - L.hookAnchorY);
      camY += (target - camY) * Math.min(1, dt * L.cameraLerp);
      updateBubbles(dt);
      ensureChunks();
    },

    render(ctx) {
      const t = game.time;
      const waterY = sy(surfaceY);
      const camDepth = Math.max(0, depthOf(camY));
      const waveAt = (x: number, phase: number): number =>
        waterY + Math.sin(x * 0.03 + t * 1.6 + phase) * 3 + Math.sin(x * 0.07 - t * 2.3 + phase) * 1.5;

      // Sunset sky and far sea, shared with the fight stage.
      if (waterY > 0) {
        const horizon = waterY - L.seaBand;
        drawSunsetSky(ctx, t, { width: W, top: waterY - surfaceY, horizonY: horizon, sunX: L.sunX, sunR: L.sunR });
        drawPineIsland(ctx, L.islandX, horizon, 1);
        drawTorii(ctx, L.toriiX, horizon, 24);
        drawSunsetSea(ctx, t, {
          width: W, horizonY: horizon, bottomY: waterY + 8, crestY: waterY - 8,
          sunX: L.sunX, sunR: L.sunR, waveRows: 3, glintRows: 4,
        });
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

      // Sunset-coloured shafts of light near the surface, slanting away from the sun.
      const rayStrength = clamp(1 - (camDepth + (H / ppm) * 0.3) / 40, 0, 1) * 0.14;
      if (rayStrength > 0.005) {
        ctx.save();
        const top = Math.max(0, waterY);
        const rg = ctx.createLinearGradient(0, top, 0, H);
        rg.addColorStop(0, `rgba(255,180,110,${rayStrength})`);
        rg.addColorStop(1, 'rgba(255,120,140,0)');
        ctx.fillStyle = rg;
        for (let i = 0; i < 6; i++) {
          const bx = i * 170 + 60 + Math.sin(t * 0.4 + i * 1.7) * 30;
          ctx.beginPath();
          ctx.moveTo(bx, top);
          ctx.lineTo(bx + 40, top);
          ctx.lineTo(bx - 130, H);
          ctx.lineTo(bx - 200, H);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      // Bubbles
      ctx.save();
      ctx.strokeStyle = 'rgba(230,210,255,0.4)';
      ctx.lineWidth = 1.5;
      for (const b of bubbles) {
        const y = b.wy - camY;
        if (y < waterY + 4) continue;
        ctx.beginPath();
        ctx.arc(b.x + Math.sin(t * 2 + b.wy * 0.05) * 3, y, b.r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      // Boat with the resting samurai, the rod, the line and the hook.
      const boatX = L.boatX + L.boatDrawDx;
      const boatCY = surfaceY + L.boatKeelDepth - sprites.boat.h / 2 + 2 + boatBob;
      const gunwaleY = boatCY + sprites.boat.h / 2 - BOAT_GEOM.gunwaleFromBottom;
      const hands = drawBoat(ctx, boatX, boatCY, gunwaleY, waterY, t);
      const rodTipY = sy(surfaceY + L.rodDy + boatBob);
      if (sy(boatCY) > -160) drawRod(ctx, hands.x, sy(hands.y), rodX, rodTipY);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,235,210,0.8)';
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
          flipX: movingLeft, time: t, alpha: dim ? L.unreachableAlpha : 1,
        });
        if (s.fish.tier > 0) {
          ctx.save();
          ctx.globalAlpha = dim ? L.unreachableAlpha : 1;
          const ly = y - (sprites[s.fish.def.sprite]?.h ?? 40) / 2 - 10;
          drawOutlinedText(ctx, s.fish.name, s.x, ly, { size: 15, color: '#ffdd22' });
          ctx.restore();
        }
      }

      // Front wave strip over the boat's hull
      if (waterY > -20 && waterY < H) {
        ctx.save();
        ctx.fillStyle = 'rgba(70,56,140,0.55)';
        ctx.beginPath();
        ctx.moveTo(0, waveAt(0, 1.3) + 2);
        for (let x = 8; x <= W; x += 8) ctx.lineTo(x, waveAt(x, 1.3) + 2);
        ctx.lineTo(W, waterY + 18);
        ctx.lineTo(0, waterY + 18);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,214,170,0.75)';
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
        ctx.lineTo(L.gaugeX - 4, limScreen);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        const label = `MAX DEPTH ${game.state.maxDepth} M — BUY A LONGER LINE`;
        drawOutlinedText(ctx, label, 16, limScreen - 14, { size: 18, align: 'left', color: '#ff7b6b' });
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

  // ---------- Boat ----------

  /**
   * Reflection, ripples, the resting samurai and the hull. Returns where his
   * hands are, in world coordinates, so the rod can start there.
   */
  function drawBoat(
    ctx: CanvasRenderingContext2D, boatX: number, boatCY: number, gunwaleY: number, waterY: number, t: number,
  ): { x: number; y: number } {
    const def = sprites.boat;
    const sam = sprites.samuraiSit;
    const k = sam.w / L.samSrcW;
    const samX = boatX + L.samDx;
    const samCY = gunwaleY + L.samSink - sam.h / 2;
    const hands = { x: samX + L.samHands.x * k, y: samCY + L.samHands.y * k };
    if (sy(boatCY) < -160 || sy(boatCY) > H + 120) return hands;

    // Soft broken reflection of the dark hull, and of the lantern, under the water line.
    const hullW = def.w * 0.8;
    for (let i = 0; i < 6; i++) {
      const w = hullW * (1 - i * 0.12) * (0.85 + 0.15 * Math.sin(t * 2 + i * 1.3));
      ctx.fillStyle = `rgba(30,12,36,${0.3 - i * 0.045})`;
      ctx.fillRect(Math.round(boatX - w / 2 + Math.sin(t * 1.4 + i) * 4), Math.round(waterY + 8 + i * 5), Math.round(w), 3);
    }
    const lantern = boatLanternPos(def.w, def.h);
    const lanternX = boatX - lantern.x; // the boat is drawn mirrored (prow left)
    for (let i = 0; i < 4; i++) {
      const w = 14 - i * 3 + Math.sin(t * 3 + i) * 2;
      ctx.fillStyle = `rgba(255,170,90,${0.4 - i * 0.08})`;
      ctx.fillRect(Math.round(lanternX - w / 2 + Math.sin(t * 2 + i) * 2), Math.round(waterY + 9 + i * 6), Math.round(w), 2);
    }

    // Ripples spreading from bow and stern.
    for (const [ex, dir] of [[boatX - def.w / 2 + 4, -1], [boatX + def.w / 2 - 12, 1]] as const) {
      for (let i = 0; i < 2; i++) {
        const p = (t * 0.45 + i * 0.5) % 1;
        const len = Math.round(8 + p * 12);
        const x = Math.round(ex + dir * (4 + p * 26));
        ctx.fillStyle = `rgba(255,220,190,${0.6 * (1 - p)})`;
        ctx.fillRect(dir < 0 ? x - len : x, Math.round(waterY + 2 + p * 3), len, 2);
      }
    }

    // The samurai at the stern, calm, breathing; the gunwale hides his legs.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, Math.round(sy(gunwaleY)) + 2);
    ctx.clip();
    game.assets.draw(ctx, 'samuraiSit', samX, sy(samCY), { time: t });
    ctx.restore();

    game.assets.draw(ctx, 'boat', boatX, sy(boatCY), { flipX: true, time: t });
    return hands;
  }

  /** A bamboo rod from his hands to the tip, with dark nodes, bowing slightly. */
  function drawRod(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void {
    const cx = (x0 + x1) / 2;
    const cy = Math.min(y0, y1) - 6;
    const at = (u: number): [number, number] => [
      (1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * cx + u * u * x1,
      (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * cy + u * u * y1,
    ];
    const SEG = 12;
    ctx.save();
    ctx.lineCap = 'round';
    for (const pass of [0, 1]) {
      for (let i = 0; i < SEG; i++) {
        const [ax, ay] = at(i / SEG);
        const [bx, by] = at((i + 1) / SEG);
        const thick = 4 - (i / SEG) * 2.8;
        ctx.strokeStyle = pass === 0 ? '#1a0a05' : (i % 3 === 2 ? '#8a6a30' : '#d8b868');
        ctx.lineWidth = pass === 0 ? thick + 2 : thick;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      }
    }
    ctx.restore();
  }

  // ---------- Overlays ----------

  function drawHud(ctx: CanvasRenderingContext2D): void {
    drawOutlinedText(ctx, text.title, 16, 30, { size: 34, align: 'left' });
    drawOutlinedText(ctx, `${game.state.gold} RYO`, 16, 64, { size: 22, align: 'left', color: '#ffdd22' });
  }

  /** A nobori banner by the gauge with the hook's depth written down it. */
  function drawBanner(ctx: CanvasRenderingContext2D, depthM: number): void {
    const { x, y, w, h } = L.banner;
    ctx.save();
    ctx.fillStyle = '#1a0a05';
    ctx.fillRect(x - 6, y, 4, h + 10);          // pole
    ctx.fillRect(x - 6, y + 4, w + 8, 3);       // top rod
    ctx.fillStyle = '#7a4a26';
    ctx.fillRect(x - 5, y, 2, h + 10);
    ctx.fillStyle = '#1a0a05';
    ctx.fillRect(x - 1, y + 7, w + 2, h + 1);   // cloth outline
    ctx.fillStyle = '#efe2c4';
    ctx.fillRect(x, y + 8, w, h - 1);
    ctx.fillStyle = '#b8282e';
    ctx.fillRect(x, y + 8, w, 26);
    ctx.fillRect(x, y + 8, 3, h - 1);
    if (seigaiha) {
      ctx.beginPath(); ctx.rect(x + 3, y + h - 14, w - 3, 21); ctx.clip();
      ctx.drawImage(seigaiha, x + 3, y + h - 14);
    }
    ctx.restore();
    const cx = x + w / 2 + 1;
    drawOutlinedText(ctx, '深', cx, y + 22, { size: 18, color: '#fff', font: KANJI_FONT, outline: '#5a0a0a' });
    drawOutlinedText(ctx, String(Math.floor(depthM)), cx, y + 54, { size: 22, color: '#1a0a0a', outline: '#efe2c4' });
    drawOutlinedText(ctx, 'M', cx, y + 76, { size: 14, color: '#b8282e', outline: '#efe2c4' });
  }

  function drawGauge(ctx: CanvasRenderingContext2D, lim: number): void {
    const maxM = game.state.maxDepth;
    const viewTopM = depthOf(camY);
    const viewBotM = depthOf(camY + PLAY_H);
    const hookM = Math.max(0, depthOf(hy));
    drawBanner(ctx, hookM);
    ctx.save();
    ctx.fillStyle = '#241538';
    ctx.fillRect(L.gaugeX - 2, 0, W - L.gaugeX + 2, PLAY_H);
    ctx.beginPath();
    ctx.rect(L.gaugeX - 2, 0, W - L.gaugeX + 2, PLAY_H);
    ctx.clip();
    if (seigaiha) {
      const off = ((camY % L.seigaihaR) + L.seigaihaR) % L.seigaihaR;
      ctx.drawImage(seigaiha, L.gaugeX - 2, -off - L.seigaihaR);
    }
    ctx.fillStyle = '#1a0a0a';
    ctx.fillRect(L.gaugeX - 2, 0, 2, PLAY_H);

    // Bands for unlocked fish, repeated per tier
    const labels: Array<[string, number, string]> = [];
    fishDefs.forEach((def, idx) => {
      const lane = idx % L.gaugeLanes;
      const colour = sprites[def.sprite]?.placeholder.color ?? '#ccc';
      for (let k = 0; ; k++) {
        const a = def.depthMin + k * tiers.depth;
        const b = def.depthMax + k * tiers.depth;
        if (a > maxM) break;
        if (b < viewTopM || a > viewBotM) continue;
        const y0 = sy(surfaceY + a * ppm);
        const y1 = sy(surfaceY + b * ppm);
        const x = L.gaugeX + 2 + lane * L.gaugeLaneW;
        ctx.fillStyle = '#1a0a0a';
        ctx.fillRect(x - 1, y0 - 1, L.gaugeLaneW + 1, y1 - y0 + 2);
        ctx.fillStyle = colour;
        ctx.fillRect(x, y0, L.gaugeLaneW - 1, y1 - y0);
        labels.push([def.name.toUpperCase(), clamp((y0 + y1) / 2, 8, PLAY_H - 8), colour]);
      }
    });

    // Beyond max depth is out of reach
    const limS = sy(lim);
    if (limS < PLAY_H) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(L.gaugeX - 2, Math.max(0, limS), W - L.gaugeX + 2, PLAY_H);
    }

    // Ruler
    const tickX = L.gaugeX + 2 + L.gaugeLanes * L.gaugeLaneW + 2;
    for (let m = Math.max(0, Math.ceil(viewTopM / 10) * 10); m <= viewBotM; m += 10) {
      const y = sy(surfaceY + m * ppm);
      ctx.fillStyle = 'rgba(255,240,220,0.9)';
      ctx.fillRect(tickX - 3, y, 4, 2);
      drawOutlinedText(ctx, String(m), tickX + 3, y + 1, { size: 11, align: 'left' });
    }

    // Max marker
    if (limS > -10 && limS < PLAY_H + 10) {
      ctx.fillStyle = '#ff6b6b';
      ctx.fillRect(L.gaugeX - 2, limS - 1, W - L.gaugeX + 2, 2);
      drawOutlinedText(ctx, `MAX ${maxM}`, W - 3, limS - 9, { size: 11, align: 'right', color: '#ff7b6b' });
    }

    // Hook marker
    const hs = sy(hy);
    ctx.fillStyle = '#fff';
    ctx.fillRect(L.gaugeX - 2, hs - 1, W - L.gaugeX + 2, 2);
    ctx.restore();

    for (const [name, my, colour] of labels) {
      drawOutlinedText(ctx, name, L.gaugeX - 6, my, { size: 11, align: 'right', color: colour });
    }

    const py = clamp(hs, 12, PLAY_H - 12);
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(L.gaugeX - 3, py); ctx.lineTo(L.gaugeX - 10, py - 5); ctx.lineTo(L.gaugeX - 10, py + 5);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    drawOutlinedText(ctx, `${hookM.toFixed(1)} M`, L.gaugeX - 13, py, { size: 17, align: 'right' });
  }
}
