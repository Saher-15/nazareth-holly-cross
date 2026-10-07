import { expect, test, type Page } from '@playwright/test';

// Performance smoke test with budgets (docs/PERFORMANCE.md). It runs against the local production build, unthrottled,
// so the limits are generous on purpose: they catch a regression of the kind that hurts (a 2 MB hero photo, a hero
// that re-wraps when the font arrives, a 20 MB video on every visit), not a few milliseconds of noise.
// Lab numbers with throttling and a Lighthouse score: tests/qa/measure-perf.mjs and tests/qa/lighthouse.mjs.

const PAGES = ['/en', '/en/sites/latin', '/en/shop', '/en/candle', '/en/gallery'];

// A photo gallery is image-heavy by nature: its first screen is a wall of pictures, so it gets its own limit.
const PAGE_IMAGE_BYTES: Record<string, number> = { '/en/gallery': 1_400_000 };

const BUDGET = {
  lcpMs: 2500, // "good" for Core Web Vitals
  cls: 0.1, // "good" for Core Web Vitals
  imageBytes: 1_000_000, // every photo the page loads before the visitor scrolls
  scriptBytes: 350_000, // all JavaScript the page loads (compressed)
  fontBytes: 250_000, // web fonts: Latin only, the other scripts only when the page shows them
  // The home hero film on a screen wide enough to get it: what it downloads in its first seconds. The film is the whole
  // tour (20 MB) in 30-second parts of 1-3 MB, so only the part that plays (and, near its end, the next) is fetched.
  heroFilmBytes: 3_000_000,
};

async function observe(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __perf: { lcp: number; cls: number } };
    w.__perf = { lcp: 0, cls: 0 };
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) w.__perf.lcp = entry.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as { hadRecentInput: boolean; value: number }[]) {
        if (!entry.hadRecentInput) w.__perf.cls += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
}

for (const path of PAGES) {
  test(`${path} stays inside the performance budget`, async ({ page }) => {
    await observe(page);
    // Film bytes are counted as they arrive (DevTools protocol): a video that is still streaming is not in the
    // resource timing until its request ends, so that list alone would not see a large film being buffered.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.enable');
    const filmRequests = new Set<string>();
    let filmBytes = 0;
    cdp.on('Network.requestWillBeSent', (e) => {
      if (/\/videos\//.test(e.request.url)) filmRequests.add(e.requestId);
    });
    cdp.on('Network.dataReceived', (e) => {
      if (filmRequests.has(e.requestId)) filmBytes += e.encodedDataLength;
    });
    await page.goto(path, { waitUntil: 'load' });
    // The hero film (wide screens) joins after the load event, once the browser is idle (at most 3 s): let it start.
    await page.waitForTimeout(path === '/en' ? 6000 : 2500);

    const result = await page.evaluate(() => {
      const perf = (window as unknown as { __perf: { lcp: number; cls: number } }).__perf;
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const bytes = (filter: (r: PerformanceResourceTiming) => boolean) =>
        resources.filter(filter).reduce((n, r) => n + (r.encodedBodySize || r.transferSize || 0), 0);
      return {
        lcp: perf.lcp,
        cls: perf.cls,
        image: bytes((r) => r.initiatorType === 'img' || /\.(avif|webp|jpe?g|png)(\?|$)/.test(r.name) || r.name.includes('/_next/image')),
        script: bytes((r) => r.initiatorType === 'script' || r.name.endsWith('.js')),
        font: bytes((r) => /\.woff2?(\?|$)/.test(r.name)),
        video: bytes((r) => r.initiatorType === 'video' || /\.(mp4|webm)(\?|$)/.test(r.name)),
      };
    });

    expect.soft(result.lcp, `LCP ${Math.round(result.lcp)} ms`).toBeLessThan(BUDGET.lcpMs);
    expect.soft(result.cls, `CLS ${result.cls.toFixed(3)}`).toBeLessThan(BUDGET.cls);
    expect.soft(result.image, `image bytes ${result.image}`).toBeLessThan(PAGE_IMAGE_BYTES[path] ?? BUDGET.imageBytes);
    expect.soft(result.script, `script bytes ${result.script}`).toBeLessThan(BUDGET.scriptBytes);
    expect.soft(result.font, `font bytes ${result.font}`).toBeLessThan(BUDGET.fontBytes);
    const film = Math.max(result.video, filmBytes);
    expect.soft(film, `film bytes ${film}`).toBeLessThan(BUDGET.heroFilmBytes);
  });
}

test('a phone never downloads the hero film', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'checked on the phone project');
  await page.goto('/en', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const films = await page.evaluate(
    () => performance.getEntriesByType('resource').filter((r) => /\.(mp4|webm)(\?|$)/.test(r.name)).length,
  );
  expect(films).toBe(0);
  await expect(page.locator('#home-hero video')).toHaveCount(0);
});

test('static assets are cached for a long time and the language cookie is not set for anonymous probes', async ({ request }) => {
  for (const file of ['/videos/hero-loop.mp4', '/videos/hero-tour-00.mp4', '/videos/hero-tour-11.mp4']) {
    const film = await request.head(file);
    expect(film.status(), file).toBe(200);
    expect(film.headers()['cache-control'], file).toMatch(/max-age=\d{6,}/);
  }
  const photo = await request.head('/images/nazareth-media/city-sunset-glow/lean-1920.avif');
  expect(photo.headers()['cache-control']).toMatch(/max-age=\d{6,}/);
  // A request without Accept-Language or cookies (a CDN health check, curl) has no language to remember.
  const page = await request.get('/en');
  expect(page.headers()['set-cookie']).toBeUndefined();
});
