// Pure, deterministic fight simulation. No DOM, canvas, window or audio here:
// the fight scene draws `state` and plays sounds for the returned events.
//
// Coordinates: x in px on the 960-wide arena (`fight.arena`). Fish `y` is the
// height above the floor (0 = on the floor). Event `x, y` are SCREEN px (y is
// already converted with `arena.floorY`), ready for popups and particles.
import { fight as F } from '../manifest';
import type { FightInput, FightOutcome, FishInstance, SamuraiStats } from '../types';

export interface FightState {
  phase: 'intro' | 'fighting' | 'over';
  outcome: FightOutcome | null;
  /** Seconds; counts down only while 'fighting'. */
  timeLeft: number;
  /** > 0 while the action is frozen after a landed hit. */
  hitStop: number;
  samurai: {
    x: number; facing: 1 | -1;
    hp: number; maxHp: number;
    move: 'idle' | 'walk' | 'quick' | 'heavy' | 'block' | 'dash' | 'hurt';
    /** For quick / heavy only, else null. */
    stage: 'startup' | 'active' | 'recovery' | null;
    /** Seconds in the current move. */
    moveTime: number;
    invulnerable: boolean;
    /** Landed hits and whiffed slashes (slips and bounces count as neither). */
    hits: number; misses: number;
  };
  fish: {
    x: number; y: number;
    facing: 1 | -1;
    hp: number; maxHp: number;
    mode: 'roam' | 'slip' | 'vulnerable' | 'tell' | 'attack' | 'stunned' | 'puffed';
    modeTime: number;
    /** True = the next strike that connects will be slipped. */
    slipReady: boolean;
    /** 0..1 during 'tell', else 0. */
    tellProgress: number;
    /** Seconds of the vulnerable window left (also runs through 'stunned'), 0 when none. */
    vulnLeft: number;
  };
  effects: { dark: boolean; inkLeft: number };
}

export type FightEventType =
  | 'fightStart' | 'quick' | 'heavyStart' | 'heavySwing' | 'hit' | 'heavyHit' | 'slip'
  | 'tell' | 'attack' | 'bitten' | 'blocked' | 'dodged' | 'bounce' | 'puff' | 'unpuff'
  | 'ink' | 'dash' | 'win' | 'timeout' | 'ko';

export type FightEvent = { type: FightEventType; x: number; y: number; damage?: number };

export interface FightSim {
  readonly state: FightState;
  step(dt: number, input: FightInput): FightEvent[];
}

/** Small arc used for slips, corner escapes, hops and lunges. */
interface Arc { fromX: number; toX: number; t: number; dur: number; h: number }

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const sign = (v: number): 1 | -1 => (v < 0 ? -1 : 1);
const smooth = (p: number) => p * p * (3 - 2 * p);

export function createFight(inst: FishInstance, stats: SamuraiStats, rng: () => number = Math.random): FightSim {
  const def = inst.def;
  const A = F.arena;
  const S = F.samurai;
  const FF = F.fish;
  const mid = (A.left + A.right) / 2;
  const fishMinX = A.left + def.size;
  const fishMaxX = A.right - def.size;
  const samMinX = A.left + S.bodyRadius;
  const samMaxX = A.right - S.bodyRadius;
  const fishMidY = A.floorY - def.size; // screen y of the fish body centre on the floor
  const samMidY = A.floorY - 64;

  const state: FightState = {
    phase: 'intro',
    outcome: null,
    timeLeft: def.timer,
    hitStop: 0,
    samurai: {
      x: mid - 160, facing: 1, hp: stats.maxHp, maxHp: stats.maxHp,
      move: 'idle', stage: null, moveTime: 0, invulnerable: false, hits: 0, misses: 0,
    },
    fish: {
      x: mid + 160, y: 0, facing: -1, hp: inst.maxHp, maxHp: inst.maxHp,
      mode: 'roam', modeTime: 0, slipReady: true, tellProgress: 0, vulnLeft: 0,
    },
    effects: { dark: def.gimmick === 'dark', inkLeft: 0 },
  };
  const s = state.samurai;
  const f = state.fish;

  // ---- hidden samurai state ----
  let introLeft = F.introDelay;
  let buffered: { kind: 'quick' | 'heavy'; life: number } | null = null;
  let strikeResolved = false;
  let dashDir: 1 | -1 = 1;
  let dashCd = 0;
  let iframes = 0;
  let hurtLeft = 0;
  let knockV = 0; // px/s, decays linearly over knockLeft
  let knockLeft = 0;

  // ---- hidden fish state ----
  let arc: Arc | null = null;     // slip dart, corner escape or lunge
  let hop: Arc | null = null;     // small cosmetic hop while roaming
  let stunLeft = 0;
  let fishKnockV = 0;
  let pref = def.move.keepAway;   // preferred distance, re-rolled on each reposition
  let weavePhase = rng() * Math.PI * 2;
  let repoLeft = 0.5;
  let crossCd = 0;
  let attackCd = def.attack ? def.attack.cooldown : 0;
  let lungeHit = false;
  let puffTimer = 0;
  let inkTimer = 0;

  const events: FightEvent[] = [];
  const emit = (type: FightEventType, x: number, y: number, damage?: number) => {
    events.push(damage === undefined ? { type, x, y } : { type, x, y, damage });
  };
  const fishScreenY = () => fishMidY - f.y;

  function setFishMode(m: FightState['fish']['mode']) {
    f.mode = m;
    f.modeTime = 0;
    f.tellProgress = 0;
    f.slipReady = m === 'roam' || m === 'puffed';
  }

  function setMove(m: FightState['samurai']['move']) {
    s.move = m;
    s.moveTime = 0;
    s.stage = m === 'quick' || m === 'heavy' ? 'startup' : null;
  }

  function faceFish() {
    if (Math.abs(f.x - s.x) > 1) s.facing = sign(f.x - s.x);
  }

  function endFight(outcome: FightOutcome) {
    state.outcome = outcome;
    state.phase = 'over';
    if (outcome === 'win') emit('win', f.x, fishScreenY());
    else if (outcome === 'ko') emit('ko', s.x, samMidY);
    else emit('timeout', mid, A.floorY - 200);
  }

  // ---------- samurai ----------

  function startStrike(kind: 'quick' | 'heavy') {
    faceFish();
    setMove(kind);
    strikeResolved = false;
    buffered = null;
    if (kind === 'quick') emit('quick', s.x + s.facing * 40, samMidY);
    else emit('heavyStart', s.x, samMidY);
  }

  function hurtSamurai(stun: number, push: number) {
    setMove('hurt');
    hurtLeft = stun;
    knockV = push;
    knockLeft = stun;
  }

  function strikeConnects(reach: number): boolean {
    const dx = f.x - s.x;
    if (f.mode === 'slip') return false;
    if (f.y > FF.hitHeight) return false;
    if (dx * s.facing < -S.bodyRadius * 0.5) return false; // behind the samurai
    return Math.abs(dx) <= reach + def.size * 0.5;
  }

  function resolveStrike(kind: 'quick' | 'heavy') {
    strikeResolved = true;
    if (f.mode === 'puffed') {
      const away = -sign(f.x - s.x);
      hurtSamurai(FF.puff.stun, away * FF.puff.knockback);
      emit('bounce', (s.x + f.x) / 2, fishScreenY());
      return;
    }
    if (f.slipReady) {
      startSlip();
      return;
    }
    const dmg = kind === 'quick' ? stats.quickDamage : stats.heavyDamage;
    f.hp = Math.max(0, f.hp - dmg);
    s.hits += 1;
    emit(kind === 'quick' ? 'hit' : 'heavyHit', f.x, fishScreenY(), dmg);
    state.hitStop = F.hitStop;
    if (f.hp <= 0) { endFight('win'); return; }
    if (f.mode === 'tell' || f.mode === 'attack') f.vulnLeft = Math.max(f.vulnLeft, FF.lungeRecovery);
    arc = null;
    hop = null;
    f.y = 0;
    fishKnockV = sign(f.x - s.x) * FF.hitPush;
    stunLeft = FF.hitStun;
    setFishMode('stunned');
  }

  function updateSamurai(dt: number, input: FightInput) {
    dashCd = Math.max(0, dashCd - dt);
    iframes = Math.max(0, iframes - dt);
    if (buffered) { buffered.life -= dt; if (buffered.life <= 0) buffered = null; }
    s.moveTime += dt;

    // knockback slide (hurt, bounce, blocked)
    if (knockLeft > 0) {
      const step = Math.min(dt, knockLeft);
      s.x += knockV * step;
      knockV -= (knockV / knockLeft) * step;
      knockLeft -= step;
    }

    const busy = s.move === 'quick' || s.move === 'heavy' || s.move === 'dash' || s.move === 'hurt';
    if (busy && (input.quick || input.heavy)) {
      buffered = { kind: input.heavy ? 'heavy' : 'quick', life: S.buffer };
    }

    switch (s.move) {
      case 'quick':
      case 'heavy': {
        const cfg = s.move === 'quick' ? S.quick : S.heavy;
        const t = s.moveTime;
        if (t < cfg.startup) s.stage = 'startup';
        else if (t < cfg.startup + cfg.active) {
          if (s.stage !== 'active' && s.move === 'heavy') emit('heavySwing', s.x + s.facing * 60, samMidY);
          s.stage = 'active';
          if (!strikeResolved && strikeConnects(cfg.reach)) resolveStrike(s.move);
        } else if (t < cfg.startup + cfg.active + cfg.recovery) {
          if (s.stage === 'active' && !strikeResolved) { strikeResolved = true; s.misses += 1; }
          s.stage = 'recovery';
        } else {
          if (!strikeResolved) { strikeResolved = true; s.misses += 1; }
          setMove('idle');
        }
        break;
      }
      case 'dash': {
        s.x += dashDir * (S.dash.distance / S.dash.duration) * dt;
        if (s.moveTime >= S.dash.duration) setMove('idle');
        break;
      }
      case 'hurt': {
        hurtLeft -= dt;
        if (hurtLeft <= 0) setMove('idle');
        break;
      }
      default:
        break;
    }

    // free states: idle / walk / block (also the step a move just ended)
    if (s.move === 'idle' || s.move === 'walk' || s.move === 'block') {
      const dir = Math.abs(input.moveX) > 0.3 ? sign(input.moveX) : 0;
      if (input.defendPressed && dir !== 0 && dashCd <= 0) {
        setMove('dash');
        dashDir = dir;
        dashCd = S.dash.cooldown + S.dash.duration;
        iframes = S.dash.iframes;
        emit('dash', s.x, samMidY);
      } else if (input.quick || input.heavy) {
        startStrike(input.heavy ? 'heavy' : 'quick');
      } else if (buffered) {
        startStrike(buffered.kind);
      } else if (input.defendHeld && dir === 0) {
        if (s.move !== 'block') setMove('block');
        faceFish();
      } else if (Math.abs(input.moveX) > 0.05) {
        if (s.move !== 'walk') setMove('walk');
        const before = s.x;
        s.x += clamp(input.moveX, -1, 1) * S.walkSpeed * dt;
        // Walking cannot push through a fish on the floor (dashing can).
        const sep = S.bodyRadius + def.size * 0.5;
        if (f.y < FF.hitHeight && f.mode !== 'slip' && Math.abs(before - f.x) >= sep - 0.01 && Math.abs(s.x - f.x) < sep) {
          s.x = f.x - sign(f.x - before) * sep;
        }
        faceFish();
      } else {
        if (s.move !== 'idle') setMove('idle');
        faceFish();
      }
    }

    s.x = clamp(s.x, samMinX, samMaxX);
    s.invulnerable = iframes > 0;
  }

  // ---------- fish ----------

  function startArc(toX: number, dur: number, h: number) {
    arc = { fromX: f.x, toX: clamp(toX, fishMinX, fishMaxX), t: 0, dur, h };
    hop = null;
  }

  function startSlip() {
    const away = sign(f.x - s.x);
    const target = f.x + away * def.slip.dart;
    if (target >= fishMinX && target <= fishMaxX) {
      setFishMode('slip');
      startArc(target, FF.slipDuration, FF.slipArc);
    } else {
      // Not enough room: over the samurai's head to the far side.
      const far = s.x - away * Math.max(def.move.keepAway, def.slip.dart - Math.abs(f.x - s.x));
      setFishMode('slip');
      startArc(far, FF.slipDuration * 1.3, FF.overArc);
    }
    f.slipReady = false;
    emit('slip', f.x, fishScreenY());
  }

  /** Advances the current arc. Returns true when it just finished. */
  function runArc(a: Arc, dt: number): boolean {
    a.t = Math.min(a.dur, a.t + dt);
    const p = a.t / a.dur;
    f.x = a.fromX + (a.toX - a.fromX) * smooth(p);
    f.y = a.h * Math.sin(Math.PI * p);
    return a.t >= a.dur;
  }

  function lungeContact() {
    if (lungeHit) return;
    if (Math.abs(f.x - s.x) > S.bodyRadius + def.size * 0.6) return;
    lungeHit = true;
    const atk = def.attack!;
    const away = sign(s.x - f.x);
    if (s.invulnerable) {
      emit('dodged', s.x, samMidY);
    } else if (s.move === 'block') {
      const dmg = atk.damage * (1 - S.blockReduction);
      s.hp = Math.max(0, s.hp - dmg);
      knockV = away * S.blockPush;
      knockLeft = 0.15;
      emit('blocked', s.x, samMidY, dmg);
    } else {
      s.hp = Math.max(0, s.hp - atk.damage);
      hurtSamurai(S.hurtStun, away * S.hurtKnockback);
      buffered = null;
      emit('bitten', s.x, samMidY, atk.damage);
    }
    if (s.hp <= 0) endFight('ko');
  }

  function roam(dt: number) {
    const dx = f.x - s.x;
    const side = dx === 0 ? (f.x < mid ? -1 : 1) : sign(dx);
    const restless = def.move.restless;

    repoLeft -= dt;
    if (repoLeft <= 0) {
      repoLeft = (2.4 - 1.9 * restless) * (0.6 + 0.8 * rng());
      pref = def.move.keepAway * (0.8 + 0.5 * rng());
      if (!hop && rng() < 0.3 + 0.5 * restless) hop = { fromX: 0, toX: 0, t: 0, dur: 0.32, h: 18 + 26 * rng() };
    }
    weavePhase += dt * (1.5 + 3 * restless);
    const weave = Math.sin(weavePhase) * 28 * (0.4 + restless);

    // Cornered and crowded: cross over the samurai to the open side.
    const room = side > 0 ? fishMaxX - f.x : f.x - fishMinX;
    if (crossCd <= 0 && room < 24 && Math.abs(dx) < pref * 0.85) {
      const to = s.x - side * pref;
      setFishMode('roam');
      startArc(to, Math.max(0.45, Math.abs(to - f.x) / (def.move.speed * 2.2)), FF.overArc);
      crossCd = FF.crossCooldown;
      return;
    }

    const desired = clamp(s.x + side * pref + weave, fishMinX, fishMaxX);
    const diff = desired - f.x;
    const maxStep = def.move.speed * dt;
    f.x += Math.abs(diff) <= maxStep ? diff : sign(diff) * maxStep;

    if (hop) {
      hop.t += dt;
      const p = Math.min(1, hop.t / hop.dur);
      f.y = hop.h * Math.sin(Math.PI * p);
      if (p >= 1) { hop = null; f.y = 0; }
    } else f.y = 0;
  }

  function updateFish(dt: number) {
    f.modeTime += dt;
    crossCd = Math.max(0, crossCd - dt);
    if (Math.abs(f.x - s.x) > 1 && f.mode !== 'slip' && f.mode !== 'attack') f.facing = sign(s.x - f.x);

    // gimmick timers
    if (def.gimmick === 'puff' && f.mode !== 'puffed') puffTimer += dt;
    if (def.gimmick === 'ink') {
      inkTimer += dt;
      if (inkTimer >= FF.ink.every) {
        inkTimer -= FF.ink.every;
        state.effects.inkLeft = FF.ink.duration;
        emit('ink', f.x, fishScreenY());
      }
    }
    if (def.attack && f.mode === 'roam') attackCd -= dt;

    switch (f.mode) {
      case 'roam': {
        if (arc) {
          if (runArc(arc, dt)) { arc = null; f.y = 0; }
          break;
        }
        if (def.gimmick === 'puff' && puffTimer >= FF.puff.every) {
          puffTimer = 0;
          setFishMode('puffed');
          hop = null;
          f.y = 0;
          emit('puff', f.x, fishScreenY());
          break;
        }
        if (def.attack && attackCd <= 0 && Math.abs(f.x - s.x) <= def.attack.reach && f.y < 4) {
          setFishMode('tell');
          hop = null;
          f.y = 0;
          emit('tell', f.x, fishScreenY());
          break;
        }
        roam(dt);
        break;
      }
      case 'puffed': {
        // Drifts slowly toward its preferred distance.
        const side = sign(f.x - s.x);
        const desired = clamp(s.x + side * pref, fishMinX, fishMaxX);
        const diff = desired - f.x;
        const maxStep = def.move.speed * 0.3 * dt;
        f.x += Math.abs(diff) <= maxStep ? diff : sign(diff) * maxStep;
        if (f.modeTime >= FF.puff.duration) {
          setFishMode('roam');
          emit('unpuff', f.x, fishScreenY());
        }
        break;
      }
      case 'tell': {
        const atk = def.attack!;
        f.tellProgress = Math.min(1, f.modeTime / atk.tell);
        if (f.modeTime >= atk.tell) {
          const dir = sign(s.x - f.x);
          f.facing = dir;
          const travel = Math.min(Math.abs(s.x - f.x) - S.bodyRadius * 0.3, atk.reach * 1.15);
          setFishMode('attack');
          startArc(f.x + dir * Math.max(0, travel), FF.lungeDuration, 14);
          lungeHit = false;
          emit('attack', f.x, fishScreenY());
        }
        break;
      }
      case 'attack': {
        const done = arc ? runArc(arc, dt) : true;
        lungeContact();
        if (state.phase === 'over') break;
        if (done) {
          arc = null;
          f.y = 0;
          attackCd = def.attack!.cooldown;
          f.vulnLeft = FF.lungeRecovery;
          setFishMode('vulnerable');
        }
        break;
      }
      case 'slip': {
        if (!arc || runArc(arc, dt)) {
          arc = null;
          f.y = 0;
          f.vulnLeft = def.slip.recovery;
          setFishMode('vulnerable');
        }
        break;
      }
      case 'stunned': {
        f.vulnLeft = Math.max(0, f.vulnLeft - dt);
        stunLeft -= dt;
        f.x += fishKnockV * dt;
        fishKnockV *= Math.max(0, 1 - 10 * dt);
        if (stunLeft <= 0) {
          fishKnockV = 0;
          if (f.vulnLeft > 0) { setFishMode('vulnerable'); }
          else setFishMode('roam');
        }
        break;
      }
      case 'vulnerable': {
        f.vulnLeft -= dt;
        // Dazed: drifts slowly away with a wobble, so the samurai has to chase.
        const away = sign(f.x - s.x);
        f.x += away * def.move.speed * 0.25 * dt;
        f.y = 0;
        if (f.vulnLeft <= 0) {
          f.vulnLeft = 0;
          repoLeft = 0;
          setFishMode('roam');
        }
        break;
      }
    }
    f.x = clamp(f.x, fishMinX, fishMaxX);
  }

  function step(dt: number, input: FightInput): FightEvent[] {
    events.length = 0;
    if (state.phase === 'over') return [];

    if (state.phase === 'intro') {
      introLeft -= dt;
      if (introLeft <= 0) {
        state.phase = 'fighting';
        emit('fightStart', mid, A.floorY - 200);
      }
      return events.slice();
    }

    if (state.hitStop > 0) {
      state.hitStop = Math.max(0, state.hitStop - dt);
      return events.slice();
    }

    if (state.effects.inkLeft > 0) state.effects.inkLeft = Math.max(0, state.effects.inkLeft - dt);

    updateSamurai(dt, input);
    if (state.phase === 'fighting') updateFish(dt);

    if (state.phase === 'fighting') {
      state.timeLeft = Math.max(0, state.timeLeft - dt);
      if (state.timeLeft <= 0) endFight('timeout');
    }
    return events.slice();
  }

  return { state, step };
}
