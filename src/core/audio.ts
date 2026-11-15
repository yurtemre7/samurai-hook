import type { AudioSys, SoundDef } from '../types';
import { assetUrl } from './assets';
import { audioPath } from './audioFormat';
import { planAnnounce, resolveLineFx, type AnnounceRequest, type FxChoice, type VoiceFx } from './announcer';
import { playThroughFx, type VoicePlayback } from './voicefx';

interface MusicDef { src: string | null; volume: number }
interface VoiceDef {
  enabled: boolean; rate: number; pitch: number; volume: number;
  clips: Record<string, string>; speakFishName: boolean;
  presets: Record<string, Partial<VoiceFx>>; preset: FxChoice;
  linePresets?: Record<string, FxChoice>;
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
  let musicFailed = 0;
  // Announcer: clips are fetched (starting now, so they are ready by the first
  // line), decoded to AudioBuffers once audio is unlocked, and played through
  // the effect chain in voicefx.ts. `voiceBroken` holds clip paths that failed.
  const voiceBroken = new Set<string>();
  const fetched = new Map<string, Promise<ArrayBuffer | null>>();
  const decoded = new Map<string, Promise<AudioBuffer | null>>();
  /** Paths whose AudioBuffer has finished decoding (for the ?debug=perf readout). */
  const ready = new Set<string>();
  let voiceCurrent: VoicePlayback | null = null;
  let voiceToken = 0;

  function fetchClip(path: string): Promise<ArrayBuffer | null> {
    let p = fetched.get(path);
    if (!p) {
      p = typeof fetch === 'undefined' ? Promise.resolve(null)
        : fetch(assetUrl(audioPath(path)))
          .then((r) => (r.ok ? r.arrayBuffer() : null))
          .catch(() => null);
      fetched.set(path, p);
      // A failure is not remembered: the next request tries again (a file can be missing for a
      // few minutes while a deploy is still publishing).
      void p.then((d) => { if (!d) fetched.delete(path); });
    }
    return p;
  }

  function loadBuffer(path: string): Promise<AudioBuffer | null> {
    let p = decoded.get(path);
    if (!p) {
      p = fetchClip(path).then(async (data) => {
        if (!data || !ctx) return null;
        try { return await ctx.decodeAudioData(data.slice(0)); } catch { voiceBroken.add(path); return null; }
      });
      decoded.set(path, p);
      void p.then((b) => { if (b) ready.add(path); else decoded.delete(path); });
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
    const el = new Audio(assetUrl(audioPath(def.src)));
    el.preload = 'auto';
    el.addEventListener('error', () => broken.add(id));
    clips.set(id, el);
    void fetchClip(def.src);
  }
  // Sound effects decoded for Web Audio: they start with no delay, unlike <audio> elements on iOS.
  const sfxBuffers = new Map<string, AudioBuffer>();
  function decodeAll(): void {
    for (const path of Object.values(voice.clips)) void loadBuffer(path);
    for (const [id, def] of Object.entries(sounds)) {
      if (!def.src || sfxBuffers.has(id)) continue;
      const src = def.src;
      void loadBuffer(src).then((b) => { if (b) sfxBuffers.set(id, b); });
    }
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
    const el = new Audio(assetUrl(audioPath(def.src)));
    el.loop = true;
    el.volume = def.volume;
    el.addEventListener('error', () => {
      // Missing for now (e.g. mid-deploy): forget it and try again in a few seconds if still wanted.
      if (currentMusic !== el) return;
      musicFailed += 1;
      currentMusic = null;
      currentMusicId = null;
      setTimeout(() => { if (unlocked && wantedMusic === id && currentMusicId === null) startMusic(id); }, 3000);
    });
    el.play().catch(() => { /* blocked or missing: stay silent */ });
    currentMusic = el;
  }

  return {
    unlock() {
      // Called on every key press and touch. iOS can leave or put the context in 'suspended'
      // (created outside a gesture, phone call, lock screen); resuming inside a gesture fixes it.
      if (unlocked) {
        if (ctx && ctx.state !== 'running') void ctx.resume().catch(() => { /* ignore */ });
        if (wantedMusic && currentMusic?.paused) void currentMusic.play().catch(() => { /* ignore */ });
        return;
      }
      unlocked = true;
      try { ctx = new AudioContext(); } catch { ctx = null; }
      if (ctx && ctx.state !== 'running') void ctx.resume().catch(() => { /* ignore */ });
      decodeAll();
      if (wantedMusic) startMusic(wantedMusic);
    },
    debugInfo() {
      const ogg = audioPath('x.ogg').endsWith('.ogg') ? 'ogg' : 'aac';
      const vTotal = Object.keys(voice.clips).length;
      const sTotal = Object.values(sounds).filter((d) => d.src).length;
      let vReady = 0;
      for (const p of Object.values(voice.clips)) if (ready.has(p)) vReady += 1;
      return `audio ${ogg} ctx ${ctx ? ctx.state : 'none'} voice ${vReady}/${vTotal} sfx ${sfxBuffers.size}/${sTotal}` +
        ` music ${currentMusic ? (currentMusic.paused ? 'paused' : 'playing') : 'none'}${musicFailed ? ` (failed ${musicFailed})` : ''}`;
    },
    play(id) {
      const def = sounds[id];
      if (!def || !unlocked) return;
      const buf = sfxBuffers.get(id);
      if (ctx && buf) {
        const src = ctx.createBufferSource();
        const gain = ctx.createGain();
        src.buffer = buf;
        gain.gain.value = def.volume ?? 1;
        src.connect(gain).connect(ctx.destination);
        src.start();
        return;
      }
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
      for (const [k, v] of Object.entries(voice.clips)) if (!voiceBroken.has(v)) usable[k] = v;
      const plan = planAnnounce(req, line, usable, voice.speakFishName);
      if (!plan.clip || !ctx) { if (plan.speech) speak(plan.speech); return; }
      const url = plan.clip;
      const fx = resolveLineFx(voice.presets, voice.preset, voice.linePresets ?? {}, req?.key);
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
  };
}
