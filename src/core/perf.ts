// `?debug=perf`: a small readout for diagnosing lag on phones. Shows the build (short commit), frames
// per second, the worst frame of the last second, and how long a touch took to reach the game.
// Off (nothing created, no work) without the URL parameter.

declare const __COMMIT__: string;

export interface Perf {
  /** Call at the start of every animation frame. */
  frame(now: number): void;
  /** A finger went down (any button, pad or the play area). */
  touched(at: number): void;
  /** The game step that used that touch ran now. */
  consumed(now: number): void;
}

const NOOP: Perf = { frame() {}, touched() {}, consumed() {} };

export function perfEnabled(search: string): boolean {
  return new URLSearchParams(search).get('debug') === 'perf';
}

export function createPerf(doc: Document = document, extra: () => string = () => ''): Perf {
  if (!perfEnabled(doc.defaultView?.location.search ?? '')) return NOOP;
  const el = doc.createElement('pre');
  el.style.cssText =
    'position:fixed;left:50%;transform:translateX(-50%);top:6px;z-index:20;margin:0;padding:4px 6px;font:11px/1.3 ui-monospace,monospace;' +
    'color:#9f9;background:rgba(0,0,0,.7);pointer-events:none;user-select:none;white-space:pre;';
  doc.body.appendChild(el);
  const commit = typeof __COMMIT__ === 'string' ? __COMMIT__ : 'dev';
  let last = 0;
  let windowStart = 0;
  let frames = 0;
  let worst = 0;
  let pending = 0;
  let lastLatency = -1;
  let fps = 0;
  let worstShown = 0;
  return {
    frame(now) {
      if (last) worst = Math.max(worst, now - last);
      last = now;
      frames += 1;
      if (!windowStart) windowStart = now;
      if (now - windowStart >= 1000) {
        fps = Math.round((frames * 1000) / (now - windowStart));
        worstShown = Math.round(worst);
        frames = 0;
        worst = 0;
        windowStart = now;
        el.textContent =
          `build ${commit}\nfps ${fps}  worst frame ${worstShown} ms\n` +
          `touch -> game ${lastLatency < 0 ? '-' : `${Math.round(lastLatency)} ms`}` +
          (extra() ? `\n${extra()}` : '');
      }
    },
    touched(at) {
      pending = at;
    },
    consumed(now) {
      if (pending) {
        lastLatency = now - pending;
        pending = 0;
      }
    },
  };
}
