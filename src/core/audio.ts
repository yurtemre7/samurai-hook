import type { AudioSys, SoundDef } from '../types';
import { assetUrl } from './assets';
import { planAnnounce, type AnnounceRequest } from './announcer';

interface MusicDef { src: string | null; volume: number }
interface VoiceDef {
  enabled: boolean; rate: number; pitch: number; volume: number;
  clips: Record<string, string>; speakFishName: boolean;
}

/** Plays manifest sounds. Missing files fall back to a synthesised blip. */
export function createAudio(
  sounds: Record<string, SoundDef>,
  music: Record<string, MusicDef>,
  voice: VoiceDef,
): AudioSys {
  let ctx: AudioContext | null = null;
  const clips = new Map<string, HTMLAudioElement>();
  const broken = new Set<string>();
  let currentMusic: HTMLAudioElement | null = null;
  let currentMusicId: string | null = null;
  let wantedMusic: string | null = null;
  let unlocked = false;
  const voiceClips = new Map<string, HTMLAudioElement>();
  const voiceBroken = new Set<string>();
  let voiceCurrent: HTMLAudioElement | null = null;
  let voiceToken = 0;

  for (const [key, src] of Object.entries(voice.clips)) {
    const el = new Audio(assetUrl(src));
    el.preload = 'auto';
    el.volume = voice.volume;
    el.addEventListener('error', () => voiceBroken.add(key));
    voiceClips.set(key, el);
  }

  function speak(line: string): void {
    if (typeof speechSynthesis === 'undefined') return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(line);
      u.rate = voice.rate; u.pitch = voice.pitch; u.volume = voice.volume;
      speechSynthesis.speak(u);
    } catch { /* no voice available */ }
  }

  for (const [id, def] of Object.entries(sounds)) {
    if (!def.src) continue;
    const el = new Audio(assetUrl(def.src));
    el.preload = 'auto';
    el.addEventListener('error', () => broken.add(id));
    clips.set(id, el);
  }

  function blip(def: SoundDef): void {
    if (!ctx) return;
    const { freq, dur, wave } = def.fallback;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = wave ?? 'square';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * 0.5), ctx.currentTime + dur);
    gain.gain.setValueAtTime(0.15 * (def.volume ?? 1), ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  function startMusic(id: string | null): void {
    if (id === currentMusicId) return;
    currentMusic?.pause();
    currentMusic = null;
    currentMusicId = id;
    const def = id ? music[id] : null;
    if (!def?.src) return;
    const el = new Audio(assetUrl(def.src));
    el.loop = true;
    el.volume = def.volume;
    el.play().catch(() => { /* blocked or missing: stay silent */ });
    currentMusic = el;
  }

  return {
    unlock() {
      if (unlocked) return;
      unlocked = true;
      try { ctx = new AudioContext(); } catch { ctx = null; }
      if (wantedMusic) startMusic(wantedMusic);
    },
    play(id) {
      const def = sounds[id];
      if (!def || !unlocked) return;
      const clip = clips.get(id);
      if (clip && !broken.has(id)) {
        const el = clip.cloneNode() as HTMLAudioElement;
        el.volume = def.volume ?? 1;
        el.play().catch(() => blip(def));
      } else {
        blip(def);
      }
    },
    music(id) {
      wantedMusic = id;
      if (unlocked) startMusic(id);
    },
    announce(line, req?: AnnounceRequest) {
      if (!voice.enabled || !unlocked) return;
      const token = ++voiceToken;
      // Never overlap: stop the previous announcer clip and speech.
      if (voiceCurrent) { voiceCurrent.pause(); voiceCurrent = null; }
      try { if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel(); } catch { /* ignore */ }
      // Only offer clips that have not failed to load.
      const usable: Record<string, string> = {};
      for (const [k, v] of Object.entries(voice.clips)) if (!voiceBroken.has(k)) usable[k] = v;
      const plan = planAnnounce(req, line, usable, voice.speakFishName);
      const key = plan.clip ? Object.keys(usable).find((k) => usable[k] === plan.clip) : undefined;
      const el = key ? voiceClips.get(key) : undefined;
      if (!plan.clip || !el) { if (plan.speech) speak(plan.speech); return; }
      voiceCurrent = el;
      el.currentTime = 0;
      el.onended = () => {
        if (token !== voiceToken) return;
        voiceCurrent = null;
        if (plan.speech) speak(plan.speech);
      };
      el.play().catch(() => {
        if (token !== voiceToken) return;
        voiceCurrent = null;
        speak(line); // clip unplayable: say the whole line instead
      });
    },
  };
}
