// Keyboard + gamepad input. Thin browser wrapper around the pure core in core.ts.
import type { Input } from '../types';
import { createInputCore, type GamepadLike } from './core';

const NO_SCROLL = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']);

export function createInput(target: Window = window): Input {
  const core = createInputCore({
    // Looked up on every call: tests and tools may replace navigator.getGamepads at runtime.
    getGamepads: () => {
      const nav = (target.navigator ?? (globalThis as { navigator?: Navigator }).navigator) as
        | (Navigator & { getGamepads?: () => (GamepadLike | null)[] })
        | undefined;
      return typeof nav?.getGamepads === 'function' ? nav.getGamepads() : null;
    },
  });

  target.addEventListener('keydown', (e) => {
    if (NO_SCROLL.has(e.code)) e.preventDefault();
    core.keyDown(e.code);
  });
  target.addEventListener('keyup', (e) => core.keyUp(e.code));
  target.addEventListener('blur', () => core.clearKeys());

  return core;
}
