import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Cross-cutting QA of the whole site: routing, every language, metadata, icons, focus and accessibility.
// Regression tests for the bugs listed in docs/QA.md (QA-01 ...). Nothing here reaches the real API:
// every request that leaves localhost is aborted.

const LOCALES = ['en', 'fr', 'es', 'de', 'it', 'pt', 'pl', 'ru', 'el', 'he', 'ar'] as const;
const RTL = ['he', 'ar'];
const PLACES = ['latin', 'greek', 'maryswell', 'oldcity', 'city'];
// Every page except the shop (another team's work), with the paths that need no data from the API.
const PAGES = ['', '/sites', '/tour', '/about', '/candle', '/donate', '/checkout', '/cart', '/reviews', '/live', ...PLACES.map((p) => `/sites/${p}`)];
const CART = [{ _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', name: 'Olive wood cross', price: 25, img: '/images/candle.jpg', color: '', quantity: 2 }];

async function offline(page: Page) {
  await page.route(
    (url) => !['localhost', '127.0.0.1'].includes(url.hostname),
    (route) => route.abort(),
  );
}
async function seedCart(page: Page) {
  await page.addInitScript((lines) => localStorage.setItem('nhc.cart.v1', JSON.stringify(lines)), CART);
}
const head = (html: string, re: RegExp) => html.match(re)?.[1];

test.describe('routing', () => {
  test('QA-01 a path without a language is sent to one, keeping the page', async ({ playwright, baseURL }) => {
    // A fresh client for each visitor: the language is remembered in a cookie after the first visit.
    const visit = async (path: string, headers: Record<string, string> = {}) => {
      const client = await playwright.request.newContext({ baseURL, extraHTTPHeaders: headers });
      const res = await client.get(path);
      const result = { status: res.status(), path: new URL(res.url()).pathname };
      await client.dispose();
      return result;
    };
    for (const path of ['/shop', '/about', '/candle', '/sites/latin', '/reviews']) {
      expect(await visit(path), path).toEqual({ status: 200, path: `/en${path}` });
    }
    // The preferred language of the browser decides which one.
    expect(await visit('/about', { 'Accept-Language': 'he-IL,he;q=0.9' })).toEqual({ status: 200, path: '/he/about' });
    expect(await visit('/', { 'Accept-Language': 'ar' })).toEqual({ status: 200, path: '/ar' });
  });

  test('QA-01 the addresses of the previous site still reach the right page', async ({ request }) => {
    const legacy: [string, string][] = [
      ...PLACES.map((p): [string, string] => [`/${p}`, `/en/sites/${p}`]),
      ['/product/66eb4665c7e03262956c8d1d', '/en/shop/66eb4665c7e03262956c8d1d'],
      ['/checkoutcandle', '/en/candle'],
      ['/checkoutdonation', '/en/donate'],
    ];
    for (const [from, to] of legacy) {
      const res = await request.get(from);
      expect(new URL(res.url()).pathname, from).toBe(to);
      // A product that is no longer sold answers with the shop's own "not found" page, never a bare 404.
      if (!from.startsWith('/product')) expect(res.status(), from).toBe(200);
    }
  });

  test('an unknown address is a localized 404, and files keep their own 404', async ({ request }) => {
    for (const path of ['/en/no-such-page', '/he/sites/atlantis']) {
      const unknown = await request.get(path);
      expect(unknown.status(), path).toBe(404);
      expect(await unknown.text(), path).toContain('name="robots" content="noindex"');
    }
    expect((await request.get('/nothing-here.txt')).status()).toBe(404);
  });
});

test.describe('every language', () => {
  for (const locale of LOCALES) {
    test(`${locale}: pages answer, have one h1, the right lang/dir and no sideways scroll`, async ({ page }) => {
      test.setTimeout(90_000);
      await offline(page);
      await seedCart(page);
      for (const path of ['', '/sites', '/sites/latin', '/tour', '/about', '/candle', '/donate', '/checkout', '/cart', '/reviews', '/live']) {
        const res = await page.goto(`/${locale}${path}`);
        expect(res?.status(), `${locale}${path}`).toBe(200);
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
        await expect(page.locator('html')).toHaveAttribute('dir', RTL.includes(locale) ? 'rtl' : 'ltr');
        await expect(page.locator('h1'), `${locale}${path} h1`).toHaveCount(1);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${locale}${path} sideways scroll`).toBeLessThanOrEqual(0);
      }
    });
  }
});

test.describe('metadata', () => {
  test('QA-02 every page names its canonical address and all 11 languages plus x-default, with a share image', async ({ request, isMobile }) => {
    test.skip(isMobile, 'markup is the same on every device');
    test.setTimeout(120_000);
    for (const locale of LOCALES) {
      for (const path of ['', '/sites', '/sites/latin', '/tour', '/about', '/candle', '/donate', '/checkout', '/reviews', '/live']) {
        const html = await (await request.get(`/${locale}${path}`)).text();
        const where = `${locale}${path}`;
        expect(head(html, /<link rel="canonical" href="([^"]+)"/), where).toMatch(new RegExp(`/${locale}${path}$`));
        expect(html.match(/<link rel="alternate" hrefLang="[^"]+"/g)?.length, `${where} hreflang`).toBe(12);
        expect(html, `${where} x-default`).toContain('hrefLang="x-default"');
        expect(html, `${where} og:image`).toMatch(/<meta property="og:image" content="[^"]+"/);
        // Open Graph wants language_TERRITORY (he_IL), starting with the language of the page.
        expect(head(html, /<meta property="og:locale" content="([^"]+)"/), `${where} og:locale`).toMatch(new RegExp(`^${locale}_[A-Z]{2}$`));
        expect(html, `${where} description`).toMatch(/<meta name="description" content="[^"]{20,}"/);
        for (const ld of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
          expect(() => JSON.parse(ld[1]), `${where} JSON-LD`).not.toThrow();
        }
      }
    }
  });

  test('the flows that must stay out of search results say so', async ({ request, isMobile }) => {
    test.skip(isMobile, 'markup is the same on every device');
    for (const path of ['/checkout', '/cart']) {
      expect(await (await request.get(`/en${path}`)).text(), path).toMatch(/<meta name="robots" content="noindex/);
    }
  });

  test('QA-03 the sitemap lists the five holy places as well as the pages', async ({ request, isMobile }) => {
    test.skip(isMobile, 'markup is the same on every device');
    const xml = await (await request.get('/sitemap.xml')).text();
    for (const place of PLACES) expect(xml).toContain(`/en/sites/${place}</loc>`);
    for (const path of ['/en</loc>', '/en/sites</loc>', '/en/tour</loc>', '/en/candle</loc>', '/en/donate</loc>']) expect(xml).toContain(path);
  });

  test('QA-13 photos and sounds are cached by the browser for a day, not re-asked on every visit', async ({ request, isMobile }) => {
    test.skip(isMobile, 'headers are the same on every device');
    for (const path of ['/images/logo.webp', '/images/latin/latin1.jpg', '/sounds/Christians.mp3']) {
      const res = await request.head(path);
      expect(res.status(), path).toBe(200);
      expect(res.headers()['cache-control'], path).toMatch(/max-age=86400/);
    }
    expect((await request.get('/sw.js')).headers()['cache-control']).toContain('no-store');
  });

  test('QA-04 the site has a favicon, a touch icon and a web manifest', async ({ request, page, isMobile }) => {
    test.skip(isMobile, 'markup is the same on every device');
    for (const path of ['/favicon.ico', '/icon.png', '/apple-icon.png']) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(200);
      expect(res.headers()['content-type'], path).toMatch(/^image\//);
    }
    await offline(page);
    await page.goto('/he');
    await expect(page.locator('link[rel="icon"]').first()).toHaveAttribute('href', /icon/);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', /apple-icon/);
    const manifest = await (await request.get('/manifest.webmanifest')).json();
    expect(manifest).toMatchObject({ name: 'Nazareth Holy Cross', theme_color: '#0a0e1a', display: 'standalone' });
    expect(manifest.icons.length).toBeGreaterThan(0);
  });
});

test.describe('language switcher', () => {
  test('QA-05 keeps the query and the section of the page, and keeps keyboard focus', async ({ page }) => {
    await offline(page);
    await page.goto('/en/reviews?utm_source=qa#review-wall-title');
    await page.getByRole('button', { name: /language/i }).click();
    await page.getByRole('link', { name: 'עברית' }).click();
    await expect(page).toHaveURL(/\/he\/reviews\?utm_source=qa#review-wall-title$/);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    // Focus is on the switcher, not lost on <body>.
    await expect(page.getByRole('button', { name: /^(שפה|Language)/ })).toBeFocused();
  });

  test('QA-06 Escape closes the menu and puts focus back on its button', async ({ page }) => {
    await offline(page);
    await page.goto('/en');
    const trigger = page.getByRole('button', { name: /language/i });
    await trigger.click();
    await page.getByRole('link', { name: 'Français' }).focus();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('link', { name: 'Français' })).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
});

test.describe('keyboard', () => {
  test('the skip link is the first stop, becomes visible and moves focus to the content', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard path');
    await offline(page);
    for (const path of ['/en', '/he/sites', '/en/candle']) {
      await page.goto(path);
      await page.keyboard.press('Tab');
      const skip = page.locator('a.skip-link');
      await expect(skip).toBeFocused();
      expect((await skip.boundingBox())!.y).toBeGreaterThanOrEqual(0);
      await page.keyboard.press('Enter');
      await expect(page.locator('#main')).toBeFocused();
    }
  });

  test('every stop on the way through a page has a focus indicator you can see', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard path');
    await offline(page);
    await seedCart(page);
    for (const path of ['/en/donate', '/he/candle', '/en/reviews', '/en/cart']) {
      await page.goto(path);
      for (let i = 0; i < 40; i++) {
        await page.keyboard.press('Tab');
        const state = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el || el === document.body) return null;
          const cs = getComputedStyle(el);
          const box = el.getBoundingClientRect();
          const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none';
          // Controls drawn by the browser (video, iframe) show their own focus; some links paint theirs on ::after.
          const own = ['VIDEO', 'IFRAME', 'AUDIO'].includes(el.tagName) || getComputedStyle(el, '::after').outlineStyle !== 'none';
          return { name: `${el.tagName} ${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)}`, visible: box.width > 0 && box.height > 0, ring: ring || own };
        });
        if (!state) break; // reached the end of the page
        expect(state.visible, `${path} stop ${i}: ${state.name} is not visible`).toBe(true);
        expect(state.ring, `${path} stop ${i}: ${state.name} shows no focus`).toBe(true);
      }
    }
  });
});

test.describe('look and feel', () => {
  test('QA-07 text fields have a border that is at least 3:1 against the page (WCAG 1.4.11)', async ({ page }) => {
    await offline(page);
    await page.goto('/en/reviews');
    const ratio = await page.evaluate(() => {
      const channel = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      const lum = ([r, g, b]: number[]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
      const parse = (s: string) => (s.match(/[\d.]+/g) ?? []).map(Number);
      const input = document.querySelector('input.ui-input') as HTMLElement;
      const [r, g, b, a = 1] = parse(getComputedStyle(input).borderTopColor);
      const page = parse(getComputedStyle(document.body).backgroundColor);
      const border = [r, g, b].map((c, i) => c * a + page[i] * (1 - a));
      const [hi, lo] = [lum(border), lum(page)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    });
    expect(ratio).toBeGreaterThanOrEqual(3);
  });

  test('reduced motion: nothing waits for an animation and nothing loops', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await offline(page);
    for (const path of ['/en', '/en/sites', '/en/candle']) {
      await page.goto(path);
      await page.waitForTimeout(500);
      const state = await page.evaluate(() => ({
        hidden: [...document.querySelectorAll('.ui-reveal')].filter((e) => getComputedStyle(e).opacity === '0').length,
        looping: document.getAnimations().filter((a) => a.playState === 'running' && a.effect?.getTiming().iterations === Infinity).length,
        smooth: getComputedStyle(document.documentElement).scrollBehavior,
      }));
      expect(state, path).toEqual({ hidden: 0, looping: 0, smooth: 'auto' });
    }
  });

  test('QA-11 without JavaScript the page content is visible, not waiting to fade in', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.route(
      (url) => !['localhost', '127.0.0.1'].includes(url.hostname),
      (route) => route.abort(),
    );
    for (const path of ['/en', '/en/about', '/he/sites', '/en/sites/latin']) {
      await page.goto(path);
      const hidden = await page.evaluate(() => [...document.querySelectorAll('.ui-reveal')].filter((e) => getComputedStyle(e).opacity === '0').length);
      expect(hidden, path).toBe(0);
      await expect(page.locator('h1')).toBeVisible();
    }
    await context.close();
  });

  test('forced colours: a focused text field still shows a focus outline', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await offline(page);
    await page.goto('/en/reviews');
    await page.locator('input.ui-input').first().focus();
    const outline = await page.locator('input.ui-input').first().evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe('none');
  });

  test('QA-12 forced colours: the chosen amount, the current page and the current step stay marked', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await offline(page);
    await page.goto('/en/donate');
    const chosen = page.locator('label:has(input[name="amount"]:checked)');
    await expect(chosen).toHaveCount(1);
    expect(await chosen.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
    expect(await page.locator('[aria-current="step"]').first().evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
    await page.goto('/en/sites');
    const header = page.locator('header');
    if (await header.locator('a[aria-current="page"]').count()) {
      expect(await header.locator('a[aria-current="page"]').first().evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
    }
  });
});

test.describe('accessibility (axe: WCAG 2.x A/AA, 2.2 AA and best practice)', () => {
  for (const locale of ['en', 'he', 'ar']) {
    test(`QA: every page in ${locale} has no violations`, async ({ page }) => {
      test.setTimeout(120_000);
      await offline(page);
      await seedCart(page);
      for (const path of [...PAGES, '/no-such-page']) {
        await page.goto(`/${locale}${path}`);
        await page.waitForLoadState('load');
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
          .exclude('iframe')
          .analyze();
        expect(
          results.violations.map((v) => `${locale}${path} ${v.impact} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`),
        ).toEqual([]);
      }
    });
  }
});

test.describe('accessibility of interactive states', () => {
  const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
  async function expectClean(page: Page, label: string) {
    const results = await new AxeBuilder({ page }).withTags(TAGS).exclude('iframe').analyze();
    expect(results.violations.map((v) => `${label} ${v.impact} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`)).toEqual([]);
  }

  for (const locale of ['en', 'he']) {
    test(`${locale}: language menu, mobile menu, photo viewer and form errors have no violations`, async ({ page, isMobile }) => {
      test.setTimeout(90_000);
      await offline(page);
      await seedCart(page);
      await page.goto(`/${locale}`);
      await page.locator('button[aria-haspopup="true"]').first().click();
      await expectClean(page, 'language menu');
      await page.keyboard.press('Escape');
      if (isMobile) {
        await page.locator('button[aria-controls="main-nav"]').click();
        await expectClean(page, 'mobile menu');
      }
      for (const path of ['/checkout', '/candle', '/donate', '/reviews']) {
        await page.goto(`/${locale}${path}`);
        await page.locator('form button[type=submit]').first().click();
        await expect(page.locator('[aria-invalid="true"]').first()).toBeVisible();
        await expectClean(page, `${path} with errors`);
      }
      await page.goto(`/${locale}/sites/latin`);
      await page.locator('button[aria-haspopup="dialog"]').first().click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expectClean(page, 'photo viewer');
    });
  }
});

test.describe('navigation', () => {
  test('back and forward walk through the visited pages, in a language kept on every link', async ({ page, isMobile }) => {
    await offline(page);
    await page.goto('/he');
    if (isMobile) await page.locator('button[aria-controls="main-nav"]').click();
    await page.locator('#main-nav a[href="/he/sites"]').click();
    await expect(page).toHaveURL(/\/he\/sites$/);
    await page.locator('a[href="/he/sites/latin"]').first().click();
    await expect(page).toHaveURL(/\/he\/sites\/latin$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/he\/sites$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/he$/);
    await page.goForward();
    await expect(page).toHaveURL(/\/he\/sites$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'he');
    // Every internal link of the page keeps the language.
    const hrefs = await page.locator('main a[href^="/"], header a[href^="/"], footer a[href^="/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    expect(hrefs.filter((h) => h && !h.startsWith('/he'))).toEqual([]);
  });

  test('the shop answers from outside (smoke: owned by another team)', async ({ page }) => {
    await page.route(
      (url) => !['localhost', '127.0.0.1'].includes(url.hostname) && !/nazareth-holy-cross-api/.test(url.hostname),
      (route) => route.abort(),
    );
    const res = await page.goto('/en/shop');
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveCount(1);
  });
});

test.describe('the cart in two tabs', () => {
  test('a change in one tab shows in the other, and survives a reload', async ({ context }) => {
    await context.addInitScript((lines) => {
      if (!sessionStorage.getItem('qa-seeded')) {
        localStorage.setItem('nhc.cart.v1', JSON.stringify(lines));
        sessionStorage.setItem('qa-seeded', '1');
      }
    }, CART);
    const a = await context.newPage();
    const b = await context.newPage();
    for (const p of [a, b]) {
      await p.route(
        (url) => !['localhost', '127.0.0.1'].includes(url.hostname),
        (route) => route.abort(),
      );
    }
    await a.goto('/en/cart');
    await b.goto('/en/cart');
    await expect(b.getByTestId('cart-line')).toHaveCount(1);
    await a.getByRole('button', { name: 'Remove Olive wood cross' }).click();
    await expect(b.getByRole('heading', { name: 'Your Cart is Empty' })).toBeVisible();
    await b.reload();
    await expect(b.getByRole('heading', { name: 'Your Cart is Empty' })).toBeVisible();
  });
});
