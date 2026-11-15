// Settings panel shared by the ocean surface and the shop. Main page: music
// volume, sound effects volume, hard mode. Keybinds page: every action has a
// primary and an alternate keyboard key the player can change. A small tab sits
// in a free corner; the settings action (Esc / Tab by default, pad Select) opens
// the panel. While it is open the scene must not handle input: `update()`
// returns true when it is open (or was just closed this step).
import type { Action, Game } from '../types';
import { drawOutlinedText } from './hud';

const STEP = 0.1;
const TAB = { w: 92, h: 26 };
const MAIN = { w: 330, h: 206 };
const KEYS = { w: 430, h: 332 };
const MAIN_ROWS = ['MUSIC', 'SOUND FX', 'HARD MODE', 'KEYBINDS'] as const;
const HARD_NOTE = 'EEL, FUGU AND SQUID FIGHT BACK';
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Every rebindable action, in the order shown, with what it does across the scenes. */
const KEY_ROWS: { action: Action; label: string }[] = [
  { action: 'left', label: 'MOVE LEFT' },
  { action: 'right', label: 'MOVE RIGHT' },
  { action: 'up', label: 'UP / JUMP / REEL IN' },
  { action: 'down', label: 'DOWN / DUCK / DROP HOOK' },
  { action: 'confirm', label: 'CONFIRM / JUMP / DROP HOOK' },
  { action: 'quick', label: 'QUICK SLASH' },
  { action: 'heavy', label: 'HEAVY SLASH' },
  { action: 'defend', label: 'BLOCK / DASH / BACK' },
  { action: 'shop', label: 'SHOP' },
  { action: 'settings', label: 'SETTINGS' },
];

export interface SettingsAnchor {
  /** Top-left of the tab, in canvas pixels. */
  x: number;
  y: number;
  /** Which edge the panel grows from, so it stays on screen. */
  panel: 'below' | 'above';
}

export interface SettingsPanel {
  readonly open: boolean;
  /** Returns true when the panel is open or just closed this step: the scene should skip its own input. */
  update(dt: number): boolean;
  render(ctx: CanvasRenderingContext2D): void;
}

const KEY_RH = 23;

const inRect = (p: { x: number; y: number }, x: number, y: number, w: number, h: number) =>
  p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createSettingsPanel(game: Game, anchor: SettingsAnchor): SettingsPanel {
  let open = false;
  let page: 'main' | 'keys' = 'main';
  let sel = 0;       // main page row
  let row = 0;       // keys page row (KEY_ROWS.length = the reset row)
  let slot: 0 | 1 = 0;
  let capturing: { row: number; slot: 0 | 1 } | null = null;
  let notice = '';
  let noticeT = 0;
  let t = 0;
  const clampVol = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 10) / 10;
  const size = () => (page === 'main' ? MAIN : KEYS);
  const origin = () => {
    const s = size();
    return { px: anchor.x, py: anchor.panel === 'below' ? anchor.y + TAB.h + 6 : anchor.y - s.h - 6 };
  };
  const say = (msg: string) => { notice = msg; noticeT = 2.2; };
  const name = (code: string | null) => game.input.keyName(code);

  function adjust(dir: number): void {
    const a = game.audio;
    if (sel === 0) {
      a.musicVolume = clampVol(a.musicVolume + dir * STEP);
    } else if (sel === 1) {
      a.sfxVolume = clampVol(a.sfxVolume + dir * STEP);
      game.audio.play('uiMove'); // audible preview of the new level
    } else if (sel === 2 && dir !== 0) {
      game.state.hardMode = dir > 0;
      game.audio.play(game.state.hardMode ? 'tell' : 'uiMove');
    }
  }

  function beginCapture(): void {
    const target = { row, slot };
    capturing = target;
    game.input.startCapture((code) => {
      capturing = null;
      const a = KEY_ROWS[target.row].action;
      if (code === 'Escape') { say('CANCELLED'); return; }
      if (code === 'Backspace' || code === 'Delete') {
        if (target.slot === 1 && game.input.clearBinding(a)) say('ALTERNATE KEY CLEARED');
        else say('THE FIRST KEY CANNOT BE EMPTY');
        return;
      }
      const r = game.input.rebind(a, target.slot, code);
      if (r === 'reserved') say(`${name(code)} CANNOT BE USED`);
      else if (r === 'refused') say('THAT IS ANOTHER ACTION\'S ONLY KEY');
      else if (r === 'swapped') say(`${name(code)} SWAPPED WITH ITS OLD ACTION`);
      else say(`BOUND TO ${name(code)}`);
      game.audio.play('uiMove');
    });
  }

  function cancelCapture(): void {
    capturing = null;
    game.input.cancelCapture();
  }

  /** Mouse: the same layout render() draws. Outside the panel closes it. */
  function clickPanel(c: { x: number; y: number }): void {
    const { w, h } = size();
    const { px, py } = origin();
    if (!inRect(c, px, py, w, h)) { open = false; game.audio.play('uiMove'); return; }
    if (page === 'main') {
      const i = Math.floor((c.y - (py + 58 - 17)) / 34);
      if (i < 0 || i >= MAIN_ROWS.length) return;
      sel = i;
      if (i < 2) {
        // Click on the bar sets the level: each of the 10 blocks is 15 px from px + 112.
        const bx = c.x - (px + 112);
        if (bx >= -4 && bx <= 150) {
          const level = Math.max(0, Math.min(10, Math.ceil(bx / 15))) / 10;
          if (i === 0) game.audio.musicVolume = level;
          else { game.audio.sfxVolume = level; game.audio.play('uiMove'); }
        } else game.audio.play('uiMove');
      } else if (i === 2) {
        game.state.hardMode = !game.state.hardMode;
        game.audio.play(game.state.hardMode ? 'tell' : 'uiMove');
      } else {
        page = 'keys'; row = 0; slot = 0; game.audio.play('uiMove');
      }
      return;
    }
    // Keybinds page: the title goes back; rows are KEY_RH apart from py + 50, then the reset row.
    if (c.y < py + 36) { page = 'main'; sel = 3; game.audio.play('uiMove'); return; }
    const i = Math.round((c.y - (py + 50)) / KEY_RH);
    if (i === KEY_ROWS.length) { row = i; game.input.resetBindings(); say('DEFAULT KEYS RESTORED'); game.audio.play('uiMove'); return; }
    if (i < 0 || i > KEY_ROWS.length) return;
    for (const s of [0, 1] as const) {
      if (inRect(c, px + 250 + s * 86, py + 50 + i * KEY_RH - 9, 78, 18)) {
        row = i; slot = s;
        say('PRESS A KEY OR CLICK  ·  ESC CANCELS');
        beginCapture();
        return;
      }
    }
    row = i;
    game.audio.play('uiMove');
  }

  return {
    get open() { return open; },
    update(dt) {
      t += dt;
      noticeT = Math.max(0, noticeT - dt);
      const inp = game.input;
      if (capturing) {
        // A pad button cancels (the next key press is taken by the capture itself).
        if (inp.device === 'gamepad' && inp.pressed('defend')) { cancelCapture(); say('CANCELLED'); }
        return true;
      }
      const click = inp.clicked();
      const onTab = click !== null && inRect(click, anchor.x, anchor.y, TAB.w, TAB.h);
      if (inp.pressed('settings') || onTab) {
        open = !open;
        page = 'main';
        sel = 0;
        game.audio.play('uiMove');
        return true; // the key press belongs to the panel this step
      }
      if (!open) return false;
      if (click) { clickPanel(click); return true; }

      if (page === 'main') {
        // Closing keys are consumed too, so E does not also leave the shop in the same step.
        if (inp.pressed('defend') || inp.pressed('shop')) { open = false; game.audio.play('uiMove'); return true; }
        if (inp.pressed('up')) { sel = (sel + MAIN_ROWS.length - 1) % MAIN_ROWS.length; game.audio.play('uiMove'); }
        if (inp.pressed('down')) { sel = (sel + 1) % MAIN_ROWS.length; game.audio.play('uiMove'); }
        if (sel === 3) {
          if (inp.pressed('confirm') || inp.pressed('right')) { page = 'keys'; row = 0; slot = 0; game.audio.play('uiMove'); }
        } else {
          if (inp.pressed('left')) adjust(-1);
          if (inp.pressed('right')) adjust(1);
          if (inp.pressed('confirm') && sel === 2) {
            game.state.hardMode = !game.state.hardMode;
            game.audio.play(game.state.hardMode ? 'tell' : 'uiMove');
          }
        }
        return true;
      }

      // Keybinds page.
      if (inp.pressed('defend') || inp.pressed('shop')) { page = 'main'; sel = 3; game.audio.play('uiMove'); return true; }
      const rows = KEY_ROWS.length + 1;
      if (inp.pressed('up')) { row = (row + rows - 1) % rows; game.audio.play('uiMove'); }
      if (inp.pressed('down')) { row = (row + 1) % rows; game.audio.play('uiMove'); }
      if (inp.pressed('left')) { slot = 0; game.audio.play('uiMove'); }
      if (inp.pressed('right')) { slot = 1; game.audio.play('uiMove'); }
      if (inp.pressed('confirm')) {
        if (row === KEY_ROWS.length) { inp.resetBindings(); say('DEFAULT KEYS RESTORED'); game.audio.play('uiMove'); } else beginCapture();
      }
      return true;
    },
    render(ctx) {
      const hard = game.state.hardMode;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      // The tab: always visible, and shows hard mode when it is on.
      roundRect(ctx, anchor.x, anchor.y, TAB.w, TAB.h, 6);
      ctx.fillStyle = open ? 'rgba(255,211,77,0.95)' : 'rgba(8,10,16,0.7)';
      ctx.fill();
      ctx.strokeStyle = hard ? '#ff5a4a' : 'rgba(255,255,255,0.45)';
      ctx.lineWidth = hard ? 2 : 1;
      ctx.stroke();
      ctx.font = `bold 12px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = open ? '#2a2200' : '#f4f1ea';
      ctx.fillText(`⚙ ${game.input.glyph('settings')}${hard ? ' · HARD' : ''}`, anchor.x + 9, anchor.y + TAB.h / 2 + 1);

      if (!open) { ctx.restore(); return; }

      const { w, h } = size();
      const { px, py } = origin();
      ctx.fillStyle = 'rgba(8,10,16,0.92)';
      roundRect(ctx, px, py, w, h, 8);
      ctx.fill();
      ctx.strokeStyle = '#ffd34d';
      ctx.lineWidth = 2;
      ctx.stroke();
      drawOutlinedText(ctx, page === 'main' ? 'SETTINGS' : 'KEYBINDS', px + w / 2, py + 22, { size: 22, color: '#ffdd22' });

      ctx.font = `11px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let hint: string;
      let hintColor = 'rgba(244,241,234,0.7)';

      if (page === 'main') {
        MAIN_ROWS.forEach((label, i) => {
          const y = py + 58 + i * 34;
          const on = i === sel;
          if (on) {
            ctx.fillStyle = 'rgba(255,211,77,0.16)';
            ctx.fillRect(px + 8, y - 16, w - 16, 32);
          }
          ctx.font = `bold 14px ${FONT}`;
          ctx.textAlign = 'left';
          ctx.fillStyle = on ? '#ffd34d' : '#f4f1ea';
          ctx.fillText(label, px + 18, y);
          if (i < 2) {
            const vol = i === 0 ? game.audio.musicVolume : game.audio.sfxVolume;
            const filled = Math.round(vol * 10);
            for (let b = 0; b < 10; b++) {
              ctx.fillStyle = b < filled ? (on ? '#ffd34d' : '#e8e0c8') : 'rgba(255,255,255,0.16)';
              ctx.fillRect(px + 112 + b * 15, y - 8, 12, 16);
            }
            ctx.fillStyle = '#f4f1ea';
            ctx.textAlign = 'right';
            ctx.fillText(`${filled * 10}%`, px + w - 14, y);
          } else if (i === 2) {
            ctx.fillStyle = hard ? '#ff5a4a' : '#9fd0ff';
            ctx.fillText(hard ? 'ON' : 'OFF', px + 112, y);
          } else {
            ctx.fillStyle = on ? '#ffd34d' : '#9fd0ff';
            ctx.fillText('CHANGE KEYS ▸', px + 112, y);
          }
        });
        const g = (a: Action) => name(game.input.binding(a, 0));
        hint = hard ? HARD_NOTE : `${g('up')} ${g('down')} CHOOSE  ·  ${g('left')} ${g('right')} CHANGE  ·  ${g('settings')} CLOSE`;
        if (hard) hintColor = '#ff9a8a';
      } else {
        const RH = KEY_RH;
        const y0 = py + 50;
        KEY_ROWS.forEach((r, i) => {
          const y = y0 + i * RH;
          const on = i === row;
          if (on) {
            ctx.fillStyle = 'rgba(255,211,77,0.16)';
            ctx.fillRect(px + 8, y - RH / 2, w - 16, RH);
          }
          ctx.font = `bold 11px ${FONT}`;
          ctx.textAlign = 'left';
          ctx.fillStyle = on ? '#ffd34d' : '#f4f1ea';
          ctx.fillText(r.label, px + 16, y);
          for (const s of [0, 1] as const) {
            const bx = px + 250 + s * 86;
            const picked = on && slot === s;
            const waiting = capturing !== null && capturing.row === i && capturing.slot === s;
            roundRect(ctx, bx, y - 9, 78, 18, 4);
            ctx.fillStyle = waiting ? '#ffd34d' : picked ? 'rgba(255,211,77,0.28)' : 'rgba(255,255,255,0.1)';
            ctx.fill();
            if (picked) { ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 1.5; ctx.stroke(); }
            ctx.textAlign = 'center';
            ctx.font = `bold 11px ${FONT}`;
            ctx.fillStyle = waiting ? '#2a2200' : '#f4f1ea';
            const label = waiting ? (Math.floor(t * 3) % 2 ? 'PRESS KEY' : '...') : name(game.input.binding(r.action, s));
            ctx.fillText(label, bx + 39, y + 0.5);
          }
        });
        const ry = y0 + KEY_ROWS.length * RH;
        const rOn = row === KEY_ROWS.length;
        if (rOn) {
          ctx.fillStyle = 'rgba(255,211,77,0.16)';
          ctx.fillRect(px + 8, ry - RH / 2, w - 16, RH);
        }
        ctx.font = `bold 11px ${FONT}`;
        ctx.textAlign = 'left';
        ctx.fillStyle = rOn ? '#ffd34d' : '#9fd0ff';
        ctx.fillText('RESET ALL KEYS TO DEFAULT', px + 16, ry);
        ctx.font = `11px ${FONT}`;
        const g = (a: Action) => name(game.input.binding(a, 0));
        hint = capturing
          ? 'PRESS THE NEW KEY  ·  ESC CANCELS  ·  BACKSPACE CLEARS THE 2ND KEY'
          : `${g('confirm')} CHANGE  ·  ${g('left')} ${g('right')} 1ST / 2ND KEY  ·  ${g('defend')} BACK`;
      }

      ctx.font = `11px ${FONT}`;
      ctx.textAlign = 'center';
      if (noticeT > 0) { hint = notice; hintColor = '#ffd34d'; }
      ctx.fillStyle = hintColor;
      ctx.fillText(hint, px + w / 2, py + h - 14);
      ctx.restore();
    },
  };
}
