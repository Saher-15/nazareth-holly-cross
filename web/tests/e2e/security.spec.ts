import { expect, test, type Page } from '@playwright/test';

// Security headers and the Content-Security-Policy. Nothing here writes to the production API:
// anything that leaves localhost is aborted (a blocked request is not a CSP violation, so a
// violation event always means the page itself did something the policy forbids).

async function blockOutside(page: Page) {
  await page.route(
    (url) => !['localhost', '127.0.0.1'].includes(url.hostname),
    (route) => route.abort(),
  );
}

// Collects every Content-Security-Policy violation the browser reports on the page.
async function watchViolations(page: Page) {
  const violations: string[] = [];
  await page.exposeFunction('__reportViolation', (text: string) => violations.push(text));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      (window as unknown as { __reportViolation: (t: string) => void }).__reportViolation(
        `${e.violatedDirective} blocked ${e.blockedURI || 'inline'} (${(e.sample || '').slice(0, 60)})`,
      );
    });
  });
  page.on('console', (m) => {
    if (/content security policy/i.test(m.text())) violations.push(m.text());
  });
  return violations;
}

const header = async (page: Page, path: string, name: string) => {
  const res = await page.request.get(path);
  return res.headers()[name];
};

test.describe('response headers', () => {
  test('every page carries a strict, nonce-based Content-Security-Policy', async ({ request }) => {
    const res = await request.get('/en');
    const csp = res.headers()['content-security-policy'];
    expect(csp).toBeTruthy();

    const scriptSrc = csp.split('; ').find((d) => d.startsWith('script-src '))!;
    expect(scriptSrc).toMatch(/'nonce-[A-Za-z0-9+/]{22}=='/);
    expect(scriptSrc).toContain("'strict-dynamic'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    // Plain-http localhost must keep working, so the upgrade directive is for real https hosts only.
    expect(csp).not.toContain('upgrade-insecure-requests');
  });

  test('the nonce is new for every response and is the one on the page scripts', async ({ request }) => {
    const nonceOf = (csp: string) => /'nonce-([^']+)'/.exec(csp)![1];
    const a = await request.get('/en');
    const b = await request.get('/en');
    const nonceA = nonceOf(a.headers()['content-security-policy']);
    expect(nonceA).not.toBe(nonceOf(b.headers()['content-security-policy']));

    const html = await a.text();
    const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="[^"]*"[^>]*>/g)].map((m) => m[0]);
    expect(scripts.length).toBeGreaterThan(3);
    for (const tag of scripts) expect(tag).toContain(`nonce="${nonceA}"`);
    // Nothing executable is inline without the nonce (JSON-LD is data, not script).
    const inline = [...html.matchAll(/<script\b(?![^>]*\bsrc=)(?![^>]*type="application\/ld\+json")[^>]*>/g)].map((m) => m[0]);
    for (const tag of inline) expect(tag).toContain(`nonce="${nonceA}"`);
  });

  test('pages are rendered per request and never cached with a stale nonce', async ({ request }) => {
    const res = await request.get('/en/about');
    expect(res.headers()['cache-control']).toMatch(/no-store|private/);
  });

  test('the other hardening headers are set', async ({ request }) => {
    const h = (await request.get('/en')).headers();
    expect(h['x-frame-options']).toBe('DENY');
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(h['strict-transport-security']).toContain('max-age=');
    expect(h['cross-origin-opener-policy']).toBe('same-origin-allow-popups');
    expect(h['cross-origin-resource-policy']).toBe('same-origin');
    expect(h['x-powered-by']).toBeUndefined();
    const pp = h['permissions-policy'];
    for (const off of ['camera=()', 'microphone=()', 'geolocation=()', 'usb=()', 'serial=()', 'bluetooth=()']) {
      expect(pp).toContain(off);
    }
    expect(pp).toContain('payment=(self "https://www.paypal.com"');
  });

  test('static files also get the headers that apply to them', async ({ page }) => {
    expect(await header(page, '/images/logo.webp', 'x-content-type-options')).toBe('nosniff');
    expect(await header(page, '/images/logo.webp', 'cross-origin-resource-policy')).toBe('same-origin');
    expect(await header(page, '/sw.js', 'cache-control')).toContain('no-store');
  });

  test('crafted addresses cannot redirect a visitor to another site', async ({ request }) => {
    for (const probe of ['//evil.com', '/en//evil.com', '/https://evil.com', '/%5Cevil.com', '/%2F%2Fevil.com', '/en/%5C%5Cevil.com', '/\\evil.com']) {
      const res = await request.get(probe, { maxRedirects: 0 });
      const location = res.headers().location;
      if (location) {
        // Only ever a path on this site: never "//host", "\\host" or an absolute URL to somewhere else.
        expect(location, probe).toMatch(/^\/(?![/\\])/);
        expect(location, probe).not.toMatch(/^[a-z][a-z0-9+.-]*:/i);
      } else {
        expect(res.status(), probe).toBeGreaterThanOrEqual(200);
      }
    }
  });

  test('an address with a dot in it is still a page request: it gets the policy', async ({ request }) => {
    const res = await request.get('/en/some.thing', { maxRedirects: 0 });
    expect(res.status()).toBe(404);
    expect(res.headers()['content-security-policy']).toContain("'nonce-");
  });

  test('a language-less address is redirected to the visitor language (not a 404)', async ({ request }) => {
    const res = await request.get('/shop', { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(res.headers().location).toBe('/en/shop');
    expect(res.headers()['content-security-policy']).toBeTruthy();
  });
});

test.describe('the policy does not break the site', () => {
  const pages = [
    '/en',
    '/en/sites',
    '/en/sites/latin',
    '/en/tour',
    '/en/candle',
    '/en/donate',
    '/en/live',
    '/en/reviews',
    '/en/about',
    '/en/shop',
    '/en/cart',
    '/he',
    '/ar/sites',
    '/en/this-page-does-not-exist',
  ];

  for (const path of pages) {
    test(`no violations and working scripts on ${path}`, async ({ page }) => {
      await blockOutside(page);
      const violations = await watchViolations(page);
      const pageErrors: string[] = [];
      page.on('pageerror', (e) => pageErrors.push(e.message));
      await page.goto(path);
      // Hydration ran: the header's mobile/desktop controls are interactive React components.
      await page.waitForLoadState('networkidle');
      await expect(page.locator('html')).toHaveAttribute('lang', /.+/);
      expect(violations).toEqual([]);
      expect(pageErrors).toEqual([]);
    });
  }

  test('next/image and next/font still load from the page origin', async ({ page }) => {
    await blockOutside(page);
    const violations = await watchViolations(page);
    await page.goto('/en/sites/latin');
    await page.waitForLoadState('networkidle');
    const broken = await page.evaluate(() =>
      [...document.images].filter((img) => img.complete && img.currentSrc.startsWith(location.origin) && img.naturalWidth === 0).map((i) => i.currentSrc),
    );
    expect(broken).toEqual([]);
    expect(await page.evaluate(() => document.fonts.size)).toBeGreaterThan(0);
    expect(violations).toEqual([]);
  });

  test('structured data (JSON-LD) is still delivered and parses', async ({ page }) => {
    await page.goto('/en');
    const blocks = await page.locator('script[type="application/ld+json"]').evaluateAll((els) => els.map((e) => e.textContent ?? ''));
    expect(blocks.length).toBeGreaterThan(0);
    for (const raw of blocks) expect(() => JSON.parse(raw)).not.toThrow();
  });

  test('an injected inline script is refused by the policy', async ({ page }) => {
    await blockOutside(page);
    const violations = await watchViolations(page);
    await page.goto('/en/about');
    await page.waitForLoadState('networkidle');
    // Markup an attacker managed to get into the page: an inline script and an inline event handler,
    // neither with the nonce. (Parser-inserted, like injected HTML would be.)
    const ran = await page.evaluate(async () => {
      const w = window as unknown as { __xss?: boolean };
      w.__xss = false;
      document.open();
      document.write('<script>window.__xss = true</script><img src="/x.png" onerror="window.__xss = true">');
      document.close();
      await new Promise((r) => setTimeout(r, 300));
      return w.__xss;
    });
    expect(ran).toBe(false);
    expect(violations.join('\n')).toMatch(/script-src/);
  });

  test('a page cannot be framed by another site', async ({ page }) => {
    await page.goto('/en/about');
    const blocked = await page.evaluate(
      () =>
        new Promise<boolean>((resolve) => {
          const frame = document.createElement('iframe');
          frame.src = location.href;
          // The page itself is same-origin, so frame-ancestors 'none' is what refuses it.
          // A refused frame becomes the browser's error page, a different origin: reading it throws.
          frame.onload = () => {
            try {
              resolve(!frame.contentDocument || frame.contentDocument.body.childElementCount === 0);
            } catch {
              resolve(true);
            }
          };
          document.body.appendChild(frame);
          setTimeout(() => resolve(false), 5000);
        }),
    );
    expect(blocked).toBe(true);
  });
});
