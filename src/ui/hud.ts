// Pure canvas helpers for the fight-game look. No state, no DOM beyond the 2D context.

const FONT = "Impact, 'Arial Black', sans-serif";

export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export interface TextOpts { size?: number; color?: string; outline?: string; align?: CanvasTextAlign; font?: string }

export function drawOutlinedText(
  ctx: CanvasRenderingContext2D, text: string, x: number, y: number, opts: TextOpts = {},
): void {
  const size = opts.size ?? 32;
  ctx.save();
  ctx.font = `${size}px ${opts.font ?? FONT}`;
  ctx.textAlign = opts.align ?? 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size / 5);
  ctx.strokeStyle = opts.outline ?? '#1a0a0a';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = opts.color ?? '#fff';
  ctx.fillText(text, x, y);
  ctx.restore();
}

const SLAM_TIME = 0.15;

export function drawSlamText(
  ctx: CanvasRenderingContext2D, text: string, x: number, y: number, t: number,
  opts: { size?: number; color?: string } = {},
): void {
  if (t < 0) return;
  const k = Math.min(1, t / SLAM_TIME);
  const ease = 1 - Math.pow(1 - k, 3);
  const scale = 3 - 2 * ease;
  const shake = k < 1 ? 0 : Math.max(0, 1 - (t - SLAM_TIME) / 0.25) * 4;
  const dx = shake ? Math.sin(t * 90) * shake : 0;
  const dy = shake ? Math.cos(t * 70) * shake : 0;
  ctx.save();
  ctx.globalAlpha *= Math.min(1, k * 2);
  ctx.translate(x + dx, y + dy);
  ctx.scale(scale, scale);
  drawOutlinedText(ctx, text, 0, 0, { size: opts.size ?? 72, color: opts.color ?? '#ffdd22' });
  ctx.restore();
}

export function drawHealthBar(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frac: number,
  opts: { label: string; sub?: string; align: 'left' | 'right'; color?: string },
): void {
  const f = Math.max(0, Math.min(1, frac));
  const left = opts.align === 'left';
  ctx.save();
  ctx.fillStyle = '#1a0a0a';
  ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
  ctx.fillStyle = '#5a1010';
  ctx.fillRect(x, y, w, h);
  const color = opts.color ?? (f > 0.3 ? '#ffd21f' : '#ff3b2f');
  const fw = w * f;
  const fx = left ? x : x + w - fw;
  ctx.fillStyle = color;
  ctx.fillRect(fx, y, fw, h);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(fx, y, fw, h * 0.35);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 4, y - 4, w + 8, h + 8);
  ctx.restore();
  const tx = left ? x : x + w;
  const align: CanvasTextAlign = left ? 'left' : 'right';
  drawOutlinedText(ctx, opts.label, tx, y + h + 20, { size: 22, align });
  if (opts.sub) drawOutlinedText(ctx, opts.sub, tx, y + h + 42, { size: 14, align, color: '#ffdd22' });
}

export function drawTimer(ctx: CanvasRenderingContext2D, x: number, y: number, seconds: number): void {
  const s = Math.max(0, Math.ceil(seconds));
  const low = seconds <= 5;
  const pulse = low ? 1 + 0.1 * Math.abs(Math.sin(seconds * Math.PI * 2)) : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(pulse, pulse);
  drawOutlinedText(ctx, String(s), 0, 0, { size: 56, color: low ? '#ff3b2f' : '#fff' });
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.save();
  roundRect(ctx, x, y, w, h, 10);
  ctx.fillStyle = 'rgba(12,10,24,0.88)';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#ffdd22';
  ctx.stroke();
  ctx.restore();
}
