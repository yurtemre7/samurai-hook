// Screen effects for the fight scene: popups, particles, impact bursts,
// screen shake, flashes and ink splats. Real-time; never frozen by hit-stop.
import { drawOutlinedText } from '../../ui/hud';

export const POPUP_LIFE = 0.7;
const POPUP_RISE = 60;
const POPUP_POP = 0.08;
const SHAKE_DECAY = 7;
const BURST_LIFE = 0.18;
const INK_FADE = 1;
const INK_SPLATS = 7;
const WHITE_FLASH_ALPHA = 0.55;

interface Popup { text: string; x: number; y: number; t: number; size: number; color: string; life: number }
interface Particle {
  x: number; y: number; vx: number; vy: number; t: number; life: number;
  size: number; color: string; kind: 'scale' | 'spark' | 'drop'; spin: number;
}
interface Burst { x: number; y: number; t: number; r: number; color: string }
interface Splat { x: number; y: number; r: number; blobs: { dx: number; dy: number; r: number }[]; rot: number }

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export class Fx {
  popups: Popup[] = [];
  particles: Particle[] = [];
  bursts: Burst[] = [];
  splats: Splat[] = [];
  shake = 0;
  white = 0;
  red = 0;
  private shakeT = 0;

  update(dt: number): void {
    for (const p of this.popups) p.t += dt;
    this.popups = this.popups.filter((p) => p.t < p.life);
    for (const p of this.particles) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.kind === 'spark' ? 300 : 900) * dt;
      p.vx *= 1 - 2 * dt;
      p.spin += dt * 12;
    }
    this.particles = this.particles.filter((p) => p.t < p.life);
    for (const b of this.bursts) b.t += dt;
    this.bursts = this.bursts.filter((b) => b.t < BURST_LIFE);
    this.shake = Math.max(0, this.shake - this.shake * SHAKE_DECAY * dt - 4 * dt);
    this.white = Math.max(0, this.white - dt * 5);
    this.red = Math.max(0, this.red - dt * 2.5);
    this.shakeT += dt;
  }

  popup(text: string, x: number, y: number, size = 34, color = '#fff', life = POPUP_LIFE): void {
    this.popups.push({ text, x, y, t: 0, size, color, life });
  }

  addShake(px: number): void { this.shake = Math.max(this.shake, px); }

  /** Offset for the world layer this frame. */
  shakeOffset(): { x: number; y: number } {
    const s = this.shake;
    return { x: Math.sin(this.shakeT * 83) * s, y: Math.cos(this.shakeT * 67) * s * 0.7 };
  }

  burst(x: number, y: number, r: number, color: string): void {
    this.bursts.push({ x, y, t: 0, r, color });
  }

  scales(x: number, y: number, n: number, color: string, power = 1): void {
    for (let i = 0; i < n; i++) {
      const a = rand(-Math.PI, 0);
      const v = rand(160, 420) * power;
      this.particles.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: rand(0.35, 0.7),
        size: rand(4, 8), color: i % 3 === 0 ? '#ffffff' : color, kind: i % 2 ? 'scale' : 'spark', spin: rand(0, 6),
      });
    }
  }

  drops(x: number, y: number, n: number, dir: number): void {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x, y, vx: -dir * rand(40, 220), vy: rand(-320, -80), t: 0, life: rand(0.35, 0.6),
        size: rand(2.5, 5), color: '#bfe8ff', kind: 'drop', spin: 0,
      });
    }
  }

  ink(left: number, right: number, top: number, bottom: number): void {
    this.splats = [];
    for (let i = 0; i < INK_SPLATS; i++) {
      const r = rand(45, 95);
      const blobs = Array.from({ length: 9 }, () => {
        const a = rand(0, Math.PI * 2);
        const d = rand(r * 0.7, r * 1.5);
        return { dx: Math.cos(a) * d, dy: Math.sin(a) * d, r: rand(5, r * 0.32) };
      });
      this.splats.push({ x: rand(left, right), y: rand(top, bottom), r, blobs, rot: rand(0, 6) });
    }
  }

  drawWorld(ctx: CanvasRenderingContext2D): void {
    for (const b of this.bursts) {
      const k = b.t / BURST_LIFE;
      const r = b.r * (0.4 + k);
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = b.color;
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + b.x;
        const rr = i % 2 ? r * 0.38 : r;
        ctx.lineTo(b.x + Math.cos(a) * rr, b.y + Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 4 * (1 - k);
      ctx.beginPath();
      ctx.arc(b.x, b.y, r * 1.1, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    for (const p of this.particles) {
      const a = 1 - p.t / p.life;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(p.x, p.y);
      if (p.kind === 'spark') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-p.vx * 0.03, -p.vy * 0.03);
        ctx.stroke();
      } else if (p.kind === 'scale') {
        ctx.rotate(p.spin);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(0, -p.size); ctx.lineTo(p.size * 0.6, 0); ctx.lineTo(0, p.size); ctx.lineTo(-p.size * 0.6, 0);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  drawInk(ctx: CanvasRenderingContext2D, inkLeft: number): void {
    if (inkLeft <= 0 || !this.splats.length) return;
    ctx.save();
    ctx.globalAlpha = Math.min(1, inkLeft / INK_FADE) * 0.94;
    for (const s of this.splats) {
      ctx.fillStyle = '#07040c';
      ctx.beginPath();
      // Lumpy main blob.
      for (let i = 0; i <= 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const rr = s.r * (0.82 + 0.18 * Math.sin(a * 5 + s.rot));
        const x = s.x + Math.cos(a) * rr;
        const y = s.y + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.fill();
      for (const b of s.blobs) {
        ctx.beginPath();
        ctx.arc(s.x + b.dx, s.y + b.dy, b.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(120,90,160,0.35)';
      ctx.beginPath();
      ctx.ellipse(s.x - s.r * 0.3, s.y - s.r * 0.35, s.r * 0.25, s.r * 0.12, -0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawPopups(ctx: CanvasRenderingContext2D): void {
    for (const p of this.popups) {
      const k = p.t / p.life;
      const pop = p.t < POPUP_POP ? 1.6 - 0.6 * (p.t / POPUP_POP) : 1;
      const rise = POPUP_RISE * (1 - Math.pow(1 - k, 2));
      ctx.save();
      ctx.globalAlpha = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
      ctx.translate(p.x, p.y - rise);
      ctx.scale(pop, pop);
      ctx.rotate(-0.06);
      drawOutlinedText(ctx, p.text, 0, 0, { size: p.size, color: p.color });
      ctx.restore();
    }
  }

  drawFlashes(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (this.red > 0) {
      const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.65);
      g.addColorStop(0, 'rgba(200,0,0,0)');
      g.addColorStop(1, `rgba(220,0,0,${0.7 * this.red})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    if (this.white > 0) {
      ctx.fillStyle = `rgba(255,255,255,${WHITE_FLASH_ALPHA * this.white})`;
      ctx.fillRect(0, 0, w, h);
    }
  }
}
