import { drawPrompts } from '../input/prompts';
import { text } from '../manifest';
import { drawOutlinedText, drawSlamText, fill } from '../ui/hud';
import type { Game, Scene, SceneParams } from '../types';

const LOCK = 0.5;
const AUTO = 5;
const GOLD_AT = 1.2;
const COUNT_TIME = 0.8;
const DROP_AT = 0.3;
const GRAVITY = 1800;
const GROUND = 290;
const START_Y = -100;

function nigiriY(t: number): number {
  const dt = Math.max(0, t - DROP_AT);
  const fall = Math.sqrt(((GROUND - START_Y) * 2) / GRAVITY);
  if (dt < fall) return START_Y + 0.5 * GRAVITY * dt * dt;
  const tt = dt - fall;
  return GROUND - Math.abs(Math.sin(tt * 9)) * 70 * Math.exp(-tt * 3);
}

export function createResultScene(game: Game, params: SceneParams['result']): Scene {
  const { fish, outcome, goldEarned } = params;
  let t = 0;
  let left = false;
  let coined = false;
  const total = game.state.gold;
  const before = total - goldEarned;

  const leave = () => { if (!left) { left = true; game.go('ocean', undefined); } };

  return {
    enter() {
      if (outcome === 'win') {
        game.audio.play('ko');
        game.audio.announce(params.perfect ? text.announce.perfect : text.announce.win);
      } else {
        game.audio.play('lose');
        game.audio.announce(outcome === 'timeout' ? text.announce.timeout : text.announce.ko);
      }
    },
    update(dt) {
      t += dt;
      if (outcome === 'win' && !coined && t >= GOLD_AT) { coined = true; game.audio.play('coin'); }
      if ((t > LOCK && game.input.pressed('confirm')) || t >= AUTO) leave();
    },
    render(ctx) {
      const W = game.width;
      ctx.fillStyle = outcome === 'win' ? '#2a1450' : '#14182e';
      ctx.fillRect(0, 0, W, game.height);
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(W / 2 + Math.cos(a) * 120, 260 + Math.sin(a) * 120);
        ctx.lineTo(W / 2 + Math.cos(a) * 900, 260 + Math.sin(a) * 900);
        ctx.stroke();
      }

      if (outcome === 'win') {
        drawSlamText(ctx, text.win.banner, W / 2, 90, t, { size: 110, color: '#ff3b2f' });
        if (params.perfect) drawSlamText(ctx, text.win.perfect, W / 2, 170, t - 0.4, { size: 54 });
        game.assets.draw(ctx, 'nigiri', W / 2, nigiriY(t) + 40, { scale: 2.5 });
        if (t >= GOLD_AT) {
          const k = Math.min(1, (t - GOLD_AT) / COUNT_TIME);
          drawOutlinedText(ctx, fill(text.win.sold, { gold: Math.round(goldEarned * k) }), W / 2, 410, { size: 40, color: '#ffdd22' });
          drawOutlinedText(ctx, fill(text.shop.gold, { gold: Math.round(before + goldEarned * k) }), W / 2, 460, { size: 30 });
        }
      } else if (outcome === 'timeout') {
        drawSlamText(ctx, text.timeout.banner, W / 2, 110, t, { size: 110, color: '#ffdd22' });
        drawOutlinedText(ctx, text.timeout.sub, W / 2, 200, { size: 34 });
        game.assets.draw(ctx, 'samuraiIdle', 300, 380, { scale: 1.6 });
        game.assets.draw(ctx, fish.def.sprite, 600 + Math.max(0, t - 0.5) ** 2 * 450, 370 - t * 10, { scale: 1.6, time: t * 3 });
      } else {
        drawSlamText(ctx, text.ko.banner, W / 2, 110, t, { size: 80, color: '#ff3b2f' });
        drawOutlinedText(ctx, fill(text.ko.sub, { fish: fish.name }), W / 2, 200, { size: 32 });
        game.assets.draw(ctx, 'samuraiHurt', 300, 410, { scale: 1.6, rotation: Math.PI / 2 });
        game.assets.draw(ctx, fish.def.sprite, 560 + t * 40, 330 + Math.sin(t * 2) * 8, { flipX: true, scale: 1.8, time: t });
      }
      drawPrompts(ctx, game.input, [{ action: 'confirm', label: 'CONTINUE' }]);
    },
  };
}
