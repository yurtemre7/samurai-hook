import { drawPrompts } from '../input/prompts';
import { text } from '../manifest';
import { drawOutlinedText, drawPanel, drawSlamText, fill } from '../ui/hud';
import type { Game, Scene, SceneParams } from '../types';

const DURATION = 2.5;
const INPUT_LOCK = 0.2;
const SLIDE = 0.45;

function bubble(ctx: CanvasRenderingContext2D, line: string, x: number, y: number, w: number): void {
  drawPanel(ctx, x - w / 2, y - 32, w, 64);
  ctx.save();
  ctx.font = "bold 16px 'Arial Black', sans-serif";
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let a = line;
  let b = '';
  if (ctx.measureText(line).width > w - 24) {
    const words = line.split(' ');
    const half = Math.ceil(words.length / 2);
    a = words.slice(0, half).join(' ');
    b = words.slice(half).join(' ');
  }
  if (b) { ctx.fillText(a, x, y - 10); ctx.fillText(b, x, y + 12); } else ctx.fillText(a, x, y);
  ctx.restore();
}

function pick<T>(a: T[]): T { return a[Math.floor(Math.random() * a.length)]; }

export function createCutsceneScene(game: Game, params: SceneParams['cutscene']): Scene {
  const { fish } = params;
  let t = 0;
  let taunt = '';
  let line = '';
  let done = false;
  let round = 0;

  return {
    enter() {
      round = game.state.nextRound();
      game.audio.play('gong');
      game.audio.announce(fill(text.announce.round, { round, fish: fish.name }));
      game.audio.music('fight');
      taunt = fish.def.taunts.length ? pick(fish.def.taunts) : '...';
      line = pick(text.samuraiLines);
    },
    update(dt) {
      t += dt;
      if (done) return;
      if (t >= DURATION || (t > INPUT_LOCK && game.input.anyPressed())) {
        done = true;
        game.go('fight', { fish });
      }
    },
    render(ctx) {
      const W = game.width;
      const H = game.height;
      ctx.fillStyle = '#b3201a';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#1f4fb3';
      ctx.beginPath();
      ctx.moveTo(W * 0.58, 0); ctx.lineTo(W, 0); ctx.lineTo(W, H); ctx.lineTo(W * 0.42, H);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(W * 0.58, 0); ctx.lineTo(W * 0.42, H); ctx.stroke();

      const k = Math.min(1, t / SLIDE);
      const ease = 1 - Math.pow(1 - k, 3);
      const sx = -150 + 380 * ease;
      const fx = W + 200 - 420 * ease;
      game.assets.draw(ctx, 'samuraiIdle', sx, 350, { scale: 2, time: t });
      game.assets.draw(ctx, fish.def.sprite, fx, 350, { flipX: true, scale: 2.2, time: t });

      drawSlamText(ctx, fill(text.cutscene.round, { round }), W / 2, 70, t - 0.1, { size: 84 });
      drawSlamText(ctx, fill(text.cutscene.versus, { fish: fish.name }), W / 2, 190, t - 0.6, { size: 46, color: '#fff' });
      if (t > 0.9) drawOutlinedText(ctx, fish.def.title, W / 2, 240, { size: 28, color: '#ffdd22' });

      if (t > 1.2) {
        bubble(ctx, line, 230, 300, 300);
        bubble(ctx, taunt, 730, 300, 300);
      }
      drawPrompts(ctx, game.input, [{ action: 'confirm', label: 'SKIP' }]);
    },
  };
}
