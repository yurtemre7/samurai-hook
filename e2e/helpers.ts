/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Page } from '@playwright/test';

/** Collects console errors and uncaught page errors; read `.list()` at the end of a test. */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  return { list: () => errors };
}

/** Records every move the samurai enters (the sim exposes only the current one, so sample each frame). */
export async function trackMoves(page: Page) {
  await page.evaluate(() => {
    const w = window as any;
    w.__moves = [];
    const tick = () => {
      const m = w.__fight.state.samurai.move;
      if (w.__moves[w.__moves.length - 1] !== m) w.__moves.push(m);
      requestAnimationFrame(tick);
    };
    tick();
  });
}

export async function openFight(page: Page, extra = '') {
  await page.goto(`/?scene=fight&fish=sardine&tier=0${extra}`);
  await page.waitForFunction(() => (window as any).__fight?.state.phase === 'fighting');
}

export async function openOcean(page: Page) {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__ocean?.mode === 'idle');
}

export const samurai = (page: Page) =>
  page.evaluate(() => {
    const s = (window as any).__fight.state.samurai;
    return { x: s.x as number, y: s.y as number, move: s.move as string };
  });

export const gameTime = (page: Page) => page.evaluate(() => (window as any).game.time as number);

/** Audio responses seen so far (url + status). */
export function watchAudio(page: Page) {
  const seen: { url: string; status: number }[] = [];
  page.on('response', (r) => {
    if (/\.(ogg|m4a|mp3|wav)(\?|$)/.test(r.url())) seen.push({ url: r.url(), status: r.status() });
  });
  return seen;
}
