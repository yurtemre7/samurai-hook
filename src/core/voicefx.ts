import { dbToGain, driveCurve, isNeutralFx, leadInSeconds, makeImpulse, type VoiceFx } from './announcer';

/** Lead-in silence per decoded clip, computed once. */
const leadCache = new WeakMap<AudioBuffer, number>();
function leadIn(buffer: AudioBuffer): number {
  let v = leadCache.get(buffer);
  if (v === undefined) {
    v = buffer.numberOfChannels > 0 ? leadInSeconds(buffer.getChannelData(0), buffer.sampleRate) : 0;
    leadCache.set(buffer, v);
  }
  return v;
}

export interface VoicePlayback {
  /** Cut the line off now (short fade, so there is no click). */
  stop(): void;
}

/**
 * Plays a decoded clip through the announcer effect chain:
 *
 *   source (playbackRate) ------------+
 *   [layer: 2nd source, lower rate] --+-> [waveshaper] -> [low shelf]
 *     -> [presence peak] -> [low-pass]
 *     -> dry -------------------------------------+
 *     -> [convolver reverb] -> wet gain ----------+-> [gain trim] -> limiter
 *     -> [delay echo (+feedback)] -> wet gain ----+        -> volume -> out
 *
 * Bracketed stages exist only when their setting is non-neutral. With neutral
 * settings the clip goes straight to the output (no limiter), so it sounds
 * identical to the unprocessed file. `onEnded` fires when the clip itself
 * (and its layer, if any) finishes, not at the end of the reverb or echo
 * tail, and not when stopped.
 */
export function playThroughFx(
  ctx: AudioContext,
  buffer: AudioBuffer,
  fx: VoiceFx,
  volume: number,
  onEnded: () => void,
): VoicePlayback {
  const out = ctx.createGain(); // per-line output, faded on stop
  out.gain.value = volume;
  const nodes: AudioNode[] = [out];

  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = fx.rate;
  const sources = [src];

  if (isNeutralFx(fx)) {
    src.connect(out).connect(ctx.destination);
  } else {
    let tail: AudioNode = src;
    if (fx.layerGain > 0) {
      // Layered voice: a second, lower copy mixed under the first.
      const mix = ctx.createGain();
      const layer = ctx.createBufferSource();
      layer.buffer = buffer;
      layer.playbackRate.value = Math.max(0.1, fx.rate * fx.layerRate);
      const layerLevel = ctx.createGain(); layerLevel.gain.value = fx.layerGain;
      src.connect(mix); layer.connect(layerLevel).connect(mix);
      sources.push(layer); nodes.push(mix, layerLevel);
      tail = mix;
    }
    if (fx.drive > 0) {
      const shaper = ctx.createWaveShaper();
      shaper.curve = driveCurve(fx.drive);
      shaper.oversample = '2x';
      tail.connect(shaper); tail = shaper; nodes.push(shaper);
    }
    if (fx.lowBoost !== 0) {
      const shelf = ctx.createBiquadFilter();
      shelf.type = 'lowshelf'; shelf.frequency.value = 150; shelf.gain.value = fx.lowBoost;
      tail.connect(shelf); tail = shelf; nodes.push(shelf);
    }
    if (fx.presence !== 0) {
      const peak = ctx.createBiquadFilter();
      peak.type = 'peaking'; peak.frequency.value = 3000; peak.Q.value = 0.9; peak.gain.value = fx.presence;
      tail.connect(peak); tail = peak; nodes.push(peak);
    }
    if (fx.highCut < 20000) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = Math.max(200, fx.highCut);
      tail.connect(lp); tail = lp; nodes.push(lp);
    }
    // Limiter at the end: loud, but no clipping.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6; limiter.knee.value = 0; limiter.ratio.value = 20;
    limiter.attack.value = 0.003; limiter.release.value = 0.1;
    // Everything (dry, reverb, echo) is summed here, trimmed, then limited.
    const sum = ctx.createGain(); sum.gain.value = dbToGain(fx.gain);
    sum.connect(limiter);
    nodes.push(sum, limiter);
    tail.connect(sum);
    if (fx.reverb > 0) {
      const conv = ctx.createConvolver();
      const ir = makeImpulse(Math.max(0.1, fx.reverbSeconds), ctx.sampleRate);
      const buf = ctx.createBuffer(1, ir.length, ctx.sampleRate);
      buf.copyToChannel(ir, 0);
      conv.buffer = buf;
      const wet = ctx.createGain(); wet.gain.value = fx.reverb;
      tail.connect(conv); conv.connect(wet).connect(sum);
      nodes.push(conv, wet);
    }
    if (fx.echo > 0) {
      const delay = ctx.createDelay(1);
      delay.delayTime.value = Math.min(1, Math.max(0.02, fx.echoSeconds));
      const wet = ctx.createGain(); wet.gain.value = fx.echo;
      tail.connect(delay); delay.connect(wet).connect(sum);
      nodes.push(delay, wet);
      if (fx.echoFeedback > 0) {
        const fb = ctx.createGain(); fb.gain.value = Math.min(0.85, fx.echoFeedback);
        delay.connect(fb).connect(delay);
        nodes.push(fb);
      }
    }
    limiter.connect(out).connect(ctx.destination);
  }

  let stopped = false;
  // The slowest copy ends last; report the end of the line from that one.
  const last = sources.reduce((a, b) => (b.playbackRate.value < a.playbackRate.value ? b : a));
  last.onended = () => { if (!stopped) onEnded(); };
  const when = ctx.currentTime;
  // Skip the recording's silent lead-in so the word starts now (offset is in buffer time).
  const offset = leadIn(buffer);
  for (const s of sources) s.start(when, offset);

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      try {
        out.gain.setTargetAtTime(0, ctx.currentTime, 0.01);
        for (const s of sources) s.stop(ctx.currentTime + 0.06);
      } catch { /* already ended */ }
      setTimeout(() => { for (const n of nodes) { try { n.disconnect(); } catch { /* ignore */ } } }, 150);
    },
  };
}
