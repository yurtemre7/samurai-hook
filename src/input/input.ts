// Keyboard + gamepad input. Thin browser wrapper around the pure core in core.ts.
import { createInputCore, type GamepadLike, type InputCore } from './core';
import { createKeyDebug, keysDebugEnabled } from './debug';

const NO_SCROLL = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']);
/** The canvas is always 960x540 game px, scaled to fit the window. */
const GAME_W = 960;
const GAME_H = 540;

export function createInput(target: Window = window): InputCore {
  const core = createInputCore({
    storage: (() => { try { return target.localStorage; } catch { return null; } })(),
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
    // While the settings panel is waiting for a key to bind, every key is consumed (Tab must not move focus).
    if (!mod && (core.capturing || NO_SCROLL.has(e.code) || core.actionsFor(e.code, e.key).length > 0)) e.preventDefault();
    // Call the core first: `debug?.log(..., core.keyDown())` would skip keyDown when debug is off.
    const acts = core.keyDown(e.code, e.key);
    debug?.log('down', e, acts);
  });
  // Keyup is never filtered: it releases by code whatever was activated on keydown.
  target.addEventListener('keyup', (e) => {
    const acts = core.keyUp(e.code, e.key);
    debug?.log('up', e, acts);
  });
  // Mouse buttons go through the key path as "Mouse0" (left) / "Mouse2" (right), see KEY_MAP.
  // Pointer events from a real mouse only: a phone's tap also fires compatibility mouse events,
  // which would slash and switch the prompts to the keyboard.
  target.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') return;
    core.keyDown(`Mouse${e.button}`);
    // A left click also reports where it landed, in game px, for clickable menus.
    const canvas = target.document?.getElementById('game');
    const r = canvas?.getBoundingClientRect();
    if (e.button === 0 && r && r.width > 0 && r.height > 0) {
      core.mouseClick(((e.clientX - r.left) / r.width) * GAME_W, ((e.clientY - r.top) / r.height) * GAME_H);
    }
  });
  target.addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse') core.keyUp(`Mouse${e.button}`); });
  // Right click is heavy slash, not the browser menu.
  target.addEventListener('contextmenu', (e) => e.preventDefault());
  target.addEventListener('blur', () => core.clearKeys());

  return core;
}
