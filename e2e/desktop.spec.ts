/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect, test } from '@playwright/test';
import { gameTime, openFight, openOcean, samurai, trackMoves, watchAudio, watchErrors } from './helpers';

test('loads the ocean with no console or page errors', async ({ page }) => {
  const errors = watchErrors(page);
  await openOcean(page);
  const t = await gameTime(page);
  await page.waitForFunction((t0) => (window as any).game.time > t0 + 0.3, t);
  expect(errors.list()).toEqual([]);
});

test('ocean: Space drops the hook', async ({ page }) => {
  await openOcean(page);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => (window as any).__ocean.mode === 'sinking');
});

test.describe('fight controls', () => {
  test.beforeEach(async ({ page }) => { await openFight(page); });

  test('hold d moves right, hold a moves left', async ({ page }) => {
    const x0 = (await samurai(page)).x;
    await page.keyboard.down('d');
    await page.waitForTimeout(500);
    await page.keyboard.up('d');
    const x1 = (await samurai(page)).x;
    expect(x1).toBeGreaterThan(x0 + 20);
    await page.keyboard.down('a');
    await page.waitForTimeout(500);
    await page.keyboard.up('a');
    expect((await samurai(page)).x).toBeLessThan(x1 - 20);
  });

  test('ArrowLeft moves left', async ({ page }) => {
    const x0 = (await samurai(page)).x;
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(500);
    await page.keyboard.up('ArrowLeft');
    expect((await samurai(page)).x).toBeLessThan(x0 - 20);
  });

  test('j starts a quick slash', async ({ page }) => {
    await trackMoves(page);
    await page.keyboard.press('j');
    await page.waitForFunction(() => (window as any).__moves.includes('quick'));
  });

  test('w jumps', async ({ page }) => {
    await page.keyboard.press('w');
    await page.waitForFunction(() => (window as any).__fight.state.samurai.y > 5);
  });

  test('holding s crouches', async ({ page }) => {
    await page.keyboard.down('s');
    await page.waitForFunction(() => (window as any).__fight.state.samurai.move === 'crouch');
    await page.keyboard.up('s');
    await page.waitForFunction(() => (window as any).__fight.state.samurai.move !== 'crouch');
  });
});

test('every audio file the game requests returns 200', async ({ page }) => {
  const audio = watchAudio(page);
  await openFight(page);
  await page.keyboard.press('d'); // first gesture unlocks audio, so the fight music is requested
  await page.waitForFunction(() => performance.getEntriesByType('resource').some((r) => /music\/fight\./.test(r.name)));
  expect(audio.length).toBeGreaterThan(3);
  expect(audio.filter((a) => a.status !== 200 && a.status !== 206)).toEqual([]);
});
