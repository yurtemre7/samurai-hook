// Balance report for tuning: the competent bot against every fish at several
// damage levels. Only the sardine at level 0 is asserted; the table is for humans.
import { expect, it } from 'vitest';
import { fish as fishDefs } from '../src/manifest';
import { competentBot, runFight } from './fightBots';

export { runFight };

const LEVELS = [0, 3, 6, 10];
const SEEDS = [1, 2, 3, 4, 5];

it('balance table: competent bot vs all fish', () => {
  const rows: Record<string, string | number>[] = [];
  for (const f of fishDefs) {
    for (const lvl of LEVELS) {
      const rs = SEEDS.map((seed) => runFight(f.id, competentBot(), lvl, seed));
      const wins = rs.filter((r) => r.outcome === 'win').length;
      const avg = (xs: number[]) => +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1);
      rows.push({
        fish: f.id,
        dmgLvl: lvl,
        outcome: `${wins}/${rs.length} win` + (wins < rs.length ? ` (${rs.filter((r) => r.outcome !== 'win').map((r) => r.outcome).join(',')})` : ''),
        timeUsed: `${avg(rs.map((r) => r.timeUsed))} / ${f.timer}s`,
        hpLeft: avg(rs.map((r) => r.hpLeft)),
        fishHpLeft: avg(rs.map((r) => r.state.fish.hp)),
      });
    }
  }
  console.table(rows);
  for (const seed of SEEDS) expect(runFight('sardine', competentBot(), 0, seed).outcome).toBe('win');
});
