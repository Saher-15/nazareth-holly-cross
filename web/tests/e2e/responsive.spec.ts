import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { auditLayout, type AuditOptions } from './responsive-audit';

// Responsive layout of every page of the public site, in an LTR and two RTL languages, on phones, tablets, laptops,
// wide screens, at 200% zoom and on a phone held sideways. The rules are in tests/e2e/responsive-audit.ts and
// docs/RESPONSIVE.md.
//
//   default (CI):            320, 375, 768 and 1280 px wide; en, he, ar; one holy-site page
//   RESPONSIVE_FULL=1        the whole matrix: 12 viewports, every holy-site page
//   RESPONSIVE_SHOTS=<dir>   also saves full-page screenshots at 375, 768 and 1440 px in en and he for review
//                            (relative paths are under web/; use a git-ignored folder such as test-results/...)
//
// The browser never talks to anything but this site: requests that leave localhost are aborted (the server still
// reads the catalogue from the API, read-only, as in shop.spec.ts). The spec runs in the "desktop" project only: it
// sets its own viewport, touch and pixel ratio per case.

const FULL = !!process.env.RESPONSIVE_FULL;
const SHOTS = process.env.RESPONSIVE_SHOTS ? path.resolve(process.env.RESPONSIVE_SHOTS) : '';

type Viewport = { id: string; width: number; height: number; touch: boolean; scale?: number };
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
  // 200% browser zoom on a 1280 x 800 laptop: the page lays out in 640 x 400 CSS pixels at a pixel ratio of 2.
  { id: 'zoom200', width: 640, height: 400, touch: false, scale: 2 },
  { id: '844x390', width: 844, height: 390, touch: true },
];
const CI_VIEWPORTS = ['320x568', '375x812', '768x1024', '1280x800'];
const SHOT_WIDTHS = [375, 768, 1440];
const LOCALES = ['en', 'he', 'ar'];

const PLACES = ['latin', 'greek', 'maryswell', 'oldcity', 'city'];
const ROUTES = [
  '',
  '/sites',
  ...(FULL || SHOTS ? PLACES : PLACES.slice(0, 1)).map((p) => `/sites/${p}`),
  '/tour',
  '/about',
  '/shop',
  '/shop/{product}',
  '/cart',
  '/checkout',
  '/wishlist',
  '/candle',
  '/donate',
  '/plan',
  '/visit',
  '/gallery',
  '/gospel',
  '/prayers',
  '/reviews',
  '/live',
  '/contact',
  '/search?q=nazareth',
  '/faq',
  '/privacy',
  '/terms',
  '/shipping-returns',
  '/credits',
  '/no-such-page',
];

const AUDIT: AuditOptions = {
  tapMin: 24,
  header: 'body > header, header[class*="header"]',
  ignore: ['.skip-link', '[data-nextjs-toast]', 'nextjs-portal'],
};
const CART = [{ _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', name: 'Olive wood cross', price: 25, img: '/images/candle.jpg', color: '', quantity: 2 }];

test.describe.configure({ mode: 'parallel' });
test.beforeEach(async ({ browserName }, info) => {
  void browserName;
  test.skip(info.project.name !== 'desktop', 'sets its own viewports');
});

async function prepare(page: Page) {
  await page.route(
    (url) => !['localhost', '127.0.0.1'].includes(url.hostname),
    (route) => route.abort(),
  );
  await page.addInitScript((lines) => {
    try {
      if (!sessionStorage.getItem('rs-seeded')) {
        localStorage.setItem('nhc.cart.v1', JSON.stringify(lines));
        sessionStorage.setItem('rs-seeded', '1');
      }
    } catch {
      /* storage blocked */
    }
  }, CART);
}

async function settle(page: Page) {
  await page.waitForLoadState('load');
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  // let client components hydrate and measure
  await page.waitForTimeout(250);
}

let productPath = '';
async function product(baseURL: string | undefined): Promise<string> {
  if (productPath) return productPath;
  const res = await fetch(`${baseURL}/en/shop`);
  const id = (await res.text()).match(/href="\/en\/shop\/([a-f0-9]{24})"/)?.[1];
  productPath = id ? `/shop/${id}` : '';
  return productPath;
}

for (const vp of VIEWPORTS.filter((v) => FULL || CI_VIEWPORTS.includes(v.id) || (SHOTS && SHOT_WIDTHS.includes(v.width)))) {
  test.describe(`${vp.id}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch, deviceScaleFactor: vp.scale ?? 1, reducedMotion: 'reduce' });

    for (const locale of LOCALES) {
      test(`${locale}: every page fits`, async ({ page, baseURL }) => {
        test.setTimeout(ROUTES.length * 12_000);
        await prepare(page);
        const problems: string[] = [];
        const advice: string[] = [];
        for (const route of ROUTES) {
          let pathName = route;
          if (route.includes('{product}')) {
            const p = await product(baseURL);
            if (!p) continue; // the catalogue could not be read: shop.spec.ts reports that
            pathName = p;
          }
          const url = `/${locale}${pathName}`;
          await page.goto(url);
          await settle(page);
          const { issues, smallTouch } = await page.evaluate(auditLayout, AUDIT);
          problems.push(...issues.map((i) => `${vp.id} ${url} [${i.kind}] ${i.detail}`));
          if (vp.touch) advice.push(...smallTouch.map((s) => `${url} ${s}`));
          // phones and tablets in portrait show the menu button instead of the links
          if (vp.width < 1100) {
            const menu = page.locator('button[aria-controls="main-nav"]');
            if (!(await menu.isVisible())) problems.push(`${vp.id} ${url} [header] the menu button is not visible`);
          }
          // the page title must not hide under the sticky header
          const covered = await page.evaluate(() => {
            const h1 = document.querySelector('h1');
            const header = document.querySelector('body > header, header[class*="header"]');
            if (!h1 || !header) return false;
            window.scrollTo(0, 0);
            const a = h1.getBoundingClientRect();
            const b = header.getBoundingClientRect();
            return a.height > 0 && a.top < b.bottom - 2 && a.bottom > b.top;
          });
          if (covered) problems.push(`${vp.id} ${url} [fixed-cover] the h1 starts under the sticky header`);
          if (SHOTS && SHOT_WIDTHS.includes(vp.width) && ['en', 'he'].includes(locale)) {
            await shoot(page, locale, vp, pathName);
          }
        }
        if (advice.length) test.info().annotations.push({ type: 'touch targets under 44px', description: [...new Set(advice)].slice(0, 30).join('\n') });
        if (process.env.RESPONSIVE_REPORT) {
          fs.appendFileSync(process.env.RESPONSIVE_REPORT, `${JSON.stringify({ viewport: vp.id, locale, problems, advice: [...new Set(advice)] })}\n`);
        }
        expect(problems, problems.join('\n')).toEqual([]);
      });
    }
  });
}

async function shoot(page: Page, locale: string, vp: Viewport, route: string) {
  // walk down the page so lazy images load, then back to the top
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += window.innerHeight) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(300);
  const slug = (route.replace(/^\//, '').replace(/[/?=]/g, '_') || 'home').slice(0, 60);
  const file = path.join(SHOTS, `${locale}`, `${vp.width}`, `${slug}.png`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file, fullPage: true, animations: 'disabled' });
}

// Menus, drawers and dialogs on the smallest screens and on a phone held sideways.
const SMALL: Viewport[] = VIEWPORTS.filter((v) => ['320x568', '375x812', '844x390'].includes(v.id));

async function expectFits(page: Page, box: Locator, what: string) {
  await expect(box, what).toBeVisible();
  const fit = await box.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const scrolls = cs.overflowY === 'auto' || cs.overflowY === 'scroll';
    return {
      left: r.left,
      right: r.right,
      top: r.top,
      bottom: r.bottom,
      vw: window.innerWidth,
      vh: window.innerHeight,
      reachable: r.bottom <= window.innerHeight + 1 || (scrolls && el.scrollHeight > el.clientHeight) || el.scrollHeight <= el.clientHeight,
      scrolls,
    };
  });
  expect(fit.left, `${what}: left edge`).toBeGreaterThanOrEqual(-1);
  expect(fit.right, `${what}: right edge`).toBeLessThanOrEqual(fit.vw + 1);
  expect(fit.top, `${what}: top edge`).toBeGreaterThanOrEqual(-1);
  // taller than the screen is fine only when the panel scrolls itself
  if (fit.bottom > fit.vh + 1) expect(fit.scrolls, `${what}: taller than the screen and does not scroll`).toBe(true);
}

for (const vp of SMALL) {
  test.describe(`${vp.id} overlays`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch, reducedMotion: 'reduce' });
    for (const locale of ['en', 'he']) {
      test(`${locale}: menu, language list, search, filters and photo viewer fit the screen`, async ({ page }) => {
        test.setTimeout(90_000);
        await prepare(page);

        await page.goto(`/${locale}`);
        await settle(page);
        await page.locator('button[aria-controls="main-nav"]').click();
        const nav = page.locator('#main-nav');
        await expectFits(page, nav, 'main menu');
        // the last entry of the menu can be reached
        const last = nav.locator('a, button').last();
        await last.scrollIntoViewIfNeeded();
        await expect(last).toBeInViewport();
        await page.keyboard.press('Escape');

        await page.getByRole('button', { name: /language|שפה/i }).first().click();
        const languages = page.getByRole('list', { name: /language|שפה/i });
        await expect(languages).toBeVisible();
        const list = await languages.evaluate((el) => {
          // the scrolling box is the list or its panel
          let box: HTMLElement = el as HTMLElement;
          for (let p: HTMLElement | null = el as HTMLElement; p; p = p.parentElement) {
            const cs = getComputedStyle(p);
            if (cs.overflowY === 'auto' || cs.overflowY === 'scroll' || cs.position === 'fixed' || cs.position === 'absolute') {
              box = p;
              break;
            }
          }
          const r = box.getBoundingClientRect();
          return { left: r.left, right: r.right, bottom: r.bottom, vw: innerWidth, vh: innerHeight, scrolls: box.scrollHeight > box.clientHeight + 1 || r.bottom <= innerHeight + 1 };
        });
        expect(list.left, 'language list left').toBeGreaterThanOrEqual(-1);
        expect(list.right, 'language list right').toBeLessThanOrEqual(list.vw + 1);
        const lastLanguage = languages.getByRole('link').last();
        await lastLanguage.scrollIntoViewIfNeeded();
        await expect(lastLanguage, 'the last language can be reached').toBeInViewport();
        await page.keyboard.press('Escape');

        // the search palette (Ctrl/Cmd + K)
        await page.keyboard.press('Control+k');
        const palette = page.getByRole('dialog').first();
        await expectFits(page, palette, 'search palette');
        await expect(palette.getByRole('searchbox').or(palette.locator('input')).first()).toBeInViewport();
        await page.keyboard.press('Escape');
        await expect(palette).toBeHidden();

        await page.goto(`/${locale}/shop`);
        await settle(page);
        const filters = page.locator('main').getByRole('button', { name: /filter|סינון|סנן/i }).first();
        if (await filters.isVisible()) {
          await filters.click();
          const drawer = page.getByRole('dialog').first();
          await expectFits(page, drawer, 'filter drawer');
          await page.keyboard.press('Escape');
        }

        await page.goto(`/${locale}/sites/latin`);
        await settle(page);
        await page.locator('main button[aria-haspopup="dialog"]').first().click(); // main: the header's accessibility button opens a dialog too
        const viewer = page.getByRole('dialog').first();
        await expect(viewer).toBeVisible();
        const img = viewer.locator('img').first();
        await expect(img).toBeVisible();
        const ib = await img.boundingBox();
        expect(ib && ib.x >= -1 && ib.x + ib.width <= vp.width + 1, 'the photo fits across').toBe(true);
        expect(ib && ib.y >= -1 && ib.y + ib.height <= vp.height + 1, 'the photo fits down').toBe(true);
        const close = viewer.getByRole('button').first();
        await expect(close).toBeInViewport();
      });
    }
  });
}
