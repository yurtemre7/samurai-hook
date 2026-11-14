// Scripted bots and helpers shared by the fight tests (not a test file itself).
import { createFight, type FightEvent, type FightSim, type FightState } from '../src/fight/sim';
import { createGameState } from '../src/game/state';
import { fight as F, samurai as samuraiBase } from '../src/manifest';
import type { FightInput, FishDef, FightOutcome, SamuraiStats } from '../src/types';

export const DT = 1 / 60;

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const NONE: FightInput = { moveX: 0, quick: false, heavy: false, defendHeld: false, defendPressed: false };
export const input = (p: Partial<FightInput> = {}): FightInput => ({ ...NONE, ...p });

export type Bot = (st: FightState, def: FishDef) => FightInput;

export const idleBot: Bot = () => NONE;

/** Walk into reach, quick slash to bait the slip, chase, heavy slash in the window, block tells. */
export function competentBot(): Bot {
  let blocking = false;
  return (st, def) => {
    const sam = st.samurai;
    const fish = st.fish;
    const dx = fish.x - sam.x;
    const dist = Math.abs(dx);
    const toward = Math.sign(dx) || 1;
    const free = sam.move === 'idle' || sam.move === 'walk' || sam.move === 'block';
    const quickR = F.samurai.quick.reach + def.size * 0.5 - 8;
    const heavyR = F.samurai.heavy.reach + def.size * 0.5 - 8 - def.move.speed * 0.25 * F.samurai.heavy.startup;

    if ((fish.mode === 'tell' || fish.mode === 'attack') && def.attack && dist < def.attack.reach * 1.3 + 40) {
      const pressed = !blocking;
      blocking = true;
      return input({ defendHeld: true, defendPressed: pressed });
    }
    blocking = false;
    if (!free) return NONE;

    if (fish.mode === 'puffed') {
      return dist < 220 ? input({ moveX: -toward }) : NONE;
    }
    const low = fish.y < F.fish.hitHeight - 10;
    if (!fish.slipReady && fish.mode !== 'slip') {
      // In the window: heavy if it still fits, else quick.
      const late = fish.mode === 'vulnerable' && fish.modeTime > def.slip.recovery - F.samurai.heavy.startup - 0.1;
      if (low && dist <= heavyR && !late) return input({ heavy: true });
      if (low && dist <= quickR) return input({ quick: true });
      return input({ moveX: toward });
    }
    if (fish.mode === 'slip') return input({ moveX: toward });
    if (low && dist <= quickR) return input({ quick: true });
    return input({ moveX: toward });
  };
}

export const statsAt = (damageLevel: number): SamuraiStats => {
  const m = 1 + 0.25 * damageLevel;
  return { maxHp: samuraiBase.maxHp, quickDamage: samuraiBase.quickDamage * m, heavyDamage: samuraiBase.heavyDamage * m };
};

export function makeFight(fishId: string, seed = 1, stats: SamuraiStats = statsAt(0), tier = 0): FightSim {
  const fish = createGameState(null).makeFish(fishId, tier);
  return createFight(fish, stats, mulberry32(seed));
}

/** Steps until the intro is over. */
export function skipIntro(sim: FightSim): FightEvent[] {
  const all: FightEvent[] = [];
  while (sim.state.phase === 'intro') all.push(...sim.step(DT, NONE));
  return all;
}

export interface FightResult { outcome: FightOutcome | null; timeUsed: number; hpLeft: number; events: FightEvent[]; state: FightState }

export function runFight(fishId: string, bot: Bot, damageLevel = 0, seed = 1): FightResult {
  const sim = makeFight(fishId, seed, statsAt(damageLevel));
  const def = createGameState(null).makeFish(fishId, 0).def;
  const events: FightEvent[] = [];
  const maxSteps = Math.ceil((def.timer + F.introDelay + 5) * 60);
  for (let i = 0; i < maxSteps && sim.state.phase !== 'over'; i++) {
    events.push(...sim.step(DT, sim.state.phase === 'fighting' ? bot(sim.state, def) : NONE));
  }
  return {
    outcome: sim.state.outcome,
    timeUsed: +(def.timer - sim.state.timeLeft).toFixed(2),
    hpLeft: +sim.state.samurai.hp.toFixed(1),
    events,
    state: sim.state,
  };
}
