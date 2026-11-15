// Keyboard + gamepad input. Thin browser wrapper around the pure core in core.ts.
import { actionsForKey, createInputCore, type GamepadLike, type InputCore } from './core';
import { createKeyDebug, keysDebugEnabled } from './debug';

const NO_SCROLL = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']);

export function createInput(target: Window = window): InputCore {
  const core = createInputCore({
    // Looked up on every call: tests and tools may replace navigator.getGamepads at runtime.
    getGamepads: () => {
      const nav = (target.navigator ?? (globalThis as { navigator?: Navigator }).navigator) as
        | (Navigator & { getGamepads?: () => (GamepadLike | null)[] })
        | undefined;
      return typeof nav?.getGamepads === 'function' ? nav.getGamepads() : null;
    },
  });

  const debug = keysDebugEnabled(target.location?.search ?? '') ? createKeyDebug(core) : null;
  const isLetter = (e: KeyboardEvent) => /^Key[A-Z]$/.test(e.code) || /^[a-z]$/i.test(e.key);

  target.addEventListener('keydown', (e) => {
    // Cmd held: the browser may swallow later keyups, so drop everything rather than risk a stuck key.
    if (e.key === 'Meta') core.clearKeys();
    // Browser shortcuts (Cmd+W, Ctrl+S, Alt+...) must not drive the samurai.
    const mod = e.metaKey || e.ctrlKey || e.altKey;
    if (mod && isLetter(e)) {
      debug?.log('down', e, []);
      return;
    }
    // Bound keys (by code or label) are consumed so macOS press-and-hold / IME never sees them.
    // Not with a modifier held, so browser shortcuts keep working. Unbound keys and F-keys untouched.
    // Composition/Dead/Process events are still mapped by their `code` (the core ignores `key` then).
    // Repeats re-assert the held state; the core's pressed() edge only fires on a real up->down.
    if (!mod && (NO_SCROLL.has(e.code) || actionsForKey(e.code, e.key).length > 0)) e.preventDefault();
    // Call the core first: `debug?.log(..., core.keyDown())` would skip keyDown when debug is off.
    const acts = core.keyDown(e.code, e.key);
    debug?.log('down', e, acts);
  });
  // Keyup is never filtered: it releases by code whatever was activated on keydown.
  target.addEventListener('keyup', (e) => {
    const acts = core.keyUp(e.code, e.key);
    debug?.log('up', e, acts);
  });
  target.addEventListener('blur', () => core.clearKeys());

  return core;
}
