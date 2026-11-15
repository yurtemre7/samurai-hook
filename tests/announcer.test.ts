import { describe, expect, it } from 'vitest';
import { planAnnounce } from '../src/core/announcer';
import { voice } from '../src/manifest';

const clips = { fight: 'a/fight.ogg', round: 'a/round.ogg', round2: 'a/r2.ogg' };

describe('planAnnounce', () => {
  it('uses the clip for a simple line and says nothing else', () => {
    expect(planAnnounce({ key: 'fight' }, 'Fight!', clips, true)).toEqual({ clip: 'a/fight.ogg', speech: null });
  });
  it('falls back to speech when the clip is missing', () => {
    expect(planAnnounce({ key: 'win' }, 'K. O.!', clips, false)).toEqual({ clip: null, speech: 'K. O.!' });
    expect(planAnnounce({ key: 'fight' }, 'Fight!', {}, false)).toEqual({ clip: null, speech: 'Fight!' });
  });
  it('speaks the whole line with no request at all', () => {
    expect(planAnnounce(undefined, 'Hello there!', clips, true)).toEqual({ clip: null, speech: 'Hello there!' });
  });
  it('prefers the numbered round clip, then the generic one', () => {
    expect(planAnnounce({ key: 'round', round: 2 }, 'Round 2! X!', clips, false).clip).toBe('a/r2.ogg');
    expect(planAnnounce({ key: 'round', round: 9 }, 'Round 9! X!', clips, false).clip).toBe('a/round.ogg');
  });
  it('speaks the whole round line when no round clip exists at all', () => {
    const noGeneric = { fight: 'a/fight.ogg' };
    expect(planAnnounce({ key: 'round', round: 9, fish: 'Fugu' }, 'Round 9! Fugu!', noGeneric, true))
      .toEqual({ clip: null, speech: 'Round 9! Fugu!' });
  });
  it('speakFishName on: fish name follows the round clip; off: dropped', () => {
    expect(planAnnounce({ key: 'round', round: 2, fish: 'Fugu' }, 't', clips, true)).toEqual({ clip: 'a/r2.ogg', speech: 'Fugu' });
    expect(planAnnounce({ key: 'round', round: 2, fish: 'Fugu' }, 't', clips, false)).toEqual({ clip: 'a/r2.ogg', speech: null });
  });
  it('manifest: speakFishName is off', () => {
    expect(voice.speakFishName).toBe(false);
  });
  it('manifest: rounds 1-5 use their own clip, above 5 the generic round clip', () => {
    const clip = (round: number) => planAnnounce({ key: 'round', round }, 't', voice.clips, false).clip;
    for (let n = 1; n <= 5; n++) expect(clip(n)).toBe(`assets/voice/round${n}.ogg`);
    for (const n of [6, 7, 12]) expect(clip(n)).toBe('assets/voice/round.ogg');
  });
  it('manifest: a missing clip falls back to speech', () => {
    const { fight: _omit, ...rest } = voice.clips;
    expect(planAnnounce({ key: 'fight' }, 'Fight!', rest, false)).toEqual({ clip: null, speech: 'Fight!' });
  });
});

import { leadInSeconds } from '../src/core/announcer';

describe('leadInSeconds', () => {
  it('finds the silent lead-in, keeps a small margin, and handles silence and empty input', () => {
    const sr = 1000;
    const s = new Float32Array(500); for (let i = 150; i < 500; i++) s[i] = 0.5;
    expect(leadInSeconds(s, sr)).toBeCloseTo(0.14, 5);
    expect(leadInSeconds(new Float32Array(100), sr)).toBe(0);
    expect(leadInSeconds([0.5, 0.5], sr)).toBe(0);
    expect(leadInSeconds([], sr)).toBe(0);
  });
});
