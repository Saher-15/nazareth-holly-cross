// Full-page screenshots for visual review:  QA_OUT=dir QA_PAGES=/,/sites QA_LOCALES=en,he QA_VIEWPORTS=desktop,mobile node tests/qa/shots.mjs
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const BASE = process.env.QA_BASE ?? 'http://localhost:3603';
const OUT = process.env.QA_OUT ?? './qa-shots';
const PAGES = (process.env.QA_PAGES ?? ',/sites,/sites/latin,/tour,/about,/candle,/donate,/checkout,/cart,/reviews,/live,/nope,/shop').split(',');
const LOCALES = (process.env.QA_LOCALES ?? 'en,he').split(',');
const VPS = { desktop: { width: 1366, height: 768 }, tablet: { width: 768, height: 1024 }, mobile: { width: 390, height: 844 }, small: { width: 360, height: 640 } };
const WANT = (process.env.QA_VIEWPORTS ?? 'desktop,mobile').split(',');
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
for (const vp of WANT) {
  const ctx = await b.newContext({ viewport: VPS[vp], isMobile: vp === 'mobile' || vp === 'small', hasTouch: vp === 'mobile' || vp === 'small', reducedMotion: process.env.QA_REDUCED ? 'reduce' : 'no-preference', forcedColors: process.env.QA_FORCED ? 'active' : 'none' });
  await ctx.route('**/*', (r) => (new URL(r.request().url()).host === new URL(BASE).host ? r.continue() : r.abort()));
  await ctx.addInitScript(() => localStorage.setItem('nhc.cart.v1', JSON.stringify([{ _id: 'p1', name: 'Olive wood cross', price: 25, img: '/images/candle.jpg', color: '', quantity: 2 }])));
  for (const loc of LOCALES) {
    for (const p of PAGES) {
      const page = await ctx.newPage();
      await page.goto(`${BASE}/${loc}${p}`, { waitUntil: 'load' });
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 400) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 120));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(1200);
      const name = `${loc}${p.replace(/\//g, '_') || '_home'}-${vp}.png`;
      await page.screenshot({ path: `${OUT}/${name}`, fullPage: true });
      await page.close();
    }
  }
  await ctx.close();
}
await b.close();
console.log('done');
