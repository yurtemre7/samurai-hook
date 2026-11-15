import { describe, expect, it } from 'vitest';
import {
  ACTIONS, applyDeadzone, BINDINGS_KEY, createInputCore, DEFAULT_BINDINGS, isReservedKey, keyName, sanitizeBindings,
  type GamepadLike,
} from '../src/input/core';

function memStore(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return { data, getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => { data[k] = v; } };
}

describe('key bindings', () => {
  const press = (input: ReturnType<typeof createInputCore>, code: string, key?: string) => {
    input.keyDown(code, key);
    input.update();
    const hit = ACTIONS.filter((a) => input.pressed(a));
    input.keyUp(code);
    input.update();
    return hit;
  };
  const fresh = (storage = memStore()) => ({ storage, input: createInputCore({ getGamepads: () => [], storage }) });

  it('a rebind changes what the key fires, and the old key goes dead', () => {
    const { input } = fresh();
    expect(press(input, 'KeyJ', 'j')).toEqual(['quick']);
    expect(input.rebind('quick', 0, 'KeyU')).toBe('ok');
    expect(press(input, 'KeyU', 'u')).toEqual(['quick']);
    expect(press(input, 'KeyJ', 'j')).toEqual([]); // not even through the labelled-letter fallback
    expect(input.glyph('quick')).toBe('U');
  });

  it('binding a key another action uses swaps the two', () => {
    const { input } = fresh();
    expect(input.rebind('quick', 0, 'KeyK')).toBe('swapped'); // K was heavy
    expect(input.binding('quick', 0)).toBe('KeyK');
    expect(input.binding('heavy', 0)).toBe('KeyJ');
    expect(press(input, 'KeyK', 'k')).toEqual(['quick']);
    expect(press(input, 'KeyJ', 'j')).toEqual(['heavy']);
  });

  it('no action can end up without a primary key', () => {
    const { input } = fresh();
    // shop has no alternate: giving its slot 2 heavy's only key would leave heavy empty.
    expect(input.rebind('shop', 1, 'KeyK')).toBe('refused');
    expect(input.binding('heavy', 0)).toBe('KeyK');
    // ...but taking an alternate key from another action is fine.
    expect(input.rebind('shop', 1, 'ArrowLeft')).toBe('swapped');
    expect(input.binding('left', 1)).toBeNull();
    expect(input.binding('left', 0)).toBe('KeyA');
    expect(input.clearBinding('shop')).toBe(true);
    expect(input.clearBinding('shop')).toBe(false);
    for (const a of ACTIONS) expect(input.binding(a, 0)).toBeTruthy();
  });

  it('reserved keys are refused', () => {
    const { input } = fresh();
    for (const code of ['F2', 'F4', 'F12', 'ControlLeft', 'AltRight', 'MetaLeft', 'Backspace', 'Delete', '', 'Unidentified']) {
      expect(isReservedKey(code), code).toBe(true);
      expect(input.rebind('quick', 0, code), code).toBe('reserved');
    }
    expect(input.binding('quick', 0)).toBe('KeyJ');
  });

  it('capture hands the next key over, fires nothing, and ignores its autorepeat', () => {
    const { input } = fresh();
    let got = '';
    input.startCapture((c) => { got = c; });
    expect(input.capturing).toBe(true);
    expect(input.keyDown('KeyJ', 'j')).toEqual([]);
    expect(got).toBe('KeyJ');
    expect(input.capturing).toBe(false);
    input.keyDown('KeyJ', 'j'); // autorepeat before the keyup
    input.update();
    expect(input.held('quick')).toBe(false);
    expect(input.pressed('quick')).toBe(false);
    input.keyUp('KeyJ');
    expect(press(input, 'KeyJ', 'j')).toEqual(['quick']); // released: it works again
  });

  it('a key held when capture starts is not captured by its autorepeat', () => {
    const { input } = fresh();
    input.keyDown('Space');
    input.update();
    let got = '';
    input.startCapture((c) => { got = c; });
    input.keyDown('Space'); // autorepeat of the key that opened the capture
    expect(got).toBe('');
    expect(input.capturing).toBe(true);
    input.keyDown('KeyZ');
    expect(got).toBe('KeyZ');
  });

  it('bindings are saved, survive a restart, and reset restores the defaults', () => {
    const { input, storage } = fresh();
    input.rebind('quick', 0, 'KeyU');
    const again = createInputCore({ getGamepads: () => [], storage });
    expect(again.binding('quick', 0)).toBe('KeyU');
    expect(press(again, 'KeyJ', 'j')).toEqual([]);
    again.resetBindings();
    expect(createInputCore({ getGamepads: () => [], storage }).binding('quick', 0)).toBe('KeyJ');
    expect(press(again, 'KeyJ', 'j')).toEqual(['quick']);
  });

  it('a partial or damaged stored map merges with the defaults', () => {
    expect(sanitizeBindings({ quick: ['KeyU', null] }).quick).toEqual(['KeyU', null]);
    expect(sanitizeBindings({ quick: ['KeyU', null] }).heavy).toEqual(DEFAULT_BINDINGS.heavy);
    expect(sanitizeBindings({ quick: ['F5', null] }).quick).toEqual(DEFAULT_BINDINGS.quick); // reserved: back to default
    expect(sanitizeBindings({ quick: [null, null] }).quick).toEqual(DEFAULT_BINDINGS.quick);
    expect(sanitizeBindings({ quick: ['KeyK', null] })).toEqual(DEFAULT_BINDINGS); // KeyK also heavy's: all dropped
    expect(sanitizeBindings('junk')).toEqual(DEFAULT_BINDINGS);
    const store = memStore({ [BINDINGS_KEY]: '{not json' });
    expect(createInputCore({ getGamepads: () => [], storage: store }).binding('quick', 0)).toBe('KeyJ');
  });

  it('key names', () => {
    expect(keyName('KeyJ')).toBe('J');
    expect(keyName('Digit5')).toBe('5');
    expect(keyName('Space')).toBe('SPACE');
    expect(keyName('ArrowLeft')).toBe('←');
    expect(keyName('ShiftLeft')).toBe('L SHIFT');
    expect(keyName('Mouse0')).toBe('LEFT CLICK');
    expect(keyName(null)).toBe('-');
  });

  it('the labelled-letter fallback still works on the defaults (non-QWERTY layouts)', () => {
    const { input } = fresh();
    expect(press(input, 'KeyZ', 'j')).toEqual(['quick']); // another layout's key that prints "j"
  });
});

function makePad(): GamepadLike & { buttons: { pressed: boolean }[]; axes: number[] } {
  return {
    connected: true,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false })),
  };
}

function setup(withPad = true) {
  const pad = makePad();
  let pads: (GamepadLike | null)[] = withPad ? [null, pad] : [];
  const input = createInputCore({ getGamepads: () => pads });
  return { input, pad, setPads: (p: (GamepadLike | null)[]) => { pads = p; } };
}

describe('keyboard', () => {
  it('held and pressed edges', () => {
    const { input } = setup(false);
    input.update();
    expect(input.held('quick')).toBe(false);
    input.keyDown('KeyJ');
    input.update();
    expect(input.pressed('quick')).toBe(true);
    expect(input.held('quick')).toBe(true);
    expect(input.anyPressed()).toBe(true);
    input.update();
    expect(input.pressed('quick')).toBe(false);
    expect(input.held('quick')).toBe(true);
    expect(input.anyPressed()).toBe(false);
    input.keyUp('KeyJ');
    input.update();
    expect(input.held('quick')).toBe(false);
  });

  it('a tap between two steps still registers once', () => {
    const { input } = setup(false);
    input.update();
    input.keyDown('Space');
    input.keyUp('Space');
    input.update();
    expect(input.pressed('confirm')).toBe(true);
    input.update();
    expect(input.held('confirm')).toBe(false);
  });

  it('alternate keys and digital move', () => {
    const { input } = setup(false);
    input.keyDown('ArrowLeft');
    input.keyDown('KeyS');
    input.update();
    expect(input.held('left')).toBe(true);
    expect(input.moveX()).toBe(-1);
    expect(input.moveY()).toBe(1);
    input.keyDown('KeyD');
    input.update();
    expect(input.moveX()).toBe(0);
  });

  it('blur clears keys', () => {
    const { input } = setup(false);
    input.keyDown('ShiftLeft');
    input.update();
    expect(input.held('defend')).toBe(true);
    input.clearKeys();
    input.update();
    expect(input.held('defend')).toBe(false);
  });
});

describe('gamepad', () => {
  it('button edges with a mocked pad, first non-null pad used', () => {
    const { input, pad } = setup();
    input.update();
    pad.buttons[2].pressed = true;
    input.update();
    expect(input.pressed('quick')).toBe(true);
    input.update();
    expect(input.pressed('quick')).toBe(false);
    expect(input.held('quick')).toBe(true);
    pad.buttons[2].pressed = false;
    input.update();
    expect(input.held('quick')).toBe(false);
  });

  it('confirm on A or Start, defend on B or RB', () => {
    const { input, pad } = setup();
    pad.buttons[9].pressed = true;
    pad.buttons[5].pressed = true;
    input.update();
    expect(input.pressed('confirm')).toBe(true);
    expect(input.pressed('defend')).toBe(true);
  });

  it('button 3 fires both heavy and shop', () => {
    const { input, pad } = setup();
    input.update();
    pad.buttons[3].pressed = true;
    input.update();
    expect(input.pressed('heavy')).toBe(true);
    expect(input.pressed('shop')).toBe(true);
  });

  it('stick deadzone and analogue moveX', () => {
    const { input, pad } = setup();
    pad.axes[0] = 0.2;
    input.update();
    expect(input.moveX()).toBe(0);
    expect(input.held('right')).toBe(false);
    pad.axes[0] = 0.4;
    input.update();
    expect(input.moveX()).toBeGreaterThan(0);
    expect(input.moveX()).toBeLessThan(0.5);
    expect(input.held('right')).toBe(false);
    pad.axes[0] = -0.8;
    pad.axes[1] = 1;
    input.update();
    expect(input.moveX()).toBeCloseTo(applyDeadzone(-0.8));
    expect(input.moveY()).toBe(1);
    expect(input.pressed('left')).toBe(true);
    expect(input.pressed('down')).toBe(true);
  });

  it('d-pad gives digital directions', () => {
    const { input, pad } = setup();
    pad.buttons[14].pressed = true;
    pad.buttons[12].pressed = true;
    input.update();
    expect(input.moveX()).toBe(-1);
    expect(input.moveY()).toBe(-1);
    expect(input.pressed('left')).toBe(true);
    expect(input.pressed('up')).toBe(true);
  });

  it('moveX clamps when stick and keys combine', () => {
    const { input, pad } = setup();
    pad.axes[0] = 1;
    input.keyDown('KeyD');
    input.update();
    expect(input.moveX()).toBe(1);
  });

  it('action held on both devices keeps one edge', () => {
    const { input, pad } = setup();
    input.update();
    input.keyDown('KeyJ');
    input.update();
    expect(input.pressed('quick')).toBe(true);
    pad.buttons[2].pressed = true;
    input.update();
    expect(input.pressed('quick')).toBe(false);
    input.keyUp('KeyJ');
    input.update();
    expect(input.held('quick')).toBe(true);
    expect(input.pressed('quick')).toBe(false);
  });

  it('no pad connected or getGamepads throwing is harmless', () => {
    const input = createInputCore({ getGamepads: () => { throw new Error('denied'); } });
    input.update();
    expect(input.moveX()).toBe(0);
    const { input: i2, setPads } = setup();
    setPads([null, null]);
    i2.update();
    expect(i2.held('confirm')).toBe(false);
  });

  it('reads getGamepads freshly every update (pad swapped at runtime)', () => {
    const { input, setPads } = setup(false);
    input.update();
    const pad = makePad();
    pad.buttons[0].pressed = true;
    setPads([pad]);
    input.update();
    expect(input.pressed('confirm')).toBe(true);
  });
});

describe('device switching', () => {
  it('switches both ways and glyphs follow', () => {
    const { input, pad } = setup();
    input.update();
    expect(input.device).toBe('keyboard');
    expect(input.glyph('quick')).toBe('J');
    expect(input.glyph('confirm')).toBe('SPACE');
    pad.buttons[0].pressed = true;
    input.update();
    expect(input.device).toBe('gamepad');
    expect(input.glyph('quick')).toBe('X');
    expect(input.glyph('confirm')).toBe('A');
    expect(input.glyph('defend')).toBe('B');
    expect(input.glyph('heavy')).toBe('Y');
    // Pad button still held: a keydown (even unmapped) wins and stays.
    input.keyDown('KeyQ');
    expect(input.device).toBe('keyboard');
    input.update();
    expect(input.device).toBe('keyboard');
    expect(input.glyph('left')).toBe('A');
  });

  it('stick beyond 0.5 switches to gamepad', () => {
    const { input, pad } = setup();
    input.update();
    pad.axes[1] = -0.7;
    input.update();
    expect(input.device).toBe('gamepad');
  });

  it('settings: Escape or Tab, and the pad Select button', () => {
    const { input, pad } = setup();
    input.keyDown('Escape');
    input.update();
    expect(input.pressed('settings')).toBe(true);
    input.keyUp('Escape');
    input.update();
    input.keyDown('Tab');
    input.update();
    expect(input.pressed('settings')).toBe(true);
    input.keyUp('Tab');
    input.update();
    pad.buttons[8].pressed = true;
    input.update();
    expect(input.pressed('settings')).toBe(true);
    expect(input.device).toBe('gamepad');
  });

  it('a diagonal stick tilt walks but does not jump or crouch', () => {
    const { input, pad } = setup();
    pad.axes[0] = 0.9;
    pad.axes[1] = 0.6;
    input.update();
    expect(input.held('right')).toBe(true);
    expect(input.held('down')).toBe(false);
    pad.axes[1] = -0.6;
    input.update();
    expect(input.held('up')).toBe(false);
    pad.axes[0] = 0.1;
    pad.axes[1] = 0.9;
    input.update();
    expect(input.held('down')).toBe(true);
  });

  it('stick drift does not flicker the device', () => {
    const { input, pad } = setup();
    input.keyDown('KeyA');
    for (let i = 0; i < 30; i++) {
      pad.axes[0] = i % 2 ? 0.1 : -0.1;
      pad.axes[1] = i % 3 ? 0.1 : 0;
      input.update();
      expect(input.device).toBe('keyboard');
      expect(input.moveX()).toBe(-1);
    }
  });
});

describe('autorepeat and composition', () => {
  it('repeat keydowns keep the key held with exactly one pressed edge', () => {
    const { input } = setup(false);
    let edges = 0;
    input.keyDown('KeyA', 'a');
    for (let i = 0; i < 10; i++) {
      input.update();
      if (input.pressed('left')) edges++;
      expect(input.held('left')).toBe(true);
      expect(input.moveX()).toBe(-1);
      input.keyDown('KeyA', 'a'); // autorepeat
    }
    expect(edges).toBe(1);
    input.keyUp('KeyA', 'a');
    input.update();
    expect(input.held('left')).toBe(false);
  });

  it('a repeat re-asserts the hold after a lost keyup', () => {
    const { input } = setup(false);
    input.keyDown('KeyA', 'a');
    input.update();
    input.keyUp('KeyA', 'a');
    input.keyDown('KeyA', 'a');
    input.update();
    expect(input.held('left')).toBe(true);
  });

  it('composition/dead/process keydowns still map by code', () => {
    const { input } = setup(false);
    expect(input.keyDown('KeyA', 'Process')).toEqual(['left']);
    expect(input.keyDown('KeyD', 'Dead')).toEqual(['right']);
    input.update();
    expect(input.held('left')).toBe(true);
    expect(input.held('right')).toBe(true);
    input.keyUp('KeyA', 'Process');
    input.update();
    expect(input.held('left')).toBe(false);
  });
});

describe('labelled-letter bindings', () => {
  it('AZERTY events move by label', () => {
    const { input } = setup(false);
    input.keyDown('KeyQ', 'a');
    input.keyDown('KeyZ', 'w');
    input.update();
    expect(input.held('left')).toBe(true);
    expect(input.held('up')).toBe(true);
    expect(input.moveX()).toBe(-1);
    expect(input.moveY()).toBe(-1);
  });

  it('US events are unchanged', () => {
    const { input } = setup(false);
    input.keyDown('KeyD', 'd');
    input.keyDown('KeyS', 's');
    input.keyDown('KeyE', 'e');
    input.update();
    expect(input.moveX()).toBe(1);
    expect(input.moveY()).toBe(1);
    expect(input.held('shop')).toBe(true);
    expect(input.held('left')).toBe(false);
  });

  it('action letters bind by label too', () => {
    const { input } = setup(false);
    input.keyDown('Semicolon', 'j');
    input.update();
    expect(input.pressed('quick')).toBe(true);
  });

  it('keyUp releases even when key differs from keyDown', () => {
    const { input } = setup(false);
    input.keyDown('KeyQ', 'a');
    input.update();
    input.keyUp('KeyQ', 'A');
    input.update();
    expect(input.held('left')).toBe(false);
    expect(input.moveX()).toBe(0);
  });

  it('code and key matching together count once', () => {
    const { input } = setup(false);
    expect(input.keyDown('KeyA', 'a')).toEqual(['left']);
    input.keyDown('KeyD', 'd');
    input.keyDown('ArrowRight', 'ArrowRight');
    input.update();
    expect(input.moveX()).toBe(0);
    input.keyUp('KeyD', 'd');
    input.update();
    expect(input.moveX()).toBe(0);
    input.keyUp('ArrowRight', 'ArrowRight');
    input.update();
    expect(input.moveX()).toBe(-1);
  });

  it('blur clears everything', () => {
    const { input } = setup(false);
    input.keyDown('KeyQ', 'a');
    input.keyDown('KeyZ', 'w');
    input.clearKeys();
    input.update();
    expect(input.held('left')).toBe(false);
    expect(input.moveX()).toBe(0);
    expect(input.moveY()).toBe(0);
    input.keyUp('KeyQ', 'a');
    input.update();
    expect(input.held('left')).toBe(false);
  });
});
