// Opt-in key debugger: enabled by `?debug=keys`. Shows what the browser reports per key event.
import type { Action, Input } from '../types';

export function keysDebugEnabled(search: string): boolean {
  try {
    return new URLSearchParams(search).get('debug') === 'keys';
  } catch {
    return false;
  }
}

export interface KeyDebug {
  log(kind: 'down' | 'up', e: KeyboardEvent, actions: readonly Action[]): void;
}

/** Builds the overlay panel. Only called when enabled, so nothing exists otherwise. */
export function createKeyDebug(input: Input, doc: Document = document): KeyDebug {
  const lines: string[] = [];
  const downAt = new Map<string, number>();
  const el = doc.createElement('pre');
  el.style.cssText =
    'position:fixed;top:4px;left:4px;margin:0;padding:6px 8px;z-index:99999;' +
    'font:12px/1.4 ui-monospace,Menlo,Consolas,monospace;color:#9f9;background:rgba(0,0,0,0.75);' +
    'pointer-events:none;user-select:none;white-space:pre;';
  el.setAttribute('aria-hidden', 'true');
  doc.body.appendChild(el);

  const render = () => {
    const status = `moveX=${input.moveX().toFixed(2)} moveY=${input.moveY().toFixed(2)} device=${input.device}`;
    el.textContent = `key debug (?debug=keys)\n${status}\n${lines.join('\n') || '(press a key)'}`;
    requestAnimationFrame(render);
  };
  render();

  return {
    log(kind, e, actions) {
      const act = actions.length ? actions.join(',') : '(none)';
      const t = performance.now();
      let extra = `repeat=${e.repeat} composing=${e.isComposing}`;
      if (kind === 'down') {
        if (!e.repeat) downAt.set(e.code, t);
      } else {
        const t0 = downAt.get(e.code);
        extra += t0 === undefined ? ' held=?ms' : ` held=${Math.round(t - t0)}ms`;
        downAt.delete(e.code);
      }
      lines.push(`${kind.padEnd(4)} code=${e.code}  key=${JSON.stringify(e.key)}  ${extra}  -> ${act}`);
      if (lines.length > 8) lines.shift();
    },
  };
}
