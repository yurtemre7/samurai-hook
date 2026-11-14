/** Pure announcer logic: which recorded clip to play for a line, and what
 *  (if anything) the synthesised voice still has to say. No Audio here, so it
 *  runs under Vitest in node. */

export interface AnnounceRequest {
  /** Clip key: 'fight', 'win', 'perfect', 'timeout', 'ko', 'round', ... */
  key: string;
  /** Round number, for key 'round'. Looks up clip 'round<N>', then 'round'. */
  round?: number;
  /** Fish name, spoken by synthesis after a recorded round clip when
   *  speakFishName is on. */
  fish?: string;
}

export interface AnnouncePlan {
  /** Clip path (relative to public/) to play, or null for speech only. */
  clip: string | null;
  /** Spoken line to say after the clip (or instead of it); null for nothing. */
  speech: string | null;
}

export function planAnnounce(
  req: AnnounceRequest | undefined,
  text: string,
  clips: Record<string, string>,
  speakFishName: boolean,
): AnnouncePlan {
  if (!req) return { clip: null, speech: text };
  const clip = (req.round !== undefined ? clips[`${req.key}${req.round}`] : undefined) ?? clips[req.key] ?? null;
  if (!clip) return { clip: null, speech: text };
  const speech = req.key === 'round' && speakFishName && req.fish ? req.fish : null;
  return { clip, speech };
}

// ---------- Voice effects (pure parameter handling) ----------

/** Effect chain settings for announcer clips. The neutral values (NEUTRAL_FX)
 *  leave a clip untouched. */
export interface VoiceFx {
  /** Playback rate. Below 1 lowers pitch and slows the line (0.7 to 0.85). */
  rate: number;
  /** Waveshaper distortion amount 0 to 1 (growl). */
  drive: number;
  /** Low-shelf gain at 150 Hz in dB (0 = off). */
  lowBoost: number;
  /** Low-pass cutoff in Hz; 20000 or more = off. */
  highCut: number;
  /** Reverb wet mix 0 to 1 (0 = off). */
  reverb: number;
  /** Length of the generated reverb tail in seconds. */
  reverbSeconds: number;
  /** Slap-back echo wet mix 0 to 1 (0 = off). */
  echo: number;
  /** Echo delay in seconds. */
  echoSeconds: number;
}

export const NEUTRAL_FX: VoiceFx = {
  rate: 1, drive: 0, lowBoost: 0, highCut: 20000,
  reverb: 0, reverbSeconds: 1.5, echo: 0, echoSeconds: 0.2,
};

/** Merge a (possibly partial) preset over the neutral values. */
export function resolveFx(
  presets: Record<string, Partial<VoiceFx>>,
  name: string,
  overrides: Partial<VoiceFx> = {},
): VoiceFx {
  return { ...NEUTRAL_FX, ...(presets[name] ?? {}), ...overrides };
}

/** True when the settings would not change the clip (the chain is bypassed
 *  entirely, so the output is the clip itself). */
export function isNeutralFx(fx: VoiceFx): boolean {
  return fx.rate === 1 && fx.drive <= 0 && fx.lowBoost === 0 && fx.highCut >= 20000
    && fx.reverb <= 0 && fx.echo <= 0;
}

/** Soft-clipping curve for a WaveShaperNode. drive 0 is the identity. */
export function driveCurve(drive: number, samples = 1024): Float32Array<ArrayBuffer> {
  const k = Math.max(0, drive) * 60;
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1;
    curve[i] = k === 0 ? x : ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

/** Reverb impulse response (one channel): noise with a decaying envelope.
 *  `rng` returns values in [0, 1); inject a seeded one in tests. */
export function makeImpulse(seconds: number, sampleRate: number, rng: () => number = Math.random): Float32Array<ArrayBuffer> {
  const n = Math.max(1, Math.floor(seconds * sampleRate));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = (rng() * 2 - 1) * Math.pow(1 - i / n, 3);
  return out;
}
