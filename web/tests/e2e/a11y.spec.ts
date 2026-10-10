import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { locales } from '../../src/i18n/routing';
import en from '../../src/messages/en.json';
import ar from '../../src/messages/ar.json';
import he from '../../src/messages/he.json';

// WCAG 2.2 AA on every public page (docs/ACCESSIBILITY.md): axe-core with the WCAG A/AA tags on every route in
// English, Hebrew and Arabic (both projects: desktop and phone), again with every mode of the accessibility panel
// switched on, and the panel itself: keyboard, persistence before the first paint under the strict CSP, the
// hero's pause button, and a header that never overflows. Nothing here reaches the real API from the browser:
// every request that leaves localhost is aborted.

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const STORAGE_KEY = 'nhc.a11y.v1';
const ALL_MODES = { text: 200, contrast: true, links: true, motion: true, font: true, spacing: true, focus: true, cursor: true };
const CART = [{ _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', name: 'Olive wood cross', price: 25, img: '/images/candle.jpg', color: '', quantity: 2 }];
const PLACES = ['latin', 'greek', 'maryswell', 'oldcity', 'city'];
// Every page of the site. The shop and a product page read the live catalogue on the server (read-only).
const ROUTES = [
  '', '/sites', ...PLACES.map((p) => `/sites/${p}`), '/tour', '/about', '/candle', '/donate', '/checkout', '/cart',
  '/wishlist', '/shop', '/reviews', '/live', '/plan', '/visit', '/gospel', '/gallery', '/prayers', '/contact', '/faq',
  '/shipping-returns', '/privacy', '/terms', '/credits', '/search', '/search?q=nazareth', '/accessibility', '/no-such-page',
];

async function offline(page: Page) {
  await page.route(
    (url) => !['localhost', '127.0.0.1'].includes(url.hostname),
    (route) => route.abort(),
  );
}
async function seed(page: Page, settings?: object) {
  await page.addInitScript(
    ({ cart, settings, key }) => {
      try {
        localStorage.setItem('nhc.cart.v1', JSON.stringify(cart));
        if (settings) localStorage.setItem(key, JSON.stringify(settings));
      } catch {
        /* storage blocked: the page must still work */
      }
    },
    { cart: CART, settings, key: STORAGE_KEY },
  );
}

/** One product page of the live catalogue (the first card of the shop), or nothing when the catalogue is down. */
async function productRoute(page: Page): Promise<string[]> {
  await page.goto('/en/shop');
  const href = await page.locator('main a[href*="/shop/"]').first().getAttribute('href', { timeout: 5000 }).catch(() => null);
  return href ? [href.replace(/^\/en/, '')] : [];
}

async function axeViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).exclude('iframe').analyze();
  return results.violations.map((v) => `${label} ${v.impact} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`);
}

for (const [mode, settings] of [['plain', undefined], ['every panel mode on', ALL_MODES]] as const) {
  test.describe(`axe on every page (${mode})`, () => {
    for (const locale of ['en', 'he', 'ar']) {
      test(`${locale}: no WCAG 2.2 A/AA violations`, async ({ page }) => {
        test.setTimeout(300_000);
        await offline(page);
        await seed(page, settings);
        const routes = [...ROUTES, ...(await productRoute(page))];
        const found: string[] = [];
        for (const path of routes) {
          await page.goto(`/${locale}${path}`);
          await page.waitForLoadState('load');
          if (settings) await expect(page.locator('html'), path).toHaveAttribute('data-a11y-contrast', 'high');
          found.push(...(await axeViolations(page, `${locale}${path || '/'}`)));
        }
        expect(found).toEqual([]);
      });
    }
  });
}

test.describe('the accessibility panel', () => {
  test.beforeEach(async ({ page }) => {
    await offline(page);
  });

  test('opens from its floating button with the keyboard, works, and closes with Escape', async ({ page }) => {
    await page.goto('/en/about');
    const trigger = page.getByRole('button', { name: en.ux.a11y.open, exact: true });
    // Not in the header any more: a floating button in its own labelled landmark.
    await expect(page.locator('header').getByRole('button', { name: en.ux.a11y.open })).toHaveCount(0);
    await expect(page.getByRole('complementary', { name: en.ux.a11y.title }).getByRole('button', { name: en.ux.a11y.open })).toBeVisible();
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const dialog = page.getByRole('dialog', { name: en.ux.a11y.title });
    await expect(dialog).toBeVisible();
    // The focus is on the chosen text size; the arrow keys change it like any radio group.
    await expect(dialog.getByRole('radio', { name: '100%' })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('html')).toHaveAttribute('data-a11y-text', '125');
    // Tab reaches the switches; Space turns one on.
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('switch', { name: en.ux.a11y.contrast })).toBeFocused();
    await page.keyboard.press('Space');
    await expect(page.locator('html')).toHaveAttribute('data-a11y-contrast', 'high');
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(0, 0, 0)');
    // Escape closes it and gives the focus back to the button.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    // The panel links to the accessibility statement.
    await trigger.click();
    await dialog.getByRole('link', { name: en.ux.a11y.statement }).click();
    await expect(page).toHaveURL(/\/en\/accessibility$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(en.pilgrim.legal.accessibility.title);
  });

  test('the choice is kept, applied before the first paint, and the CSP stays strict', async ({ page }) => {
    const violations: string[] = [];
    page.on('console', (m) => {
      if (/Content.Security.Policy/i.test(m.text())) violations.push(m.text());
    });
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (e) => console.error(`Content-Security-Policy ${e.violatedDirective} ${e.blockedURI}`));
      // Read the attributes the moment the HTML has been parsed, before React has hydrated anything.
      document.addEventListener('DOMContentLoaded', () => {
        (window as unknown as { __early: string | null }).__early = document.documentElement.getAttribute('data-a11y-text');
      });
    });
    await page.goto('/en/candle');
    await page.getByRole('button', { name: en.ux.a11y.open, exact: true }).click();
    await page.getByRole('radio', { name: '150%' }).check();
    await page.getByRole('switch', { name: en.ux.a11y.links }).check();
    await page.reload();
    expect(await page.evaluate(() => (window as unknown as { __early: string | null }).__early)).toBe('150');
    await expect(page.locator('html')).toHaveAttribute('data-a11y-links', 'underline');
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('24px');
    // Another page keeps it too, and Reset clears everything.
    await page.goto('/he');
    await expect(page.locator('html')).toHaveAttribute('data-a11y-text', '150');
    await page.getByRole('button', { name: he.ux.a11y.open, exact: true }).click();
    await page.getByRole('button', { name: he.ux.a11y.reset }).click();
    await expect(page.locator('html')).not.toHaveAttribute('data-a11y-text');
    expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBeNull();
    expect(violations).toEqual([]);
  });

  test('the pre-paint script carries the nonce of the response and nothing else is inline', async ({ request }) => {
    const res = await request.get('/en');
    const csp = res.headers()['content-security-policy'];
    const nonce = csp.match(/'nonce-([^']+)'/)?.[1];
    expect(nonce).toBeTruthy();
    const scriptSrc = csp.split(';').find((d) => d.trim().startsWith('script-src')) ?? '';
    expect(scriptSrc).not.toContain('unsafe-inline');
    const html = await res.text();
    // Every inline script that runs carries the nonce (JSON-LD is data, not code).
    const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>/g)].map((m) => m[1]).filter((a) => !a.includes('application/ld+json'));
    expect(inline.length).toBeGreaterThan(0);
    for (const attributes of inline) expect(attributes, attributes).toContain(`nonce="${nonce}"`);
    expect(html).toContain('nhc.a11y.v1');
  });

  test('stop animations: nothing keeps moving, and the setting reaches the motion checks', async ({ page }) => {
    await seed(page, { motion: true });
    for (const path of ['/en', '/en/sites/latin', '/he/candle']) {
      await page.goto(path);
      const looping = await page.evaluate(() =>
        [...document.querySelectorAll('main *, header *')].filter((el) => {
          const s = getComputedStyle(el);
          return s.animationName !== 'none' && s.animationIterationCount === 'infinite';
        }).length,
      );
      expect(looping, path).toBe(0);
      await expect(page.locator('video')).toHaveCount(0);
      // Nothing moves, so the hero's pause button is not offered.
      await expect(page.getByRole('button', { name: en.ux.motion.pause })).toHaveCount(0);
    }
  });

  test('works in right-to-left and at 200% text on a phone, with no sideways scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seed(page, { text: 200 });
    for (const path of ['/ar', '/he/candle', '/en/sites/latin', '/ru/shop', '/en/accessibility']) {
      await page.goto(path);
      const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(sideways, path).toBeLessThanOrEqual(0);
    }
    await page.goto('/ar');
    const trigger = page.getByRole('button', { name: ar.ux.a11y.open, exact: true });
    await trigger.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box && box.x >= 0 && box.x + box.width <= 390).toBe(true);
    // Under the header, above the button: the whole panel is on the screen.
    const header = await page.locator('body > header').boundingBox();
    expect(box && header && box.y >= header.y + header.height - 1 && box.y + box.height <= 844).toBe(true);
    // The panel scrolls inside itself, so its last control can be reached at 200% text.
    await dialog.getByRole('link').scrollIntoViewIfNeeded();
    await expect(dialog.getByRole('link')).toBeInViewport();
  });
});

test.describe('the floating accessibility button', () => {
  type Box = { x: number; y: number; width: number; height: number };
  const overlap = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

  for (const [locale, messages] of [['en', en], ['he', he]] as const) {
    test(`${locale}: sits in the bottom corner at the start of the line and opens its panel above itself`, async ({ page }) => {
      await offline(page);
      await page.goto(`/${locale}/about`);
      const trigger = page.getByRole('button', { name: messages.ux.a11y.open, exact: true });
      const vp = page.viewportSize()!;
      const box = (await trigger.boundingBox())!;
      // 16px from the bottom and from the start edge: left in English, right in Hebrew (back to top has the other corner).
      expect(Math.round(vp.height - (box.y + box.height))).toBe(16);
      if (locale === 'en') expect(Math.round(box.x)).toBe(16);
      else expect(Math.round(vp.width - (box.x + box.width))).toBe(16);
      expect(Math.round(box.width)).toBe(48);
      // It stays there while the page scrolls, and never meets the back-to-top button.
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const back = page.getByRole('button', { name: messages.ux.backToTop });
      await expect(back).toBeVisible();
      const after = (await trigger.boundingBox())!;
      expect(Math.abs(after.y - box.y)).toBeLessThan(1);
      expect(overlap(after, (await back.boundingBox())!)).toBe(false);
      // The panel opens above the button, inside the window, and Escape gives the focus back.
      await trigger.click();
      const dialog = page.getByRole('dialog', { name: messages.ux.a11y.title });
      await expect(dialog).toBeVisible();
      const panel = (await dialog.boundingBox())!;
      expect(panel.y + panel.height).toBeLessThanOrEqual(after.y);
      expect(panel.x).toBeGreaterThanOrEqual(0);
      expect(panel.x + panel.width).toBeLessThanOrEqual(vp.width);
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(trigger).toBeFocused();
    });
  }

  test("on a phone it steps up above the home page's candle pill and stays clear of it", async ({ page }) => {
    await offline(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/en');
    const trigger = page.getByRole('button', { name: en.ux.a11y.open, exact: true });
    // Scroll the hero away: the "light a candle" pill slides in along the bottom edge.
    await page.evaluate(() => window.scrollTo(0, window.innerHeight * 2));
    const pill = page.locator('main a.ui-btn[data-shown="true"][href$="/candle"]');
    await expect(pill).toBeVisible();
    await expect(async () => {
      const [a, b] = [(await trigger.boundingBox())!, (await pill.boundingBox())!];
      expect(overlap(a, b)).toBe(false);
      expect(a.y + a.height).toBeLessThanOrEqual(b.y);
    }).toPass({ timeout: 5000 });
  });

  test('the phone menu covers it and takes it out of reach while open', async ({ page }) => {
    await offline(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/en/about');
    await page.locator('button[aria-controls="main-nav"]').click();
    const landmark = page.locator('aside[data-floating]');
    await expect(landmark).toHaveJSProperty('inert', true);
    await expect(page.locator('main#main')).toHaveJSProperty('inert', true);
    await page.keyboard.press('Escape');
    await expect(landmark).toHaveJSProperty('inert', false);
    await expect(page.locator('main#main')).toHaveJSProperty('inert', false);
  });
});

test.describe('moving backgrounds can be paused (WCAG 2.2.2)', () => {
  test('the home hero photo zoom pauses and plays', async ({ page }) => {
    await offline(page);
    await page.goto('/en');
    const pause = page.getByRole('button', { name: en.ux.motion.pause });
    await expect(pause).toBeVisible();
    const zoom = page.locator('#home-hero picture img, #home-hero img').first();
    expect(await zoom.evaluate((el) => getComputedStyle(el).animationPlayState)).toBe('running');
    await pause.click();
    await expect(page.getByRole('button', { name: en.ux.motion.play })).toBeVisible();
    expect(await zoom.evaluate((el) => getComputedStyle(el).animationPlayState)).toBe('paused');
    await page.getByRole('button', { name: en.ux.motion.play }).click();
    expect(await zoom.evaluate((el) => getComputedStyle(el).animationPlayState)).toBe('running');
  });

  test('a holy-site hero has the same pause button', async ({ page }) => {
    await offline(page);
    await page.goto('/he/sites/latin');
    const pause = page.locator('main header').getByRole('button', { name: he.ux.motion.pause });
    await pause.click();
    await expect(page.locator('main header').getByRole('button', { name: he.ux.motion.play })).toBeVisible();
    expect(await page.locator('main header img').first().evaluate((el) => getComputedStyle(el).animationPlayState)).toBe('paused');
  });
});

test.describe('form errors are identified in words and linked to their field (WCAG 3.3.1, 3.3.3)', () => {
  for (const locale of ['en', 'ar']) {
    test(`${locale}: every form, sent empty`, async ({ page }) => {
      test.setTimeout(120_000);
      await offline(page);
      await seed(page);
      for (const path of ['/contact', '/prayers', '/reviews', '/candle', '/donate', '/checkout']) {
        await page.goto(`/${locale}${path}`);
        await page.waitForLoadState('load');
        const submit = page.locator('main form button[type="submit"]').first();
        // Nothing reaches the API: the browser checks the fields first (and every request off localhost is aborted).
        const invalid = page.locator('main [aria-invalid="true"]');
        // A click before React has hydrated the form does nothing yet (seen under load): click again until it answers.
        await expect(async () => {
          await submit.click();
          await expect(invalid.first(), path).toBeVisible({ timeout: 1500 });
        }).toPass({ timeout: 15_000 });
        const problems = await invalid.evaluateAll((fields) =>
          fields.flatMap((field) => {
            const ids = (field.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
            const text = ids.map((id) => document.getElementById(id)?.textContent?.trim() ?? '').join(' ');
            return text ? [] : [`${field.getAttribute('name') ?? field.id}: no error text linked`];
          }),
        );
        expect(problems, path).toEqual([]);
        // The focus goes to the first field to fix (or to the summary that names them).
        const focused = await page.evaluate(() => {
          const el = document.activeElement;
          return !!el && (el.getAttribute('aria-invalid') === 'true' || !!el.closest('[role="alert"]') || el.matches('[role="alert"], [tabindex="-1"]'));
        });
        expect(focused, `${path}: focus after submit`).toBe(true);
        expect(await axeViolations(page, `${locale}${path} errors`)).toEqual([]);
      }
    });
  }
});

test('the header never overflows, in any language, with the logo and the search button', async ({ page, isMobile }) => {
  test.skip(isMobile, 'widths are set by the test');
  test.setTimeout(120_000);
  await offline(page);
  for (const locale of locales) {
    await page.goto(`/${locale}/about`);
    for (const width of [320, 390, 481, 768, 1181, 1240, 1366]) {
      await page.setViewportSize({ width, height: 800 });
      const over = await page.evaluate(() => {
        const bar = document.querySelector('header .ui-container')!;
        return bar.scrollWidth - bar.clientWidth;
      });
      expect(over, `${locale} at ${width}px`).toBeLessThanOrEqual(0);
    }
  }
});

test('focus is never hidden under the sticky header or a floating button (WCAG 2.4.11)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard only');
  test.setTimeout(120_000);
  await offline(page);
  await seed(page);
  for (const path of ['/en', '/he/candle', '/en/shop', '/ar/faq', '/en/accessibility']) {
    await page.goto(path);
    const hidden: string[] = [];
    for (let i = 0; i < 70; i += 1) {
      await page.keyboard.press('Tab');
      const state = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0 || getComputedStyle(el).opacity === '0') return { name: '', covered: false };
        const points = [[0.5, 0.5], [0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]].map(([fx, fy]) => [r.left + r.width * fx, r.top + r.height * fy]);
        const seen = points.some(([x, y]) => {
          if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return false;
          const hit = document.elementFromPoint(x, y);
          return !!hit && (hit === el || el.contains(hit) || hit.contains(el));
        });
        return { name: (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 40), covered: !seen };
      });
      if (state?.covered) {
        // Something that slides in on focus (the skip link) gets the time of its transition, and a long Tab jump the time
        // of the page's smooth scroll (html { scroll-behavior: smooth }): judge once the page has stopped moving.
        await page.waitForTimeout(400);
        for (let settle = 0, last = -1; settle < 20; settle += 1) {
          const y = await page.evaluate(() => scrollY);
          if (y === last) break;
          last = y;
          await page.waitForTimeout(100);
        }
        const again = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement;
          const r = el.getBoundingClientRect();
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return !!hit && (hit === el || el.contains(hit) || hit.contains(el));
        });
        if (!again) hidden.push(`${path}: ${state.name}`);
      }
    }
    expect(hidden).toEqual([]);
  }
});

// Audit 2026-10-10, F10: a control focused inside a horizontal product row must be wholly inside the visible part of
// the row (not cut by its edge), at any width, in both directions.
test('a focused control in a product row is never cut by the edge of the row', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard only');
  test.setTimeout(120_000);
  for (const [path, width] of [['/en/shop', 1366], ['/en/shop', 1024], ['/en/shop', 820], ['/he/shop', 1024], ['/ar/shop', 700]] as const) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(path);
    const track = page.locator('[data-testid="product-strip"] [role="region"]').first();
    await expect(track).toBeVisible();
    await track.focus();
    const cut: string[] = [];
    for (let i = 0; i < 40; i += 1) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(350); // a smooth scroll of the row, if any
      const state = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        const row = el?.closest('[data-testid="product-strip"] [role="region"]');
        if (!el || !row || el === row) return null;
        const r = el.getBoundingClientRect();
        const t = row.getBoundingClientRect();
        const inside = r.left >= t.left - 1 && r.right <= t.right + 1;
        return { name: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40), inside, left: Math.round(r.left - t.left), right: Math.round(t.right - r.right) };
      });
      if (state === null) break; // left the row
      if (!state.inside) cut.push(`${path} @${width}: ${state.name} (${state.left} / ${state.right})`);
    }
    expect(cut).toEqual([]);
  }
});
