import { drawPrompts } from '../input/prompts';
import { text } from '../manifest';
import { drawOutlinedText, fill } from '../ui/hud';
import type { Game, Scene, SceneParams, UpgradeInfo } from '../types';
import {
  GOLD, INK, PAPER, VERMILION, W, deck, duskSea, duskSky, fillPattern, hanko, inkText, kanji,
  lantern, seigaiha, shadow, wood, wrap,
} from './screens/paint';

const LOCK = 0.2;

// ---------- layout (960 x 540; the prompt bar owns y 510..540) ----------
const HORIZON = 330;
const STALL_X = 236;        // left edge of the stall; the dock and sea show to its left
const ROOF_H = 46;
const NOREN_Y = ROOF_H;
const NOREN_H = 64;
const BEAM_Y = 120;         // signboards hang from this beam
const BOARD_W = 196;
const BOARD_H = 240;
const BOARD_GAP = 26;
const BOARD_X0 = 270;
const BOARD_Y = 132;
const COUNTER_Y = 432;
const DOCK_Y = 480;
const SAM_X = 122;
const SAM_FEET = 506;
const SAM_SCALE = 1.25;     // 190 px source frames drawn 2.4x by the sprite def: 3x on screen
const STAMP_TIME = 1.1;
const LIFT = 10;

const EMBLEM: Record<string, string> = { damage: '刀', depth: '糸', gold: '名' };
const MAX_MARKS = 10;

export function createShopScene(game: Game, _params: SceneParams['shop']): Scene {
  let t = 0;
  let sel = 0;
  let flash = 0;
  let flashRow = -1;
  let broke = 0;
  let brokeRow = 0;
  let stamp = 99;            // seconds since the last purchase (cosmetic)
  let lifted = [0, 0, 0];    // eased lift per board

  return {
    update(dt) {
      t += dt;
      flash = Math.max(0, flash - dt);
      broke = Math.max(0, broke - dt);
      stamp += dt;
      lifted = lifted.map((v, i) => v + ((i === sel ? 1 : 0) - v) * Math.min(1, dt * 14));
      if (t < LOCK) return;
      const rows = game.state.upgrades();
      if (game.input.pressed('left')) { sel = (sel + rows.length - 1) % rows.length; game.audio.play('uiMove'); }
      if (game.input.pressed('right')) { sel = (sel + 1) % rows.length; game.audio.play('uiMove'); }
      if (game.input.pressed('confirm')) {
        if (game.state.buy(rows[sel].id)) {
          game.audio.play('buy');
          game.audio.announce(text.announce.buy);
          flash = 0.5;
          flashRow = sel;
          stamp = 0;
        } else {
          game.audio.play('uiDeny');
          broke = 1.2;
          brokeRow = sel;
        }
      }
      if (game.input.pressed('shop')) game.go('ocean', undefined);
    },
    render(ctx) {
      const time = game.time;
      drawBackdrop(ctx, time);
      drawWall(ctx);
      drawStringLanterns(ctx, time);

      const rows = game.state.upgrades();
      rows.forEach((r, i) => {
        if (i !== sel) drawBoard(ctx, r, i, false, time, lifted[i] ?? 0, -1, 0);
      });
      drawCounter(ctx);
      drawAwaySign(ctx, time);
      // Selected board last, so its glow and lift sit on top.
      const s = rows[sel];
      if (s) {
        drawBoard(ctx, s, sel, true, time, lifted[sel] ?? 1,
          flashRow === sel ? stamp : -1, flashRow === sel ? flash : 0);
      }

      drawRoofAndNoren(ctx, time);
      lantern(ctx, STALL_X - 4, ROOF_H - 2, time, 1.25, '魚', 16);
      lantern(ctx, W - 14, ROOF_H - 2, time + 1.7, 1.0, '', 10);

      shadow(ctx, SAM_X - 6, SAM_FEET - 2, 46);
      game.assets.draw(ctx, 'samuraiIdle', SAM_X, SAM_FEET - (173 * SAM_SCALE) / 2, { scale: SAM_SCALE, time });

      drawPurse(ctx, game.state.gold);
      if (broke > 0) drawBrokeSign(ctx, Math.min(W - 125, boardX(brokeRow) + BOARD_W / 2), BOARD_Y + BOARD_H - 46, broke);

      drawPrompts(ctx, game.input, [
        { action: 'move', label: 'SELECT' },
        { action: 'confirm', label: 'BUY' },
        { action: 'shop', label: 'BACK' },
      ]);
    },
  };
}

function boardX(i: number): number {
  return BOARD_X0 + i * (BOARD_W + BOARD_GAP);
}

// ---------- backdrop: dusk sky and harbour to the left of the stall ----------

function drawBackdrop(ctx: CanvasRenderingContext2D, t: number): void {
  duskSky(ctx, t, HORIZON, 120, 60);
  duskSea(ctx, t, HORIZON, DOCK_Y, 120);
  // A far-off pagoda silhouette on the horizon, for place.
  ctx.fillStyle = '#2a1238';
  const px = 44;
  ctx.fillRect(px - 2, HORIZON - 70, 4, 14);
  for (let i = 0; i < 4; i++) {
    const y = HORIZON - 56 + i * 14;
    const hw = 10 + i * 4;
    ctx.beginPath();
    ctx.moveTo(px - hw - 6, y + 4);
    ctx.lineTo(px + hw + 6, y + 4);
    ctx.lineTo(px + hw, y);
    ctx.lineTo(px - hw, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(px - hw + 4, y + 4, (hw - 4) * 2, 10);
  }
  deck(ctx, DOCK_Y, 510);
}

// ---------- the stall ----------

function drawWall(ctx: CanvasRenderingContext2D): void {
  const x = STALL_X;
  const w = W - STALL_X;
  // Shoji backing: warm paper lit from inside, dark lattice.
  const g = ctx.createLinearGradient(0, NOREN_Y + NOREN_H, 0, COUNTER_Y);
  g.addColorStop(0, '#f6d79a');
  g.addColorStop(1, '#d99a5a');
  ctx.fillStyle = g;
  ctx.fillRect(x, NOREN_Y, w, COUNTER_Y - NOREN_Y);
  ctx.fillStyle = 'rgba(120,60,20,0.08)';
  for (let yy = NOREN_Y; yy < COUNTER_Y; yy += 6) ctx.fillRect(x, yy, w, 1);
  ctx.fillStyle = '#4a2612';
  const cell = 46;
  for (let xx = x + 18; xx < W; xx += cell) ctx.fillRect(xx, NOREN_Y, 4, COUNTER_Y - NOREN_Y);
  for (let yy = NOREN_Y + 40; yy < COUNTER_Y; yy += cell * 1.3) ctx.fillRect(x, yy, w, 4);
  // Seigaiha band along the bottom of the wall (wainscot), subtle.
  const pat = seigaiha(ctx, 14, '#3a1d0e', '#6b3a1e');
  fillPattern(ctx, pat, x, COUNTER_Y - 70, w, 70, 0.9);
  ctx.fillStyle = 'rgba(40,18,6,0.5)';
  ctx.fillRect(x, COUNTER_Y - 72, w, 3);
  // Warm vignette toward the edges.
  const v = ctx.createRadialGradient(600, 260, 80, 600, 260, 520);
  v.addColorStop(0, 'rgba(255,200,120,0)');
  v.addColorStop(1, 'rgba(60,20,40,0.45)');
  ctx.fillStyle = v;
  ctx.fillRect(x, NOREN_Y, w, COUNTER_Y - NOREN_Y);
  // Corner post and the beam the boards hang from.
  wood(ctx, STALL_X - 12, NOREN_Y, 22, DOCK_Y - NOREN_Y, '#5a3018', 3);
  wood(ctx, STALL_X, BEAM_Y - 6, w, 12, '#6b3a1e', 5);
}

function drawRoofAndNoren(ctx: CanvasRenderingContext2D, t: number): void {
  // Kawara roof edge: rounded tile caps over a dark underside, sloping off at the left.
  const left = STALL_X - 70;
  ctx.fillStyle = '#1c1a2e';
  ctx.beginPath();
  ctx.moveTo(left, ROOF_H);
  ctx.lineTo(left + 40, 0);
  ctx.lineTo(W, 0);
  ctx.lineTo(W, ROOF_H);
  ctx.closePath();
  ctx.fill();
  for (let x = left + 30; x < W + 20; x += 22) {
    const top = x < left + 40 ? ROOF_H - (x - left) : 0;
    const g = ctx.createLinearGradient(x - 9, 0, x + 9, 0);
    g.addColorStop(0, '#2c2a48');
    g.addColorStop(0.45, '#6a6890');
    g.addColorStop(1, '#24223a');
    ctx.fillStyle = g;
    ctx.fillRect(x - 8, Math.max(0, top), 16, ROOF_H - 10 - Math.max(0, top));
    // Round end cap with a tiny mon.
    ctx.fillStyle = '#3a3858';
    ctx.beginPath();
    ctx.arc(x, ROOF_H - 10, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,214,140,0.5)';
    ctx.fillRect(x - 2, ROOF_H - 12, 4, 4);
  }
  ctx.fillStyle = 'rgba(255,170,120,0.35)';
  ctx.fillRect(left + 40, 0, W - left - 40, 2);

  // Noren curtain: indigo panels with a seigaiha texture, split by slits, swaying at the hem.
  const nx = STALL_X + 4;
  const nw = W - nx;
  const panels = 6;
  const pw = nw / panels;
  const pat = seigaiha(ctx, 10, '#1f2456', '#2b3170');
  for (let i = 0; i < panels; i++) {
    const x0 = nx + i * pw + 2;
    const sway = Math.sin(t * 1.3 + i * 0.9) * 3;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x0, NOREN_Y);
    ctx.lineTo(x0 + pw - 4, NOREN_Y);
    ctx.lineTo(x0 + pw - 4 + sway, NOREN_Y + NOREN_H);
    ctx.lineTo(x0 + sway, NOREN_Y + NOREN_H);
    ctx.closePath();
    ctx.fillStyle = '#1f2456';
    ctx.fill();
    ctx.clip();
    fillPattern(ctx, pat, x0 - 6, NOREN_Y, pw + 12, NOREN_H, 1);
    ctx.restore();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0, NOREN_Y);
    ctx.lineTo(x0 + sway, NOREN_Y + NOREN_H);
    ctx.lineTo(x0 + pw - 4 + sway, NOREN_Y + NOREN_H);
    ctx.lineTo(x0 + pw - 4, NOREN_Y);
    ctx.stroke();
  }
  // Curtain rod.
  wood(ctx, STALL_X - 6, NOREN_Y - 4, W - STALL_X + 6, 9, '#6b3a1e', 1);

  // Kanji crest on the first panel, shop name in big lettering across the rest.
  const cy = NOREN_Y + NOREN_H / 2 + 2;
  ctx.fillStyle = PAPER;
  ctx.beginPath();
  ctx.arc(nx + pw / 2, cy, 25, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.stroke();
  kanji(ctx, '港', nx + pw / 2, cy + 1, 32, '#1f2456');
  drawOutlinedText(ctx, text.shop.title, nx + pw + (nw - pw) / 2 - 70, cy, { size: 34, color: '#fff4dc' });
  kanji(ctx, text.shop.kanji, W - 112, cy, 24, PAPER, INK);
}

function drawCounter(ctx: CanvasRenderingContext2D): void {
  const x = STALL_X - 2;
  const w = W - x;
  ctx.fillStyle = 'rgba(30,10,4,0.35)';
  ctx.fillRect(x, COUNTER_Y - 6, w, 6);
  wood(ctx, x, COUNTER_Y, w, 12, '#c07a44', 2);
  wood(ctx, x + 6, COUNTER_Y + 12, w - 6, DOCK_Y - COUNTER_Y - 12, '#7a4422', 4);
  // Vertical slats on the counter front.
  ctx.fillStyle = 'rgba(40,18,6,0.45)';
  for (let xx = x + 40; xx < W; xx += 58) ctx.fillRect(xx, COUNTER_Y + 14, 3, DOCK_Y - COUNTER_Y - 16);
}

/** Paper note pinned to the counter: the shopkeeper is out. */
function drawAwaySign(ctx: CanvasRenderingContext2D, t: number): void {
  const cx = 604;
  const cy = COUNTER_Y + 30;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.03 + Math.sin(t * 0.8) * 0.01);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-84, -13, 172, 34);
  ctx.fillStyle = PAPER;
  ctx.fillRect(-88, -17, 172, 34);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.strokeRect(-88, -17, 172, 34);
  kanji(ctx, '留守', -66, 0, 15, VERMILION);
  inkText(ctx, text.shop.away, 12, -4, 16, INK);
  inkText(ctx, text.shop.awaySub, 12, 10, 9, '#6b4a2a', 'center', 'monospace');
  ctx.fillStyle = '#7a1a14';
  ctx.beginPath(); ctx.arc(-80, -10, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(76, -10, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** A rope of small lanterns from the stall corner out over the water. */
function drawStringLanterns(ctx: CanvasRenderingContext2D, t: number): void {
  const x0 = STALL_X - 6;
  const y0 = ROOF_H + 30;
  const cx = 110;
  const cyy = 150;
  const x1 = -20;
  const y1 = 64;
  ctx.strokeStyle = '#2a1a10';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(cx, cyy, x1, y1);
  ctx.stroke();
  [0.3, 0.66].forEach((u, i) => {
    const x = (1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * cx + u * u * x1;
    const y = (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * cyy + u * u * y1;
    lantern(ctx, x, y, t + i * 1.3, 0.62, '', 4);
  });
}

// ---------- signboards ----------

function drawBoard(
  ctx: CanvasRenderingContext2D, r: UpgradeInfo, i: number, selected: boolean, t: number,
  lift: number, stampAge: number, flash: number,
): void {
  const x = boardX(i);
  const y = BOARD_Y - lift * LIFT;
  const cx = x + BOARD_W / 2;
  const swing = Math.sin(t * 1.2 + i * 1.9) * (selected ? 0.012 : 0.006);
  const thump = stampAge >= 0 && stampAge < 0.2 ? Math.sin(stampAge * 60) * (0.2 - stampAge) * 20 : 0;

  // Ropes from the beam.
  ctx.strokeStyle = '#2a1a10';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 26, BEAM_Y); ctx.lineTo(x + 26, y + 6);
  ctx.moveTo(x + BOARD_W - 26, BEAM_Y); ctx.lineTo(x + BOARD_W - 26, y + 6);
  ctx.stroke();

  ctx.save();
  ctx.translate(cx, BEAM_Y);
  ctx.rotate(swing);
  ctx.translate(-cx, -BEAM_Y + thump);

  if (selected) {
    const glow = ctx.createRadialGradient(cx, y + BOARD_H / 2, 40, cx, y + BOARD_H / 2, 200);
    glow.addColorStop(0, 'rgba(255,214,120,0.6)');
    glow.addColorStop(1, 'rgba(255,170,80,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 90, y - 70, BOARD_W + 180, BOARD_H + 140);
  }
  // Drop shadow on the shoji.
  ctx.fillStyle = 'rgba(40,14,4,0.35)';
  ctx.fillRect(x + 8, y + 10 + lift * 6, BOARD_W, BOARD_H);

  // The board: two planks with a cap rail.
  const base = selected ? '#b06a36' : '#8a4e28';
  wood(ctx, x, y + 10, BOARD_W, BOARD_H / 2, base, i * 3 + 1, false);
  wood(ctx, x, y + 10 + BOARD_H / 2, BOARD_W, BOARD_H / 2 - 10, base, i * 3 + 2, false);
  ctx.fillStyle = 'rgba(40,18,6,0.5)';
  ctx.fillRect(x, y + 10 + BOARD_H / 2, BOARD_W, 2);
  wood(ctx, x - 8, y, BOARD_W + 16, 14, '#4a2612', i, true);
  // Nails.
  ctx.fillStyle = '#2a1408';
  for (const [nx, ny] of [[x + 10, y + 22], [x + BOARD_W - 13, y + 22], [x + 10, y + BOARD_H - 12], [x + BOARD_W - 13, y + BOARD_H - 12]]) {
    ctx.fillRect(nx, ny, 3, 3);
  }
  ctx.strokeStyle = selected ? GOLD : INK;
  ctx.lineWidth = selected ? 5 : 3;
  ctx.strokeRect(x, y + 10, BOARD_W, BOARD_H - 10);
  if (selected) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 4, y + 6, BOARD_W + 8, BOARD_H - 2);
  }

  // Emblem: a paper disc with the track's kanji.
  const ey = y + 62;
  ctx.fillStyle = selected ? '#fff4dc' : '#e6d2a6';
  ctx.beginPath();
  ctx.arc(cx, ey, 36, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(26,10,10,0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, ey, 30, 0, Math.PI * 2);
  ctx.stroke();
  kanji(ctx, EMBLEM[r.id] ?? '道', cx, ey + 2, 46, selected ? VERMILION : INK);

  // LV seal in the corner.
  drawLevelSeal(ctx, x + BOARD_W - 26, y + 42, r.level);

  // Track label and current level name.
  drawOutlinedText(ctx, r.label, cx, y + 118, { size: 28, color: GOLD });
  const font = "18px Impact, 'Arial Black', sans-serif";
  const lines = wrap(ctx, r.name.toUpperCase(), BOARD_W - 22, font, 2);
  lines.forEach((l, k) => {
    const ly = y + 146 + k * 21 - (lines.length - 1) * 4;
    drawOutlinedText(ctx, l, cx, ly, { size: 18, color: selected ? '#fff' : '#f0dcc0' });
  });

  // Level marks: a row of small pips, filled up to the current level.
  const marks = MAX_MARKS;
  const mw = 12;
  const mx0 = cx - (marks * mw) / 2 + mw / 2;
  for (let k = 0; k < marks; k++) {
    const on = k < r.level;
    const mx = mx0 + k * mw;
    const my = y + 186;
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = on ? GOLD : 'rgba(26,10,10,0.45)';
    ctx.fillRect(-3.5, -3.5, 7, 7);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-3.5, -3.5, 7, 7);
    ctx.restore();
  }

  // Effect line on a dark inset strip.
  const sy = y + 202;
  ctx.fillStyle = 'rgba(26,10,10,0.55)';
  ctx.fillRect(x + 10, sy, BOARD_W - 20, 24);
  ctx.save();
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = selected ? '#ffe9b0' : '#d9c39a';
  ctx.fillText(r.effect, cx, sy + 12.5);
  ctx.restore();

  // Purchase flash.
  if (flash > 0) {
    ctx.fillStyle = `rgba(255,250,220,${flash})`;
    ctx.fillRect(x, y + 10, BOARD_W, BOARD_H - 10);
  }

  // Hanging price tag.
  drawPriceTag(ctx, cx, y + BOARD_H, r, t + i, selected);

  // Hanko stamp thumping down after a purchase.
  if (stampAge >= 0 && stampAge < STAMP_TIME) {
    const k = Math.min(1, stampAge / 0.12);
    const scale = 2.6 - 1.6 * (1 - Math.pow(1 - k, 3));
    const alpha = stampAge < 0.7 ? Math.min(1, k * 1.5) : Math.max(0, 1 - (stampAge - 0.7) / (STAMP_TIME - 0.7));
    ctx.save();
    ctx.translate(cx + 54, y + 186);
    ctx.scale(scale, scale);
    hanko(ctx, 0, 0, 62, '済', alpha * 0.95, -0.18, true);
    ctx.restore();
    if (k >= 1 && stampAge < 0.35) {
      // Ink burst ring.
      const ring = (stampAge - 0.12) / 0.23;
      ctx.strokeStyle = `rgba(200,40,30,${0.7 * (1 - ring)})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx + 54, y + 186, 34 + ring * 46, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawLevelSeal(ctx: CanvasRenderingContext2D, x: number, y: number, level: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(0.12);
  ctx.fillStyle = VERMILION;
  ctx.strokeStyle = '#7a0e08';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-20, -20, 40, 40, 5);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-16, -16, 32, 32);
  inkText(ctx, 'LV', 0, -7, 12, PAPER);
  inkText(ctx, String(level), 0, 7, level > 99 ? 13 : 18, PAPER);
  ctx.restore();
}

function drawPriceTag(
  ctx: CanvasRenderingContext2D, cx: number, top: number, r: UpgradeInfo, t: number, selected: boolean,
): void {
  const sway = Math.sin(t * 2.1) * 0.06;
  const tw = 122;
  const th = 34;
  ctx.save();
  ctx.translate(cx, top - 2);
  ctx.rotate(sway);
  ctx.strokeStyle = '#d9c08a';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 14); ctx.stroke();
  const ok = r.affordable;
  const fillC = ok ? (selected ? '#f0cf8a' : '#d8b070') : '#7a1a14';
  // Tag with clipped corners and a punch hole.
  ctx.beginPath();
  ctx.moveTo(-tw / 2 + 8, 12);
  ctx.lineTo(tw / 2 - 8, 12);
  ctx.lineTo(tw / 2, 20);
  ctx.lineTo(tw / 2, 12 + th);
  ctx.lineTo(-tw / 2, 12 + th);
  ctx.lineTo(-tw / 2, 20);
  ctx.closePath();
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.save(); ctx.translate(4, 4); ctx.fill(); ctx.restore();
  ctx.fillStyle = fillC;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(0, 18, 2.5, 0, Math.PI * 2); ctx.fill();
  const price = fill(text.shop.gold, { gold: r.cost });
  if (ok) {
    drawOutlinedText(ctx, price, 0, 12 + th / 2 + 3, { size: 22, color: '#fff4c0' });
  } else {
    drawOutlinedText(ctx, price, 0, 12 + th / 2 + 3, { size: 22, color: '#c98a84', outline: '#3a0806' });
    ctx.strokeStyle = 'rgba(255,120,110,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-tw / 2 + 12, 12 + th / 2 + 3);
    ctx.lineTo(tw / 2 - 12, 12 + th / 2 + 3);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------- gold and refusal ----------

function drawPurse(ctx: CanvasRenderingContext2D, gold: number): void {
  const label = fill(text.shop.gold, { gold });
  ctx.save();
  ctx.font = "30px Impact, 'Arial Black', sans-serif";
  const tw = ctx.measureText(label).width;
  ctx.restore();
  const x = W - 22 - tw;
  const y = 24;
  // Koban coin.
  const kx = x - 26;
  ctx.save();
  ctx.translate(kx, y);
  ctx.fillStyle = '#e8b830';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, 0, 13, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#a07010';
  ctx.lineWidth = 1;
  for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(-8, k * 5); ctx.lineTo(8, k * 5); ctx.stroke(); }
  kanji(ctx, '両', 0, 1, 13, INK);
  ctx.restore();
  drawOutlinedText(ctx, label, W - 22, y + 1, { size: 30, color: GOLD, align: 'right' });
}

function drawBrokeSign(ctx: CanvasRenderingContext2D, cx: number, cy: number, left: number): void {
  const age = 1.2 - left;
  const pop = Math.min(1, age / 0.1);
  const shake = Math.max(0, 1 - age / 0.6) * 7;
  const alpha = Math.min(1, left / 0.25);
  const sw = 230;
  const sh = 46;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(cx + Math.sin(age * 70) * shake, cy + Math.cos(age * 53) * shake * 0.4);
  ctx.rotate(Math.sin(age * 40) * 0.05 * (shake / 7) - 0.04);
  ctx.scale(0.6 + 0.4 * pop, 0.6 + 0.4 * pop);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(-sw / 2 + 5, -sh / 2 + 5, sw, sh);
  wood(ctx, -sw / 2, -sh / 2, sw, sh, '#6b3a1e', 9);
  ctx.fillStyle = '#2a1408';
  ctx.fillRect(-sw / 2 + 6, -sh / 2 + 6, 3, 3);
  ctx.fillRect(sw / 2 - 9, -sh / 2 + 6, 3, 3);
  hanko(ctx, -sw / 2 + 22, 0, 28, '無', 1, -0.1);
  drawOutlinedText(ctx, text.shop.broke, 14, 1, { size: 22, color: '#ff5a4a' });
  ctx.restore();
}
