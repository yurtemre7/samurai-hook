import type { AudioSys, SoundDef } from '../types';
import { assetUrl } from './assets';
import { planAnnounce, resolveLineFx, type AnnounceRequest, type FxChoice, type VoiceFx } from './announcer';
import { playThroughFx, type VoicePlayback } from './voicefx';

interface MusicDef { src: string | null; volume: number }
interface VoiceDef {
  enabled: boolean; rate: number; pitch: number; volume: number;
  clips: Record<string, string>; speakFishName: boolean;
  presets: Record<string, Partial<VoiceFx>>; preset: FxChoice;
  linePresets?: Record<string, FxChoice>;
}

/** AudioSys plus a way to swap the announcer's clip set and effects at
 *  runtime (used by the audition page; the game itself never calls it). */
export interface AudioSysEx extends AudioSys {
  setVoice(opts: { clips?: Record<string, string>; preset?: FxChoice; linePresets?: Record<string, FxChoice> }): void;
}

/** Plays manifest sounds. Missing files fall back to a synthesised blip. */
export function createAudio(
  sounds: Record<string, SoundDef>,
  music: Record<string, MusicDef>,
  voice: VoiceDef,
): AudioSysEx {
  let ctx: AudioContext | null = null;
  const clips = new Map<string, HTMLAudioElement>();
  const broken = new Set<string>();
  let currentMusic: HTMLAudioElement | null = null;
  let currentMusicId: string | null = null;
  let wantedMusic: string | null = null;
  let unlocked = false;
  // Announcer: clips are fetched (starting now, so they are ready by the first
  // line), decoded to AudioBuffers once audio is unlocked, and played through
  // the effect chain in voicefx.ts. `voiceBroken` holds clip paths that failed.
  let activeClips = voice.clips;
  let activePreset: FxChoice = voice.preset;
  let activeLinePresets: Record<string, FxChoice> = voice.linePresets ?? {};
  const voiceBroken = new Set<string>();
  const fetched = new Map<string, Promise<ArrayBuffer | null>>();
  const decoded = new Map<string, Promise<AudioBuffer | null>>();
  let voiceCurrent: VoicePlayback | null = null;
  let voiceToken = 0;

  function fetchClip(path: string): Promise<ArrayBuffer | null> {
    let p = fetched.get(path);
    if (!p) {
      p = typeof fetch === 'undefined' ? Promise.resolve(null)
        : fetch(assetUrl(path))
          .then((r) => (r.ok ? r.arrayBuffer() : null))
          .catch(() => null);
      fetched.set(path, p);
    }
    return p;
  }

  function loadBuffer(path: string): Promise<AudioBuffer | null> {
    let p = decoded.get(path);
    if (!p) {
      p = fetchClip(path).then(async (data) => {
        if (!data || !ctx) { voiceBroken.add(path); return null; }
        try { return await ctx.decodeAudioData(data.slice(0)); } catch { voiceBroken.add(path); return null; }
      });
      decoded.set(path, p);
    }
    return p;
  }

  for (const path of Object.values(voice.clips)) void fetchClip(path);

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
      if (voiceCurrent) { voiceCurrent.stop(); voiceCurrent = null; }
      try { if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel(); } catch { /* ignore */ }
      // Only offer clips that have not failed to load.
      const usable: Record<string, string> = {};
      for (const [k, v] of Object.entries(activeClips)) if (!voiceBroken.has(v)) usable[k] = v;
      const plan = planAnnounce(req, line, usable, voice.speakFishName);
      if (!plan.clip || !ctx) { if (plan.speech) speak(plan.speech); return; }
      const url = plan.clip;
      const fx = resolveLineFx(voice.presets, activePreset, activeLinePresets, req?.key);
      const context = ctx;
      void loadBuffer(url).then((buf) => {
        if (token !== voiceToken) return; // a newer line took over
        if (!buf) { speak(line); return; } // clip unusable: say the whole line
        if (context.state === 'suspended') void context.resume().catch(() => { /* ignore */ });
        voiceCurrent = playThroughFx(context, buf, fx, voice.volume, () => {
          if (token !== voiceToken) return;
          voiceCurrent = null;
          if (plan.speech) speak(plan.speech);
        });
      });
    },
    setVoice(opts) {
      if (opts.clips) activeClips = opts.clips;
      if (opts.preset !== undefined) activePreset = opts.preset;
      if (opts.linePresets) activeLinePresets = opts.linePresets;
    },
  };
}
