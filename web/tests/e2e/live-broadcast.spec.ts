import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import en from '../../src/messages/en.json';
import he from '../../src/messages/he.json';

// The live broadcast on /live (docs/LIVE.md): the browser polls GET /live/status and shows Cloudflare Stream's player
// above the schedule while a broadcast is live. Every status request is answered here (nothing reaches the real API)
// and the player address is answered with a stand-in page (nothing reaches Cloudflare).

const PLAYER = `https://customer-e2e0test.cloudflarestream.com/${'a'.repeat(32)}/iframe`;
const CORS = { 'access-control-allow-origin': '*' };
const now = en.communityPage.live.now;

type Status = { live: false } | { live: true; title: string; startedAt: string; playbackUrl: string };

async function fakeApi(page: Page, initial: Status) {
  const state = { status: initial, requests: 0 };
  await page.route('**/live/status', (route) => {
    state.requests += 1;
    return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(state.status) });
  });
  await page.route(/^https:\/\/customer-[a-z0-9]+\.cloudflarestream\.com\//, (route) =>
    route.fulfill({ status: 200, headers: { 'content-type': 'text/html' }, body: '<!doctype html><html lang="en"><title>Player</title><body>fake player</body></html>' }),
  );
  return state;
}

/** Content-Security-Policy refusals (a frame or a request the policy blocked). */
function cspProblems(page: Page) {
  const problems: string[] = [];
  page.on('console', (msg) => {
    if (/content security policy|refused to (frame|connect|load)/i.test(msg.text())) problems.push(msg.text());
  });
  return problems;
}

const live = (title: string, minutesAgo = 12): Status => ({ live: true, title, startedAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(), playbackUrl: PLAYER });

test.describe('live broadcast on /live', () => {
  test('nothing live: no player, the schedule stays; the browser asks about every 15 seconds, not more', async ({ page }) => {
    const api = await fakeApi(page, { live: false });
    await page.clock.install();
    await page.goto('/en/live');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(en.communityPage.live.title);
    await page.clock.fastForward(15_000);
    await expect.poll(() => api.requests).toBeGreaterThanOrEqual(1);
    await expect(page.getByTestId('live-now')).toHaveCount(0);
    await expect(page.locator('iframe')).toHaveCount(0);
    await expect(page.locator('#live-stage-title')).toBeVisible(); // the schedule's player frame
    // One question per 15 seconds: nothing after 14 s, one more after 15 s, three times in a row.
    for (let i = 0; i < 3; i += 1) {
      const before = api.requests;
      await page.clock.runFor(14_000);
      await page.waitForTimeout(150);
      expect(api.requests).toBe(before);
      await page.clock.runFor(1_000);
      await expect.poll(() => api.requests).toBe(before + 1);
    }
  });

  test('a broadcast starts: the player appears above the schedule, accessible, framed by the policy; then it ends', async ({ page }) => {
    const problems = cspProblems(page);
    const api = await fakeApi(page, { live: false });
    await page.clock.install();
    await page.goto('/en/live');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    api.status = live('Evening prayer &amp; vespers');
    await page.clock.fastForward(16_000);
    const section = page.getByTestId('live-now');
    await expect(section).toBeVisible();
    await expect(section.getByRole('heading', { level: 2 })).toHaveText('Evening prayer & vespers');
    await expect(section.getByText(now.badge)).toBeVisible();
    await expect(section.getByText('Live for 12 minutes')).toBeVisible();
    const frame = page.locator('iframe[title="Live broadcast: Evening prayer & vespers"]');
    await expect(frame).toHaveAttribute('src', PLAYER);
    await expect(frame).toHaveAttribute('allow', /fullscreen/);
    await expect(page.frameLocator('iframe').getByText('fake player')).toBeVisible(); // the policy let the player in
    await expect(page.getByTestId('live-now-announcement')).toHaveText('A live broadcast has started: Evening prayer & vespers');
    // above the schedule
    const [playerTop, scheduleTop] = await Promise.all([section.evaluate((el) => el.getBoundingClientRect().top), page.locator('#live-stage-title').evaluate((el) => el.getBoundingClientRect().top)]);
    expect(playerTop).toBeLessThan(scheduleTop);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    const axe = await new AxeBuilder({ page }).include('[data-testid="live-now"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

    api.status = { live: false };
    await page.clock.fastForward(16_000);
    await expect(section).toHaveCount(0);
    await expect(page.getByTestId('live-now-announcement')).toHaveText(now.ended);
    expect(problems).toEqual([]);
  });

  test('an address that is not Cloudflare\'s player is never framed', async ({ page }) => {
    const api = await fakeApi(page, { live: false });
    await page.clock.install();
    await page.goto('/en/live');
    api.status = { ...(live('Trap') as Extract<Status, { live: true }>), playbackUrl: 'https://evil.example.com/x/iframe' };
    await page.clock.fastForward(16_000);
    await expect.poll(() => api.requests).toBeGreaterThanOrEqual(1);
    await expect(page.locator('iframe')).toHaveCount(0);
  });

  test('right to left in Hebrew, and it fits a phone', async ({ page }) => {
    const api = await fakeApi(page, { live: false });
    await page.setViewportSize({ width: 360, height: 740 });
    await page.clock.install();
    await page.goto('/he/live');
    api.status = live('תפילת ערב');
    await page.clock.fastForward(16_000);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    const section = page.getByTestId('live-now');
    await expect(section.getByText(he.communityPage.live.now.badge)).toBeVisible();
    await expect(section.getByRole('heading', { level: 2 })).toHaveText('תפילת ערב');
    await page.evaluate(() => document.querySelector<HTMLElement>('body > header')?.style.setProperty('display', 'none', 'important'));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
