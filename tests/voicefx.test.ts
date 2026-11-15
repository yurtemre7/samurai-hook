import { describe, expect, it } from 'vitest';
import { NEUTRAL_FX, dbToGain, driveCurve, isNeutralFx, makeImpulse, resolveFx, resolveLineFx } from '../src/core/announcer';
import { voice } from '../src/manifest';

describe('voice fx', () => {
  it('neutral defaults leave the clip untouched', () => {
    expect(isNeutralFx(NEUTRAL_FX)).toBe(true);
    expect(isNeutralFx(resolveFx(voice.presets, 'clean'))).toBe(true);
    expect(NEUTRAL_FX).toMatchObject({ echoFeedback: 0, presence: 0, gain: 0, layerRate: 1, layerGain: 0 });
  });
  it('any non-neutral setting is detected', () => {
    for (const o of [{ rate: 0.9 }, { drive: 0.1 }, { lowBoost: 3 }, { highCut: 8000 }, { reverb: 0.2 }, { echo: 0.1 }, { presence: 3 }, { gain: 2 }, { layerGain: 0.5 }]) {
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
  it('new parameters alone do nothing when their switch is off', () => {
    // echoFeedback needs echo, layerRate needs layerGain.
    expect(isNeutralFx({ ...NEUTRAL_FX, echoFeedback: 0.5, layerRate: 0.6 })).toBe(true);
  });
  it('older presets are unchanged by the new parameters', () => {
    expect(resolveFx(voice.presets, 'deep')).toEqual({ ...NEUTRAL_FX, rate: 0.85, lowBoost: 8, highCut: 9000 });
    const demon = resolveFx(voice.presets, 'demon');
    expect(demon).toMatchObject({ rate: 0.72, drive: 0.5, gain: 0, layerGain: 0, echoFeedback: 0, presence: 0 });
  });
  it('resolveFx accepts inline values as well as a preset name', () => {
    expect(resolveFx(voice.presets, { rate: 0.9, gain: 3 })).toEqual({ ...NEUTRAL_FX, rate: 0.9, gain: 3 });
  });
  it('per-line presets: the line override wins, others use the default', () => {
    const presets = { deep: { rate: 0.85 }, demon: { rate: 0.72, drive: 0.5 } };
    const lp = { fight: 'demon', win: { rate: 0.5 } };
    expect(resolveLineFx(presets, 'deep', lp, 'fight')).toEqual({ ...NEUTRAL_FX, rate: 0.72, drive: 0.5 });
    expect(resolveLineFx(presets, 'deep', lp, 'win').rate).toBe(0.5);
    expect(resolveLineFx(presets, 'deep', lp, 'round').rate).toBe(0.85);
    expect(resolveLineFx(presets, 'deep', lp, undefined).rate).toBe(0.85);
    expect(resolveLineFx(presets, 'deep', undefined, 'fight').rate).toBe(0.85);
    expect(resolveLineFx(presets, 'deep', { fight: 'missing' }, 'fight')).toEqual(NEUTRAL_FX);
  });
  it('manifest: active configuration is fighter + deep, with demon for Fight', () => {
    expect(voice.pack).toBe('fighter');
    expect(voice.clips).toBe(voice.packs.fighter);
    expect(voice.preset).toBe('deep');
    expect(voice.linePresets).toEqual({ fight: 'demon' });
    const fx = (k: string) => resolveLineFx(voice.presets, voice.preset, voice.linePresets, k);
    expect(fx('fight')).toEqual(resolveFx(voice.presets, 'demon'));
    for (const k of ['round', 'win', 'perfect', 'timeout', 'ko']) expect(fx(k)).toEqual(resolveFx(voice.presets, 'deep'));
  });
  it('manifest: the Fight treatments exist and each uses its own feature', () => {
    for (const n of ['hype', 'roar', 'titan', 'stadium', 'demonPlus']) expect(voice.presets[n]).toBeDefined();
    const r = (n: string) => resolveFx(voice.presets, n);
    expect(r('hype').gain).toBeGreaterThan(0);
    expect(r('hype').presence).toBeGreaterThan(0);
    expect(r('roar').drive).toBeGreaterThan(r('demon').drive);
    expect(r('titan').layerGain).toBeGreaterThan(0);
    expect(r('titan').layerRate).toBeLessThan(1);
    expect(r('stadium').echoFeedback).toBeGreaterThan(0);
    expect(r('stadium').echoFeedback).toBeLessThanOrEqual(0.85);
    expect(r('demonPlus').drive).toBeGreaterThan(r('demon').drive);
    expect(r('demonPlus').rate).toBeGreaterThan(r('demon').rate);
  });
  it('dbToGain', () => {
    expect(dbToGain(0)).toBe(1);
    expect(dbToGain(6)).toBeCloseTo(1.995, 2);
    expect(dbToGain(-20)).toBeCloseTo(0.1);
  });
});
