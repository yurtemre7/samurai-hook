/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect, test, type Page } from '@playwright/test';
import { gameTime, openFight, openOcean, samurai, trackMoves, watchAudio, watchErrors } from './helpers';

const button = (page: Page, label: string) => page.locator('.sh-btn', { hasText: label }).first();

async function centre(page: Page, selector: string) {
  const b = (await page.locator(selector).first().boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/**
 * Quick one-finger swipe on the play area. Playwright's touchscreen can only tap, so this sends
 * real PointerEvents to the document, which is where the game listens for drags.
 */
async function swipe(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.evaluate(({ from, to }) => {
    const fire = (type: string, p: { x: number; y: number }) =>
      document.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: p.x, clientY: p.y, bubbles: true }));
    fire('pointerdown', from);
    fire('pointermove', { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 });
    fire('pointermove', to);
    fire('pointerup', to);
  }, { from, to });
}

test('loads with no console or page errors and the touch overlay visible', async ({ page }) => {
  const errors = watchErrors(page);
  await openOcean(page);
  await expect(page.locator('.sh-pad')).toBeVisible();
  expect(errors.list()).toEqual([]);
});

test('portrait shows the turn-sideways message and pauses the game; landscape hides it', async ({ page }) => {
  await openOcean(page);
  const msg = page.getByText('Turn your phone sideways');
  await expect(msg).toBeHidden();
  const vp = page.viewportSize()!;
  await page.setViewportSize({ width: Math.min(vp.width, vp.height), height: Math.max(vp.width, vp.height) });
  await expect(msg).toBeVisible();
  await page.waitForTimeout(150); // let any in-flight frame finish
  const t0 = await gameTime(page);
  await page.waitForTimeout(500);
  expect(await gameTime(page)).toBe(t0);
  await page.setViewportSize(vp);
  await expect(msg).toBeHidden();
  await page.waitForFunction((t) => (window as any).game.time > t + 0.2, t0);
});

test('ocean shows REEL IN and SHOP; touching the water casts', async ({ page }) => {
  await openOcean(page);
  await expect(button(page, 'REEL IN')).toBeVisible();
  await expect(button(page, 'SHOP')).toBeVisible();
  const c = await centre(page, '#game');
  await page.touchscreen.tap(c.x, c.y);
  await page.waitForFunction(() => (window as any).__ocean.mode === 'sinking');
});

test.describe('fight', () => {
  test.beforeEach(async ({ page }) => { await openFight(page); });

  test('shows QUICK/HEAVY/BLOCK/DASH and hides CONFIRM and SHOP', async ({ page }) => {
    for (const l of ['QUICK', 'HEAVY', 'BLOCK', 'DASH']) await expect(button(page, l)).toBeVisible();
    for (const l of ['CONFIRM', 'SHOP']) await expect(button(page, l)).toBeHidden();
  });

  test('holding the left pad cell moves the samurai left', async ({ page }) => {
    const x0 = (await samurai(page)).x;
    const pad = (await page.locator('.sh-pad').boundingBox())!;
    const pt = { x: pad.x + pad.width / 6, y: pad.y + pad.height / 2 }; // the ◀ cell
    const fire = (type: string) => page.evaluate(({ type, pt }) =>
      document.querySelector('.sh-pad')!.dispatchEvent(new PointerEvent(type, { pointerId: 3, pointerType: 'touch', isPrimary: true, clientX: pt.x, clientY: pt.y, bubbles: true })), { type, pt });
    await fire('pointerdown');
    await page.waitForFunction((x) => (window as any).__fight.state.samurai.x < x - 20, x0);
    await fire('pointerup');
  });

  test('quick horizontal swipe dashes', async ({ page }) => {
    await trackMoves(page);
    const c = await centre(page, '#game');
    await swipe(page, c, { x: c.x + 80, y: c.y });
    await page.waitForFunction(() => (window as any).__moves.includes('dash'));
  });

  test('quick upward swipe jumps', async ({ page }) => {
    const c = await centre(page, '#game');
    await swipe(page, c, { x: c.x, y: c.y - 80 });
    await page.waitForFunction(() => (window as any).__fight.state.samurai.y > 5);
  });

  test('DASH button dashes', async ({ page }) => {
    await trackMoves(page);
    const b = await centre(page, '.sh-btn[aria-label="DASH"]');
    await page.touchscreen.tap(b.x, b.y);
    await page.waitForFunction(() => (window as any).__moves.includes('dash'));
  });
});

test('audio: announcer and fight music use the format the browser chose, and load', async ({ page }) => {
  const audio = watchAudio(page);
  await openFight(page);
  await page.touchscreen.tap(10, 10); // first gesture unlocks audio, so the fight music is requested
  const oggOk = await page.evaluate(() => !!document.createElement('audio').canPlayType('audio/ogg; codecs="vorbis"'));
  const [ext, other] = oggOk ? ['ogg', 'm4a'] : ['m4a', 'ogg'];
  await page.waitForFunction((e) => performance.getEntriesByType('resource').some((r) => r.name.includes(`music/fight.${e}`)), ext);
  const voice = audio.filter((a) => a.url.includes('/voice/'));
  const music = audio.filter((a) => a.url.includes('/music/fight'));
  expect(voice.length).toBeGreaterThan(0);
  expect(music.length).toBeGreaterThan(0);
  for (const a of [...voice, ...music]) {
    expect(a.url.endsWith(`.${other}`)).toBe(false);
    expect([200, 206]).toContain(a.status); // 206: media elements use range requests
  }
  expect(music.every((a) => a.url.endsWith(`.${ext}`))).toBe(true);
});

test('audio: the iPhone format (?audio=aac) loads every announcer clip and the fight music as .m4a', async ({ page }) => {
  // Older iPhones cannot play Ogg; this forces that path in every browser so it is always exercised.
  const audio = watchAudio(page);
  await openFight(page, '&audio=aac');
  await page.touchscreen.tap(10, 10); // unlock: starts the music and decodes all clips
  // Decoding runs in the background after the first touch: wait until every clip and effect is ready.
  await page.waitForFunction(() => {
    const m = /voice (\d+)\/(\d+) sfx (\d+)\/(\d+) music playing/.exec((window as any).game.audio.debugInfo?.() ?? '');
    return !!m && m[1] === m[2] && m[3] === m[4];
  });
  const info = await page.evaluate(() => (window as any).game.audio.debugInfo());
  expect(info).toContain('audio aac');
  const sfx = info.match(/sfx (\d+)\/(\d+)/);
  expect(sfx && sfx[1]).toBe(sfx && sfx[2]); // every effect decoded
  const used = audio.filter((a) => /\/(voice|music|sfx)\//.test(a.url));
  expect(used.some((a) => a.url.includes('music/fight.m4a'))).toBe(true);
  for (const a of used) {
    expect(a.url.endsWith('.ogg')).toBe(false);
    expect([200, 206]).toContain(a.status);
  }
});
