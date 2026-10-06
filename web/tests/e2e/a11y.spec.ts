import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { locales } from '../../src/i18n/routing';
import en from '../../src/messages/en.json';
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

  test('opens from the header with the keyboard, works, and closes with Escape', async ({ page }) => {
    await page.goto('/en/about');
    const trigger = page.getByRole('button', { name: en.ux.a11y.open, exact: true });
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
    const trigger = page.locator('header').getByRole('button', { name: 'إعدادات إمكانية الوصول', exact: true });
    await trigger.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box && box.x >= 0 && box.x + box.width <= 390).toBe(true);
    // The panel scrolls inside itself, so its last control can be reached at 200% text.
    await dialog.getByRole('link').scrollIntoViewIfNeeded();
    await expect(dialog.getByRole('link')).toBeInViewport();
  });
});

test.describe('moving backgrounds can be paused (WCAG 2.2.2)', () => {
  test('the home hero film and the Ken Burns zoom pause and play', async ({ page, isMobile }) => {
    await offline(page);
    await page.goto('/en');
    const pause = page.getByRole('button', { name: en.ux.motion.pause });
    await expect(pause).toBeVisible();
    const zoom = page.locator('#home-hero picture img, #home-hero img').first();
    expect(await zoom.evaluate((el) => getComputedStyle(el).animationPlayState)).toBe('running');
    await pause.click();
    await expect(page.getByRole('button', { name: en.ux.motion.play })).toBeVisible();
    expect(await zoom.evaluate((el) => getComputedStyle(el).animationPlayState)).toBe('paused');
    // On a wide screen the film may have started; once paused it stays paused.
    if (!isMobile) {
      const paused = await page.evaluate(() => [...document.querySelectorAll('video')].every((v) => v.paused));
      expect(paused).toBe(true);
    }
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
        await submit.click();
        // Nothing reaches the API: the browser checks the fields first (and every request off localhost is aborted).
        const invalid = page.locator('main [aria-invalid="true"]');
        await expect(invalid.first(), path).toBeVisible();
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

test('the header never overflows, in any language, with the accessibility button', async ({ page, isMobile }) => {
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
        // Something that slides in on focus (the skip link) gets the time of its transition.
        await page.waitForTimeout(400);
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
