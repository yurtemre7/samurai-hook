import { fish as fishDefs, ocean, samurai as samuraiBase, tiers, upgrades as upgradeDefs } from '../manifest';
import type { FishInstance, GameState, UpgradeDef, UpgradeId, UpgradeInfo } from '../types';

const SAVE_KEY = 'samurai-hook-save-v1';

interface SaveData { gold: number; round: number; levels: Record<UpgradeId, number> }

export interface Storage { getItem(k: string): string | null; setItem(k: string, v: string): void }

const fresh = (): SaveData => ({ gold: 0, round: 0, levels: { damage: 0, depth: 0, gold: 0 } });

export function upgradeCost(def: UpgradeDef, level: number): number {
  return Math.round(def.baseCost * Math.pow(def.growth, level));
}

function levelName(def: UpgradeDef, level: number): string {
  const last = def.names.length - 1;
  return level <= last ? def.names[level] : `${def.names[last]} +${level - last}`;
}

/** Gold, upgrade levels and everything derived from them. Saves to `storage` on change. */
export function createGameState(storage: Storage | null): GameState {
  let data = fresh();
  try {
    const raw = storage?.getItem(SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      data = { ...fresh(), ...parsed, levels: { ...fresh().levels, ...(parsed.levels ?? {}) } };
    }
  } catch { /* corrupt save: start fresh */ }

  const save = () => { try { storage?.setItem(SAVE_KEY, JSON.stringify(data)); } catch { /* ignore */ } };
  const def = (id: UpgradeId) => upgradeDefs.find((u) => u.id === id)!;
  const damageMult = (lvl = data.levels.damage) => 1 + def('damage').perLevel * lvl;
  const maxDepth = (lvl = data.levels.depth) => ocean.startDepth + def('depth').perLevel * lvl;
  const goldMult = (lvl = data.levels.gold) => 1 + def('gold').perLevel * lvl;

  function effect(id: UpgradeId, lvl: number): string {
    if (id === 'damage') return `DAMAGE x${damageMult(lvl).toFixed(2)} > x${damageMult(lvl + 1).toFixed(2)}`;
    if (id === 'depth') return `DEPTH ${maxDepth(lvl)} M > ${maxDepth(lvl + 1)} M`;
    return `RYO x${goldMult(lvl).toFixed(2)} > x${goldMult(lvl + 1).toFixed(2)}`;
  }

  function makeFish(fishId: string, tier: number): FishInstance {
    const d = fishDefs.find((f) => f.id === fishId);
    if (!d) throw new Error(`Unknown fish "${fishId}"`);
    const t = Math.max(0, Math.floor(tier));
    const prefix = t === 0 ? '' : (tiers.prefixes[t] ?? `${tiers.prefixes[tiers.prefixes.length - 1]} x${t}`);
    return {
      def: d,
      tier: t,
      name: `${prefix} ${d.name}`.trim().toUpperCase(),
      maxHp: Math.round(d.hp * Math.pow(tiers.hpMult, t)),
      gold: Math.round(d.gold * Math.pow(tiers.goldMult, t)),
    };
  }

  return {
    get gold() { return data.gold; },
    get round() { return data.round; },
    get maxDepth() { return maxDepth(); },
    get samurai() {
      return {
        maxHp: samuraiBase.maxHp,
        quickDamage: samuraiBase.quickDamage * damageMult(),
        heavyDamage: samuraiBase.heavyDamage * damageMult(),
      };
    },
    upgrades(): UpgradeInfo[] {
      return upgradeDefs.map((u) => {
        const level = data.levels[u.id];
        const cost = upgradeCost(u, level);
        return { id: u.id, label: u.label, level, cost, affordable: data.gold >= cost, name: levelName(u, level), effect: effect(u.id, level) };
      });
    },
    buy(id) {
      const cost = upgradeCost(def(id), data.levels[id]);
      if (data.gold < cost) return false;
      data.gold -= cost;
      data.levels[id] += 1;
      save();
      return true;
    },
    pickFish(depth, rng = Math.random) {
      const tier = Math.floor(depth / tiers.depth);
      const local = depth - tier * tiers.depth;
      const options = fishDefs.filter((f) => local >= f.depthMin && local <= f.depthMax);
      if (options.length === 0) return null;
      return makeFish(options[Math.floor(rng() * options.length) % options.length].id, tier);
    },
    makeFish,
    nextRound() { data.round += 1; save(); return data.round; },
    sell(f) {
      const earned = Math.round(f.gold * goldMult());
      data.gold += earned;
      save();
      return earned;
    },
    reset() { data = fresh(); save(); },
    loadPreset(preset) { data = { ...fresh(), gold: preset.gold, levels: { ...preset.levels } }; save(); },
  };
}
