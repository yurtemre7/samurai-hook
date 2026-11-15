import { describe, expect, it } from 'vitest';
import { createInputCore } from '../src/input/core';
import { dragToAxis, padDirections, touchEnabled } from '../src/input/touch';

const make = () => createInputCore({ getGamepads: () => [] });

describe('touch buttons in the core', () => {
  it('held plus exactly one pressed edge', () => {
    const input = make();
    input.update();
    input.touchDown('quick');
    input.update();
    expect(input.held('quick')).toBe(true);
    expect(input.pressed('quick')).toBe(true);
    input.update();
    expect(input.held('quick')).toBe(true);
    expect(input.pressed('quick')).toBe(false);
    input.touchUp('quick');
    input.update();
    expect(input.held('quick')).toBe(false);
  });

  it('a tap between two updates still registers once', () => {
    const input = make();
    input.update();
    input.touchDown('confirm');
    input.touchUp('confirm');
    input.update();
    expect(input.pressed('confirm')).toBe(true);
    expect(input.anyPressed()).toBe(true);
    input.update();
    expect(input.held('confirm')).toBe(false);
    expect(input.pressed('confirm')).toBe(false);
  });

  it('repeated touchDown while held does not re-latch an edge', () => {
    const input = make();
    input.touchDown('heavy');
    input.update();
    input.touchDown('heavy');
    input.update();
    expect(input.pressed('heavy')).toBe(false);
  });

  it('touch plus key for the same action is one edge', () => {
    const input = make();
    input.update();
    input.touchDown('quick');
    input.keyDown('KeyJ');
    input.update();
    expect(input.pressed('quick')).toBe(true);
    input.update();
    expect(input.pressed('quick')).toBe(false);
    input.keyUp('KeyJ');
    input.update();
    expect(input.held('quick')).toBe(true); // touch still holds it
    input.touchUp('quick');
    input.update();
    expect(input.held('quick')).toBe(false);
  });

  it('pad directions drive moveX / moveY like keys', () => {
    const input = make();
    input.touchDown('left');
    input.touchDown('down');
    input.update();
    expect(input.moveX()).toBe(-1);
    expect(input.moveY()).toBe(1);
  });

  it('device switches to touch and glyphs follow; a key switches back', () => {
    const input = make();
    expect(input.device).toBe('keyboard');
    input.touchDown('quick');
    expect(input.device).toBe('touch');
    expect(input.glyph('quick')).toBe('QUICK');
    input.keyDown('KeyQ');
    expect(input.device).toBe('keyboard');
  });

  it('clearKeys (blur) releases touch buttons and the axis', () => {
    const input = make();
    input.touchDown('defend');
    input.setTouchAxis(1, 1);
    input.update();
    expect(input.held('defend')).toBe(true);
    input.clearKeys();
    input.update();
    expect(input.held('defend')).toBe(false);
    expect(input.moveX()).toBe(0);
    expect(input.moveY()).toBe(0);
  });
});

describe('touch axis in the core', () => {
  it('feeds moveX / moveY and clamps', () => {
    const input = make();
    input.setTouchAxis(0.5, -0.25);
    input.update();
    expect(input.moveX()).toBeCloseTo(0.5);
    expect(input.moveY()).toBeCloseTo(-0.25);
    input.setTouchAxis(5, -5);
    input.update();
    expect(input.moveX()).toBe(1);
    expect(input.moveY()).toBe(-1);
  });

  it('combines with keys and clamps the sum', () => {
    const input = make();
    input.keyDown('KeyD');
    input.setTouchAxis(-0.4, 0);
    input.update();
    expect(input.moveX()).toBeCloseTo(0.6);
    input.setTouchAxis(0.5, 0);
    input.update();
    expect(input.moveX()).toBe(1);
  });

  it('never produces held or pressed actions, switches device, and NaN is zero', () => {
    const input = make();
    input.setTouchAxis(1, 1);
    input.update();
    expect(input.device).toBe('touch');
    expect(input.anyPressed()).toBe(false);
    expect(input.held('confirm')).toBe(false);
    input.setTouchAxis(Number.NaN, 0);
    input.update();
    expect(input.moveX()).toBe(0);
  });
});

describe('dragToAxis', () => {
  it('dead zone is zero, full deflection is 1, clamped beyond', () => {
    expect(dragToAxis(0, 0)).toEqual({ x: 0, y: 0 });
    expect(dragToAxis(10, 0)).toEqual({ x: 0, y: 0 });
    expect(dragToAxis(80, 0).x).toBeCloseTo(1);
    expect(dragToAxis(-500, 0).x).toBeCloseTo(-1);
    expect(dragToAxis(45, 0).x).toBeCloseTo(0.5);
  });
  it('keeps direction and never exceeds length 1 on diagonals', () => {
    const a = dragToAxis(300, 300);
    expect(Math.hypot(a.x, a.y)).toBeCloseTo(1);
    expect(a.x).toBeCloseTo(a.y);
    const b = dragToAxis(0, -60);
    expect(b.x).toBeCloseTo(0);
    expect(b.y).toBeLessThan(0);
  });
  it('NaN is zero', () => {
    expect(dragToAxis(Number.NaN, 5)).toEqual({ x: 0, y: 0 });
  });
});

describe('padDirections', () => {
  const half = 90;
  it('centre is dead', () => expect(padDirections(0, 0, half)).toEqual([]));
  it('cardinal cells', () => {
    expect(padDirections(0, -60, half)).toEqual(['up']);
    expect(padDirections(0, 60, half)).toEqual(['down']);
    expect(padDirections(-60, 0, half)).toEqual(['left']);
    expect(padDirections(60, 0, half)).toEqual(['right']);
  });
  it('corners are diagonals', () => {
    expect(padDirections(60, -60, half).sort()).toEqual(['right', 'up']);
    expect(padDirections(-60, 60, half).sort()).toEqual(['down', 'left']);
  });
  it('far outside is nothing; bad input is nothing', () => {
    expect(padDirections(200, 0, half)).toEqual([]);
    expect(padDirections(0, 0, 0)).toEqual([]);
    expect(padDirections(Number.NaN, 0, half)).toEqual([]);
  });
});

describe('touchEnabled', () => {
  it('coarse pointer or ?touch=1', () => {
    expect(touchEnabled('', false)).toBe(false);
    expect(touchEnabled('?scene=fight', false)).toBe(false);
    expect(touchEnabled('', true)).toBe(true);
    expect(touchEnabled('?touch=1', false)).toBe(true);
    expect(touchEnabled('?touch=0', false)).toBe(false);
  });
});
