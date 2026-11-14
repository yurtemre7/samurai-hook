import { describe, expect, it } from 'vitest';
import { createGameState } from '../src/game/state';
import { ocean, tiers } from '../src/manifest';

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; };

describe('game state', () => {
  it('starts broke at the starting depth', () => {
    const s = createGameState(null);
    expect(s.gold).toBe(0);
    expect(s.maxDepth).toBe(ocean.startDepth);
  });
  it('sells fish, buys upgrades and persists', () => {
    const store = mem();
    const s = createGameState(store);
    for (let i = 0; i < 10; i++) s.sell(s.makeFish('sardine', 0));
    expect(s.gold).toBe(50);
    expect(s.buy('damage')).toBe(true);
    expect(s.gold).toBe(30);
    expect(s.samurai.quickDamage).toBeGreaterThan(6);
    expect(s.buy('gold')).toBe(false);
    const again = createGameState(store);
    expect(again.gold).toBe(30);
    expect(again.upgrades().find((u) => u.id === 'damage')!.level).toBe(1);
  });
  it('loads a demo preset', () => {
    const s = createGameState(null);
    s.loadPreset({ gold: 1500, levels: { damage: 4, depth: 6, gold: 2 } });
    expect(s.gold).toBe(1500);
    expect(s.maxDepth).toBe(ocean.startDepth + 6 * 15);
    expect(s.samurai.heavyDamage).toBe(36);
  });
  it('costs rise with level', () => {
    const s = createGameState(null);
    for (let i = 0; i < 100; i++) s.sell(s.makeFish('shark', 0));
    const c0 = s.upgrades()[0].cost; s.buy('damage');
    expect(s.upgrades()[0].cost).toBeGreaterThan(c0);
  });
  it('picks fish by depth band and scales tiers', () => {
    const s = createGameState(null);
    expect(s.pickFish(6, () => 0)!.def.id).toBe('sardine');
    expect(s.pickFish(1)).toBeNull();
    const elder = s.pickFish(tiers.depth + 6, () => 0)!;
    expect(elder.tier).toBe(1);
    expect(elder.name).toBe('ELDER IWASHI');
    expect(elder.maxHp).toBe(Math.round(40 * tiers.hpMult));
  });
  it('every depth from 5 m down has at least one fish', () => {
    const s = createGameState(null);
    for (let d = 5; d < 170; d++) expect(s.pickFish(d), `depth ${d}`).not.toBeNull();
  });
});
