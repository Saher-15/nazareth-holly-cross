// Rough lab numbers (LCP, CLS, long tasks, bytes) on a throttled phone. Not Lighthouse, but comparable between runs.
//   QA_BASE=... PW_CHANNEL=msedge node tests/qa/probe-perf.mjs
import { chromium } from '@playwright/test';
const BASE = process.env.QA_BASE ?? 'http://localhost:3603';
const b = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
const PAGES = ['/en', '/he', '/en/sites', '/en/sites/latin', '/en/tour', '/en/candle', '/en/donate', '/en/reviews', '/en/live'];
for (const [name, opts, cpu, net] of [
  ['phone 4G (CPU x4, 1.6 Mbit/s, 150 ms)', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, 4, { latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 }],
  ['desktop (no throttling)', { viewport: { width: 1366, height: 768 } }, 1, null],
]) {
  console.log(`\n== ${name}`);
  for (const path of PAGES) {
    const ctx = await b.newContext(opts);
    await ctx.route('**/*', (r) => (new URL(r.request().url()).host === new URL(BASE).host ? r.continue() : r.abort()));
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    if (net) await cdp.send('Network.emulateNetworkConditions', { offline: false, ...net });
    if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
    let bytes = 0;
    let js = 0;
    let img = 0;
    let video = 0;
    cdp.on('Network.loadingFinished', () => {});
    page.on('response', async (r) => {
      const len = Number((await r.allHeaders())['content-length'] ?? 0);
      const t = r.request().resourceType();
      bytes += len;
      if (t === 'script') js += len;
      if (t === 'image') img += len;
      if (t === 'media') video += len;
    });
    await page.addInitScript(() => {
      window.__m = { lcp: 0, cls: 0, tbt: 0 };
      new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__m.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__m.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.duration > 50) window.__m.tbt += e.duration - 50; }).observe({ type: 'longtask', buffered: true });
    });
    await page.goto(BASE + path, { waitUntil: 'load' });
    await page.waitForTimeout(3500);
    const m = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      return { ...window.__m, ttfb: nav.responseStart, dcl: nav.domContentLoadedEventEnd, load: nav.loadEventEnd };
    });
    console.log(`${path.padEnd(18)} LCP ${m.lcp.toFixed(0).padStart(5)} ms  CLS ${m.cls.toFixed(3)}  TBT~${m.tbt.toFixed(0).padStart(4)} ms  TTFB ${m.ttfb.toFixed(0).padStart(4)}  load ${m.load.toFixed(0).padStart(5)}  JS ${(js / 1024).toFixed(0)} kB  img ${(img / 1024).toFixed(0)} kB  media ${(video / 1048576).toFixed(1)} MB  total ${(bytes / 1024).toFixed(0)} kB`);
    await ctx.close();
  }
}
await b.close();
