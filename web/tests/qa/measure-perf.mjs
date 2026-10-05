// Lab numbers for the performance table in docs/PERFORMANCE.md: LCP, CLS, blocking time, bytes by type.
// Not Lighthouse (no score), but the same browser, the same throttling idea and comparable between runs.
//   QA_BASE=http://localhost:3801 PW_CHANNEL=msedge QA_LABEL=before node tests/qa/measure-perf.mjs
// Output: a table on stdout, JSON in QA_OUT (default: perf-<label>.json) and a screenshot per page + profile in QA_SHOTS.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const BASE = process.env.QA_BASE ?? 'http://localhost:3801';
const LABEL = process.env.QA_LABEL ?? 'run';
const SHOTS = process.env.QA_SHOTS;
const OUT = process.env.QA_OUT ?? `perf-${LABEL}.json`;
const PAGES = (process.env.QA_PAGES ?? '/en,/en/sites/latin,/en/shop,/en/candle,/en/gallery').split(',');
const PROFILES = {
  mobile: {
    // Lighthouse's "slow 4G" mobile profile: 4x CPU, 1.6 Mbit/s down, 150 ms RTT.
    ctx: { viewport: { width: 412, height: 823 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
    cpu: 4,
    net: { latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 },
  },
  desktop: { ctx: { viewport: { width: 1350, height: 940 } }, cpu: 1, net: null },
};

if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
const rows = [];
for (const [profile, cfg] of Object.entries(PROFILES)) {
  for (const path of PAGES) {
    const ctx = await browser.newContext(cfg.ctx);
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    if (cfg.net) await cdp.send('Network.emulateNetworkConditions', { offline: false, ...cfg.net });
    if (cfg.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cfg.cpu });
    const types = new Map();
    const bytes = { total: 0, image: 0, script: 0, media: 0, font: 0, css: 0, doc: 0, other: 0 };
    cdp.on('Network.responseReceived', (e) => types.set(e.requestId, e.type));
    cdp.on('Network.dataReceived', (e) => {
      const t = types.get(e.requestId);
      const n = e.encodedDataLength ?? 0;
      bytes.total += n;
      const key = { Image: 'image', Script: 'script', Media: 'media', Font: 'font', Stylesheet: 'css', Document: 'doc' }[t] ?? 'other';
      bytes[key] += n;
    });
    await page.addInitScript(() => {
      window.__m = { lcp: 0, lcpEl: '', cls: 0, tbt: 0 };
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) {
          window.__m.lcp = e.startTime;
          window.__m.lcpEl = (e.element?.tagName ?? '') + ' ' + (e.url ?? '').slice(-60);
        }
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) if (!e.hadRecentInput) window.__m.cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) if (e.duration > 50) window.__m.tbt += e.duration - 50;
      }).observe({ type: 'longtask', buffered: true });
    });
    await page.goto(BASE + path, { waitUntil: 'load' });
    await page.waitForTimeout(4000);
    const m = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      return { ...window.__m, ttfb: nav.responseStart, load: nav.loadEventEnd };
    });
    if (SHOTS) await page.screenshot({ path: join(SHOTS, `${LABEL}-${profile}-${path.replace(/\W+/g, '_')}.png`) });
    const row = { label: LABEL, profile, path, ...m, bytes };
    rows.push(row);
    const kb = (n) => (n / 1024).toFixed(0).padStart(6);
    console.log(
      `${profile.padEnd(8)} ${path.padEnd(18)} LCP ${m.lcp.toFixed(0).padStart(5)}  CLS ${m.cls.toFixed(3)}  TBT~${m.tbt.toFixed(0).padStart(4)}  TTFB ${m.ttfb.toFixed(0).padStart(4)}  total ${kb(bytes.total)} kB  img ${kb(bytes.image)}  js ${kb(bytes.script)}  media ${kb(bytes.media)}  font ${kb(bytes.font)}  lcp: ${m.lcpEl}`,
    );
    await ctx.close();
  }
}
await browser.close();
writeFileSync(OUT, JSON.stringify(rows, null, 2));
