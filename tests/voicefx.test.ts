import { describe, expect, it } from 'vitest';
import { NEUTRAL_FX, driveCurve, isNeutralFx, makeImpulse, resolveFx } from '../src/core/announcer';
import { voice } from '../src/manifest';

describe('voice fx', () => {
  it('neutral defaults leave the clip untouched', () => {
    expect(isNeutralFx(NEUTRAL_FX)).toBe(true);
    expect(isNeutralFx(resolveFx(voice.presets, 'clean'))).toBe(true);
    expect(voice.preset).toBe('clean');
  });
  it('any non-neutral setting is detected', () => {
    for (const o of [{ rate: 0.9 }, { drive: 0.1 }, { lowBoost: 3 }, { highCut: 8000 }, { reverb: 0.2 }, { echo: 0.1 }]) {
      expect(isNeutralFx({ ...NEUTRAL_FX, ...o })).toBe(false);
    }
  });
  it('resolves presets over neutral and applies overrides', () => {
    const presets = { deep: { rate: 0.8, lowBoost: 6 } };
    expect(resolveFx(presets, 'deep')).toEqual({ ...NEUTRAL_FX, rate: 0.8, lowBoost: 6 });
    expect(resolveFx(presets, 'deep', { rate: 0.7 }).rate).toBe(0.7);
    expect(resolveFx(presets, 'missing')).toEqual(NEUTRAL_FX);
  });
  it('manifest presets: clean, deep, arena, demon exist; the others lower the pitch', () => {
    for (const n of ['clean', 'deep', 'arena', 'demon']) expect(voice.presets[n]).toBeDefined();
    for (const n of ['deep', 'arena', 'demon']) expect(resolveFx(voice.presets, n).rate).toBeLessThan(1);
    expect(resolveFx(voice.presets, 'demon').drive).toBeGreaterThan(0);
    expect(resolveFx(voice.presets, 'arena').reverb).toBeGreaterThan(0);
    for (const name of Object.keys(voice.packs)) expect(voice.packs[name].fight).toBeTruthy();
  });
  it('drive curve is the identity at 0 and saturates above', () => {
    expect(Array.from(driveCurve(0, 5))).toEqual([-1, -0.5, 0, 0.5, 1]);
    const hard = driveCurve(1, 5);
    expect(hard[3]).toBeGreaterThan(0.5);
    expect(hard[4]).toBeCloseTo(1);
    expect(hard[2]).toBe(0);
  });
  it('impulse response has the right length and decays', () => {
    let s = 1;
    const rng = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const ir = makeImpulse(2, 100, rng);
    expect(ir.length).toBe(200);
    const energy = (a: number, b: number) => { let e = 0; for (let i = a; i < b; i++) e += ir[i] * ir[i]; return e; };
    expect(energy(0, 50)).toBeGreaterThan(energy(150, 200) * 10);
  });
});
