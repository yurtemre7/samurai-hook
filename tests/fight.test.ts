import { describe, expect, it } from 'vitest';
import type { FightEvent, FightSim } from '../src/fight/sim';
import { fight as F, fish as fishDefs } from '../src/manifest';
import type { FightInput } from '../src/types';
import { competentBot, DT, idleBot, input, makeFight, NONE, runFight, skipIntro } from './fightBots';

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

  it('slippery fish never attack', () => {
    for (const id of ['sardine', 'eel', 'squid']) {
      const r = runFight(id, idleBot);
      expect(r.events.some((e) => e.type === 'tell' || e.type === 'bitten')).toBe(false);
      expect(r.hpLeft).toBe(100);
    }
  });
});

describe('gimmicks', () => {
  it('hitting a puffed pufferfish bounces and does no damage', () => {
    const sim = makeFight('pufferfish', 1);
    skipIntro(sim);
    run(sim, () => NONE, has('puff'));
    expect(sim.state.fish.mode).toBe('puffed');
    const hp = sim.state.fish.hp;
    const reach = F.samurai.quick.reach + def('pufferfish').size * 0.5 - 6;
    const ev = run(sim, approachAnd('quick', reach), (e) => has('bounce')(e) || has('slip')(e), F.fish.puff.duration);
    expect(ev.some((e) => e.type === 'bounce')).toBe(true);
    expect(sim.state.fish.hp).toBe(hp);
    expect(sim.state.samurai.move).toBe('hurt');
    const x0 = sim.state.samurai.x;
    run(sim, () => NONE, () => sim.state.samurai.move !== 'hurt');
    expect(Math.abs(sim.state.samurai.x - x0)).toBeGreaterThan(20);
    expect(sim.state.samurai.hp).toBe(100);
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
