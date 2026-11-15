import { describe, expect, it } from 'vitest';
import { pickAudioPath } from '../src/core/audioFormat';
import { music, sounds, voice } from '../src/manifest';

// Files on disk (keys only; nothing is loaded).
const onDisk = new Set(Object.keys(import.meta.glob('../public/assets/**/*.m4a')).map((k) => k.replace('../public/', '')));
const yes = () => 'maybe';
const no = () => '';

describe('pickAudioPath', () => {
  it('keeps .ogg when Ogg Vorbis is playable', () => {
    expect(pickAudioPath('assets/voice/round1.ogg', yes)).toBe('assets/voice/round1.ogg');
  });
  it('uses the .m4a twin when it is not', () => {
    expect(pickAudioPath('assets/voice/round1.ogg', no)).toBe('assets/voice/round1.m4a');
  });
  it('asks about Vorbis in Ogg', () => {
    let asked = '';
    pickAudioPath('a.ogg', (m) => { asked = m; return ''; });
    expect(asked).toBe('audio/ogg; codecs="vorbis"');
  });
  it('leaves .wav and .mp3 alone', () => {
    expect(pickAudioPath('a/fight.wav', no)).toBe('a/fight.wav');
    expect(pickAudioPath('a/ocean.mp3', no)).toBe('a/ocean.mp3');
  });
});

describe('AAC twins', () => {
  const srcs = [
    ...Object.values(sounds).map((s) => s.src),
    ...Object.values(music).map((m) => m.src),
    ...Object.values(voice.clips),
  ].filter((s): s is string => !!s && s.endsWith('.ogg'));
  it('every manifest .ogg has a .m4a twin on disk', () => {
    expect(srcs.length).toBeGreaterThan(0);
    for (const s of srcs) expect(onDisk.has(`${s.slice(0, -4)}.m4a`), s).toBe(true);
  });
});
