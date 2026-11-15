// The fight scene: a thin layer over the fight simulation (src/fight/sim.ts).
// It feeds input into the sim, draws the sim's state and reacts to its events
// with sound, text and screen effects. No fight rules live here.
import { createFight, type FightEvent } from '../fight/sim';
import { drawPrompts } from '../input/prompts';
import { fight as F, sprites, text } from '../manifest';
import type { FightInput, Game, Prompt, Scene, SceneParams } from '../types';
import { drawHealthBar, drawSlamText, drawTimer, fill, drawOutlinedText } from '../ui/hud';
import { FISH_TILT_BY_MODE, createLook, drawFish, drawFishMarks, drawProjectiles, drawSamurai, fishPose, lurePos, type Ghost } from './fight/fighters';
import { Fx } from './fight/fx';
import { drawStage } from './fight/stage';

// ---------- look-and-feel constants ----------
/** Seconds the final moment stays on screen before the result screen. */
const OVER_HOLD = 1.2;
/** World speed while the final moment plays (slow motion). */
const OVER_SLOWMO = 0.25;
/** Zoom punch-in toward the fish on a K.O. */
const KO_ZOOM = 0.1;
const FIGHT_BANNER_TIME = 0.9;
const SHAKE = { hit: 6, heavyHit: 16, bitten: 11, bounce: 9, blocked: 4, win: 22, puff: 5 };
const SCALES = { hit: 10, heavyHit: 24 };
const GHOST_EVERY = 2; // world steps between remembered after-image poses
const GHOST_COUNT = 5;
const HP_LAG_DELAY = 0.35; // seconds before the white "damage taken" bar drains
const HP_LAG_SPEED = 0.9;  // fraction of the bar per second
const BAR = { w: 360, h: 22, y: 22, margin: 26 };
const DARK_LURE_RADIUS = 60;
const DARK_ALPHA = 0.95;
/** Extra px drawn around the world layer so shake and zoom never show an edge. */
const OVERSCAN = 48;

const PROMPTS: Prompt[] = [
  { action: 'move', label: 'MOVE / JUMP / DUCK', keys: 'all' },
  { action: 'quick', label: 'QUICK' },
  { action: 'heavy', label: 'HEAVY' },
  { action: 'defend', label: 'BLOCK / +DIR DASH' },
];

const pick = <T>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];

export function createFightScene(game: Game, params: SceneParams['fight']): Scene {
  const fish = params.fish;
  const sim = createFight(fish, game.state.samurai);
  const state = sim.state;
  // Dev only: lets browser checks read the fight state.
  if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __fight?: unknown }).__fight = sim;
  const W = game.width;
  const H = game.height;
  const floorY = F.arena.floorY;
  const fishColor = sprites[fish.def.sprite]?.placeholder.color ?? '#9fd0ff';
  // "biter" here means "can hurt the samurai": a lunge or a special attack.
  const biter = !!(fish.def.attack || fish.def.special);

  const fx = new Fx();
  const look = createLook();
  let t = 0;
  let fightT = -1; // seconds since "FIGHT!", -1 before
  let overT = -1;  // seconds since the fight ended, -1 before
  let left = false;
  let worldStep = 0;
  let lastFishX = state.fish.x;
  const lag = { sam: 1, fish: 1, samHold: 0, fishHold: 0 };
  let dark: HTMLCanvasElement | null = null;

  function onEvent(e: FightEvent): void {
    const dmg = e.damage !== undefined ? Math.max(1, Math.round(e.damage)) : 0;
    switch (e.type) {
      case 'fightStart':
        fightT = 0;
        game.audio.play('gong');
        game.audio.announce(text.announce.fight, { key: 'fight' });
        break;
      case 'quick': game.audio.play('slash'); break;
      case 'heavyStart': game.audio.play('uiMove'); break;
      case 'heavySwing': game.audio.play('heavy'); fx.addShake(3); break;
      case 'hit':
        game.audio.play('hit');
        fx.popup(pick(text.hit), e.x, e.y - 50, 36, '#ffffff');
        fx.popup(`-${dmg}`, e.x + 34, e.y - 10, 26, '#ffdd22');
        fx.burst(e.x, e.y, 46, '#ffffff');
        fx.scales(e.x, e.y, SCALES.hit, fishColor);
        fx.addShake(SHAKE.hit);
        break;
      case 'heavyHit':
        game.audio.play('hit');
        fx.popup(pick(text.heavyHit), e.x, e.y - 70, 54, '#ff9a1a', 0.9);
        fx.popup(`-${dmg}`, e.x + 40, e.y - 16, 38, '#ffdd22');
        fx.burst(e.x, e.y, 90, '#ffb020');
        fx.scales(e.x, e.y, SCALES.heavyHit, fishColor, 1.4);
        fx.addShake(SHAKE.heavyHit);
        fx.white = 1;
        break;
      case 'slip':
        game.audio.play('slip');
        fx.popup(pick(text.slip), e.x, e.y - 50, 36, '#8ff4ff');
        fx.drops(e.x, e.y, 10, state.samurai.x < e.x ? -1 : 1);
        break;
      case 'tell': case 'aim': game.audio.play('tell'); break;
      case 'charge': game.audio.play('dash'); fx.addShake(SHAKE.blocked); break;
      case 'shoot': game.audio.play('slip'); break;
      case 'jump': game.audio.play('dash'); fx.drops(e.x, e.y, 6, state.samurai.facing); break;
      case 'bitten':
        game.audio.play('bite');
        fx.popup(`-${dmg}`, e.x, e.y - 80, 34, '#ff4a3a');
        fx.burst(e.x, e.y - 10, 50, '#ff3a2a');
        fx.addShake(SHAKE.bitten);
        fx.red = 1;
        lag.samHold = HP_LAG_DELAY;
        break;
      case 'blocked':
        game.audio.play('block');
        fx.popup(text.block, e.x, e.y - 90, 30, '#9fd8ff');
        fx.burst(e.x + state.samurai.facing * 40, e.y, 34, '#8fd0ff');
        fx.addShake(SHAKE.blocked);
        look.blockFlash = 1;
        lag.samHold = HP_LAG_DELAY;
        break;
      case 'dodged': fx.popup(text.dodged, e.x, e.y - 90, 30, '#5ad8ff'); break;
      case 'bounce':
        game.audio.play('block');
        fx.popup(text.bounce, e.x, e.y - 60, 44, '#ffe14a');
        fx.addShake(SHAKE.bounce);
        break;
      case 'puff':
        game.audio.play('splash');
        fx.popup(text.puff, e.x, e.y - 80, 32, '#ffe14a');
        fx.addShake(SHAKE.puff);
        break;
      case 'dash': game.audio.play('dash'); break;
      case 'ink':
        game.audio.play('splash');
        fx.ink(F.arena.left + 40, F.arena.right - 40, 120, floorY - 20);
        break;
      case 'win':
        fx.addShake(SHAKE.win);
        fx.white = Math.max(fx.white, 0.8);
        break;
      default: break; // attack, unpuff, ko, timeout: the banner says it all
    }
  }

  /** Visual memory that only advances while the world moves. */
  function worldUpdate(dt: number): void {
    const f = state.fish;
    look.wt += dt;
    const vx = dt > 0 ? (f.x - lastFishX) / dt : 0;
    lastFishX = f.x;
    look.fishVx += (vx - look.fishVx) * Math.min(1, dt * 12);

    const tiltTarget = FISH_TILT_BY_MODE[f.mode];
    look.fishTilt += (tiltTarget - look.fishTilt) * Math.min(1, dt * 10);
    look.puff += ((f.mode === 'puffed' ? 1 : 0) - look.puff) * Math.min(1, dt * 12);

    if (++worldStep % GHOST_EVERY === 0) {
      const s = state.samurai;
      const pose = fishPose(state, fish, look);
      pushGhost(look.samGhosts, { x: s.x, y: 0, rot: s.facing * 0.22, flip: s.facing === -1, on: s.move === 'dash' });
      pushGhost(look.fishGhosts, { x: pose.cx, y: pose.cy, rot: pose.rot, flip: f.facing === -1, on: f.mode === 'slip' });
    }
  }

  function pushGhost(list: Ghost[], g: Ghost): void {
    list.push(g);
    if (list.length > GHOST_COUNT) list.shift();
  }

  function updateLag(dt: number): void {
    const samF = state.samurai.hp / state.samurai.maxHp;
    const fishF = state.fish.hp / state.fish.maxHp;
    lag.samHold -= dt;
    lag.fishHold -= dt;
    if (lag.samHold <= 0) lag.sam = Math.max(samF, lag.sam - HP_LAG_SPEED * dt);
    if (lag.fishHold <= 0) lag.fish = Math.max(fishF, lag.fish - HP_LAG_SPEED * dt);
    lag.sam = Math.max(lag.sam, samF);
    lag.fish = Math.max(lag.fish, fishF);
  }

  function finish(): void {
    if (left) return;
    left = true;
    const outcome = state.outcome ?? 'timeout';
    if (outcome === 'win') {
      const gold = game.state.sell(fish);
      game.go('result', { fish, outcome: 'win', goldEarned: gold, perfect: state.samurai.misses === 0 });
    } else {
      game.go('result', { fish, outcome, goldEarned: 0 });
    }
  }

  // ---------- drawing ----------

  /**
   * Anglerfish lure light, as multiples of DARK_LURE_RADIUS: `reveal` is the
   * hole cut in the dark (clear inside `inner` of it), `halo` the warm glow.
   */
  const LURE_GLOW = { reveal: 1.3, inner: 0.3, halo: 1.1 };

  function drawDarkness(ctx: CanvasRenderingContext2D): void {
    if (!dark) {
      dark = document.createElement('canvas');
      dark.width = W + 2 * OVERSCAN;
      dark.height = H + 2 * OVERSCAN;
    }
    const d = dark.getContext('2d')!;
    d.globalCompositeOperation = 'source-over';
    d.setTransform(1, 0, 0, 1, OVERSCAN, OVERSCAN);
    d.clearRect(-OVERSCAN, -OVERSCAN, W + 2 * OVERSCAN, H + 2 * OVERSCAN);
    d.fillStyle = `rgba(2,0,8,${DARK_ALPHA})`;
    d.fillRect(-OVERSCAN, -OVERSCAN, W + 2 * OVERSCAN, H + 2 * OVERSCAN);
    d.globalCompositeOperation = 'destination-out';
    /** Clears the dark: fully inside `inner` x r, fading out to r. */
    const hole = (x: number, y: number, r: number, inner = 0.45) => {
      const g = d.createRadialGradient(x, y, r * inner, x, y, r);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = g;
      d.fillRect(x - r, y - r, r * 2, r * 2);
    };
    hole(state.samurai.x, floorY - 64 - state.samurai.y, F.fish.darkRadius);
    // The anglerfish's own lure is the light: centred on the bulb in its art,
    // so it follows the fish's pose and facing, and flickers like a flame.
    const onSprite = game.assets.has(fish.def.sprite);
    const lure = lurePos(state, fish, look, onSprite);
    const flick = 0.9 + 0.06 * Math.sin(look.rt * 11) + 0.04 * Math.sin(look.rt * 23.7);
    hole(lure.x, lure.y, DARK_LURE_RADIUS * LURE_GLOW.reveal * flick, LURE_GLOW.inner);
    ctx.drawImage(dark, -OVERSCAN, -OVERSCAN);

    ctx.save();
    if (!onSprite) {
      // Placeholder art has no lure: draw a stalk and bulb.
      const pose = fishPose(state, fish, look);
      ctx.strokeStyle = 'rgba(160,200,120,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pose.cx + state.fish.facing * pose.hw * 0.2, pose.cy - pose.ext * 0.6);
      ctx.quadraticCurveTo(pose.cx, lure.y - 18, lure.x, lure.y);
      ctx.stroke();
      ctx.fillStyle = '#fbf236';
      ctx.beginPath(); ctx.arc(lure.x, lure.y, 5, 0, Math.PI * 2); ctx.fill();
    }
    // Warm glow, added on top so it shines through the dark.
    ctx.globalCompositeOperation = 'lighter';
    const r = DARK_LURE_RADIUS * LURE_GLOW.halo * flick;
    const g = ctx.createRadialGradient(lure.x, lure.y, 0, lure.x, lure.y, r);
    g.addColorStop(0, `rgba(255,230,150,${0.75 * flick})`);
    g.addColorStop(0.1, `rgba(255,200,90,${0.5 * flick})`);
    g.addColorStop(0.35, `rgba(255,140,40,${0.16 * flick})`);
    g.addColorStop(1, 'rgba(255,100,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(lure.x, lure.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawLagBar(ctx: CanvasRenderingContext2D, x: number, frac: number, lagFrac: number, alignLeft: boolean): void {
    if (lagFrac <= frac + 0.001) return;
    const a = BAR.w * frac;
    const b = BAR.w * lagFrac;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    if (alignLeft) ctx.fillRect(x + a, BAR.y, b - a, BAR.h);
    else ctx.fillRect(x + BAR.w - b, BAR.y, b - a, BAR.h);
    ctx.restore();
  }

  function drawHud(ctx: CanvasRenderingContext2D): void {
    const s = state.samurai;
    const f = state.fish;
    const lx = BAR.margin;
    const rx = W - BAR.margin - BAR.w;
    const samF = biter ? s.hp / s.maxHp : 1;
    drawHealthBar(ctx, lx, BAR.y, BAR.w, BAR.h, samF, {
      label: text.samurai.label, sub: biter ? undefined : text.samurai.safeSub, align: 'left',
      color: biter ? undefined : '#7fd0ff',
    });
    if (biter) drawLagBar(ctx, lx, samF, lag.sam, true);
    const fishF = f.hp / f.maxHp;
    drawHealthBar(ctx, rx, BAR.y, BAR.w, BAR.h, fishF, { label: fish.name, sub: fish.def.title, align: 'right' });
    drawLagBar(ctx, rx, fishF, lag.fish, false);

    drawTimer(ctx, W / 2, 46, state.timeLeft);
    drawOutlinedText(ctx, `ROUND ${game.state.round}`, W / 2, 88, { size: 18, color: '#ffdd22' });
  }

  function drawBanners(ctx: CanvasRenderingContext2D): void {
    const cy = 210;
    if (state.phase === 'intro') {
      drawSlamText(ctx, fill(text.cutscene.round, { round: game.state.round }), W / 2, cy, t, { size: 84 });
    }
    if (fightT >= 0 && fightT < FIGHT_BANNER_TIME && state.phase !== 'over') {
      ctx.save();
      ctx.globalAlpha = fightT > FIGHT_BANNER_TIME - 0.2 ? (FIGHT_BANNER_TIME - fightT) / 0.2 : 1;
      drawSlamText(ctx, text.cutscene.fight, W / 2, cy, fightT, { size: 110, color: '#ff3b2f' });
      ctx.restore();
    }
    if (state.phase === 'over' && overT >= 0) {
      if (state.outcome === 'win') drawSlamText(ctx, text.win.banner, W / 2, cy, overT, { size: 120, color: '#ff3b2f' });
      else if (state.outcome === 'timeout') drawSlamText(ctx, text.timeout.banner, W / 2, cy, overT, { size: 120, color: '#ffdd22' });
      else drawSlamText(ctx, text.ko.banner, W / 2, cy, overT, { size: 80, color: '#ff3b2f' });
    }
  }

  return {
    enter() {
      game.audio.music('fight');
    },

    update(dt) {
      t += dt;
      look.rt += dt;
      fx.update(dt);
      look.blockFlash = Math.max(0, look.blockFlash - dt * 4);
      if (fightT >= 0) fightT += dt;
      updateLag(dt);

      if (state.phase === 'over') {
        overT += dt;
        look.wt += dt * OVER_SLOWMO;
        if (overT >= OVER_HOLD) finish();
        return;
      }

      const input: FightInput = {
        moveX: game.input.moveX(),
        quick: game.input.pressed('quick'),
        heavy: game.input.pressed('heavy'),
        defendHeld: game.input.held('defend'),
        defendPressed: game.input.pressed('defend'),
        jump: game.input.pressed('up') || game.input.pressed('confirm'),
        crouch: game.input.held('down'),
        // Touch: dragging walks faster (owner's choice); keys and pad stay at normal speed.
        walkScale: game.input.dragging() ? F.samurai.touchWalkScale : 1,
      };
      // Touch dash (quick swipe or DASH button) = defend tapped with a direction, like the keyboard.
      // No direction given: dash away from the fish.
      const dash = game.input.dashDir();
      if (dash !== null) {
        input.defendPressed = true;
        input.moveX = dash !== 0 ? dash : -state.samurai.facing;
      }
      const frozen = state.hitStop > 0;
      const fishHpBefore = state.fish.hp;
      const events = sim.step(dt, input);
      if (state.fish.hp < fishHpBefore) lag.fishHold = HP_LAG_DELAY;
      if (!frozen) worldUpdate(dt);
      for (const e of events) onEvent(e);
      if (sim.state.outcome !== null) overT = 0; // the step just ended the fight
    },

    render(ctx) {
      ctx.save();
      const sh = fx.shakeOffset();
      ctx.translate(sh.x, sh.y);
      if (state.phase === 'over' && state.outcome === 'win' && overT >= 0) {
        const k = 1 - Math.pow(1 - Math.min(1, overT / 0.4), 3);
        const z = 1 + KO_ZOOM * k;
        const fx0 = state.fish.x;
        const fy0 = floorY - fish.def.size - state.fish.y;
        ctx.translate(fx0, fy0);
        ctx.scale(z, z);
        ctx.translate(-fx0, -fy0);
      }
      // Overscan so shake and zoom never reveal the canvas edge.
      ctx.fillStyle = '#1c0f3a';
      ctx.fillRect(-OVERSCAN, -OVERSCAN, W + 2 * OVERSCAN, H + 2 * OVERSCAN);
      drawStage(ctx, t, floorY, H + OVERSCAN);

      // The fighter in the air is drawn last so a slip over the head reads.
      if (state.fish.y > 60) {
        drawSamurai(ctx, game.assets, state, look);
        drawFish(ctx, game.assets, state, fish, look);
      } else {
        drawFish(ctx, game.assets, state, fish, look);
        drawSamurai(ctx, game.assets, state, look);
      }
      fx.drawWorld(ctx);
      if (state.effects.dark) drawDarkness(ctx);
      fx.drawInk(ctx, state.effects.inkLeft);
      // Above darkness and ink, so dodge-only attacks are always readable.
      drawProjectiles(ctx, state, look);
      drawFishMarks(ctx, state, fish, look);
      fx.drawPopups(ctx);
      ctx.restore();

      fx.drawFlashes(ctx, W, H);
      drawHud(ctx);
      drawBanners(ctx);
      drawPrompts(ctx, game.input, PROMPTS);
    },
  };
}
