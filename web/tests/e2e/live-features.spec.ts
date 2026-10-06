import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import ar from '../../src/messages/ar.json';
import en from '../../src/messages/en.json';
import he from '../../src/messages/he.json';

// The live features around the player (docs/LIVE.md): the red dot on the header's Live link, the "We are live now"
// window, the countdown to the next announced broadcast and the recordings of past broadcasts on /live. Every request
// the browser makes to the live routes is answered here (nothing reaches the real API) and Cloudflare Stream's host is
// answered with stand-ins (nothing reaches Cloudflare). The page's clock is mocked where time matters.

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];
const CORS = { 'access-control-allow-origin': '*' };
const PLAYER = (n: string) => `https://customer-e2e0test.cloudflarestream.com/${n.repeat(32)}/iframe`;
const THUMB = (n: string) => `https://customer-e2e0test.cloudflarestream.com/${n.repeat(32)}/thumbnails/thumbnail.jpg`;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const SESSION_A = 'a'.repeat(24);
const SESSION_B = 'b'.repeat(24);
const alert = en.ux.liveAlert;
const next = en.communityPage.live.next;

type Status = { live: false } | { live: true; id?: string; title: string; startedAt: string; playbackUrl: string };
type Api = { status: Status; schedule: unknown[]; recordings: unknown[]; statusRequests: number; scheduleRequests: number; recordingRequests: number };

const live = (id = SESSION_A, title = 'Evening prayer'): Status => ({
  live: true,
  id,
  title,
  startedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
  playbackUrl: PLAYER('a'),
});

async function fakeLiveApi(page: Page, init: Partial<Api> = {}): Promise<Api> {
  const api: Api = { status: { live: false }, schedule: [], recordings: [], statusRequests: 0, scheduleRequests: 0, recordingRequests: 0, ...init };
  const answer = (body: unknown) => ({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  await page.route('**/live/status', (route) => {
    api.statusRequests += 1;
    return route.fulfill(answer(api.status));
  });
  await page.route('**/live/schedule', (route) => {
    api.scheduleRequests += 1;
    return route.fulfill(answer({ timeZone: 'Asia/Jerusalem', items: api.schedule }));
  });
  await page.route('**/live/recordings', (route) => {
    api.recordingRequests += 1;
    return route.fulfill(answer({ items: api.recordings }));
  });
  await page.route(/^https:\/\/customer-[a-z0-9]+\.cloudflarestream\.com\//, (route) =>
    route.request().url().endsWith('.jpg')
      ? route.fulfill({ status: 200, headers: { 'content-type': 'image/png' }, body: PNG })
      : route.fulfill({ status: 200, headers: { 'content-type': 'text/html' }, body: '<!doctype html><html lang="en"><title>Player</title><body>fake player</body></html>' }),
  );
  return api;
}

/** The window was already shown for these broadcasts (so it does not cover the page in tests of other things). */
async function alreadySeen(page: Page, ids: string[]) {
  await page.addInitScript((seen) => localStorage.setItem('nhc.liveAlert.v1', JSON.stringify(seen)), ids);
}

const isPhone = () => test.info().project.name === 'mobile';

/**
 * Moves the page's clock on until the window is open, in small steps with a pause after each: a busy machine may still
 * be hydrating the page when the clock first moves (the window's 4 seconds on the page start only then), and a clock
 * that jumps faster than an answer arrives makes the poller give up on that question (10 s) and wait longer.
 */
async function untilOpen(page: Page) {
  const window = page.getByTestId('live-alert');
  for (let i = 0; i < 70 && !(await window.isVisible()); i += 1) {
    await page.clock.fastForward(2_000);
    await page.waitForTimeout(100);
  }
  await expect(window).toBeVisible();
}

/** Waits for the animations that end (the window's fade-in), so axe reads the colours at rest. */
async function settled(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
}

/** axe on one part of the page, with the elements behind each finding (so a failure says where). */
async function axeOn(page: Page, ...selectors: string[]) {
  await settled(page);
  let builder = new AxeBuilder({ page }).withTags(TAGS);
  for (const selector of selectors) builder = builder.include(selector);
  const result = await builder.analyze();
  return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => `${n.target.join(' ')} ${n.failureSummary ?? ''}`).join(' | ')}`);
}

/** The header's Live link, opening the phone's drawer first. */
async function liveLink(page: Page, locale = 'en') {
  const menu = page.locator('button[aria-controls="main-nav"]');
  if (await menu.isVisible()) {
    if ((await menu.getAttribute('aria-expanded')) !== 'true') await menu.click();
  }
  return page.locator(`#main-nav a[href="/${locale}/live"]`);
}

test.describe('the red dot on the Live link', () => {
  test('appears and disappears without a reload while a broadcast is live (desktop bar and phone drawer)', async ({ page }) => {
    const api = await fakeLiveApi(page);
    await alreadySeen(page, [SESSION_A]);
    await page.clock.install();
    await page.goto('/en/sites');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByTestId('nav-live-now')).toHaveCount(0);

    api.status = live();
    await page.clock.fastForward(31_000);
    await expect.poll(() => api.statusRequests).toBeGreaterThanOrEqual(1);
    const link = await liveLink(page);
    await expect(link.getByTestId('nav-live-now')).toBeVisible();
    await expect(link).toHaveAccessibleName(`${en.site.nav.live} ${en.site.nav.liveNow}`);
    const colour = await link.getByTestId('nav-live-now').evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(colour).toBe('rgb(255, 77, 79)'); // --live

    api.status = { live: false };
    await page.clock.fastForward(31_000);
    await expect(page.getByTestId('nav-live-now')).toHaveCount(0);
  });

  test('polls every 30 seconds on an ordinary page, never while the tab is hidden', async ({ page }) => {
    const api = await fakeLiveApi(page);
    await page.clock.install();
    await page.goto('/en/about');
    await page.clock.fastForward(31_000);
    await expect.poll(() => api.statusRequests).toBeGreaterThanOrEqual(1);
    const before = api.statusRequests;
    await page.clock.runFor(29_000);
    await page.waitForTimeout(150);
    expect(api.statusRequests).toBe(before);
    await page.clock.runFor(1_000);
    await expect.poll(() => api.statusRequests).toBe(before + 1);

    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const hidden = api.statusRequests;
    await page.clock.runFor(5 * 60_000);
    await page.waitForTimeout(150);
    expect(api.statusRequests).toBe(hidden);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect.poll(() => api.statusRequests).toBe(hidden + 1); // at once when shown again
  });

  test('does not pulse for visitors who asked for less motion', async ({ page }) => {
    const api = await fakeLiveApi(page);
    await alreadySeen(page, [SESSION_A]);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.clock.install();
    await page.goto('/en/shop');
    api.status = live();
    await page.clock.fastForward(31_000);
    const dot = page.getByTestId('nav-live-now');
    await expect(dot).toHaveCount(1);
    expect(await dot.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  });

  test('does not keep pulsing with the panel’s "Stop animations" either', async ({ page }) => {
    const api = await fakeLiveApi(page);
    await alreadySeen(page, [SESSION_A]);
    await page.addInitScript(() => localStorage.setItem('nhc.a11y.v1', JSON.stringify({ motion: true })));
    await page.clock.install();
    await page.goto('/en/shop');
    api.status = live();
    await page.clock.fastForward(31_000);
    const dot = page.getByTestId('nav-live-now');
    await expect(dot).toHaveCount(1);
    const style = await dot.evaluate((el) => ({ duration: parseFloat(getComputedStyle(el).animationDuration), count: getComputedStyle(el).animationIterationCount }));
    expect(style.duration).toBeLessThan(0.001);
    expect(style.count).toBe('1');
  });
});

test.describe('"We are live now"', () => {
  const dialog = (page: Page) => page.getByTestId('live-alert');

  test('opens once per broadcast after a few seconds, with the keyboard inside it; not again after a reload; again for a new one', async ({ page }) => {
    const api = await fakeLiveApi(page, { status: live() });
    await page.clock.install();
    await page.goto('/en/sites');
    const opener = page.locator('footer a').first();
    await opener.focus();
    await untilOpen(page);
    await expect(dialog(page).getByRole('heading', { level: 2 })).toHaveText(alert.title);
    await expect(dialog(page).getByText('Evening prayer')).toHaveAttribute('dir', 'auto');
    const watch = dialog(page).getByRole('link', { name: alert.watch });
    await expect(watch).toBeFocused();
    await expect(watch).toHaveClass(/ui-btn--gold/);
    await expect(dialog(page).getByRole('button', { name: alert.later })).toHaveClass(/ui-btn--ghost/);

    // Tab stays inside the window (the page behind is inert)
    for (let i = 0; i < 4; i += 1) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(() => {
        const active = document.activeElement;
        return !active || active === document.body || !!active.closest('[data-testid="live-alert"]');
      });
      expect(inside).toBe(true);
    }
    for (const box of [watch, dialog(page).getByRole('button', { name: alert.later })]) {
      const size = await box.boundingBox();
      expect(size?.height ?? 0).toBeGreaterThanOrEqual(44);
    }

    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeHidden();
    await expect(opener).toBeFocused(); // the focus is back where it was

    const seenBefore = api.statusRequests;
    await page.reload();
    for (let i = 0; i < 20; i += 1) {
      await page.clock.fastForward(2_000);
      await page.waitForTimeout(100);
    }
    await expect.poll(() => api.statusRequests).toBeGreaterThan(seenBefore);
    await expect(dialog(page)).toBeHidden(); // 40 s on the page, the broadcast still live: not shown again

    api.status = live(SESSION_B, 'Morning prayer');
    await untilOpen(page);
    await expect(dialog(page).getByText('Morning prayer')).toBeVisible();
  });

  test('a click on the dimmed page closes it; "Watch now" goes to the live page', async ({ page }) => {
    await fakeLiveApi(page, { status: live() });
    await page.clock.install();
    await page.goto('/en/tour');
    await untilOpen(page);
    await page.mouse.click(4, 4);
    await expect(dialog(page)).toBeHidden();

    await page.evaluate(() => localStorage.removeItem('nhc.liveAlert.v1'));
    await page.reload();
    await untilOpen(page);
    await dialog(page).getByRole('link', { name: alert.watch }).click();
    await expect(page).toHaveURL(/\/en\/live$/);
    await expect(dialog(page)).toBeHidden();
  });

  test('never on the live page or a page with a payment step', async ({ page }) => {
    const api = await fakeLiveApi(page, { status: live() });
    await page.clock.install();
    for (const path of ['/en/live', '/en/checkout', '/en/cart', '/en/candle', '/en/donate']) {
      const before = api.statusRequests;
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await page.clock.fastForward(40_000);
      await expect.poll(() => api.statusRequests, path).toBeGreaterThan(before);
      await expect(dialog(page), path).toBeHidden();
    }
    expect(await page.evaluate(() => localStorage.getItem('nhc.liveAlert.v1'))).toBeNull();
  });

  for (const [locale, messages] of [['he', he], ['ar', ar]] as const) {
    test(`reads right to left in ${locale} and passes axe`, async ({ page }) => {
      await fakeLiveApi(page, { status: live(SESSION_A, locale === 'he' ? 'תפילת ערב' : 'صلاة المساء') });
      await page.clock.install();
      await page.goto(`/${locale}/sites`);
      await untilOpen(page);
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      await expect(dialog(page).getByRole('heading', { level: 2 })).toHaveText(messages.ux.liveAlert.title);
      await expect(dialog(page).getByRole('link', { name: messages.ux.liveAlert.watch })).toBeFocused();
      // the window is centred
      const box = await dialog(page).boundingBox();
      const viewport = page.viewportSize();
      expect(Math.abs((box?.x ?? 0) + (box?.width ?? 0) / 2 - (viewport?.width ?? 0) / 2)).toBeLessThan(2);
      expect(await axeOn(page, '[data-testid="live-alert"]')).toEqual([]);
    });
  }

  test('passes axe in English, also at 200% text, and fits the screen', async ({ page }) => {
    await fakeLiveApi(page, { status: live(SESSION_A, 'A long title of an evening prayer from the Basilica of the Annunciation in Nazareth') });
    await page.addInitScript(() => localStorage.setItem('nhc.a11y.v1', JSON.stringify({ text: 200, contrast: true })));
    await page.clock.install();
    await page.goto('/en/visit');
    await untilOpen(page);
    expect(await axeOn(page, '[data-testid="live-alert"]')).toEqual([]);
    const box = await dialog(page).boundingBox();
    const viewport = page.viewportSize();
    expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewport?.width ?? 0);
    expect(box?.height ?? 0).toBeLessThanOrEqual(viewport?.height ?? 0);
  });
});

test.describe('the next broadcast on /live', () => {
  test.use({ timezoneId: 'America/New_York' });

  const announce = (start: number, over: Record<string, unknown> = {}) => ({
    id: 'c'.repeat(24),
    title: 'Sunday Mass &amp; rosary',
    description: 'From the Basilica of the Annunciation',
    startsAt: new Date(start).toISOString(),
    status: 'scheduled',
    ...over,
  });

  test('counts down, says "Starting soon" at zero, then asks every 10 seconds until the player appears', async ({ page }) => {
    const now = Date.now();
    const start = now + (65 * 60 + 5) * 1000;
    const api = await fakeLiveApi(page, { schedule: [announce(start)] });
    // The page's clock at every status question.
    await page.addInitScript(() => {
      const record = window as unknown as { __liveStatusTimes: number[] };
      record.__liveStatusTimes = [];
      const original = window.fetch;
      window.fetch = (input, init) => {
        if (String(input instanceof Request ? input.url : input).endsWith('/live/status')) record.__liveStatusTimes.push(Date.now());
        return original(input, init);
      };
    });
    await page.clock.install({ time: now });
    await page.goto('/en/live');
    const stage = page.getByTestId('live-stage');
    await expect(stage.getByRole('heading', { level: 2 })).toHaveText('Sunday Mass & rosary');
    const timer = stage.getByRole('timer');
    await expect(timer).toHaveAttribute('aria-live', 'off');
    await expect(page.getByTestId('live-countdown-summary')).toHaveText('Starts in 1 hour and 6 minutes');
    await expect(stage.getByText(next.nazarethTime)).toBeVisible();
    await expect(stage.getByText(next.yourTime)).toBeVisible(); // New York is not Nazareth
    await expect(stage.locator('dd').nth(1)).toContainText(/E[DS]T/);
    expect(api.scheduleRequests).toBe(1);

    // From here the clock stands still between the test's steps (a busy machine must not let it run out by itself).
    await page.clock.pauseAt(start - 2_000);
    await expect(page.getByTestId('live-countdown-summary')).toHaveText('Starts in 1 minute');
    await page.clock.runFor(3_000);
    await expect(page.getByTestId('live-starting-soon')).toHaveText(new RegExp(next.soonTitle));
    await expect(page.getByTestId('live-stage-announcement')).toHaveText(next.startingNow);

    // every 10 seconds now: the page's own clock at each question
    for (let i = 0; i < 8; i += 1) {
      await page.clock.runFor(5_000);
      await page.waitForTimeout(200);
    }
    const times = await page.evaluate(() => (window as unknown as { __liveStatusTimes: number[] }).__liveStatusTimes.filter((t) => t > Date.now() - 40_000));
    const gaps = times.slice(1).map((t, i) => t - times[i]);
    expect(gaps.length).toBeGreaterThanOrEqual(3);
    for (const gap of gaps.slice(1)) {
      expect(gap).toBeGreaterThanOrEqual(9_900);
      expect(gap).toBeLessThanOrEqual(10_800);
    }

    api.status = live(SESSION_A, 'Sunday Mass');
    await page.clock.runFor(10_000);
    await expect(page.getByTestId('live-now')).toBeVisible();
    await expect(stage).toHaveCount(0);
    expect(api.scheduleRequests).toBe(1); // the list is never polled
  });

  test('saves the broadcast to a calendar (.ics in UTC)', async ({ page }) => {
    const start = Date.parse('2027-03-26T08:00:00Z'); // the morning the clocks go forward in Israel
    await fakeLiveApi(page, { schedule: [announce(start, { title: 'Prayer, rosary; vespers' })] });
    await page.goto('/en/live');
    const button = page.getByTestId('live-stage').getByRole('button', { name: next.addToCalendar });
    const [download] = await Promise.all([page.waitForEvent('download'), button.click()]);
    expect(download.suggestedFilename()).toBe('nazareth-holy-cross-live-2027-03-26.ics');
    const text = readFileSync((await download.path()) ?? '', 'utf8');
    expect(text).toContain('BEGIN:VEVENT');
    expect(text).toContain('DTSTART:20270326T080000Z');
    expect(text).toContain('DTEND:20270326T090000Z');
    expect(text).toContain(`UID:live-${'c'.repeat(24)}@nazarethholycross.com`);
    expect(text).toContain('SUMMARY:Prayer\\, rosary\\; vespers');
    expect(text).toMatch(/URL:https:\/\/nazarethholycross\.com\/en\/live/);
  });

  test('lists the other broadcasts and passes axe (en and ar), without seconds for less motion', async ({ page }) => {
    const now = Date.now();
    await fakeLiveApi(page, {
      schedule: [announce(now + 3 * 86_400_000), announce(now + 10 * 86_400_000, { id: 'd'.repeat(24), title: 'Vespers', description: '' })],
    });
    for (const locale of ['en', 'ar'] as const) {
      await page.goto(`/${locale}/live`);
      const list = page.getByTestId('live-upcoming');
      await expect(list.getByRole('heading', { level: 3, name: 'Vespers' })).toBeVisible();
      await expect(page.getByTestId('live-countdown')).toBeVisible();
      if (locale === 'ar') expect(await page.getByTestId('live-stage').textContent()).not.toMatch(/[٠-٩]/);
      expect(await axeOn(page, '[data-testid="live-stage"]', '[data-testid="live-upcoming"]'), locale).toEqual([]);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/en/live');
    await expect(page.getByTestId('live-countdown')).toBeVisible();
    await expect(page.getByTestId('live-countdown')).not.toContainText(/Seconds?/);
  });
});

test.describe('past broadcasts on /live', () => {
  const recording = (id: string, video: string, title: string, date: string) => ({
    id,
    title,
    date,
    durationSeconds: 3905,
    thumbnailUrl: THUMB(video),
    playbackUrl: PLAYER(video),
  });

  test('the published recordings come first: a poster, a press puts the player in its place, one player at a time', async ({ page }) => {
    const api = await fakeLiveApi(page, {
      recordings: [
        recording('e'.repeat(24), 'b', 'Vespers &amp; rosary', '2026-10-04T16:00:00Z'),
        recording('f'.repeat(24), 'c', 'Morning prayer', '2026-09-20T06:00:00Z'),
        { ...recording('1'.repeat(24), 'd', 'Trap', '2026-09-01T06:00:00Z'), playbackUrl: 'https://evil.example.com/x/iframe' },
      ],
    });
    await page.goto('/en/live');
    const items = page.getByTestId('live-recording');
    await expect(items).toHaveCount(2);
    expect(api.recordingRequests).toBe(1);
    const first = items.first();
    await expect(first.getByRole('heading', { level: 3 })).toHaveText('Vespers & rosary');
    await expect(first.getByText('October 4, 2026')).toBeVisible();
    await expect(first.getByText('1 hr 5 min')).toBeVisible();
    const poster = first.locator('img');
    await expect(poster).toHaveAttribute('src', THUMB('b'));
    await expect(poster).toHaveAttribute('alt', '');
    await expect.poll(() => poster.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true); // the policy let the poster in
    await expect(page.locator('video')).toHaveCount(2); // the older recordings follow
    await expect(page.locator('iframe')).toHaveCount(0);

    expect(await axeOn(page, '#past-broadcasts-title', '[data-testid="live-recording"]')).toEqual([]);

    await first.getByRole('button', { name: 'Play: Vespers & rosary' }).click();
    const frame = page.locator('iframe');
    await expect(frame).toHaveCount(1);
    await expect(frame).toHaveAttribute('title', 'Recording: Vespers & rosary');
    await expect(frame).toHaveAttribute('src', `${PLAYER('b')}?autoplay=true`);
    await expect(page.frameLocator('iframe').getByText('fake player')).toBeVisible();
    await expect(frame).toBeFocused();

    await items.nth(1).getByRole('button', { name: 'Play: Morning prayer' }).click();
    await expect(page.locator('iframe')).toHaveCount(1);
    await expect(page.locator('iframe')).toHaveAttribute('src', `${PLAYER('c')}?autoplay=true`);

    const jsonLd = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}');
    expect(jsonLd['@graph'].filter((n: { '@type': string }) => n['@type'] === 'VideoObject').length).toBeGreaterThanOrEqual(2);
  });

  test('reads right to left in Hebrew and fits the screen', async ({ page }) => {
    await fakeLiveApi(page, { recordings: [recording('e'.repeat(24), 'b', 'תפילת ערב', '2026-10-04T16:00:00Z')] });
    await page.goto('/he/live');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    const item = page.getByTestId('live-recording');
    await expect(item.getByRole('button', { name: he.communityPage.live.recordings.play.replace('{title}', 'תפילת ערב') })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    if (isPhone()) await expect(item).toBeVisible();
  });
});
