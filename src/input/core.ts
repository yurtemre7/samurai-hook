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
  /** Where custom key bindings are kept. Omit for in-memory only. */
  storage?: { getItem(k: string): string | null; setItem(k: string, v: string): void } | null;
}

export interface InputCore extends Input {
  /** Actions a key event would trigger right now, with the current bindings. */
  actionsFor(code: string, key?: string): Action[];
  /**
   * Feed a keydown: `code` is KeyboardEvent.code (physical position), `key` the optional
   * KeyboardEvent.key (the labelled character). Switches device to keyboard, mapped or not.
   * Returns the actions this event activated (empty if unmapped).
   */
  keyDown(code: string, key?: string): Action[];
  /** Releases whatever `code` activated on its keydown, whatever `key` says now. Returns those actions. */
  keyUp(code: string, key?: string): Action[];
  /** Release everything (window blur): keys and touch buttons, and the touch axis. */
  clearKeys(): void;
  /** On-screen button went down. Same held/edge/tap-latch semantics as a key; switches device to touch. */
  touchDown(action: Action): void;
  /** On-screen button released. */
  touchUp(action: Action): void;
  /** Analog drag, each -1..1 (clamped). Added to keys/stick in moveX/moveY. Non-zero switches device to touch. */
  setTouchAxis(x: number, y: number): void;
  /** A finger touched the play area (not a button): `tapped()` is true for exactly one step. */
  touchTap(): void;
  /** Finger travel in game px since the last call; summed and handed out once per step by `dragDX()`. */
  touchDrag(dx: number): void;
  /** Drag started or ended on the play area. */
  setDragging(on: boolean): void;
  /** Dash request from a quick swipe (-1 / 1) or the DASH button (direction held, else 0 = backward). */
  touchDash(dir: -1 | 0 | 1): void;
  /** Make touch the current device (the overlay calls this on start, so phone hints show before the first touch). */
  useTouch(): void;
  /** A left mouse click at (x, y) in game px; `clicked()` returns it for exactly one step (unless a prompt took it). */
  mouseClick(x: number, y: number): void;
}

export const ACTIONS: readonly Action[] = [
  'left', 'right', 'up', 'down', 'confirm', 'quick', 'heavy', 'defend', 'shop', 'settings',
];

/** Two keyboard keys per action: a primary and an optional alternate (null = none). */
export type KeySlots = [string, string | null];
export type Bindings = Record<Action, KeySlots>;

export const DEFAULT_BINDINGS: Readonly<Bindings> = {
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  confirm: ['Space', 'Enter'],
  // Mouse<button> codes come from mousedown/mouseup in input.ts: left click quick, right click heavy.
  quick: ['KeyJ', 'Mouse0'],
  heavy: ['KeyK', 'Mouse2'],
  defend: ['KeyL', 'ShiftLeft'],
  shop: ['KeyE', null],
  settings: ['Escape', 'Tab'],
};

export const BINDINGS_KEY = 'samurai-hook-keys-v1';

const cloneBindings = (b: Readonly<Bindings>): Bindings => {
  const out = {} as Bindings;
  for (const a of ACTIONS) out[a] = [b[a][0], b[a][1]];
  return out;
};

/** Keys that can never be bound: the browser's own, the demo shortcuts, modifiers. */
export function isReservedKey(code: string): boolean {
  if (!code || code === 'Unidentified' || code === 'Dead' || code === 'Process') return true;
  if (/^F\d{1,2}$/.test(code)) return true;
  if (/^(Control|Alt|Meta|OS)(Left|Right)?$/.test(code)) return true;
  return code === 'ContextMenu' || code === 'Backspace' || code === 'Delete' || code === 'CapsLock'
    || code === 'NumLock' || code === 'ScrollLock' || code === 'PrintScreen' || code === 'Pause';
}

/**
 * Merges stored bindings with the defaults, action by action. An invalid entry (reserved
 * key, no primary, a repeated key) falls back to its default; if the result still has a
 * key on two actions, the whole stored map is dropped for the defaults.
 */
export function sanitizeBindings(raw: unknown): Bindings {
  const out = cloneBindings(DEFAULT_BINDINGS);
  if (!raw || typeof raw !== 'object') return out;
  const src = raw as Record<string, unknown>;
  for (const a of ACTIONS) {
    const e = src[a];
    if (!Array.isArray(e)) continue;
    const p = e[0];
    const s = e[1] ?? null;
    if (typeof p !== 'string' || isReservedKey(p)) continue;
    if (s !== null && (typeof s !== 'string' || isReservedKey(s) || s === p)) continue;
    out[a] = [p, s];
  }
  const seen = new Set<string>();
  for (const a of ACTIONS) {
    for (const k of out[a]) {
      if (k === null) continue;
      if (seen.has(k)) return cloneBindings(DEFAULT_BINDINGS);
      seen.add(k);
    }
  }
  return out;
}

/** Labelled-letter bindings (KeyboardEvent.key, lower-cased), so non-QWERTY layouts work too.
 *  Used only while the keyboard bindings are the defaults. */
export const LABEL_MAP: Record<string, Action> = {
  w: 'up', a: 'left', s: 'down', d: 'right',
  j: 'quick', k: 'heavy', l: 'defend', e: 'shop',
};

/** Actions bound to a key event: by physical code, or (default bindings only) by labelled letter. */
export function actionsForKey(code: string, key?: string, bindings: Readonly<Bindings> = DEFAULT_BINDINGS, labels = true): Action[] {
  const out = new Set<Action>();
  for (const a of ACTIONS) if (bindings[a][0] === code || bindings[a][1] === code) out.add(a);
  const label = labels && typeof key === 'string' && key.length === 1 ? LABEL_MAP[key.toLowerCase()] : undefined;
  if (label) out.add(label);
  return [...out];
}

const ARROWS: Record<string, string> = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓' };
const NAMES: Record<string, string> = {
  Space: 'SPACE', Enter: 'ENTER', NumpadEnter: 'NUM ENTER', Escape: 'ESC', Tab: 'TAB',
  ShiftLeft: 'L SHIFT', ShiftRight: 'R SHIFT', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[',
  BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\',
  Mouse0: 'LEFT CLICK', Mouse1: 'MID CLICK', Mouse2: 'RIGHT CLICK', Mouse3: 'MOUSE 4', Mouse4: 'MOUSE 5',
  Insert: 'INS', Home: 'HOME', End: 'END', PageUp: 'PG UP', PageDown: 'PG DN',
};

/** A short, readable name for a KeyboardEvent.code, e.g. "KeyJ" -> "J". Empty slot -> "-". */
export function keyName(code: string | null | undefined): string {
  if (!code) return '-';
  if (ARROWS[code]) return ARROWS[code];
  if (NAMES[code]) return NAMES[code];
  const m = /^(?:Key|Digit)(.)$/.exec(code);
  if (m) return m[1];
  const n = /^Numpad(.+)$/.exec(code);
  if (n) return `NUM ${n[1].replace('Multiply', '*').replace('Add', '+').replace('Subtract', '-').replace('Divide', '/').replace('Decimal', '.')}`;
  return code.toUpperCase();
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
  settings: [8], // Back / Select
};

export const PAD_GLYPH: Record<Action, string> = {
  left: '←', right: '→', up: '↑', down: '↓',
  confirm: 'A', quick: 'X', heavy: 'Y', defend: 'B', shop: 'Y', settings: 'SEL',
};

/** On-screen button symbols for the touch device (the overlay labels itself with words). */
export const TOUCH_GLYPH: Record<Action, string> = {
  left: '◀', right: '▶', up: '▲', down: '▼',
  confirm: 'OK', quick: 'QUICK', heavy: 'HEAVY', defend: 'BLOCK', shop: 'SHOP', settings: 'MENU',
};

/** Below this the stick reads as 0 for moveX/moveY. */
export const STICK_DEADZONE = 0.25;
/** Stick past this counts as a digital direction and switches the device. */
export const STICK_DIGITAL = 0.5;
/**
 * Stick up/down also needs |y| >= this x |x|: about 56 deg or steeper from horizontal, roughly
 * midway between a 4-way (45) and an 8-way (67.5) split. Up and down jump and crouch in the
 * fight, so a stick walking a little off horizontal (even a full 45 deg diagonal) must not fire them.
 */
export const STICK_VERTICAL_RATIO = 1.5;
/**
 * Once up/down is on, it stays on down to |y| >= this x |x| (about 50 deg). Without the band a
 * thumb resting near the onset would toggle every step, and each toggle is a fresh pressed('up') jump.
 * Still above 1, so a 45 deg diagonal never holds up/down either.
 */
export const STICK_VERTICAL_HOLD_RATIO = 1.2;

const clamp1 = (v: number) => (v < -1 ? -1 : v > 1 ? 1 : v);

/**
 * Digital vertical direction of the stick: -1 up, 1 down, 0 neither. `prev` is the previous
 * step's result, for the hysteresis. The magnitude test is the same as left/right's.
 */
export function stickVertical(ax: number, ay: number, prev: -1 | 0 | 1 = 0): -1 | 0 | 1 {
  const ny = Math.abs(ay);
  if (!(ny >= STICK_DIGITAL)) return 0; // also catches NaN
  const dir = ay < 0 ? -1 : 1;
  const ratio = dir === prev ? STICK_VERTICAL_HOLD_RATIO : STICK_VERTICAL_RATIO;
  return ny >= ratio * Math.abs(ax) ? dir : 0;
}

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
  let stickVert: -1 | 0 | 1 = 0;
  let stickX = 0;
  let stickY = 0;
  let digX = 0;
  let digY = 0;
  let device: Device = 'keyboard';
  /** On-screen buttons currently held, plus the same tap latch as keys. */
  const touchHeld = new Set<Action>();
  const touchTapped = new Set<Action>();
  let touchX = 0;
  let touchY = 0;
  let tapLatch = false;
  let tapNow = false;
  let dragAcc = 0;
  let dragStep = 0;
  let dragOn = false;
  let dashLatch: -1 | 0 | 1 | null = null;
  let dashNow: -1 | 0 | 1 | null = null;
  let clickLatch: { x: number; y: number } | null = null;
  let clickNow: { x: number; y: number } | null = null;
  /** Prompt-bar items drawn last frame; a click on one presses its action instead of being a click. */
  let promptHits: { x0: number; x1: number; y0: number; y1: number; action: Action }[] = [];

  // ---- key bindings ----
  let bind: Bindings = (() => {
    try {
      const raw = deps.storage?.getItem(BINDINGS_KEY);
      if (raw) return sanitizeBindings(JSON.parse(raw));
    } catch { /* corrupt: defaults */ }
    return cloneBindings(DEFAULT_BINDINGS);
  })();
  /** True once the player changed anything: the labelled-letter fallback then switches off. */
  let custom = false;
  const recomputeCustom = () => {
    custom = ACTIONS.some((a) => bind[a][0] !== DEFAULT_BINDINGS[a][0] || bind[a][1] !== DEFAULT_BINDINGS[a][1]);
  };
  recomputeCustom();
  const saveBindings = () => {
    recomputeCustom();
    try { deps.storage?.setItem(BINDINGS_KEY, JSON.stringify(bind)); } catch { /* ignore */ }
  };
  let captureCb: ((code: string) => void) | null = null;
  /** Keys taken by a capture: ignored until released, so autorepeat cannot fire the new binding. */
  const swallowed = new Set<string>();

  const keyActive = (a: Action) => {
    if (keysTapped.has(a) || touchTapped.has(a) || touchHeld.has(a)) return true;
    for (const acts of keysDown.values()) if (acts.includes(a)) return true;
    return false;
  };

  const core: InputCore = {
    actionsFor: (code, key) => actionsForKey(code, key, bind, !custom),
    get capturing() { return captureCb !== null; },
    startCapture(onKey) {
      captureCb = onKey;
      // Keys already held (the one that opened the capture) must not be captured by their autorepeat.
      for (const c of keysDown.keys()) swallowed.add(c);
    },
    cancelCapture() { captureCb = null; },
    binding: (a, slot) => bind[a][slot],
    keyName,
    rebind(a, slot, code) {
      if (isReservedKey(code)) return 'reserved';
      const cur = bind[a][slot];
      if (cur === code) return 'ok';
      let owner: [Action, 0 | 1] | null = null;
      for (const b of ACTIONS) for (const s of [0, 1] as const) if (bind[b][s] === code) owner = [b, s];
      if (owner) {
        const [b, s] = owner;
        // Swap: the other action takes our old key. With nothing to hand over, it may only lose an alternate.
        if (cur === null && s === 0) return 'refused';
        (bind[b] as (string | null)[])[s] = cur; // a null only ever lands in an alternate slot (checked above)
      }
      bind[a][slot] = code;
      saveBindings();
      return owner ? 'swapped' : 'ok';
    },
    clearBinding(a) {
      if (bind[a][1] === null) return false;
      bind[a][1] = null;
      saveBindings();
      return true;
    },
    resetBindings() {
      bind = cloneBindings(DEFAULT_BINDINGS);
      saveBindings();
    },
    keyDown(code, key) {
      device = 'keyboard';
      if (swallowed.has(code)) return [];
      if (captureCb) {
        const cb = captureCb;
        captureCb = null;
        swallowed.add(code);
        cb(code);
        return [];
      }
      const acts = actionsForKey(code, key, bind, !custom);
      // Autorepeat (code already held) only re-asserts the hold; it must not latch a fresh tap,
      // or a release right after would linger for one step.
      const repeat = keysDown.has(code);
      keysDown.set(code, acts);
      if (!repeat) for (const a of acts) keysTapped.add(a);
      return acts;
    },
    keyUp(code) {
      swallowed.delete(code);
      const acts = keysDown.get(code) ?? [];
      keysDown.delete(code);
      return acts;
    },
    clearKeys() {
      keysDown.clear();
      keysTapped.clear();
      swallowed.clear();
      touchHeld.clear();
      touchTapped.clear();
      touchX = 0;
      touchY = 0;
      tapLatch = false;
      dragAcc = 0;
      dragOn = false;
      dashLatch = null;
      clickLatch = null;
    },
    touchDash(dir) {
      device = 'touch';
      dashLatch = dir;
    },
    touchTap() {
      device = 'touch';
      tapLatch = true;
    },
    touchDrag(dx) {
      if (Number.isFinite(dx)) dragAcc += dx;
    },
    setDragging(on) {
      dragOn = on;
      if (on) device = 'touch';
    },
    useTouch() {
      device = 'touch';
    },
    mouseClick(x, y) {
      if (Number.isFinite(x) && Number.isFinite(y)) clickLatch = { x, y };
    },
    press(a) {
      keysTapped.add(a); // one step, like a key tap; the device does not change
    },
    setPromptHits(hits) {
      promptHits = hits;
    },
    touchDown(a) {
      device = 'touch';
      if (!touchHeld.has(a)) touchTapped.add(a);
      touchHeld.add(a);
    },
    touchUp(a) {
      touchHeld.delete(a);
    },
    setTouchAxis(x, y) {
      touchX = clamp1(Number.isFinite(x) ? x : 0);
      touchY = clamp1(Number.isFinite(y) ? y : 0);
      if (touchX !== 0 || touchY !== 0) device = 'touch';
    },

    update() {
      prev = now;
      now = new Set<Action>();

      // A click on a prompt-bar item works like its key; any other click is handed to the scene.
      clickNow = null;
      if (clickLatch) {
        const c = clickLatch;
        const hit = promptHits.find((h) => c.x >= h.x0 && c.x <= h.x1 && c.y >= h.y0 && c.y <= h.y1);
        if (hit) keysTapped.add(hit.action);
        else clickNow = c;
        clickLatch = null;
      }
      promptHits = []; // redrawn every frame; stale ones from another scene must not linger

      for (const a of ACTIONS) {
        if (keyActive(a)) now.add(a);
      }
      keysTapped.clear();
      touchTapped.clear();
      tapNow = tapLatch;
      tapLatch = false;
      dragStep = dragAcc;
      dragAcc = 0;
      dashNow = dashLatch;
      dashLatch = null;

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
      }
      // Up/down only for a clearly vertical tilt, with a hold band (see stickVertical), so a
      // diagonal walk or a thumb resting near the edge does not jump or crouch in the fight.
      // ax = ay = 0 without a pad, which also resets the hysteresis.
      stickVert = stickVertical(ax, ay, stickVert);
      if (stickVert < 0) now.add('up');
      if (stickVert > 0) now.add('down');

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
    dragging: () => dragOn,
    dragDX: () => dragStep,
    tapped: () => tapNow,
    clicked: () => clickNow,
    dashDir: () => dashNow,
    moveX: () => clamp1(digX + stickX + touchX),
    moveY: () => clamp1(digY + stickY + touchY),
    anyPressed: () => {
      for (const a of now) if (!prev.has(a)) return true;
      return false;
    },
    get device() {
      return device;
    },
    glyph: (a) => (device === 'gamepad' ? PAD_GLYPH[a] : device === 'touch' ? TOUCH_GLYPH[a] : keyName(bind[a][0])),
  };
  return core;
}
