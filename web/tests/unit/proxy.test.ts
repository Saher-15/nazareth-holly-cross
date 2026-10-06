// @vitest-environment node
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import proxy, { config } from '@/proxy';
import { languageFallbacks, locales } from '@/i18n/routing';
import { isCrawler, parseAcceptLanguage, withLanguageFallbacks } from '@/lib/negotiate';

const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

type Init = { path?: string; acceptLanguage?: string; cookie?: string; userAgent?: string; method?: string };

function ask({ path = '/', acceptLanguage, cookie, userAgent = CHROME, method = 'GET' }: Init = {}) {
  const headers: Record<string, string> = { 'user-agent': userAgent };
  if (acceptLanguage !== undefined) headers['accept-language'] = acceptLanguage;
  if (cookie) headers.cookie = cookie;
  return proxy(new NextRequest(`http://localhost:3000${path}`, { headers, method }));
}

/** Where a request is sent: the path of the redirect, or null when the page is served as it is. */
const redirectTo = (response: Response) => {
  const location = response.headers.get('location');
  return location ? new URL(location).pathname : null;
};

describe('language negotiation (Accept-Language)', () => {
  it.each([
    ['fr-CH, fr;q=0.9, en;q=0.8', '/fr'],
    ['de-AT,de;q=0.9,en;q=0.5', '/de'],
    ['pt-BR,pt;q=0.9', '/pt'],
    ['pt-PT', '/pt'],
    ['he-IL,he;q=0.9,en-US;q=0.8', '/he'],
    ['iw', '/he'], // the legacy code Android WebViews still send for Hebrew
    ['ar-EG,ar;q=0.9', '/ar'],
    ['uk-UA,uk;q=0.9,ru;q=0.5', '/uk'],
    ['ro-RO,ro;q=0.9', '/ro'],
    ['nl-BE,nl;q=0.9,fr;q=0.5', '/nl'],
    ['el-GR', '/el'],
    ['ru-RU,ru;q=0.9', '/ru'],
    ['en-GB,en;q=0.9,he;q=0.8', '/en'],
  ])('"%s" opens %s', (acceptLanguage, expected) => {
    expect(redirectTo(ask({ acceptLanguage }))).toBe(expected);
  });

  it('prefers the first language the browser lists over a later, better-weighted match order', () => {
    // q-values decide, not position: German at 0.9 beats French at 0.5.
    expect(redirectTo(ask({ acceptLanguage: 'fr;q=0.5, de;q=0.9' }))).toBe('/de');
  });

  it('falls back to English for languages the site does not offer', () => {
    expect(redirectTo(ask({ acceptLanguage: 'zh-CN,zh;q=0.9' }))).toBe('/en');
    expect(redirectTo(ask({ acceptLanguage: 'ja' }))).toBe('/en');
    expect(redirectTo(ask({ acceptLanguage: '*' }))).toBe('/en');
  });

  it('falls back to English without an Accept-Language header, or with a broken one', () => {
    expect(redirectTo(ask())).toBe('/en');
    expect(redirectTo(ask({ acceptLanguage: ';;;q=banana,,' }))).toBe('/en');
  });

  it('uses a neighbouring language for people who most likely read it (Belarusian → Russian, Catalan → Spanish)', () => {
    expect(redirectTo(ask({ acceptLanguage: 'be-BY,be;q=0.9' }))).toBe('/ru');
    expect(redirectTo(ask({ acceptLanguage: 'ca-ES,ca;q=0.9' }))).toBe('/es');
    expect(redirectTo(ask({ acceptLanguage: 'gsw-CH' }))).toBe('/de');
  });

  it('keeps a language the visitor lists themselves ahead of the neighbour', () => {
    // Belarusian first, but Polish listed explicitly at q=0.8 and Russian not at all: Polish is a real choice,
    // Russian only a guess at 0.999 would win by weight, so the neighbour is added just below Belarusian.
    expect(redirectTo(ask({ acceptLanguage: 'be;q=0.7, pl;q=0.9' }))).toBe('/pl');
  });

  it('redirects any bare path and keeps the rest of the address', () => {
    expect(redirectTo(ask({ path: '/shop', acceptLanguage: 'it' }))).toBe('/it/shop');
    expect(redirectTo(ask({ path: '/sites/latin', acceptLanguage: 'es' }))).toBe('/es/sites/latin');
  });
});

describe('the remembered language (cookie)', () => {
  it('beats Accept-Language when a visitor comes back to the bare address', () => {
    expect(redirectTo(ask({ acceptLanguage: 'fr', cookie: 'NEXT_LOCALE=he' }))).toBe('/he');
  });

  it('is ignored when it names a language the site does not have', () => {
    expect(redirectTo(ask({ acceptLanguage: 'fr', cookie: 'NEXT_LOCALE=xx' }))).toBe('/fr');
  });

  it('never overrides a language that is in the address', () => {
    const response = ask({ path: '/fr/shop', acceptLanguage: 'de', cookie: 'NEXT_LOCALE=he' });
    expect(redirectTo(response)).toBeNull();
  });

  it('is updated when the visitor opens a page in another language', () => {
    const response = ask({ path: '/ar/live', acceptLanguage: 'en', cookie: 'NEXT_LOCALE=en' });
    expect(redirectTo(response)).toBeNull();
    expect(response.headers.get('set-cookie')).toMatch(/NEXT_LOCALE=ar/);
  });

  it('is not set on a page whose language matches the browser (nothing to remember, and a shared cache may keep it)', () => {
    const response = ask({ path: '/en/shop', acceptLanguage: 'en-US,en;q=0.9' });
    expect(redirectTo(response)).toBeNull();
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('is not set for a client that sent no language at all (a probe, curl): it has no preference to remember', () => {
    const response = ask({ path: '/en', userAgent: 'curl/8.0' });
    expect(redirectTo(response)).toBeNull();
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('is still set when a browser asks for a page in a language other than its own', () => {
    const response = ask({ path: '/he/shop', acceptLanguage: 'en-US,en;q=0.9' });
    expect(response.headers.get('set-cookie')).toMatch(/NEXT_LOCALE=he/);
  });

  it('lasts a year and is not sent to other sites', () => {
    const response = ask({ path: '/ar/live', acceptLanguage: 'en', cookie: 'NEXT_LOCALE=en' });
    const cookie = response.headers.get('set-cookie') ?? '';
    expect(cookie).toMatch(/Max-Age=31536000/i);
    expect(cookie).toMatch(/SameSite=lax/i);
  });
});

describe('every page that names a language is served as it is', () => {
  it.each(locales)('/%s and /%s/shop are not redirected', (locale) => {
    expect(redirectTo(ask({ path: `/${locale}`, acceptLanguage: 'ru' }))).toBeNull();
    expect(redirectTo(ask({ path: `/${locale}/shop`, acceptLanguage: 'ru' }))).toBeNull();
  });

  it('does not add a Link header (hreflang lives in the page HTML and the sitemap)', () => {
    expect(ask({ path: '/de' }).headers.get('link')).toBeNull();
  });
});

describe('robots', () => {
  it.each([
    ['Googlebot', GOOGLEBOT],
    ['Bingbot', 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'],
    ['Facebook link preview', 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'],
    ['WhatsApp link preview', 'WhatsApp/2.23.20.0'],
    ['Slack', 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)'],
    ['Lighthouse', 'Mozilla/5.0 (Linux; Android 11) Chrome-Lighthouse'],
  ])('%s is recognised', (_name, userAgent) => {
    expect(isCrawler(userAgent)).toBe(true);
  });

  it.each([
    ['desktop Chrome', CHROME],
    ['headless Chrome (Playwright)', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/130.0 Safari/537.36'],
    ['an iPhone', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1'],
  ])('%s is a visitor', (_name, userAgent) => {
    expect(isCrawler(userAgent)).toBe(false);
  });

  it('gets English for a bare address whatever its headers and cookies say', () => {
    const response = ask({ path: '/', userAgent: GOOGLEBOT, acceptLanguage: 'he', cookie: 'NEXT_LOCALE=ar' });
    expect(redirectTo(response)).toBe('/en');
    expect(redirectTo(ask({ path: '/shop', userAgent: GOOGLEBOT, acceptLanguage: 'ru' }))).toBe('/en/shop');
  });

  it('is never redirected away from a page that names its language', () => {
    for (const locale of locales) {
      const response = ask({ path: `/${locale}/sites/latin`, userAgent: GOOGLEBOT, acceptLanguage: 'en' });
      expect(redirectTo(response)).toBeNull();
      expect(response.headers.get('set-cookie')).toBeNull(); // a robot has no preference to remember
    }
  });
});

describe('caching of the redirect', () => {
  it('varies by the headers it depends on and is not stored by shared caches', () => {
    const response = ask({ acceptLanguage: 'fr' });
    expect(response.headers.get('vary')).toMatch(/Accept-Language/);
    expect(response.headers.get('vary')).toMatch(/Cookie/);
    expect(response.headers.get('cache-control')).toMatch(/no-store/);
  });
});

describe('what the proxy leaves alone', () => {
  it('passes a POST (a server action) through untouched', () => {
    const response = ask({ path: '/fr/reviews', method: 'POST', acceptLanguage: 'be' });
    expect(redirectTo(response)).toBeNull();
  });

  it('is configured to skip API routes, Next internals and files', () => {
    const matcher = new RegExp(`^${config.matcher[0]}$`);
    for (const skipped of ['/api/anything', '/admin', '/admin/orders', '/_next/static/chunk.js', '/robots.txt', '/sitemap.xml', '/images/logo.webp', '/sw.js']) {
      expect(matcher.test(skipped), skipped).toBe(false);
    }
    for (const handled of ['/', '/fr', '/he/shop', '/ar/sites/latin', '/shop/66c7060187e696939c4ab0f8']) {
      expect(matcher.test(handled), handled).toBe(true);
    }
  });
});

describe('parseAcceptLanguage / withLanguageFallbacks', () => {
  it('reads weights and ignores malformed entries', () => {
    expect(parseAcceptLanguage('fr-CH, fr;q=0.9, en;q=0.8, *;q=0.5')).toEqual([
      { tag: 'fr-CH', q: 1 },
      { tag: 'fr', q: 0.9 },
      { tag: 'en', q: 0.8 },
      { tag: '*', q: 0.5 },
    ]);
    expect(parseAcceptLanguage('en;q=2, de;q=x, !!, fr')).toEqual([{ tag: 'fr', q: 1 }]);
  });

  it('adds the neighbour just below the language it stands for, and only once', () => {
    expect(withLanguageFallbacks('be, be-BY;q=0.9', locales, languageFallbacks)).toBe('be, be-BY;q=0.9, ru;q=0.999');
  });

  it('returns the header unchanged when nothing applies', () => {
    expect(withLanguageFallbacks('fr, en;q=0.5', locales, languageFallbacks)).toBe('fr, en;q=0.5');
    expect(withLanguageFallbacks('be, ru;q=0.5', locales, languageFallbacks)).toBe('be, ru;q=0.5');
  });

  it('only maps to languages the site really has', () => {
    for (const target of Object.values(languageFallbacks)) expect(locales).toContain(target);
  });
});

describe('Strict-Transport-Security on the proxy\'s own redirects', () => {
  it('is the full two-year, includeSubDomains, preload value (Netlify would otherwise fill in a weaker one)', async () => {
    const { HSTS_VALUE } = await import('@/lib/hsts');
    const redirect = ask({ path: '/shop', acceptLanguage: 'it' });
    expect(redirect.status).toBeGreaterThanOrEqual(300);
    expect(redirect.headers.get('strict-transport-security')).toBe(HSTS_VALUE);
    expect(HSTS_VALUE).toMatch(/max-age=63072000; includeSubDomains; preload/);
  });

  it('is left to next.config.ts on pages that are served (not redirected)', () => {
    expect(ask({ path: '/en/shop', acceptLanguage: 'en' }).headers.get('strict-transport-security')).toBeNull();
  });
});
