import { describe, expect, it } from 'vitest';
import type { FightEvent, FightSim } from '../src/fight/sim';
import { fight as F, fish as fishDefs } from '../src/manifest';
import type { FightInput } from '../src/types';
import { createFight } from '../src/fight/sim';
import { createGameState } from '../src/game/state';
import { competentBot, DT, idleBot, input, makeFight, mulberry32, NONE, runFight, skipIntro, stateWith, statsAt } from './fightBots';

const def = (id: string) => fishDefs.find((f) => f.id === id)!;

/** Steps with `fn` choosing the input until `until` returns true. Returns all events. */
function run(sim: FightSim, fn: (sim: FightSim) => FightInput, until: (ev: FightEvent[], sim: FightSim) => boolean, maxSec = 30): FightEvent[] {
  const all: FightEvent[] = [];
  for (let i = 0; i < maxSec * 60; i++) {
    const ev = sim.step(DT, fn(sim));
    all.push(...ev);
    if (until(ev, sim) || sim.state.phase === 'over') return all;
  }
  throw new Error('condition never met');
}

const has = (t: FightEvent['type']) => (ev: FightEvent[]) => ev.some((e) => e.type === t);

/** Walks toward the fish; presses `strike` once in reach. */
function approachAnd(strike: 'quick' | 'heavy', reach: number) {
  return (sim: FightSim): FightInput => {
    const s = sim.state.samurai, f = sim.state.fish;
    const dx = f.x - s.x;
    const free = s.move === 'idle' || s.move === 'walk';
    if (!free) return NONE;
    if (Math.abs(dx) <= reach && f.y < F.fish.hitHeight - 10) return input({ [strike]: true });
    return input({ moveX: Math.sign(dx) });
  };
}

describe('fight flow', () => {
  it('starts with an intro, then fightStart, with the timer frozen during the intro', () => {
    const sim = makeFight('sardine');
    expect(sim.state.phase).toBe('intro');
    expect(sim.state.samurai.x).toBeLessThan(480);
    expect(sim.state.fish.x).toBeGreaterThan(480);
    const ev = skipIntro(sim);
    expect(ev.map((e) => e.type)).toEqual(['fightStart']);
    expect(sim.state.timeLeft).toBe(def('sardine').timer);
  });

  it('is deterministic for the same seed and inputs', () => {
    const a = runFight('mackerel', competentBot(), 0, 7);
    const b = runFight('mackerel', competentBot(), 0, 7);
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
    const c = runFight('piranha', competentBot(), 0, 3);
    const d = runFight('piranha', competentBot(), 0, 3);
    expect(JSON.stringify(c)).toBe(JSON.stringify(d));
  });

  it('an idle samurai times out against the sardine and loses no hp', () => {
    const r = runFight('sardine', idleBot);
    expect(r.outcome).toBe('timeout');
    expect(r.hpLeft).toBe(100);
    expect(r.events.some((e) => e.type === 'timeout')).toBe(true);
  });

  it('an idle samurai is knocked out by the shark', () => {
    const r = runFight('shark', idleBot);
    expect(r.outcome).toBe('ko');
    expect(r.state.samurai.hp).toBe(0);
    expect(r.events.filter((e) => e.type === 'bitten').length).toBeGreaterThan(0);
  });

  it('a cornered fish crosses over the samurai to the open side', () => {
    for (const id of ['sardine', 'mackerel', 'shark']) {
      const sim = makeFight(id, 2);
      skipIntro(sim);
      let crossed = false;
      let maxY = 0;
      run(sim, () => input({ moveX: 1 }), () => {
        maxY = Math.max(maxY, sim.state.fish.y);
        crossed = sim.state.fish.x < sim.state.samurai.x - 40 && sim.state.fish.y === 0;
        return crossed;
      }, 10);
      expect(crossed).toBe(true);
      expect(maxY).toBeGreaterThan(100);
    }
  });

  it('stops changing once over', () => {
    const r = runFight('sardine', idleBot);
    const sim = makeFight('sardine');
    while (sim.state.phase !== 'over') sim.step(DT, NONE);
    const snap = JSON.stringify(sim.state);
    expect(sim.step(DT, input({ quick: true, moveX: 1 }))).toEqual([]);
    expect(JSON.stringify(sim.state)).toBe(snap);
    expect(r.outcome).toBe('timeout');
  });
});

describe('the slip', () => {
  const quickReach = F.samurai.quick.reach + def('sardine').size * 0.5 - 6;
  const heavyReach = F.samurai.heavy.reach + def('sardine').size * 0.5 - 20;

  it('a strike on a slipReady fish does no damage and slips', () => {
    const sim = makeFight('sardine', 3);
    skipIntro(sim);
    expect(sim.state.fish.slipReady).toBe(true);
    const hp = sim.state.fish.hp;
    const ev = run(sim, approachAnd('quick', quickReach), has('slip'));
    expect(ev.some((e) => e.type === 'hit')).toBe(false);
    expect(sim.state.fish.hp).toBe(hp);
    expect(sim.state.fish.mode).toBe('slip');
    expect(sim.state.fish.slipReady).toBe(false);
    expect(sim.state.samurai.misses).toBe(0);
  });

  it('strikes during vulnerable land, and slipReady returns after slip.recovery', () => {
    const sim = makeFight('sardine', 4);
    skipIntro(sim);
    run(sim, approachAnd('quick', quickReach), has('slip'));
    run(sim, () => NONE, () => sim.state.fish.mode === 'vulnerable');
    const hp = sim.state.fish.hp;
    const ev = run(sim, approachAnd('heavy', heavyReach), has('heavyHit'), 3);
    const hit = ev.find((e) => e.type === 'heavyHit')!;
    expect(hit.damage).toBe(18);
    expect(sim.state.fish.hp).toBe(hp - 18);
    expect(sim.state.hitStop).toBeGreaterThan(0);
    expect(sim.state.samurai.hits).toBe(1);

    // A fresh slip, then wait the window out.
    const sim2 = makeFight('sardine', 5);
    skipIntro(sim2);
    run(sim2, approachAnd('quick', quickReach), has('slip'));
    run(sim2, () => NONE, () => sim2.state.fish.mode === 'vulnerable');
    let t = 0;
    run(sim2, () => NONE, () => { t += DT; return sim2.state.fish.slipReady; });
    expect(sim2.state.fish.mode).toBe('roam');
    expect(t).toBeCloseTo(def('sardine').slip.recovery, 1);
  });

  it('vulnLeft is 0 until a slip ends, then counts down to 0', () => {
    const sim = makeFight('sardine', 6);
    skipIntro(sim);
    expect(sim.state.fish.vulnLeft).toBe(0);
    run(sim, approachAnd('quick', quickReach), has('slip'));
    run(sim, () => NONE, () => sim.state.fish.mode === 'vulnerable');
    const recovery = def('sardine').slip.recovery;
    expect(sim.state.fish.vulnLeft).toBeGreaterThan(0);
    expect(sim.state.fish.vulnLeft).toBeLessThanOrEqual(recovery);
    let prev = sim.state.fish.vulnLeft;
    run(sim, () => NONE, () => {
      const v = sim.state.fish.vulnLeft;
      expect(v).toBeLessThanOrEqual(prev);
      prev = v;
      return sim.state.fish.mode === 'roam';
    });
    expect(sim.state.fish.vulnLeft).toBe(0);
  });

  it('vulnTotal is 0 with no window, slip.recovery once a slip ends', () => {
    const sim = makeFight('sardine', 6);
    skipIntro(sim);
    expect(sim.state.fish.vulnTotal).toBe(0);
    run(sim, approachAnd('quick', quickReach), has('slip'));
    run(sim, () => NONE, () => sim.state.fish.mode === 'vulnerable');
    expect(sim.state.fish.vulnTotal).toBe(def('sardine').slip.recovery);
    run(sim, () => NONE, () => sim.state.fish.mode === 'roam');
    expect(sim.state.fish.vulnTotal).toBe(0);
  });

  it('a hit inside an open window leaves vulnTotal unchanged', () => {
    const recovery = def('sardine').slip.recovery;
    const sim = makeFight('sardine', 4);
    skipIntro(sim);
    run(sim, approachAnd('quick', quickReach), has('slip'));
    run(sim, () => NONE, () => sim.state.fish.mode === 'vulnerable');
    run(sim, approachAnd('heavy', heavyReach), has('heavyHit'), 3);
    expect(sim.state.fish.mode).toBe('stunned');
    expect(sim.state.fish.vulnLeft).toBeGreaterThan(0);
    expect(sim.state.fish.vulnTotal).toBe(recovery);
    // Through 'stunned' and back to 'vulnerable': the total holds while the window is open.
    let sawVulnerableAgain = false;
    run(sim, () => NONE, () => {
      const f = sim.state.fish;
      if (f.vulnLeft > 0) expect(f.vulnTotal).toBe(recovery);
      if (f.mode === 'vulnerable') sawVulnerableAgain = true;
      return f.mode === 'roam';
    });
    expect(sawVulnerableAgain).toBe(true);
    expect(sim.state.fish.vulnTotal).toBe(0);
  });

  it('a whiffed slash counts as a miss', () => {
    const sim = makeFight('sardine', 1);
    skipIntro(sim);
    sim.step(DT, input({ quick: true }));
    run(sim, () => NONE, () => sim.state.samurai.move === 'idle');
    expect(sim.state.samurai.misses).toBe(1);
  });

  it('buffers a slash pressed during another move', () => {
    const sim = makeFight('sardine', 1);
    skipIntro(sim);
    sim.step(DT, input({ quick: true }));
    // Press heavy late in the quick's recovery: it starts as soon as the quick ends.
    const q = F.samurai.quick;
    const steps = Math.round((q.startup + q.active + q.recovery - 0.08) / DT);
    for (let i = 1; i < steps; i++) sim.step(DT, NONE);
    sim.step(DT, input({ heavy: true }));
    const ev = run(sim, () => NONE, has('heavyStart'), 0.5);
    expect(ev.some((e) => e.type === 'heavyStart')).toBe(true);
  });
});

describe('biters', () => {
  it('block reduces bite damage', () => {
    const sim = makeFight('piranha', 2);
    skipIntro(sim);
    const ev = run(sim, (s) => (s.state.fish.mode === 'tell' || s.state.fish.mode === 'attack'
      ? input({ defendHeld: true, defendPressed: s.state.samurai.move !== 'block' }) : NONE), (e) => has('blocked')(e) || has('bitten')(e));
    const b = ev.find((e) => e.type === 'blocked');
    expect(b).toBeDefined();
    expect(b!.damage).toBeCloseTo(def('piranha').attack!.damage * (1 - F.samurai.blockReduction));
    expect(sim.state.samurai.hp).toBeCloseTo(100 - b!.damage!);

    const sim2 = makeFight('piranha', 2);
    skipIntro(sim2);
    const ev2 = run(sim2, () => NONE, has('bitten'));
    expect(ev2.find((e) => e.type === 'bitten')!.damage).toBe(def('piranha').attack!.damage);
    expect(sim2.state.samurai.move).toBe('hurt');
  });

  it('a dash with invulnerability avoids the bite', () => {
    const sim = makeFight('shark', 2);
    skipIntro(sim);
    let dashed = false;
    const ev = run(sim, (s) => {
      if (s.state.fish.mode === 'attack' && !dashed) {
        dashed = true;
        return input({ moveX: Math.sign(s.state.fish.x - s.state.samurai.x), defendPressed: true, defendHeld: true });
      }
      return NONE;
    }, (e) => has('dodged')(e) || has('bitten')(e));
    expect(ev.some((e) => e.type === 'dash')).toBe(true);
    expect(ev.some((e) => e.type === 'dodged')).toBe(true);
    expect(sim.state.samurai.hp).toBe(100);
  });

  it('a fish in tell cannot slip, so a strike lands', () => {
    const sim = makeFight('shark', 2);
    skipIntro(sim);
    run(sim, () => NONE, has('tell'));
    expect(sim.state.fish.slipReady).toBe(false);
    const hp = sim.state.fish.hp;
    const ev = run(sim, approachAnd('quick', F.samurai.quick.reach + def('shark').size * 0.5 - 6), has('hit'), 1);
    expect(ev.some((e) => e.type === 'hit')).toBe(true);
    expect(sim.state.fish.hp).toBeLessThan(hp);
    expect(sim.state.fish.mode).toBe('stunned');
  });

  it('after a lunge ends, vulnTotal is lungeRecovery', () => {
    const sim = makeFight('piranha', 2);
    skipIntro(sim);
    run(sim, () => NONE, has('attack'));
    run(sim, () => NONE, () => sim.state.fish.mode === 'vulnerable');
    expect(sim.state.fish.vulnTotal).toBe(F.fish.lungeRecovery);
    expect(sim.state.fish.vulnLeft).toBe(F.fish.lungeRecovery);
  });

  it('a hit that interrupts a tell or an aim opens a window as long as the vulnLeft it starts with', () => {
    for (const [id, cue] of [['shark', 'tell'], ['eel', 'aim']] as const) {
      const sim = makeFight(id, 2);
      skipIntro(sim);
      run(sim, () => NONE, has(cue));
      expect(sim.state.fish.vulnTotal).toBe(0);
      let start = -1;
      run(sim, approachAnd('quick', F.samurai.quick.reach + def(id).size * 0.5 - 6), (e) => {
        // The sim sets vulnLeft on the hit, then counts it down in the same step.
        if (has('hit')(e)) start = sim.state.fish.vulnLeft + DT;
        return start >= 0;
      }, 2);
      expect(sim.state.fish.mode, id).toBe('stunned');
      expect(start).toBeCloseTo(F.fish.lungeRecovery, 9);
      expect(sim.state.fish.vulnTotal).toBe(F.fish.lungeRecovery);
      run(sim, () => NONE, () => sim.state.fish.mode === 'vulnerable');
      expect(sim.state.fish.vulnTotal).toBe(F.fish.lungeRecovery);
    }
  });

  it('fish with no attack and no special never hurt the samurai', () => {
    for (const id of ['sardine', 'mackerel', 'anglerfish']) {
      expect(def(id).attack ?? def(id).special).toBeUndefined();
      const r = runFight(id, idleBot);
      expect(r.events.some((e) => e.type === 'tell' || e.type === 'bitten')).toBe(false);
      expect(r.hpLeft).toBe(100);
    }
  });
});

describe('hard mode', () => {
  const SLIPPERY_WITH_SPECIAL = ['eel', 'pufferfish', 'squid'];

  it('normal mode: slippery fish stay harmless, however long the fight', () => {
    for (const id of SLIPPERY_WITH_SPECIAL) {
      expect(def(id).special, `${id} has a special in the manifest`).toBeDefined();
      expect(stateWith(false).makeFish(id, 0).def.special).toBeUndefined();
      const r = runFight(id, idleBot, 0, 1, false);
      expect(r.events.some((e) => e.type === 'aim' || e.type === 'shoot' || e.type === 'bitten'), id).toBe(false);
      expect(r.hpLeft, id).toBe(100);
    }
  });

  it('normal mode: the same holds for the tougher tiers', () => {
    for (const id of SLIPPERY_WITH_SPECIAL) expect(stateWith(false).makeFish(id, 2).def.special).toBeUndefined();
  });

  it('normal mode keeps the specials of the biters: swordfish and shark still attack', () => {
    for (const id of ['swordfish', 'shark']) expect(stateWith(false).makeFish(id, 0).def.special).toBeDefined();
  });

  it('hard mode: eel, pufferfish and squid use their specials and can hurt', () => {
    for (const id of SLIPPERY_WITH_SPECIAL) {
      expect(stateWith(true).makeFish(id, 0).def.special, id).toBeDefined();
      const r = runFight(id, idleBot, 0, 1, true);
      expect(r.events.some((e) => e.type === 'bitten'), id).toBe(true);
      expect(r.hpLeft, id).toBeLessThan(100);
    }
  });

  it('hard mode never gives sardine, mackerel or anglerfish an attack', () => {
    for (const id of ['sardine', 'mackerel', 'anglerfish']) {
      const r = runFight(id, idleBot, 0, 1, true);
      expect(r.hpLeft, id).toBe(100);
    }
  });

  it('the mode is saved, defaults to off, survives reset and an old save without the field', () => {
    const store: Record<string, string> = {};
    const storage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; } };
    const a = createGameState(storage);
    expect(a.hardMode).toBe(false);
    a.hardMode = true;
    expect(createGameState(storage).hardMode).toBe(true);
    a.reset();
    expect(createGameState(storage).hardMode).toBe(true);
    a.loadPreset({ gold: 10, levels: { damage: 1, depth: 0, gold: 0 } });
    expect(a.hardMode).toBe(true);
    store['samurai-hook-save-v1'] = JSON.stringify({ gold: 5, round: 1, levels: { damage: 0, depth: 0, gold: 0 } });
    expect(createGameState(storage).hardMode).toBe(false);
  });
});

describe('gimmicks', () => {
  it('hitting a puffed pufferfish bounces and does no damage', () => {
    const sim = makeFight('pufferfish', 1);
    skipIntro(sim);
    run(sim, () => NONE, has('puff'));
    expect(sim.state.fish.mode).toBe('puffed');
    const hp = sim.state.fish.hp;
    const samHp = sim.state.samurai.hp;
    const reach = F.samurai.quick.reach + def('pufferfish').size * 0.5 - 6;
    const ev = run(sim, approachAnd('quick', reach), (e) => has('bounce')(e) || has('slip')(e), F.fish.puff.duration);
    expect(ev.some((e) => e.type === 'bounce')).toBe(true);
    expect(sim.state.fish.hp).toBe(hp);
    expect(sim.state.samurai.move).toBe('hurt');
    const x0 = sim.state.samurai.x;
    ev.push(...run(sim, () => NONE, () => sim.state.samurai.move !== 'hurt'));
    expect(Math.abs(sim.state.samurai.x - x0)).toBeGreaterThan(20);
    // The bounce itself does no damage (only its spine special can hurt).
    const spines = ev.filter((e) => e.type === 'bitten').reduce((a, e) => a + e.damage!, 0);
    expect(sim.state.samurai.hp).toBeCloseTo(samHp - spines);
  });

  it('the pufferfish unpuffs after its duration', () => {
    const sim = makeFight('pufferfish', 1);
    skipIntro(sim);
    run(sim, () => NONE, has('puff'));
    let t = 0;
    run(sim, () => NONE, (e) => { t += DT; return has('unpuff')(e); });
    expect(t).toBeCloseTo(F.fish.puff.duration, 1);
  });

  it('anglerfish darkens the arena, squid inks it', () => {
    expect(makeFight('anglerfish').state.effects.dark).toBe(true);
    expect(makeFight('sardine').state.effects.dark).toBe(false);
    const sim = makeFight('squid', 1);
    skipIntro(sim);
    run(sim, () => NONE, has('ink'), F.fish.ink.every + 1);
    expect(sim.state.effects.inkLeft).toBeCloseTo(F.fish.ink.duration, 1);
    run(sim, () => NONE, () => sim.state.effects.inkLeft === 0, F.fish.ink.duration + 0.5);
  });
});

describe('jump and crouch', () => {
  const J = F.samurai.jump;
  const apex = (J.speed * J.speed) / (2 * J.gravity);

  it('a jump rises, lands back on the floor and allows no second jump in the air', () => {
    const sim = makeFight('sardine', 1);
    skipIntro(sim);
    sim.step(DT, input({ jump: true }));
    expect(sim.state.samurai.move).toBe('jump');
    let maxY = 0;
    let t = 0;
    run(sim, () => input({ jump: true }), () => {
      t += DT;
      maxY = Math.max(maxY, sim.state.samurai.y);
      return sim.state.samurai.y === 0;
    }, 2);
    expect(maxY).toBeGreaterThan(apex * 0.95);
    expect(maxY).toBeLessThan(apex * 1.05);
    expect(t).toBeCloseTo((2 * J.speed) / J.gravity, 1);
  });

  it('the jump clears every charge and lunge, and the tells leave time to dodge', () => {
    for (const d of fishDefs) {
      if (d.attack || d.special?.kind === 'charge') expect(apex).toBeGreaterThan(d.size * F.fish.special.clearScale + 30);
      // Time to rise above a low projectile (top = y + r) is far below any special tell.
      const P = F.fish.special.projectile.low;
      const rise = (J.speed - Math.sqrt(J.speed * J.speed - 2 * J.gravity * (P.y + P.r))) / J.gravity;
      if (d.special) expect(d.special.tell).toBeGreaterThan(rise * 4);
    }
    const high = F.fish.special.projectile.high;
    expect(high.y - high.r).toBeGreaterThan(F.samurai.crouchHeight); // crouching clears it
    expect(high.y - high.r).toBeLessThan(F.samurai.standHeight);     // standing gets hit
    expect(high.y + high.r).toBeGreaterThan(apex);                   // no jump clears it
  });

  it('no jump timing clears a single high shot', () => {
    const P = F.fish.special.projectile.high;
    for (let lead = 0.05; lead <= 0.7; lead += 0.05) {
      const inst = stateWith(true).makeFish('pufferfish', 0);
      inst.def = { ...inst.def, gimmick: 'none', special: { ...inst.def.special!, pattern: ['high'] } };
      const sim = createFight(inst, statsAt(0), mulberry32(2));
      skipIntro(sim);
      run(sim, () => NONE, has('shoot'));
      // Jump when the shot is `lead` seconds from the samurai's body.
      const ev = run(sim, (s) => {
        const p = s.state.projectiles[0];
        return input({ jump: !!p && Math.abs(p.x - s.state.samurai.x) - F.samurai.bodyRadius - P.r < Math.abs(p.vx) * lead });
      }, (e, s) => has('bitten')(e) || has('dodged')(e) || s.state.projectiles.length === 0, 4);
      expect(ev.some((e) => e.type === 'bitten'), `lead ${lead.toFixed(2)} s`).toBe(true);
    }
  });

  /** Waits for the special to come out, then holds `react` until it resolves. */
  function special(id: string, react: (sim: FightSim) => FightInput) {
    const sim = makeFight(id, 2);
    skipIntro(sim);
    run(sim, () => NONE, has('aim'));
    const hp0 = sim.state.samurai.hp;
    const busy = (m: string) => m === 'aim' || m === 'charge' || m === 'shoot';
    const ev = run(sim, react, (e, s) => has('bitten')(e) || has('blocked')(e)
      || (!busy(s.state.fish.mode) && s.state.projectiles.length === 0), 6);
    return { sim, ev, hp0 };
  }
  /** True when the charge or a projectile is less than `sec` seconds from the samurai. */
  const near = (s: FightSim, sec: number) => {
    const st = s.state;
    if (st.fish.mode === 'charge') return Math.abs(st.fish.x - st.samurai.x) < 70 + def('swordfish').special!.speed * sec;
    return st.projectiles.some((p) => Math.abs(p.x - st.samurai.x) < 50 + Math.abs(p.vx) * sec);
  };
  const jumpWhenNear = (s: FightSim) => input({ jump: near(s, 0.2) });
  const block = (s: FightSim) => input({ defendHeld: true, defendPressed: s.state.samurai.move !== 'block' });
  const dashWhenNear = (s: FightSim) => (near(s, 0.05)
    ? input({ moveX: Math.sign(s.state.fish.x - s.state.samurai.x) || 1, defendPressed: true, defendHeld: true }) : NONE);

  it('swordfish charge: standing, blocking or dashing gets hit full; jumping over it dodges and opens it up', () => {
    const dmg = def('swordfish').special!.damage;
    for (const react of [() => NONE, block, dashWhenNear]) {
      const { ev } = special('swordfish', react);
      expect(ev.find((e) => e.type === 'bitten')?.damage).toBe(dmg);
    }
    const { sim, ev, hp0 } = special('swordfish', jumpWhenNear);
    expect(ev.some((e) => e.type === 'dodged')).toBe(true);
    expect(sim.state.samurai.hp).toBe(hp0);
    expect(sim.state.fish.mode).toBe('vulnerable');
    expect(sim.state.fish.vulnTotal).toBe(F.fish.special.chargeRecovery);
    expect(sim.state.fish.vulnLeft).toBe(F.fish.special.chargeRecovery);
  });

  it('low shot (eel): crouching or blocking gets hit; jumping dodges', () => {
    const dmg = def('eel').special!.damage;
    for (const react of [() => input({ crouch: true }), block]) {
      expect(special('eel', react).ev.find((e) => e.type === 'bitten')?.damage).toBe(dmg);
    }
    const { sim, ev, hp0 } = special('eel', jumpWhenNear);
    expect(ev.some((e) => e.type === 'dodged')).toBe(true);
    expect(sim.state.samurai.hp).toBe(hp0);
  });

  it('high shot (pufferfish): standing, jumping or blocking gets hit; crouching dodges both spines', () => {
    const dmg = def('pufferfish').special!.damage;
    for (const react of [() => NONE, jumpWhenNear, block]) {
      expect(special('pufferfish', react).ev.find((e) => e.type === 'bitten')?.damage).toBe(dmg);
    }
    const sim = makeFight('pufferfish', 2);
    skipIntro(sim);
    run(sim, () => NONE, has('aim'));
    const ev = run(sim, () => input({ crouch: true }), (_, s) => s.state.fish.mode === 'roam' && s.state.projectiles.length === 0, 6);
    expect(ev.filter((e) => e.type === 'shoot').length).toBe(2);
    expect(ev.filter((e) => e.type === 'dodged').length).toBe(2);
    expect(sim.state.samurai.hp).toBe(100);
  });

  it('jumping over a biter lunge dodges it', () => {
    const sim = makeFight('piranha', 2);
    skipIntro(sim);
    run(sim, () => NONE, has('tell'));
    const ev = run(sim, (s) => input({ jump: s.state.fish.mode === 'tell' && s.state.fish.tellProgress > 0.5 }),
      (e) => has('dodged')(e) || has('bitten')(e), 3);
    expect(ev.some((e) => e.type === 'dodged')).toBe(true);
    expect(sim.state.samurai.hp).toBe(100);
  });
});

describe('competent bot', () => {
  it('stays inside the arena', () => {
    for (const id of ['mackerel', 'eel', 'swordfish']) {
      const sim = makeFight(id, 9);
      const bot = competentBot();
      const d = def(id);
      while (sim.state.phase !== 'over') {
        sim.step(DT, sim.state.phase === 'fighting' ? bot(sim.state, d) : NONE);
        expect(sim.state.fish.x).toBeGreaterThanOrEqual(F.arena.left);
        expect(sim.state.fish.x).toBeLessThanOrEqual(F.arena.right);
        expect(sim.state.samurai.x).toBeGreaterThanOrEqual(F.arena.left);
        expect(sim.state.samurai.x).toBeLessThanOrEqual(F.arena.right);
      }
    }
  });

  it('keeps 0 < vulnLeft <= vulnTotal on every step, and vulnTotal steady within a window', () => {
    for (const { id } of fishDefs) {
      const sim = makeFight(id, 3);
      const d = createGameState(null).makeFish(id, 0).def;
      const bot = competentBot();
      let prev = { left: 0, total: 0 };
      let windows = 0;
      while (sim.state.phase !== 'over') {
        sim.step(DT, sim.state.phase === 'fighting' ? bot(sim.state, d) : NONE);
        const { vulnLeft: left, vulnTotal: total } = sim.state.fish;
        if (left > 0) {
          expect(left, d.id).toBeLessThanOrEqual(total);
          // Same window (still open, only counting down): the ring's full circle stays put.
          if (prev.left > 0 && left <= prev.left) expect(total, d.id).toBe(prev.total);
          else windows++;
        } else {
          expect(left, d.id).toBe(0);
          expect(total, d.id).toBe(0);
        }
        prev = { left, total };
      }
      expect(windows, d.id).toBeGreaterThan(0);
    }
  });

  for (const id of ['sardine', 'mackerel', 'piranha']) {
    it(`beats the ${id} at base stats before the timer`, () => {
      for (let seed = 1; seed <= 5; seed++) {
        const r = runFight(id, competentBot(), 0, seed);
        expect(r.outcome).toBe('win');
        expect(r.timeUsed).toBeLessThan(def(id).timer);
      }
    });
  }
});

describe('dash out of a crouch', () => {
  const minX = F.samurai.dash.crouchMinX;

  /** A sardine fight with the samurai already crouched. */
  function crouched(): FightSim {
    const sim = makeFight('sardine', 1);
    skipIntro(sim);
    for (let i = 0; i < 5; i++) sim.step(DT, input({ crouch: true }));
    expect(sim.state.samurai.move).toBe('crouch');
    return sim;
  }
  /** Defend tapped (and held) with `moveX`, crouch held or not. */
  const tap = (moveX: number, crouch = true) => input({ moveX, crouch, defendPressed: true, defendHeld: true });

  /** Steps one defend tap and checks it dashed the way `moveX` points. */
  function expectDash(sim: FightSim, moveX: number, crouch = true) {
    const x0 = sim.state.samurai.x;
    const ev = sim.step(DT, tap(moveX, crouch));
    expect(ev.some((e) => e.type === 'dash')).toBe(true);
    expect(sim.state.samurai.move).toBe('dash');
    expect(sim.state.samurai.invulnerable).toBe(true);
    run(sim, () => NONE, () => sim.state.samurai.move !== 'dash', 1);
    expect(Math.sign(sim.state.samurai.x - x0)).toBe(Math.sign(moveX));
    expect(Math.abs(sim.state.samurai.x - x0)).toBeGreaterThan(F.samurai.dash.distance * 0.8);
  }

  /** Steps one defend tap and checks the samurai stayed crouched where he was, with no dash side effects. */
  function expectStay(sim: FightSim, moveX: number) {
    const x0 = sim.state.samurai.x;
    const ev = sim.step(DT, tap(moveX));
    expect(ev.some((e) => e.type === 'dash')).toBe(false);
    expect(sim.state.samurai.move).toBe('crouch');
    expect(sim.state.samurai.x).toBe(x0);
    expect(sim.state.samurai.invulnerable).toBe(false);
  }

  it('the threshold is above a full-tilt stick diagonal and below a full push (keys, d-pad, touch dash)', async () => {
    // Imported here, not at the top, so this block stays self-contained.
    const { applyDeadzone } = await import('../src/input/core');
    expect(minX).toBeGreaterThan(applyDeadzone(Math.SQRT1_2));
    expect(minX).toBeLessThan(1);
  });

  for (const mx of [0.33, -0.33]) {
    it(`a slight lean (moveX ${mx}) and a defend tap stays crouched; held defend does not block`, () => {
      const sim = crouched();
      const x0 = sim.state.samurai.x;
      expectStay(sim, mx);
      // Keeps crouching with the lean and defend held: no dash, no block, no walking.
      for (let i = 0; i < 30; i++) {
        const ev = sim.step(DT, input({ moveX: mx, crouch: true, defendHeld: true }));
        expect(ev.some((e) => e.type === 'dash')).toBe(false);
        expect(sim.state.samurai.move).toBe('crouch');
        expect(sim.state.samurai.x).toBe(x0);
      }
      // The refused tap did not start the cooldown: a full push on the very next step dashes.
      const again = crouched();
      expectStay(again, mx);
      expectDash(again, Math.sign(mx));
    });
  }

  for (const mx of [1, -1]) {
    it(`a full sideways push (moveX ${mx}) dashes out of the crouch, as before`, () => {
      expectDash(crouched(), mx);
    });
  }

  for (const mx of [0.33, -0.33]) {
    it(`standing, moveX ${mx} and a defend tap still dashes (the 0.3 cutoff is unchanged)`, () => {
      const sim = makeFight('sardine', 1);
      skipIntro(sim);
      expectDash(sim, mx, false);
    });
  }

  for (const s of [1, -1]) {
    it(`crouching: just below the threshold stays down, just above dashes (side ${s})`, () => {
      expectStay(crouched(), s * (minX - 0.01));
      expectDash(crouched(), s * (minX + 0.01));
    });
  }
});
