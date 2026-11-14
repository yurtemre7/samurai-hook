import type { Assets, DrawOpts, SpriteDef } from '../types';

/** Loads sprite images from the manifest and draws them, or a placeholder if missing. */
export function createAssets(defs: Record<string, SpriteDef>): Assets {
  const images = new Map<string, HTMLImageElement>();

  function load(): Promise<void> {
    const jobs = Object.entries(defs)
      .filter(([, d]) => d.src)
      .map(([id, d]) => new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => { images.set(id, img); resolve(); };
        img.onerror = () => { console.warn(`[assets] missing ${d.src}; using placeholder for "${id}"`); resolve(); };
        img.src = d.src!.startsWith('/') ? d.src! : `/${d.src}`;
      }));
    return Promise.all(jobs).then(() => undefined);
  }

  function draw(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, opts: DrawOpts = {}): void {
    const def = defs[id];
    if (!def) {
      drawPlaceholder(ctx, { src: null, w: 48, h: 48, placeholder: { shape: 'box', color: '#f0f', label: id } });
      return;
    }
    const scale = opts.scale ?? 1;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    if (opts.rotation) ctx.rotate(opts.rotation);
    ctx.globalAlpha *= opts.alpha ?? 1;
    const img = images.get(id);
    // Unflipped always faces right; art that natively faces left is mirrored.
    const nativeLeft = (def.facing ?? 'right') === 'left';
    const mirror = (opts.flipX ?? false) !== (img ? nativeLeft : false);
    ctx.scale(mirror ? -scale : scale, scale);
    if (img) {
      const frames = def.frames ?? 1;
      const fw = img.width / frames;
      const frame = Math.floor((opts.time ?? 0) * (def.fps ?? 8)) % frames;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, frame * fw, 0, fw, img.height, -def.w / 2, -def.h / 2, def.w, def.h);
    } else {
      drawPlaceholder(ctx, def, opts.time ?? 0);
      if (def.placeholder.label) {
        // Keep the label readable when mirrored.
        ctx.scale(mirror ? -1 : 1, 1);
        ctx.fillStyle = '#000';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(def.placeholder.label, 0, 0);
        ctx.scale(mirror ? -1 : 1, 1);
      }
    }
    if (opts.tint) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = opts.tint;
      ctx.fillRect(-def.w / 2, -def.h / 2, def.w, def.h);
    }
    ctx.restore();
  }

  return { load, has: (id) => images.has(id), draw };
}

/** Simple code-drawn stand-ins, centred on the origin, facing right. */
function drawPlaceholder(ctx: CanvasRenderingContext2D, def: SpriteDef, time = 0): void {
  const { w, h } = def;
  const { shape, color } = def.placeholder;
  ctx.fillStyle = color;
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 2;
  switch (shape) {
    case 'fish': {
      ctx.beginPath();
      ctx.ellipse(w * 0.08, 0, w * 0.38, h * 0.42, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-w * 0.26, 0); ctx.lineTo(-w * 0.5, -h * 0.4); ctx.lineTo(-w * 0.5, h * 0.4);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(w * 0.3, -h * 0.12, Math.max(3, h * 0.1), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(w * 0.32, -h * 0.12, Math.max(1.5, h * 0.05), 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'samurai': {
      ctx.fillRect(-w * 0.22, -h * 0.2, w * 0.44, h * 0.7); // robe
      ctx.strokeRect(-w * 0.22, -h * 0.2, w * 0.44, h * 0.7);
      ctx.fillStyle = '#f1c9a5';
      ctx.beginPath(); ctx.arc(0, -h * 0.3, w * 0.16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#d9b36c'; // straw hat
      ctx.beginPath(); ctx.moveTo(-w * 0.4, -h * 0.34); ctx.lineTo(0, -h * 0.5); ctx.lineTo(w * 0.4, -h * 0.34);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#ecf0f1'; ctx.lineWidth = 4; // katana
      ctx.beginPath(); ctx.moveTo(w * 0.2, h * 0.05); ctx.lineTo(w * 0.5, -h * 0.25); ctx.stroke();
      break;
    }
    case 'fisher': {
      // Meditating in the lotus position under a wide straw hat, breathing slowly.
      const breath = Math.sin(time * 1.6);
      ctx.lineWidth = 2;
      ctx.save(); // calm aura
      ctx.globalAlpha *= 0.18 + 0.08 * breath;
      ctx.fillStyle = '#fff6c8';
      ctx.beginPath(); ctx.arc(0, -h * 0.05, w * (0.62 + 0.04 * breath), 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = color;
      ctx.beginPath(); // crossed legs
      ctx.ellipse(0, h * 0.38, w * 0.44, h * 0.11, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      const lift = -breath * h * 0.012; // chest rises and falls
      ctx.beginPath(); // robe
      ctx.moveTo(-w * 0.27, h * 0.36); ctx.lineTo(-w * 0.17, -h * 0.1 + lift);
      ctx.lineTo(w * 0.17, -h * 0.1 + lift); ctx.lineTo(w * 0.27, h * 0.36);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#c0392b'; // sash
      ctx.fillRect(-w * 0.22, h * 0.14, w * 0.44, h * 0.06);
      ctx.fillStyle = '#f1c9a5'; // hands resting on the knees, palms up
      for (const side of [-1, 1]) {
        ctx.beginPath(); ctx.arc(side * w * 0.33, h * 0.3, w * 0.06, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(0, -h * 0.2 + lift, w * 0.13, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); // face
      ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5; // closed eyes
      for (const side of [-1, 1]) {
        ctx.beginPath(); ctx.arc(side * w * 0.055, -h * 0.2 + lift, w * 0.035, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      }
      ctx.lineWidth = 2;
      ctx.fillStyle = '#d9b36c'; // straw hat
      ctx.beginPath(); ctx.moveTo(-w * 0.48, -h * 0.23 + lift); ctx.lineTo(0, -h * 0.5 + lift); ctx.lineTo(w * 0.48, -h * 0.23 + lift);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    }
    case 'boat': {
      ctx.beginPath();
      ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(w / 2, -h / 2); ctx.lineTo(w * 0.36, h / 2); ctx.lineTo(-w * 0.36, h / 2);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    }
    case 'hook': {
      ctx.strokeStyle = color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, -h / 2); ctx.lineTo(0, h * 0.2);
      ctx.arc(-w * 0.25, h * 0.2, w * 0.25, 0, Math.PI); ctx.stroke();
      break;
    }
    case 'nigiri': {
      ctx.fillStyle = '#fafafa';
      ctx.beginPath(); ctx.ellipse(0, h * 0.15, w * 0.42, h * 0.3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.ellipse(0, -h * 0.12, w * 0.48, h * 0.24, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      break;
    }
    default:
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
  }
}
