import { expect, test, type Page } from '@playwright/test';
import { HERO_TOUR_TYPE } from '../../src/lib/videos';
import en from '../../src/messages/en.json';

// The home hero's film (components/home/HeroVideo.tsx, docs/PERFORMANCE.md "Video"): the whole virtual tour as a silent
// background, served from the site itself (no video service), in twelve 30-second parts that play one after the other.
// It joins the photo only on a wide screen with a good connection, never under reduced motion, plays only while the
// hero is on screen, and falls back to the 16 s loop. Nothing leaves the local server in these tests.

const LOOP = /\/videos\/hero-loop\.(webm|mp4)$/;
const part = (n: number) => `/videos/hero-tour-${String(n).padStart(2, '0')}.mp4`;

async function localOnly(page: Page) {
  await page.route(
    (url) => !['localhost', '127.0.0.1'].includes(url.hostname),
    (route) => route.abort(),
  );
}

/** Stands in for navigator.connection (Chromium's Network Information API) before the page's scripts run. */
async function connection(page: Page, info: { effectiveType: string; saveData: boolean }) {
  await page.addInitScript((value) => {
    const fake = Object.assign(new EventTarget(), value);
    Object.defineProperty(Navigator.prototype, 'connection', { configurable: true, get: () => fake });
  }, info);
}

const box = (page: Page) => page.locator('#home-hero [data-film]');
/** The film on screen: the front part of the tour, or the loop. */
const film = (page: Page) => page.locator('#home-hero [data-film="tour"] video[data-front="true"], #home-hero [data-film="loop"] video');
/** Whether this browser plays the tour's codec (H.264 High), as HeroVideo asks it. */
const canPlayMp4 = (page: Page) => page.evaluate((type) => document.createElement('video').canPlayType(type) !== '', HERO_TOUR_TYPE);
const playing = (page: Page) => film(page).evaluate((v: HTMLVideoElement) => !v.paused && v.currentTime > 0).catch(() => false);
const paused = (page: Page) => film(page).evaluate((v: HTMLVideoElement) => v.paused);

test.describe('the home hero film', () => {
  test.skip(({ isMobile }) => isMobile, 'a phone never gets a film (performance.spec.ts checks it)');

  test('the tour joins after the page has loaded, muted and inline, and fetches only the part it plays', async ({ page }) => {
    await localOnly(page);
    const requested: string[] = [];
    page.on('request', (request) => request.url().includes('/videos/') && requested.push(new URL(request.url()).pathname));
    await page.goto('/en', { waitUntil: 'load' });
    // The photo is the first thing painted; the film is not in the server HTML.
    expect(await (await page.request.get('/en')).text()).not.toContain('<video');
    await expect(box(page)).toHaveCount(1, { timeout: 10_000 });
    for (const video of await page.locator('#home-hero video').all()) {
      await expect(video).toHaveAttribute('preload', /none|auto/);
      expect(await video.evaluate((v: HTMLVideoElement) => v.muted && v.playsInline)).toBe(true);
    }
    await expect.poll(() => playing(page), { timeout: 15_000 }).toBe(true);
    if (await canPlayMp4(page)) {
      await expect(box(page)).toHaveAttribute('data-film', 'tour');
      expect(await film(page).getAttribute('src')).toBe(part(0));
      // A few seconds in, only the first part has been asked for (the next one loads near the end of this one).
      await page.waitForTimeout(3000);
      expect([...new Set(requested)]).toEqual([part(0)]);
    } else {
      // Playwright's own Chromium has no H.264: it gets the AV1 loop instead.
      await expect(box(page)).toHaveAttribute('data-film', 'loop');
      expect(await film(page).getAttribute('src')).toMatch(LOOP);
    }
  });

  test('plays the parts one after the other, and starts again after the last', async ({ page }) => {
    await localOnly(page);
    await page.goto('/en', { waitUntil: 'load' });
    test.skip(!(await canPlayMp4(page)), 'this browser plays the loop, not the tour (no H.264)');
    await expect.poll(() => playing(page), { timeout: 15_000 }).toBe(true);
    // Waits for the part on screen to know its length (just after a swap it may not yet), then jumps to its last half second.
    const jumpToEnd = async () => {
      await expect.poll(() => film(page).evaluate((v: HTMLVideoElement) => v.duration > 0), { timeout: 15_000 }).toBe(true);
      await film(page).evaluate((v: HTMLVideoElement) => {
        v.currentTime = Math.max(0, v.duration - 0.5);
      });
    };

    await jumpToEnd();
    await expect.poll(() => film(page).getAttribute('src'), { timeout: 15_000 }).toBe(part(1));
    await expect.poll(() => playing(page), { timeout: 15_000 }).toBe(true);
    // Only one element is shown at a time.
    await expect(page.locator('#home-hero video[data-front="true"]')).toHaveCount(1);

    for (let n = 2; n <= 11; n++) {
      await jumpToEnd();
      await expect.poll(() => film(page).getAttribute('src'), { timeout: 15_000 }).toBe(part(n));
    }
    await jumpToEnd();
    await expect.poll(() => film(page).getAttribute('src'), { timeout: 15_000 }).toBe(part(0));
  });

  test('pauses with the pause button and when the hero leaves the screen, and plays again', async ({ page }) => {
    await localOnly(page);
    await page.goto('/en', { waitUntil: 'load' });
    await expect.poll(() => playing(page), { timeout: 15_000 }).toBe(true);

    await page.getByRole('button', { name: en.ux.motion.pause }).click();
    await expect.poll(() => paused(page)).toBe(true);
    await page.getByRole('button', { name: en.ux.motion.play }).click();
    await expect.poll(() => paused(page)).toBe(false);

    await page.locator('#home-verse').scrollIntoViewIfNeeded();
    await expect.poll(() => paused(page)).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(() => paused(page)).toBe(false);
  });

  test('falls back to the short loop when the tour cannot be loaded', async ({ page }) => {
    await localOnly(page);
    await page.route(/\/videos\/hero-tour-\d+\.mp4$/, (route) => route.abort());
    await page.goto('/en', { waitUntil: 'load' });
    test.skip(!(await canPlayMp4(page)), 'this browser never asks for the tour (no H.264)');
    await expect(box(page)).toHaveAttribute('data-film', 'loop', { timeout: 15_000 });
    expect(await film(page).getAttribute('src')).toMatch(LOOP);
    await expect.poll(() => playing(page), { timeout: 15_000 }).toBe(true);
  });

  test('is not started on a slow connection, when the visitor saves data, or under reduced motion', async ({ browser }) => {
    test.setTimeout(90_000); // three page loads, each waiting out the idle delay
    for (const setup of [
      { info: { effectiveType: '3g', saveData: false } },
      { info: { effectiveType: '4g', saveData: true } },
      { reducedMotion: 'reduce' as const },
    ]) {
      const context = await browser.newContext({ viewport: { width: 1366, height: 800 }, reducedMotion: setup.reducedMotion ?? 'no-preference' });
      const page = await context.newPage();
      await localOnly(page);
      if (setup.info) await connection(page, setup.info);
      const requested: string[] = [];
      page.on('request', (request) => request.url().includes('/videos/') && requested.push(request.url()));
      await page.goto('/en', { waitUntil: 'load' });
      await page.waitForTimeout(3500); // longer than the idle wait before the film would mount
      await expect(page.locator('#home-hero video'), JSON.stringify(setup)).toHaveCount(0);
      expect(requested, JSON.stringify(setup)).toEqual([]);
      await context.close();
    }
  });

  test('a good connection that the browser reports (4g, no data saving) gets the film', async ({ page }) => {
    await localOnly(page);
    await connection(page, { effectiveType: '4g', saveData: false });
    await page.goto('/en', { waitUntil: 'load' });
    await expect(box(page)).toHaveCount(1, { timeout: 10_000 });
  });
});
