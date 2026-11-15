// Regression guard for game feel: the competent bot fights every fish at
// several damage levels and seeds, and the results must match the committed
// snapshot. Fights are deterministic (seeded RNG, fixed 60 Hz step), so any
// change here means the game plays differently.
//
// Changed difficulty on purpose (tuning, a new fish, a new move)? Update the
// snapshot and commit it with the change, so reviewers see the difference:
//   npx vitest run -u tests/balance-snapshot.test.ts
// CI never writes snapshots: a missing or different snapshot fails the check.
import { expect, it } from 'vitest';
import { fish as fishDefs } from '../src/manifest';
import { competentBot, runFight } from './fightBots';

const LEVELS = [0, 3, 6, 10];
const SEEDS = [1, 2, 3, 4, 5];

it('bot results against every fish are unchanged', () => {
  const table: Record<string, string> = {};
  for (const f of fishDefs) {
    for (const lvl of LEVELS) {
      const runs = SEEDS.map((seed) => runFight(f.id, competentBot(), lvl, seed));
      // One readable line per fish and level: outcome, seconds used, samurai hp
      // left, fish hp left, landed hits and whiffed slashes.
      table[`${f.id} dmg${lvl}`] = runs
        .map((r) => `${r.outcome} ${r.timeUsed.toFixed(1)}s hp${Math.round(r.hpLeft)} fish${Math.round(r.state.fish.hp)} hits${r.state.samurai.hits} miss${r.state.samurai.misses}`)
        .join(' | ');
    }
  }
  expect(table).toMatchSnapshot();
});
