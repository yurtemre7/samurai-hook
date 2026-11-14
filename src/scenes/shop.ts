import { drawPrompts } from '../input/prompts';
import { text } from '../manifest';
import { drawOutlinedText, drawPanel, fill } from '../ui/hud';
import type { Game, Scene, SceneParams } from '../types';

const LOCK = 0.2;
const ROW_X = 250;
const ROW_W = 680;
const ROW_H = 120;
const ROW_Y = 80;
const ROW_GAP = 10;

export function createShopScene(game: Game, _params: SceneParams['shop']): Scene {
  let t = 0;
  let sel = 0;
  let flash = 0;
  let flashRow = -1;
  let broke = 0;

  return {
    update(dt) {
      t += dt;
      flash = Math.max(0, flash - dt);
      broke = Math.max(0, broke - dt);
      if (t < LOCK) return;
      const rows = game.state.upgrades();
      if (game.input.pressed('up')) { sel = (sel + rows.length - 1) % rows.length; game.audio.play('uiMove'); }
      if (game.input.pressed('down')) { sel = (sel + 1) % rows.length; game.audio.play('uiMove'); }
      if (game.input.pressed('confirm')) {
        if (game.state.buy(rows[sel].id)) {
          game.audio.play('buy');
          game.audio.announce(text.announce.buy);
          flash = 0.5;
          flashRow = sel;
        } else {
          game.audio.play('uiDeny');
          broke = 1.2;
        }
      }
      if (game.input.pressed('shop')) game.go('ocean', undefined);
    },
    render(ctx) {
      const W = game.width;
      ctx.fillStyle = '#1b1230';
      ctx.fillRect(0, 0, W, game.height);
      ctx.fillStyle = '#2d1b4e';
      ctx.fillRect(0, 470, W, 40);

      drawOutlinedText(ctx, text.shop.title, 30, 36, { size: 36, color: '#ffdd22', align: 'left' });
      drawOutlinedText(ctx, fill(text.shop.gold, { gold: game.state.gold }), W - 30, 36, { size: 36, align: 'right' });

      game.assets.draw(ctx, 'samuraiIdle', 120, 370, { scale: 1.8, time: game.time });

      const rows = game.state.upgrades();
      rows.forEach((r, i) => {
        const y = ROW_Y + i * (ROW_H + ROW_GAP);
        drawPanel(ctx, ROW_X, y, ROW_W, ROW_H);
        if (i === sel) {
          ctx.save();
          ctx.fillStyle = 'rgba(255,221,34,0.15)';
          ctx.fillRect(ROW_X + 4, y + 4, ROW_W - 8, ROW_H - 8);
          ctx.restore();
          const bob = Math.sin(game.time * 8) * 4;
          drawOutlinedText(ctx, '>', ROW_X - 20 + bob, y + ROW_H / 2, { size: 48, color: '#ffdd22' });
        }
        if (flash > 0 && flashRow === i) {
          ctx.save();
          ctx.fillStyle = `rgba(255,255,255,${flash})`;
          ctx.fillRect(ROW_X, y, ROW_W, ROW_H);
          ctx.restore();
        }
        const dim = r.affordable ? '#fff' : '#7d7a88';
        drawOutlinedText(ctx, r.label, ROW_X + 20, y + 26, { size: 28, color: '#ffdd22', align: 'left' });
        drawOutlinedText(ctx, `LV ${r.level}`, ROW_X + ROW_W - 20, y + 26, { size: 24, align: 'right' });
        drawOutlinedText(ctx, r.name.toUpperCase(), ROW_X + 20, y + 62, { size: 26, color: dim, align: 'left' });
        drawOutlinedText(ctx, r.effect, ROW_X + 20, y + 98, { size: 16, color: dim, align: 'left', font: 'monospace' });
        drawOutlinedText(ctx, fill(text.shop.gold, { gold: r.cost }), ROW_X + ROW_W - 20, y + 92, {
          size: 30, color: r.affordable ? '#7dff7d' : '#7d7a88', align: 'right',
        });
      });

      if (broke > 0) drawOutlinedText(ctx, text.shop.broke, W / 2 + 100, 488, { size: 30, color: '#ff3b2f' });
      drawPrompts(ctx, game.input, [
        { action: 'move', label: 'SELECT' },
        { action: 'confirm', label: 'BUY' },
        { action: 'shop', label: 'BACK' },
      ]);
    },
  };
}
