import { drawPrompts } from '../input/prompts';
import { cutscene, text } from '../manifest';
import { drawOutlinedText, drawSlamText, fill } from '../ui/hud';
import type { Game, Scene, SceneParams } from '../types';
import {
  FISH_KANJI, INK, PAPER, VERMILION, brush, fillPattern, kanji, kanjiColumn, scroll, seigaiha, sunRays,
} from './screens/paint';


const BUBBLE_FONT = "bold 16px 'Arial Black', sans-serif";

/** Speech as a paper scroll with ink lettering. */
function bubble(ctx: CanvasRenderingContext2D, line: string, x: number, y: number, w: number, appear: number): void {
  const k = Math.min(1, Math.max(0, appear / 0.18));
  if (k <= 0) return;
  const ease = 1 - Math.pow(1 - k, 3);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(0.15 + 0.85 * ease, 1);
  scroll(ctx, 0, 0, w, 64);
  ctx.restore();
  if (k < 1) return;
  ctx.save();
  ctx.font = BUBBLE_FONT;
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let a = line;
  let b = '';
  if (ctx.measureText(line).width > w - 28) {
    const words = line.split(' ');
    const half = Math.ceil(words.length / 2);
    a = words.slice(0, half).join(' ');
    b = words.slice(half).join(' ');
  }
  if (b) { ctx.fillText(a, x, y - 10); ctx.fillText(b, x, y + 12); } else ctx.fillText(a, x, y);
  ctx.restore();
}

function pick<T>(a: T[]): T { return a[Math.floor(Math.random() * a.length)]; }

/** Vertical nobori banner along a screen edge. */
function banner(ctx: CanvasRenderingContext2D, x: number, w: number, H: number, cloth: string, glyphs: string, t: number): void {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(x + 4, 0, w, H);
  ctx.fillStyle = cloth;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x + w, 0);
  for (let y = 0; y <= H; y += 20) ctx.lineTo(x + w + Math.sin(t * 3 + y / 40) * 2, y);
  ctx.lineTo(x, H);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(x + 4, 0, 3, H);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.strokeRect(x, -2, w, H + 4);
  // Loops along the pole side.
  ctx.fillStyle = PAPER;
  for (let y = 30; y < H; y += 70) ctx.fillRect(x + (x < 480 ? w - 6 : 0), y, 6, 12);
  kanjiColumn(ctx, glyphs, x + w / 2, 230, 34, PAPER, INK);
  ctx.restore();
}

export function createCutsceneScene(game: Game, params: SceneParams['cutscene']): Scene {
  const { fish } = params;
  let t = 0;
  let taunt = '';
  let line = '';
  let done = false;
  let round = 0;
  const fishKanji = FISH_KANJI[fish.def.id] ?? '魚';

  return {
    enter() {
      round = game.state.nextRound();
      game.audio.play('gong');
      game.audio.announce(fill(text.announce.round, { round, fish: fish.name }), { key: 'round', round, fish: fish.name });
      game.audio.music('fight');
      taunt = fish.def.taunts.length ? pick(fish.def.taunts) : '...';
      line = pick(text.samuraiLines);
    },
    update(dt) {
      t += dt;
      if (done) return;
      if (t >= cutscene.duration || (t > cutscene.inputLock && game.input.anyPressed())) {
        done = true;
        game.go('fight', { fish });
      }
    },
    render(ctx) {
      const W = game.width;
      const H = game.height;

      // Samurai side: sunset sky with rising-sun rays.
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#4a1d5c');
      sky.addColorStop(0.5, '#a33a5a');
      sky.addColorStop(1, '#f07a3a');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.globalAlpha = 0.55;
      sunRays(ctx, 230, 330, t, 'rgba(0,0,0,0)', '#ffb347', 18, 900);
      ctx.restore();
      const glow = ctx.createRadialGradient(230, 330, 40, 230, 330, 220);
      glow.addColorStop(0, 'rgba(255,240,180,0.9)');
      glow.addColorStop(1, 'rgba(255,140,80,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = VERMILION;
      ctx.beginPath();
      ctx.arc(230, 330, 120, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,214,120,0.35)';
      for (let i = 0; i < 5; i++) ctx.fillRect(110, 360 + i * 16 + ((t * 10) % 16), 240, 3 + i);

      // Fish side: the deep sea with a drifting seigaiha pattern.
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(W * 0.58, 0); ctx.lineTo(W, 0); ctx.lineTo(W, H); ctx.lineTo(W * 0.42, H);
      ctx.closePath();
      ctx.clip();
      const sea = ctx.createLinearGradient(0, 0, 0, H);
      sea.addColorStop(0, '#2a2a6a');
      sea.addColorStop(1, '#070d26');
      ctx.fillStyle = sea;
      ctx.fillRect(0, 0, W, H);
      fillPattern(ctx, seigaiha(ctx, 22, '#14205a', '#24357a'), 0, 0, W, H, 0.75, -t * 14, t * 6);
      const deep = ctx.createLinearGradient(0, 0, 0, H);
      deep.addColorStop(0, 'rgba(10,14,40,0)');
      deep.addColorStop(1, 'rgba(5,8,26,0.75)');
      ctx.fillStyle = deep;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(190,220,255,0.5)';
      for (let i = 0; i < 14; i++) {
        const bx = 520 + ((i * 97) % 420);
        const by = H - ((t * (30 + (i % 4) * 12) + i * 61) % (H + 40));
        ctx.beginPath();
        ctx.arc(bx + Math.sin(t * 2 + i) * 6, by, 2 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Brush-stroke divider along the diagonal.
      brush(ctx, W * 0.6, -20, W * 0.4, H + 30, 44, INK, 2);
      brush(ctx, W * 0.585, -10, W * 0.42, H + 10, 8, PAPER, 5);

      // Huge faint "versus" kanji behind everything.
      ctx.save();
      ctx.globalAlpha = 0.16;
      kanji(ctx, '対', W / 2, 250, 260, PAPER);
      ctx.restore();

      banner(ctx, 0, 46, H, VERMILION, '侍道', t);
      banner(ctx, W - 46, 46, H, '#1f2456', fishKanji, t + 1);

      const k = Math.min(1, t / cutscene.slide);
      const ease = 1 - Math.pow(1 - k, 3);
      const sx = -150 + 380 * ease;
      const fx = W + 200 - 420 * ease;
      game.assets.draw(ctx, 'samuraiIdle', sx, 350, { scale: 2, time: t });
      game.assets.draw(ctx, fish.def.sprite, fx, 350, { flipX: true, scale: 2.2, time: t });

      drawSlamText(ctx, fill(text.cutscene.round, { round }), W / 2, 70, t - 0.1, { size: 84 });
      if (t > 0.6) {
        // Ink swash under the names, painted on quickly.
        const p = Math.min(1, (t - 0.6) / 0.12);
        brush(ctx, 150, 196, 150 + 660 * p, 192, 74, 'rgba(26,10,10,0.88)', 7);
      }
      drawSlamText(ctx, fill(text.cutscene.versus, { fish: fish.name }), W / 2, 190, t - 0.6, { size: 50, color: '#fff' });
      if (t > 0.9) drawOutlinedText(ctx, fish.def.title, W / 2, 246, { size: 28, color: '#ffdd22' });

      if (t > 1.2) {
        bubble(ctx, line, 236, 304, 300, t - 1.2);
        bubble(ctx, taunt, 724, 304, 300, t - 1.2);
      }
      drawPrompts(ctx, game.input, [{ action: 'confirm', label: 'SKIP' }]);
    },
  };
}
