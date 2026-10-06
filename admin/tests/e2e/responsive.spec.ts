import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page, type PlaywrightWorkerArgs } from '@playwright/test';
import { auditLayout, type AuditOptions } from '../../../web/tests/e2e/responsive-audit';
import { APP } from './helpers';

// Responsive layout of every dashboard page, in English, Hebrew and Arabic, from a 320px phone to a 1920px screen,
// at 200% zoom and on a phone held sideways. The rules are shared with the public site
// (web/tests/e2e/responsive-audit.ts) and explained in docs/RESPONSIVE.md.
//
//   default (CI):        320, 375, 768 and 1280 px wide; en, he, ar
//   RESPONSIVE_FULL=1    the whole matrix of 12 viewports
//   RESPONSIVE_SHOTS=<dir>  also saves full-page screenshots at 375, 768 and 1440 px in en and he (with FULL)
//
// Read-only: nothing is changed. The pages are opened as "tempowner", the spare owner of the seed that no other test
// uses, so this spec has its own share of the API's budget of 300 requests per 15 minutes per admin and does not use
// up the owner's. To stay well inside that budget each page is loaded ONCE per language and then measured at every
// viewport by resizing the window (the layout is CSS; the charts follow their own box with a ResizeObserver).
// Runs in the "desktop" project only.

const FULL = !!process.env.RESPONSIVE_FULL;
const SHOTS = process.env.RESPONSIVE_SHOTS ? path.resolve(process.env.RESPONSIVE_SHOTS) : '';

type Viewport = { id: string; width: number; height: number; touch: boolean };
const VIEWPORTS: Viewport[] = [
  { id: '320x568', width: 320, height: 568, touch: true },
  { id: '360x740', width: 360, height: 740, touch: true },
  { id: '375x812', width: 375, height: 812, touch: true },
  { id: '390x844', width: 390, height: 844, touch: true },
  { id: '414x896', width: 414, height: 896, touch: true },
  { id: '768x1024', width: 768, height: 1024, touch: true },
  { id: '1024x768', width: 1024, height: 768, touch: true },
  { id: '1280x800', width: 1280, height: 800, touch: false },
  { id: '1440x900', width: 1440, height: 900, touch: false },
  { id: '1920x1080', width: 1920, height: 1080, touch: false },
  // 200% browser zoom on a 1280 x 800 laptop lays the page out in 640 x 400 CSS pixels
  { id: 'zoom200', width: 640, height: 400, touch: false },
  { id: '844x390', width: 844, height: 390, touch: true },
];
const CI_VIEWPORTS = ['320x568', '375x812', '768x1024', '1280x800'];
const LOCALES = ['en', 'he', 'ar'];

const SIGNED_IN = [
  '/',
  '/orders',
  '/orders?open={order}',
  '/candles',
  '/contacts',
  '/payments',
  '/products',
  '/products?view=grid',
  '/products/new',
  '/products/{product}',
  '/reviews',
  '/reviews?tab=product',
  '/prayers',
  '/users',
  '/audit',
  '/settings',
  '/profile',
  '/privacy',
  '/no-such-page',
];
const SIGNED_OUT = ['/login', '/forgot-password', '/reset-password'];

const AUDIT: AuditOptions = { tapMin: 24, header: '.topbar', ignore: ['.skip-link'] };
// The spare owner of mock-api/seed.mjs and server/test-harness/seed.mjs (public test account, exists nowhere else).
const SPARE_OWNER = { username: 'tempowner', password: 'Tempowner-Mock-Pass-1' };

test.describe.configure({ mode: 'parallel' });
test.beforeEach(async ({ browserName }, info) => {
  void browserName;
  test.skip(info.project.name !== 'desktop', 'sets its own viewports');
});

/** Cookies of a signed-in session of the spare owner (or of a visitor), with the dashboard's language. */
async function session(playwright: PlaywrightWorkerArgs['playwright'], locale: string, signedIn = true) {
  const api = await playwright.request.newContext({ baseURL: APP, extraHTTPHeaders: { Origin: APP } });
  if (signedIn) {
    const res = await api.post('/api/session/login', { data: SPARE_OWNER });
    expect(res.ok(), `sign-in as ${SPARE_OWNER.username}`).toBe(true);
  }
  const state = await api.storageState();
  await api.dispose();
  state.cookies.push({ name: 'nhc_admin_lang', value: locale, domain: 'localhost', path: '/', expires: -1, httpOnly: false, secure: false, sameSite: 'Lax' });
  return state;
}

async function settle(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.waitForTimeout(150);
}

/** The first id a page links to ("/" links to "/orders?open=<id>"). */
async function firstId(page: Page, list: string, pattern: RegExp): Promise<string> {
  await page.goto(list);
  let id = '';
  // the lists stream in after the page frame: wait for them
  await expect
    .poll(async () => {
      const hrefs = await page.locator('main a[href]').evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''));
      id = hrefs.map((h) => h.match(pattern)?.[1]).find(Boolean) ?? '';
      return id;
    })
    .not.toBe('')
    .catch(() => undefined);
  return id;
}

const viewports = VIEWPORTS.filter((v) => FULL || CI_VIEWPORTS.includes(v.id));

async function auditEverywhere(page: Page, locale: string, route: string, problems: string[], advice: string[]) {
  await page.goto(route);
  await settle(page);
  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(60);
    const { issues, smallTouch } = await page.evaluate(auditLayout, AUDIT);
    problems.push(...issues.map((i) => `${vp.id} ${locale} ${route} [${i.kind}] ${i.detail}`));
    if (vp.touch) advice.push(...smallTouch.map((s) => `${route} ${s}`));
    if (SHOTS && [375, 768, 1440].includes(vp.width) && ['en', 'he'].includes(locale)) {
      const file = path.join(SHOTS, locale, String(vp.width), `${(route.replace(/^\//, '').replace(/[/?=&]/g, '_') || 'dashboard').slice(0, 50)}.png`);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      await page.screenshot({ path: file, fullPage: true, animations: 'disabled' });
    }
    // at 960px and narrower the navigation sits behind a menu button in the top bar
    if ((await page.locator('#sidebar').count()) && vp.width <= 960 && !(await page.locator('.topbar button[aria-controls="sidebar"]').isVisible())) {
      problems.push(`${vp.id} ${locale} ${route} [header] the menu button is not visible`);
    }
  }
}

for (const locale of LOCALES) {
  test(`${locale}: every dashboard page fits at ${viewports.length} viewports`, async ({ browser, playwright }) => {
    test.setTimeout((SIGNED_IN.length + SIGNED_OUT.length) * viewports.length * 1_500 + 30_000);
    const problems: string[] = [];
    const advice: string[] = [];
    const options = { viewport: { width: viewports[0].width, height: viewports[0].height }, reducedMotion: 'reduce' as const };

    const owner = await browser.newContext({ ...options, storageState: await session(playwright, locale) });
    const page = await owner.newPage();
    const order = await firstId(page, '/', /\/orders\?open=([^&]+)/);
    const product = await firstId(page, '/products', /^\/products\/([^/?]+)$/);
    for (const p of SIGNED_IN) {
      if ((p.includes('{order}') && !order) || (p.includes('{product}') && !product)) continue;
      await auditEverywhere(page, locale, p.replace('{order}', order).replace('{product}', product), problems, advice);
    }
    await owner.close();

    const guest = await browser.newContext({ ...options, storageState: await session(playwright, locale, false) });
    const guestPage = await guest.newPage();
    for (const p of SIGNED_OUT) await auditEverywhere(guestPage, locale, p, problems, advice);
    await guest.close();

    if (advice.length) test.info().annotations.push({ type: 'touch targets under 44px', description: [...new Set(advice)].slice(0, 30).join('\n') });
    if (process.env.RESPONSIVE_REPORT) {
      fs.appendFileSync(process.env.RESPONSIVE_REPORT, `${JSON.stringify({ locale, problems, advice: [...new Set(advice)] })}\n`);
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });
}

// The navigation panel and a detail drawer on the smallest phone and on a phone held sideways.
for (const vp of VIEWPORTS.filter((v) => ['320x568', '844x390'].includes(v.id))) {
  for (const locale of ['en', 'he']) {
    test(`${vp.id} ${locale}: the navigation panel and a drawer fit the screen`, async ({ browser, playwright }) => {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        hasTouch: vp.touch,
        reducedMotion: 'reduce',
        storageState: await session(playwright, locale),
      });
      const page = await context.newPage();
      const order = await firstId(page, '/', /\/orders\?open=([^&]+)/);

      await page.locator('.topbar button[aria-controls="sidebar"]').click();
      const sidebar = page.locator('#sidebar');
      await expect(sidebar).toBeVisible();
      // (reduced motion is on, so the panel must already be in place, not sliding in)
      const box = await sidebar.boundingBox();
      expect(box!.x, 'panel left edge').toBeGreaterThanOrEqual(-1);
      expect(box!.x + box!.width, 'panel right edge').toBeLessThanOrEqual(vp.width + 1);
      // everything in it can be reached, the sign-out button last
      const signOut = sidebar.getByTestId('sign-out');
      await signOut.scrollIntoViewIfNeeded();
      await expect(signOut).toBeInViewport();
      await page.keyboard.press('Escape');
      await expect(sidebar).toBeHidden();

      expect(order, 'an order is linked from the dashboard').not.toBe('');
      await page.goto(`/orders?open=${order}`);
      await settle(page);
      const drawer = page.locator('dialog.drawer[open]');
      await expect(drawer).toBeVisible();
      const d = await drawer.boundingBox();
      expect(d!.x, 'drawer left edge').toBeGreaterThanOrEqual(-1);
      expect(d!.x + d!.width, 'drawer right edge').toBeLessThanOrEqual(vp.width + 1);
      expect(d!.height, 'drawer height').toBeLessThanOrEqual(vp.height + 1);
      // its close button and its last action are reachable
      await expect(drawer.getByRole('button').first()).toBeInViewport();
      const last = drawer.locator('button, a[href]').last();
      await last.scrollIntoViewIfNeeded();
      await expect(last).toBeInViewport();
      await context.close();
    });
  }
}
