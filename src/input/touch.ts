// Touch controls for mobile browsers: a DOM overlay (not drawn on the canvas) that feeds the
// pure input core. Left thumb: 4-way pad. Right thumb: QUICK / HEAVY / BLOCK / CONFIRM. SHOP top right.
// Dragging a finger anywhere that is not a button: in the ocean the hook follows the finger 1:1
// (dragDX), elsewhere it is a small floating stick (walk in fights; up/down brake/sink while fishing).
// Touching the play area is its own signal (`tapped()`), NOT confirm: only the idle ocean uses it, to
// cast. Confirm also jumps and reels in, so a stray tap must never become confirm.
// Buttons follow the scene (`setScene`): fights show QUICK / HEAVY / BLOCK / DASH and no CONFIRM or SHOP;
// fishing shows REEL IN and SHOP; the shop shows BUY and BACK; cutscene and result show OK.
// A quick swipe on the play area: left/right dashes, up jumps (presses `up` once), down crouches
// (holds `down` until the finger lifts). Only fights act on dash/jump/crouch.
// Landscape only: in portrait a full-screen message covers everything and `blocked()` pauses the game loop.
import type { Action } from '../types';
import type { InputCore } from './core';

/** Dead zone and full-deflection distance of the drag, in CSS px. */
export const DRAG_DEADZONE_PX = 8;
export const DRAG_FULL_PX = 30;

/** Overlay on when the primary pointer is coarse (a phone) or `?touch=1` forces it on desktop. */
export function touchEnabled(search: string, coarse: boolean): boolean {
  return coarse || new URLSearchParams(search).get('touch') === '1';
}

/** Relative drag (floating joystick): pixel offset from touch-down -> axis -1..1, circular dead zone, clamped. */
export function dragToAxis(
  dx: number,
  dy: number,
  deadzone = DRAG_DEADZONE_PX,
  full = DRAG_FULL_PX,
): { x: number; y: number } {
  const len = Math.hypot(dx, dy);
  if (!(len > deadzone)) return { x: 0, y: 0 }; // also catches NaN
  const k = Math.min(1, (len - deadzone) / (full - deadzone)) / len;
  return { x: dx * k, y: dy * k };
}

export type PadDir = 'up' | 'left' | 'right' | 'down';

/**
 * Which pad directions a point hits, from its offset to the pad centre and the pad's half-size.
 * Diagonals give two directions (e.g. jump forward). The middle is dead; far outside the pad is nothing.
 */
export function padDirections(dx: number, dy: number, half: number): PadDir[] {
  if (!(half > 0) || !(Math.abs(dx) <= half * 1.7) || !(Math.abs(dy) <= half * 1.7)) return [];
  const t = half * 0.3;
  const out: PadDir[] = [];
  if (dy <= -t) out.push('up');
  else if (dy >= t) out.push('down');
  if (dx <= -t) out.push('left');
  else if (dx >= t) out.push('right');
  return out;
}

/** A swipe this fast counts: at least SWIPE_PX of travel within SWIPE_MS, along its main axis. */
export const SWIPE_PX = 40;
export const SWIPE_MS = 180;

export type Swipe = 'left' | 'right' | 'up' | 'down';

/** Quick swipe -> its direction (the larger axis wins), else null. Pure, for tests. */
export function swipeDir(dx: number, dy: number, ms: number): Swipe | null {
  if (!(ms <= SWIPE_MS)) return null;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax > ay && ax >= SWIPE_PX) return dx < 0 ? 'left' : 'right';
  if (ay > ax && ay >= SWIPE_PX) return dy < 0 ? 'up' : 'down';
  return null;
}

/** Which buttons each scene shows. */
export type TouchScene = 'ocean' | 'cutscene' | 'fight' | 'result' | 'shop';
const SCENE_BUTTONS: Record<TouchScene, { show: string[]; confirm?: string; shop?: string }> = {
  ocean: { show: ['confirm', 'shop'], confirm: 'REEL IN', shop: 'SHOP' },
  fight: { show: ['quick', 'heavy', 'defend', 'dash'] },
  shop: { show: ['confirm', 'shop'], confirm: 'BUY', shop: 'BACK' },
  cutscene: { show: ['confirm'], confirm: 'OK' },
  result: { show: ['confirm'], confirm: 'OK' },
};
export const sceneButtons = (s: TouchScene) => SCENE_BUTTONS[s].show;

export interface TouchControls {
  /** True while the screen is in portrait: the game loop must not advance. */
  blocked(): boolean;
  /** Show the buttons that make sense for this scene (and release anything held). */
  setScene(s: TouchScene): void;
}

const CSS = `
.sh-touch{position:fixed;inset:0;z-index:5;pointer-events:none;font:700 13px system-ui,-apple-system,sans-serif;
  -webkit-user-select:none;user-select:none;-webkit-touch-callout:none;touch-action:none;
  --u:clamp(56px,14vh,68px)}
.sh-btn,.sh-pad{pointer-events:auto;touch-action:none;-webkit-tap-highlight-color:transparent}
.sh-pad{position:absolute;left:calc(env(safe-area-inset-left) + 14px);bottom:calc(env(safe-area-inset-bottom) + 12px);
  width:calc(var(--u)*3);height:calc(var(--u)*3);display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr)}
.sh-cell{display:flex;align-items:center;justify-content:center;margin:3px;border-radius:14px;font-size:22px;color:#fff;
  background:rgba(12,16,28,.5);border:2px solid rgba(255,255,255,.6);pointer-events:none}
.sh-cell.on,.sh-btn.on{background:rgba(255,255,255,.78);color:#0b1020}
.sh-cell.empty{visibility:hidden}
.sh-cluster{position:absolute;right:calc(env(safe-area-inset-right) + 14px);bottom:calc(env(safe-area-inset-bottom) + 12px);
  display:grid;grid-template-columns:repeat(2,var(--u));grid-auto-rows:var(--u);gap:8px;align-content:end}
.sh-btn.hide{display:none}
.sh-btn{display:flex;align-items:center;justify-content:center;border-radius:50%;color:#fff;letter-spacing:.03em;
  background:rgba(12,16,28,.5);border:2px solid rgba(255,255,255,.6)}
.sh-btn.confirm{border-color:#f0c419}
.sh-btn.shop{position:absolute;top:calc(env(safe-area-inset-top) + 10px);right:calc(env(safe-area-inset-right) + 14px);
  width:72px;height:48px;border-radius:12px}
.sh-ring{position:absolute;width:160px;height:160px;margin:-80px 0 0 -80px;border-radius:50%;display:none;
  border:2px solid rgba(255,255,255,.28);background:rgba(255,255,255,.05);pointer-events:none}
.sh-portrait{position:fixed;inset:0;z-index:10;display:none;flex-direction:column;align-items:center;justify-content:center;gap:20px;
  background:#0b1020;color:#f4f1ea;font:600 20px system-ui,-apple-system,sans-serif;text-align:center;padding:24px;touch-action:none}
@media (orientation:portrait){.sh-portrait{display:flex}}
`;

const ICON = `<svg width="96" height="96" viewBox="0 0 96 96" fill="none" stroke="#f4f1ea" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
<rect x="34" y="14" width="28" height="48" rx="5"/><path d="M34 52h28"/>
<path d="M16 70a36 36 0 0 0 64 8"/><path d="M80 78l-2-12M80 78l-12-1"/></svg>`;

export function createTouchControls(input: InputCore, doc: Document = document): TouchControls {
  const win = doc.defaultView ?? window;
  const style = doc.createElement('style');
  style.textContent = CSS;
  doc.head.appendChild(style);

  const root = doc.createElement('div');
  root.className = 'sh-touch';
  const ring = doc.createElement('div');
  ring.className = 'sh-ring';
  root.appendChild(ring);

  const mk = (cls: string, text = '') => {
    const e = doc.createElement('div');
    e.className = cls;
    if (text) e.textContent = text;
    return e;
  };

  // ---- Pad ----
  const pad = mk('sh-pad');
  pad.setAttribute('aria-label', 'Direction pad');
  const cells: Partial<Record<PadDir, HTMLElement>> = {};
  const layout: (PadDir | null)[] = [null, 'up', null, 'left', null, 'right', null, 'down', null];
  for (const d of layout) {
    const sym = d === 'up' ? '▲' : d === 'down' ? '▼' : d === 'left' ? '◀' : d === 'right' ? '▶' : '';
    const c = mk(d ? 'sh-cell' : 'sh-cell empty', sym);
    if (d) cells[d] = c;
    pad.appendChild(c);
  }
  let padPointer: number | null = null;
  const padHeld = new Set<PadDir>();
  const setPad = (dirs: PadDir[]) => {
    for (const d of [...padHeld]) {
      if (!dirs.includes(d)) { padHeld.delete(d); input.touchUp(d); cells[d]?.classList.remove('on'); }
    }
    for (const d of dirs) {
      if (!padHeld.has(d)) { padHeld.add(d); input.touchDown(d); cells[d]?.classList.add('on'); }
    }
  };
  const padHit = (e: PointerEvent) => {
    const r = pad.getBoundingClientRect();
    return padDirections(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2), r.width / 2);
  };
  pad.addEventListener('pointerdown', (e) => {
    if (padPointer !== null) return;
    padPointer = e.pointerId;
    try { pad.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
    setPad(padHit(e));
  });
  pad.addEventListener('pointermove', (e) => {
    if (e.pointerId === padPointer) setPad(padHit(e));
  });
  const padEnd = (e: PointerEvent) => {
    if (e.pointerId !== padPointer) return;
    padPointer = null;
    setPad([]);
  };
  pad.addEventListener('pointerup', padEnd);
  pad.addEventListener('pointercancel', padEnd);
  pad.addEventListener('lostpointercapture', padEnd);
  root.appendChild(pad);

  // ---- Buttons ----
  const cluster = mk('sh-cluster');
  const btnHeld = new Map<number, { action: Action; el: HTMLElement }>();
  const buttons: Record<string, HTMLElement> = {};
  const button = (action: Action, label: string, cls = '') => {
    const el = mk(`sh-btn ${cls}`.trim(), label);
    el.setAttribute('aria-label', label);
    buttons[action] = el;
    el.addEventListener('pointerdown', (e) => {
      try { el.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
      if (btnHeld.has(e.pointerId)) return;
      btnHeld.set(e.pointerId, { action, el });
      el.classList.add('on');
      input.touchDown(action);
    });
    const end = (e: PointerEvent) => {
      const h = btnHeld.get(e.pointerId);
      if (!h || h.el !== el) return;
      btnHeld.delete(e.pointerId);
      el.classList.remove('on');
      input.touchUp(action);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('lostpointercapture', end);
    return el;
  };
  // DASH: dashes the way the pad or drag points; with no direction held, away from the fish.
  const dashBtn = mk('sh-btn', 'DASH');
  dashBtn.setAttribute('aria-label', 'DASH');
  buttons.dash = dashBtn;
  dashBtn.addEventListener('pointerdown', () => {
    const held: -1 | 0 | 1 = padHeld.has('left') ? -1 : padHeld.has('right') ? 1 : 0;
    const axis = input.moveX();
    input.touchDash(held !== 0 ? held : Math.abs(axis) > 0.3 ? (axis < 0 ? -1 : 1) : 0);
    dashBtn.classList.add('on');
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave'] as const) {
    dashBtn.addEventListener(ev, () => dashBtn.classList.remove('on'));
  }
  cluster.append(
    button('defend', 'BLOCK'),
    dashBtn,
    button('quick', 'QUICK'),
    button('heavy', 'HEAVY'),
    button('confirm', 'CONFIRM', 'confirm'),
  );
  root.appendChild(cluster);
  root.appendChild(button('shop', 'SHOP', 'shop'));

  // ---- Landscape only ----
  const mq = win.matchMedia('(orientation: portrait)');
  const blocked = () => mq.matches;

  const portrait = mk('sh-portrait');
  portrait.innerHTML = `${ICON}<div>Turn your phone sideways to play</div>`;
  doc.body.append(root, portrait);

  // ---- Drag steering (anywhere that is not a button) ----
  let dragId: number | null = null;
  let ox = 0;
  let oy = 0;
  let lastX = 0;
  let downAt = 0;
  let swiped = false;
  let crouching = false;
  const canvas = doc.getElementById('game');
  /** CSS px -> game px (the canvas is 960 game px wide, scaled to fit). */
  const toGame = () => {
    const w = canvas?.getBoundingClientRect().width ?? 0;
    return w > 0 ? 960 / w : 1;
  };
  const onGlass = (t: EventTarget | null) =>
    t instanceof Element && !!t.closest('.sh-btn, .sh-pad, .sh-portrait');
  doc.addEventListener('pointerdown', (e) => {
    if (dragId !== null || blocked() || onGlass(e.target)) return;
    dragId = e.pointerId;
    ox = e.clientX;
    oy = e.clientY;
    lastX = e.clientX;
    downAt = e.timeStamp || win.performance.now();
    swiped = false;
    input.touchTap();
    input.setDragging(true);
    ring.style.left = `${ox}px`;
    ring.style.top = `${oy}px`;
    ring.style.display = 'block';
  });
  doc.addEventListener('pointermove', (e) => {
    if (e.pointerId !== dragId) return;
    input.touchDrag((e.clientX - lastX) * toGame());
    lastX = e.clientX;
    if (!swiped) {
      const d = swipeDir(e.clientX - ox, e.clientY - oy, (e.timeStamp || win.performance.now()) - downAt);
      if (d !== null) {
        swiped = true;
        if (d === 'left' || d === 'right') input.touchDash(d === 'left' ? -1 : 1);
        else if (d === 'up') { input.touchDown('up'); input.touchUp('up'); } // one press: jump
        else { crouching = true; input.touchDown('down'); }                   // held until the finger lifts
      }
    }
    const a = dragToAxis(e.clientX - ox, e.clientY - oy);
    input.setTouchAxis(a.x, a.y);
  });
  const dragEnd = (e: PointerEvent) => {
    if (e.pointerId !== dragId) return;
    dragId = null;
    ring.style.display = 'none';
    input.setTouchAxis(0, 0);
    input.setDragging(false);
    if (crouching) { crouching = false; input.touchUp('down'); }
  };
  doc.addEventListener('pointerup', dragEnd);
  doc.addEventListener('pointercancel', dragEnd);

  // ---- Release everything (blur, tab hidden, rotation) ----
  const releaseAll = () => {
    padPointer = null;
    setPad([]);
    for (const h of btnHeld.values()) h.el.classList.remove('on');
    btnHeld.clear();
    dragId = null;
    crouching = false;
    ring.style.display = 'none';
    input.clearKeys(); // touch buttons and axis in the core as well
  };
  win.addEventListener('blur', releaseAll);
  doc.addEventListener('visibilitychange', releaseAll);
  mq.addEventListener('change', releaseAll);

  input.useTouch(); // phone hints from the first frame, before any touch
  for (const el of [root, portrait, canvas]) {
    el?.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  const setScene = (s: TouchScene) => {
    const cfg = SCENE_BUTTONS[s] ?? SCENE_BUTTONS.ocean;
    for (const [a, el] of Object.entries(buttons)) el.classList.toggle('hide', !cfg.show.includes(a));
    if (cfg.confirm) buttons.confirm.textContent = cfg.confirm;
    if (cfg.shop) buttons.shop.textContent = cfg.shop;
    releaseAll();
  };
  setScene('ocean');

  return { blocked, setScene };
}
