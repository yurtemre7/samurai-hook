import { driveCurve, isNeutralFx, makeImpulse, type VoiceFx } from './announcer';

export interface VoicePlayback {
  /** Cut the line off now (short fade, so there is no click). */
  stop(): void;
}

/**
 * Plays a decoded clip through the announcer effect chain:
 *
 *   source (playbackRate) -> [waveshaper] -> [low shelf] -> [low-pass]
 *     -> dry ----------------------------+
 *     -> [convolver reverb] -> wet gain -+-> limiter -> volume -> out
 *     -> [delay echo] -> wet gain -------+
 *
 * Bracketed stages exist only when their setting is non-neutral. With neutral
 * settings the clip goes straight to the output (no limiter), so it sounds
 * identical to the unprocessed file. `onEnded` fires when the clip itself
 * finishes (not at the end of the reverb tail), and not when stopped.
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

  if (isNeutralFx(fx)) {
    src.connect(out).connect(ctx.destination);
  } else {
    let tail: AudioNode = src;
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
    if (fx.highCut < 20000) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = Math.max(200, fx.highCut);
      tail.connect(lp); tail = lp; nodes.push(lp);
    }
    // Limiter at the end: loud, but no clipping.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6; limiter.knee.value = 0; limiter.ratio.value = 20;
    limiter.attack.value = 0.003; limiter.release.value = 0.1;
    nodes.push(limiter);
    tail.connect(limiter);
    if (fx.reverb > 0) {
      const conv = ctx.createConvolver();
      const ir = makeImpulse(Math.max(0.1, fx.reverbSeconds), ctx.sampleRate);
      const buf = ctx.createBuffer(1, ir.length, ctx.sampleRate);
      buf.copyToChannel(ir, 0);
      conv.buffer = buf;
      const wet = ctx.createGain(); wet.gain.value = fx.reverb;
      tail.connect(conv); conv.connect(wet).connect(limiter);
      nodes.push(conv, wet);
    }
    if (fx.echo > 0) {
      const delay = ctx.createDelay(1);
      delay.delayTime.value = Math.min(1, Math.max(0.02, fx.echoSeconds));
      const wet = ctx.createGain(); wet.gain.value = fx.echo;
      tail.connect(delay); delay.connect(wet).connect(limiter);
      nodes.push(delay, wet);
    }
    limiter.connect(out).connect(ctx.destination);
  }

  let stopped = false;
  src.onended = () => { if (!stopped) onEnded(); };
  src.start();

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      try {
        out.gain.setTargetAtTime(0, ctx.currentTime, 0.01);
        src.stop(ctx.currentTime + 0.06);
      } catch { /* already ended */ }
      setTimeout(() => { for (const n of nodes) { try { n.disconnect(); } catch { /* ignore */ } } }, 150);
    },
  };
}
