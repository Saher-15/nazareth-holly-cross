import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { isRtl, locales, openGraphLocales } from '../../src/i18n/routing';

// The site in 14 languages: addresses, hreflang, Open Graph, the language a visitor lands on and is
// remembered, fonts, and layouts that must survive long German or Russian words and right-to-left text.

const PAGES = ['', '/sites', '/sites/latin', '/sites/greek', '/tour', '/candle', '/shop', '/live', '/reviews', '/donate', '/about'];
// Pages whose Open Graph tags are written by this task's helpers (the shop writes its own).
const OG_PAGES = PAGES.filter((p) => p !== '/shop');

const attr = (html: string, tag: RegExp, name: string) => {
  const match = html.match(tag);
  return match?.[0].match(new RegExp(`${name}="([^"]*)"`))?.[1];
};

test.describe('hreflang, canonical and Open Graph in the served HTML', () => {
  for (const locale of locales) {
    test(`/${locale}: every page names its language versions`, async ({ request }) => {
      for (const page of PAGES) {
        const path = `/${locale}${page}`;
        const res = await request.get(path);
        expect(res.status(), path).toBe(200);
        const html = await res.text();

        expect(html, path).toContain(`<html lang="${locale}" dir="${isRtl(locale) ? 'rtl' : 'ltr'}"`);

        const alternates = new Map(
          [...html.matchAll(/<link rel="alternate" hrefLang="([^"]+)" href="([^"]+)"/g)].map((m) => [m[1], m[2]]),
        );
        expect([...alternates.keys()].sort(), `${path} hreflang set`).toEqual([...locales, 'x-default'].sort());

        const canonical = attr(html, /<link rel="canonical"[^>]*>/, 'href');
        expect(canonical, `${path} canonical`).toBe(alternates.get(locale));
        expect(alternates.get('x-default'), `${path} x-default`).toBe(alternates.get('en'));
        for (const [lang, href] of alternates) {
          if (lang === 'x-default') continue;
          expect(href, `${path} ${lang}`).toBe(`${new URL(canonical ?? '').origin}/${lang}${page}`);
        }

        if (OG_PAGES.includes(page)) {
          const og = [...html.matchAll(/<meta property="og:locale" content="([^"]+)"/g)].map((m) => m[1]);
          expect(og, `${path} og:locale`).toEqual([openGraphLocales[locale]]);
          const others = [...html.matchAll(/<meta property="og:locale:alternate" content="([^"]+)"/g)].map((m) => m[1]);
          expect(others, `${path} og:locale:alternate`).toHaveLength(locales.length - 1);
          expect(others).not.toContain(openGraphLocales[locale]);
        }

        // JSON-LD pages state their language.
        for (const block of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)) {
          for (const language of block[1].matchAll(/"inLanguage":"([^"]+)"/g)) expect(language[1], path).toBe(locale);
        }
      }
    });
  }
});

test('the sitemap lists every language version of every page', async ({ request }) => {
  const xml = await (await request.get('/sitemap.xml')).text();
  const entries = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => m[1]);
  expect(entries.length).toBeGreaterThanOrEqual(locales.length * 14);
  const urls = entries.map((e) => e.match(/<loc>([^<]+)<\/loc>/)?.[1]);
  expect(new Set(urls).size).toBe(urls.length);
  for (const entry of entries) {
    const loc = entry.match(/<loc>([^<]+)<\/loc>/)?.[1] ?? '';
    const langs = [...entry.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)];
    expect(langs.map((l) => l[1]).sort()).toEqual([...locales, 'x-default'].sort());
    expect(langs.map((l) => l[2])).toContain(loc);
  }
});

test.describe('the language a visitor lands on', () => {
  const cases: [string, string][] = [
    ['uk-UA', 'uk'],
    ['he-IL', 'he'],
    ['ar-EG', 'ar'],
    ['nl-NL', 'nl'],
    ['ro-RO', 'ro'],
    ['pt-BR', 'pt'],
    ['de-AT', 'de'],
    ['zh-CN', 'en'],
  ];
  for (const [accept, expected] of cases) {
    test(`a browser in ${accept} opens /${expected}`, async ({ browser, baseURL }) => {
      const context = await browser.newContext({ locale: accept, baseURL });
      const page = await context.newPage();
      await page.goto('/');
      await expect(page).toHaveURL(new RegExp(`/${expected}$`));
      await expect(page.locator('html')).toHaveAttribute('lang', expected);
      await context.close();
    });
  }

  test('a bare address keeps its path: /shop in Russian opens /ru/shop', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ locale: 'ru-RU', baseURL });
    const page = await context.newPage();
    await page.goto('/sites/latin');
    await expect(page).toHaveURL(/\/ru\/sites\/latin$/);
    await context.close();
  });

  test('the chosen language is remembered for the next visit', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ locale: 'en-US', baseURL });
    const page = await context.newPage();
    await page.goto('/en/about');
    await page.getByRole('button', { name: /language/i }).click();
    await page.getByRole('link', { name: 'Nederlands' }).click();
    await expect(page).toHaveURL(/\/nl\/about$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'nl');
    await page.goto('/'); // the bare address now follows the saved choice, not the browser language
    await expect(page).toHaveURL(/\/nl$/);
    await context.close();
  });

  test('a link to a page in a language is never redirected, whatever the browser language', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ locale: 'ru-RU', baseURL });
    const page = await context.newPage();
    const response = await page.goto('/he/about');
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/he\/about$/);
    await context.close();
  });

  test('search-engine robots get English for a bare address and are never redirected from a language page', async ({ request }) => {
    const headers = { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'accept-language': 'he' };
    const bare = await request.get('/', { headers, maxRedirects: 0 });
    expect(bare.status()).toBe(307);
    expect(new URL(bare.headers().location, 'http://x').pathname).toBe('/en');
    const page = await request.get('/fr/sites', { headers, maxRedirects: 0 });
    expect(page.status()).toBe(200);
    expect(page.headers()['set-cookie']).toBeUndefined();
  });

  test('the redirect varies by language and cookie and is not cached', async ({ request }) => {
    const res = await request.get('/', { headers: { 'accept-language': 'it' }, maxRedirects: 0 });
    expect(res.headers().vary).toMatch(/Accept-Language/i);
    expect(res.headers().vary).toMatch(/Cookie/i);
    expect(res.headers()['cache-control']).toMatch(/no-store/);
  });
});

test('the language menu lists every language as a link in its own script', async ({ page }) => {
  await page.goto('/en');
  await page.getByRole('button', { name: /language/i }).click();
  const menu = page.getByRole('list', { name: 'Language' });
  const links = menu.getByRole('link');
  await expect(links).toHaveCount(locales.length);
  for (const locale of locales) await expect(menu.locator(`a[lang="${locale}"]`)).toHaveAttribute('href', new RegExp(`/${locale}$`));
  await expect(menu.getByRole('link', { name: 'English' })).toHaveAttribute('aria-current', 'true');
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
});

test.describe('fonts', () => {
  // The unicode-range prefix of the font file that must have been downloaded to draw each script.
  const scripts: Record<string, RegExp> = {
    // (the browser writes ranges without leading zeros: U+590-5FF)
    he: /U\+59[0-9A-F]/i, // Hebrew
    ar: /U\+600/i, // Arabic
    ru: /U\+400/i, // Cyrillic
    uk: /U\+400/i,
    el: /U\+37[0-7]/i, // Greek
    ro: /U\+100/i, // Latin Extended-A: ș ț ă
  };
  for (const [locale, range] of Object.entries(scripts)) {
    test(`/${locale} loads a font that covers its script (no empty boxes)`, async ({ page }) => {
      await page.goto(`/${locale}`);
      await page.evaluate(() => document.fonts.ready);
      const loaded = await page.evaluate(() =>
        [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.unicodeRange),
      );
      expect(loaded.some((r) => range.test(r)), loaded.join(' | ').slice(0, 300)).toBe(true);
    });
  }
});

test.describe('layout survives long words and right-to-left text', () => {
  const layoutPages = ['', '/sites', '/sites/latin', '/candle', '/donate', '/about', '/live'];

  for (const locale of locales) {
    test(`/${locale}: nothing pushes the page sideways`, async ({ page }) => {
      for (const path of layoutPages) {
        await page.goto(`/${locale}${path}`);
        await page.evaluate(() => document.fonts.ready);
        const overflow = await page.evaluate(() => {
          const root = document.documentElement;
          const wide = [...document.querySelectorAll<HTMLElement>('body *')]
            .filter((el) => {
              const r = el.getBoundingClientRect();
              return r.width > 0 && r.right > root.clientWidth + 1 && getComputedStyle(el).position !== 'fixed' && !el.closest('[aria-hidden="true"]');
            })
            .slice(0, 3)
            .map((el) => `${el.tagName.toLowerCase()}.${el.className.toString().slice(0, 40)}`);
          return { scroll: root.scrollWidth - root.clientWidth, wide };
        });
        expect(overflow.scroll, `${locale}${path} horizontal scroll (${overflow.wide.join(', ')})`).toBeLessThanOrEqual(1);
      }
    });
  }

  test('Hebrew and Arabic text is not hyphenated and keeps letter-spacing off', async ({ page }) => {
    for (const locale of ['he', 'ar']) {
      await page.goto(`/${locale}`);
      const styles = await page.evaluate(() => {
        const p = document.querySelector('main p') as HTMLElement;
        const eyebrow = document.querySelector('.ui-eyebrow') as HTMLElement;
        return { hyphens: getComputedStyle(p).hyphens, spacing: getComputedStyle(eyebrow).letterSpacing };
      });
      expect(styles.hyphens, locale).toBe('manual');
      expect(['normal', '0px'], locale).toContain(styles.spacing);
    }
  });

  test('German text is allowed to hyphenate', async ({ page }) => {
    await page.goto('/de');
    const hyphens = await page.evaluate(() => getComputedStyle(document.querySelector('main p') as HTMLElement).hyphens);
    expect(hyphens).toBe('auto');
  });
});

test.describe('accessibility in other languages', () => {
  for (const locale of ['he', 'ar', 'ru', 'de', 'uk', 'ro', 'nl', 'el']) {
    test(`/${locale} has no serious accessibility violations`, async ({ page }) => {
      await page.goto(`/${locale}`);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(serious.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    });
  }
});

test('the footer line reads correctly in Hebrew and Arabic (isolated, so the © and year stay with the name)', async ({ page }) => {
  for (const locale of ['he', 'ar']) {
    await page.goto(`/${locale}`);
    const text = await page.locator('footer p').last().textContent();
    expect(text, locale).toMatch(/^⁦© \d{4} Nazareth Holy Cross⁩\./);
  }
});

test.describe('currency and shipping note', () => {
  // Nothing may reach PayPal or the production API from these tests.
  test.beforeEach(async ({ page }) => {
    await page.route((url) => !['localhost', '127.0.0.1'].includes(url.hostname), (route) => route.abort());
  });

  const cases: [string, RegExp][] = [
    ['he', /87\.50/], // 25 USD at the indicative shekel rate
    ['de', /22,00/], // and in euro
    ['uk', /1\s?038|1038/], // whole hryvnia
  ];
  for (const [locale, approx] of cases) {
    test(`a donation in /${locale} shows the dollar amount, an approximate local amount and the currency note`, async ({ page }) => {
      await page.goto(`/${locale}/donate`);
      await page.locator('#donate-name').fill('Maria');
      await page.locator('input[name="amount"][value="25"]').check({ force: true });
      await page.locator('form button[type="submit"]').click();
      await expect(page.getByTestId('donation-total')).toContainText(/25\.00|25,00/);
      const note = page.getByTestId('currency-note');
      await expect(note).toBeVisible();
      await expect(page.getByTestId('currency-approx')).toContainText(approx);
      await expect(note).not.toContainText(/shipping|Versand|משלוח/i); // a donation is not shipped
    });
  }

  test('English visitors get the dollar note without a made-up local price', async ({ page }) => {
    await page.goto('/en/donate');
    await page.locator('#donate-name').fill('Maria');
    await page.locator('input[name="amount"][value="25"]').check({ force: true });
    await page.locator('form button[type="submit"]').click();
    await expect(page.getByTestId('currency-note')).toContainText('US dollars (USD)');
    await expect(page.getByTestId('currency-approx')).toHaveCount(0);
  });
});
