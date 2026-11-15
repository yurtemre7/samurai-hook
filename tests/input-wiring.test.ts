import { describe, expect, it } from 'vitest';
import { createInput } from '../src/input/input';

// Regression: with ?debug=keys off, key events must still reach the input core.
function fakeWindow() {
  const handlers: Record<string, ((e: unknown) => void)[]> = {};
  const target = {
    location: { search: '' },
    addEventListener: (t: string, h: (e: unknown) => void) => { (handlers[t] ??= []).push(h); },
  };
  const fire = (t: string, code: string, key: string) =>
    handlers[t]?.forEach((h) => h({ code, key, metaKey: false, ctrlKey: false, altKey: false, repeat: false, preventDefault() {} }));
  return { target: target as unknown as Window, fire };
}

describe('createInput wiring (debug off)', () => {
  it('Space and E register as confirm / shop', () => {
    const { target, fire } = fakeWindow();
    const input = createInput(target);
    fire('keydown', 'Space', ' ');
    input.update();
    expect(input.pressed('confirm')).toBe(true);
    fire('keyup', 'Space', ' ');
    fire('keydown', 'KeyE', 'e');
    input.update();
    expect(input.pressed('shop')).toBe(true);
  });

  it('held D keeps moving right until released', () => {
    const { target, fire } = fakeWindow();
    const input = createInput(target);
    fire('keydown', 'KeyD', 'd');
    input.update();
    expect(input.moveX()).toBe(1);
    fire('keyup', 'KeyD', 'd');
    input.update();
    expect(input.moveX()).toBe(0);
  });
});
