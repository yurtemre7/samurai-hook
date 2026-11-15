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

/** A window with a 960x540 canvas drawn at 480x270 from (100, 50), and a pointer helper. */
function mouseWindow() {
  const handlers: Record<string, ((e: unknown) => void)[]> = {};
  const canvas = { getBoundingClientRect: () => ({ left: 100, top: 50, width: 480, height: 270 }) };
  const target = {
    location: { search: '' },
    document: { getElementById: (id: string) => (id === 'game' ? canvas : null) },
    addEventListener: (t: string, h: (e: unknown) => void) => { (handlers[t] ??= []).push(h); },
  };
  const input = createInput(target as unknown as Window);
  const mouse = (t: string, button: number, pointerType = 'mouse', clientX = 0, clientY = 0) =>
    handlers[t].forEach((h) => h({ button, pointerType, clientX, clientY }));
  return { input, handlers, mouse };
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

  it('left click is quick, right click is heavy, and the menu is blocked', () => {
    const { input, handlers, mouse } = mouseWindow();
    mouse('pointerdown', 0);
    input.update();
    expect(input.pressed('quick')).toBe(true);
    mouse('pointerup', 0);
    mouse('pointerdown', 2);
    input.update();
    expect(input.pressed('heavy')).toBe(true);
    expect(input.held('quick')).toBe(false);
    let blocked = false;
    handlers.contextmenu.forEach((h) => h({ preventDefault: () => { blocked = true; } }));
    expect(blocked).toBe(true);
  });

  it('a left click reports where it landed in game px, once', () => {
    const { input, mouse } = mouseWindow();
    // The canvas is drawn at half size (480x270) from (100, 50): (340, 185) is game (480, 270).
    mouse('pointerdown', 0, 'mouse', 340, 185);
    input.update();
    expect(input.clicked()).toEqual({ x: 480, y: 270 });
    input.update();
    expect(input.clicked()).toBeNull();
  });

  it('a touch on a phone is not a mouse click: no slash, no click', () => {
    const { input, mouse } = mouseWindow();
    mouse('pointerdown', 0, 'touch', 340, 185);
    input.update();
    expect(input.pressed('quick')).toBe(false);
    expect(input.clicked()).toBeNull();
  });

  it('a click on a prompt-bar item presses its action instead of being a click', () => {
    const { input, mouse } = mouseWindow();
    input.setPromptHits([{ x0: 400, x1: 500, y0: 510, y1: 540, action: 'shop' }]);
    mouse('pointerdown', 0, 'mouse', 100 + 450 / 2, 50 + 525 / 2);
    input.update();
    expect(input.pressed('shop')).toBe(true);
    expect(input.clicked()).toBeNull();
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
