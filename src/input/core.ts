// Pure input core: action mapping, edge detection, device tracking.
// No DOM access, so it runs under vitest in node. `input.ts` wires it to window events.
import type { Action, Device, Input } from '../types';

/** The subset of the browser Gamepad the core reads. */
export interface GamepadButtonLike { pressed: boolean; value?: number }
export interface GamepadLike {
  connected?: boolean;
  axes: readonly number[];
  buttons: readonly GamepadButtonLike[];
}

export interface InputCoreDeps {
  /** Called freshly inside every update(); never cached. */
  getGamepads: () => readonly (GamepadLike | null | undefined)[] | null | undefined;
}

export interface InputCore extends Input {
  /**
   * Feed a keydown: `code` is KeyboardEvent.code (physical position), `key` the optional
   * KeyboardEvent.key (the labelled character). Switches device to keyboard, mapped or not.
   * Returns the actions this event activated (empty if unmapped).
   */
  keyDown(code: string, key?: string): Action[];
  /** Releases whatever `code` activated on its keydown, whatever `key` says now. Returns those actions. */
  keyUp(code: string, key?: string): Action[];
  /** Release everything (window blur). */
  clearKeys(): void;
}

export const ACTIONS: readonly Action[] = [
  'left', 'right', 'up', 'down', 'confirm', 'quick', 'heavy', 'defend', 'shop',
];

export const KEY_MAP: Record<Action, readonly string[]> = {
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  confirm: ['Space', 'Enter', 'NumpadEnter'],
  quick: ['KeyJ'],
  heavy: ['KeyK'],
  defend: ['KeyL', 'ShiftLeft', 'ShiftRight'],
  shop: ['KeyE'],
};

/** Labelled-letter bindings (KeyboardEvent.key, lower-cased), so non-QWERTY layouts work too. */
export const LABEL_MAP: Record<string, Action> = {
  w: 'up', a: 'left', s: 'down', d: 'right',
  j: 'quick', k: 'heavy', l: 'defend', e: 'shop',
};

/** Actions bound to a key event: by physical code, or by labelled letter. Deduplicated. */
export function actionsForKey(code: string, key?: string): Action[] {
  const out = new Set<Action>();
  for (const a of ACTIONS) if (KEY_MAP[a].includes(code)) out.add(a);
  const label = typeof key === 'string' && key.length === 1 ? LABEL_MAP[key.toLowerCase()] : undefined;
  if (label) out.add(label);
  return [...out];
}

/** Standard-mapping button indices. Directions also come from the left stick. */
export const PAD_MAP: Record<Action, readonly number[]> = {
  left: [14],
  right: [15],
  up: [12],
  down: [13],
  confirm: [0, 9],
  quick: [2],
  heavy: [3],
  defend: [1, 5],
  shop: [3],
};

export const KEY_GLYPH: Record<Action, string> = {
  left: 'A', right: 'D', up: 'W', down: 'S',
  confirm: 'SPACE', quick: 'J', heavy: 'K', defend: 'L', shop: 'E',
};

export const PAD_GLYPH: Record<Action, string> = {
  left: '←', right: '→', up: '↑', down: '↓',
  confirm: 'A', quick: 'X', heavy: 'Y', defend: 'B', shop: 'Y',
};

/** Below this the stick reads as 0 for moveX/moveY. */
export const STICK_DEADZONE = 0.25;
/** Stick past this counts as a digital direction and switches the device. */
export const STICK_DIGITAL = 0.5;

const clamp1 = (v: number) => (v < -1 ? -1 : v > 1 ? 1 : v);

/** Deadzone with rescale, so output starts at 0 just past the deadzone and reaches 1 at full tilt. */
export function applyDeadzone(v: number, dz = STICK_DEADZONE): number {
  const a = Math.abs(v);
  if (!(a > dz)) return 0; // also catches NaN
  return Math.sign(v) * Math.min(1, (a - dz) / (1 - dz));
}

function firstPad(getGamepads: InputCoreDeps['getGamepads']): GamepadLike | null {
  let list: ReturnType<InputCoreDeps['getGamepads']>;
  try {
    list = getGamepads();
  } catch {
    return null;
  }
  if (!list) return null;
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    if (p && p.connected !== false) return p;
  }
  return null;
}

export function createInputCore(deps: InputCoreDeps): InputCore {
  /** Held physical keys (by code) -> the actions each activated on keydown. */
  const keysDown = new Map<string, Action[]>();
  /** Actions that went down since the last update; latched so a tap between steps still registers. */
  const keysTapped = new Set<Action>();
  let now = new Set<Action>();
  let prev = new Set<Action>();
  let prevButtons: boolean[] = [];
  let prevStickBeyond = false;
  let stickX = 0;
  let stickY = 0;
  let digX = 0;
  let digY = 0;
  let device: Device = 'keyboard';

  const keyActive = (a: Action) => {
    if (keysTapped.has(a)) return true;
    for (const acts of keysDown.values()) if (acts.includes(a)) return true;
    return false;
  };

  const core: InputCore = {
    keyDown(code, key) {
      device = 'keyboard';
      const acts = actionsForKey(code, key);
      // Autorepeat (code already held) only re-asserts the hold; it must not latch a fresh tap,
      // or a release right after would linger for one step.
      const repeat = keysDown.has(code);
      keysDown.set(code, acts);
      if (!repeat) for (const a of acts) keysTapped.add(a);
      return acts;
    },
    keyUp(code) {
      const acts = keysDown.get(code) ?? [];
      keysDown.delete(code);
      return acts;
    },
    clearKeys() {
      keysDown.clear();
      keysTapped.clear();
    },

    update() {
      prev = now;
      now = new Set<Action>();

      for (const a of ACTIONS) {
        if (keyActive(a)) now.add(a);
      }
      keysTapped.clear();

      const pad = firstPad(deps.getGamepads);
      const buttons: boolean[] = [];
      let ax = 0;
      let ay = 0;
      if (pad) {
        for (let i = 0; i < pad.buttons.length; i++) buttons.push(!!pad.buttons[i]?.pressed);
        ax = Number(pad.axes[0]) || 0;
        ay = Number(pad.axes[1]) || 0;
        for (const a of ACTIONS) {
          if (PAD_MAP[a].some((b) => buttons[b])) now.add(a);
        }
        if (ax <= -STICK_DIGITAL) now.add('left');
        if (ax >= STICK_DIGITAL) now.add('right');
        if (ay <= -STICK_DIGITAL) now.add('up');
        if (ay >= STICK_DIGITAL) now.add('down');
      }

      // Device switch to gamepad only on a new button press or the stick newly crossing 0.5.
      // Level-triggering would fight a keyboard press while a pad button is merely held.
      const newButton = buttons.some((b, i) => b && !prevButtons[i]);
      const stickBeyond = Math.abs(ax) > STICK_DIGITAL || Math.abs(ay) > STICK_DIGITAL;
      if (newButton || (stickBeyond && !prevStickBeyond)) device = 'gamepad';
      prevButtons = buttons;
      prevStickBeyond = stickBeyond;

      stickX = applyDeadzone(ax);
      stickY = applyDeadzone(ay);
      const keyX = (keyActive('right') ? 1 : 0) - (keyActive('left') ? 1 : 0);
      const keyY = (keyActive('down') ? 1 : 0) - (keyActive('up') ? 1 : 0);
      const padX = (buttons[15] ? 1 : 0) - (buttons[14] ? 1 : 0);
      const padY = (buttons[13] ? 1 : 0) - (buttons[12] ? 1 : 0);
      digX = clamp1(keyX + padX);
      digY = clamp1(keyY + padY);
    },

    held: (a) => now.has(a),
    pressed: (a) => now.has(a) && !prev.has(a),
    moveX: () => clamp1(digX + stickX),
    moveY: () => clamp1(digY + stickY),
    anyPressed: () => {
      for (const a of now) if (!prev.has(a)) return true;
      return false;
    },
    get device() {
      return device;
    },
    glyph: (a) => (device === 'gamepad' ? PAD_GLYPH[a] : KEY_GLYPH[a]),
  };
  return core;
}
