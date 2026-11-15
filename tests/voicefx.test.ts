import { describe, expect, it } from 'vitest';
import { NEUTRAL_FX, dbToGain, driveCurve, isNeutralFx, makeImpulse, resolveFx, resolveLineFx, planAnnounce } from '../src/core/announcer';
import { text, voice } from '../src/manifest';

// Files on disk under public/assets/voice (keys only; nothing is loaded).
const voiceFiles = new Set(Object.keys(import.meta.glob('../public/assets/voice/**/*.{ogg,m4a,wav}')).map((k) => k.replace('../public/', '')));
const fxOf = (k: string) => resolveLineFx(voice.presets, voice.preset, voice.linePresets, k);

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
  it('manifest presets: exactly clean, deep, demonPlus; deep and demonPlus lower the pitch', () => {
    expect(Object.keys(voice.presets).sort()).toEqual(['clean', 'deep', 'demonPlus']);
    expect(resolveFx(voice.presets, 'deep').rate).toBeLessThan(1);
    expect(resolveFx(voice.presets, 'demonPlus').rate).toBeLessThan(1);
    expect(resolveFx(voice.presets, 'demonPlus').drive).toBeGreaterThan(0);
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
  it('the deep preset keeps its values', () => {
    expect(resolveFx(voice.presets, 'deep')).toEqual({ ...NEUTRAL_FX, rate: 0.85, lowBoost: 8, highCut: 9000 });
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
  it('manifest: Fight uses the Alba clip with demonPlus; every other line uses deep', () => {
    expect(voice.clips.fight).toBe('assets/voice/alba-fx-fight.wav');
    expect(voice.preset).toBe('deep');
    expect(voice.linePresets).toEqual({ fight: 'demonPlus' });
    expect(fxOf('fight')).toEqual(resolveFx(voice.presets, 'demonPlus'));
    for (const k of ['round', 'win', 'perfect', 'timeout', 'ko']) expect(fxOf(k)).toEqual(resolveFx(voice.presets, 'deep'));
  });
  it('manifest: clean is a no-op', () => {
    expect(isNeutralFx(resolveFx(voice.presets, 'clean'))).toBe(true);
  });
  it('dbToGain', () => {
    expect(dbToGain(0)).toBe(1);
    expect(dbToGain(6)).toBeCloseTo(1.995, 2);
    expect(dbToGain(-20)).toBeCloseTo(0.1);
  });
  it('manifest: every announce line resolves to a clip file that exists on disk', () => {
    for (const k of Object.keys(text.announce)) {
      if (k === 'buy') continue; // "Upgrade!" stays on speech synthesis
      const plan = planAnnounce({ key: k, round: 1 }, (text.announce as Record<string, string>)[k], voice.clips, false);
      expect(plan.clip, k).toBeTruthy();
      expect(voiceFiles.has(plan.clip as string), plan.clip as string).toBe(true);
    }
    expect(planAnnounce({ key: 'buy' }, text.announce.buy, voice.clips, false).clip).toBeNull();
  });
  it('manifest: every clip in the manifest exists, and no unreferenced clip is shipped', () => {
    const paths = Object.values(voice.clips);
    // Each .ogg clip also ships as an AAC .m4a twin (for browsers that cannot play Ogg).
    const expected = paths.flatMap((p) => (p.endsWith('.ogg') ? [p, p.replace(/\.ogg$/, '.m4a')] : [p]));
    for (const path of expected) expect(voiceFiles.has(path), path).toBe(true);
    expect([...voiceFiles].sort()).toEqual([...expected].sort());
  });
});
