// axe-core sweep over every page (and several interactive states) in en/he/ar at desktop + mobile.
//   QA_BASE=http://localhost:3603 PW_CHANNEL=msedge node tests/qa/axe.mjs   [QA_LOCALES=en,he,ar] [QA_OUT=dir]
import AxeBuilder from '@axe-core/playwright';
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = process.env.QA_BASE ?? 'http://localhost:3603';
const OUT = process.env.QA_OUT ?? './qa-report';
const LOCALES = (process.env.QA_LOCALES ?? 'en,he,ar').split(',');
const VPS = { desktop: { width: 1366, height: 768 }, mobile: { width: 390, height: 844 } };
const ROUTES = ['', '/sites', '/sites/latin', '/sites/greek', '/sites/maryswell', '/sites/oldcity', '/sites/city', '/tour', '/about', '/candle', '/donate', '/checkout', '/cart', '/reviews', '/live', '/no-such-page'];
const CART = [{ _id: 'p1', name: 'Olive wood cross', price: 25, img: '/images/candle.jpg', color: '', quantity: 2 }];
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
const found = [];

async function scan(page, label) {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  for (const v of r.violations) {
    found.push({ label, id: v.id, impact: v.impact, help: v.help, n: v.nodes.length, sample: v.nodes.slice(0, 3).map((n) => n.target.join(' ') + ' :: ' + (n.failureSummary ?? '').split('\n').slice(1, 3).join(' | ').slice(0, 220)) });
  }
}

for (const [vpName, viewport] of Object.entries(VPS)) {
  const ctx = await browser.newContext({ viewport, isMobile: vpName === 'mobile', hasTouch: vpName === 'mobile' });
  await ctx.route('**/*', (r) => {
    const u = new URL(r.request().url());
    return u.host === new URL(BASE).host ? r.continue() : r.abort();
  });
  await ctx.addInitScript((cart) => {
    try {
      localStorage.setItem('nhc.cart.v1', JSON.stringify(cart));
    } catch {}
  }, CART);
  for (const locale of LOCALES) {
    for (const route of ROUTES) {
      const page = await ctx.newPage();
      await page.goto(`${BASE}/${locale}${route}`, { waitUntil: 'load' });
      await page.waitForTimeout(700);
      await scan(page, `${locale}${route || '/'} @${vpName}`);
      await page.close();
    }
    // interactive states
    const page = await ctx.newPage();
    await page.goto(`${BASE}/${locale}`, { waitUntil: 'load' });
    await page.waitForTimeout(500);
    await page.locator('button[aria-haspopup="true"]').first().click();
    await scan(page, `${locale}/ language menu open @${vpName}`);
    await page.keyboard.press('Escape');
    if (vpName === 'mobile') {
      await page.locator('button[aria-controls="main-nav"]').click();
      await page.waitForTimeout(300);
      await scan(page, `${locale}/ mobile menu open @${vpName}`);
    }
    // forms with errors shown
    for (const route of ['/checkout', '/candle', '/donate', '/reviews']) {
      await page.goto(`${BASE}/${locale}${route}`, { waitUntil: 'load' });
      await page.waitForTimeout(500);
      const submit = page.locator('form button[type=submit]').first();
      if (await submit.count()) {
        await submit.click().catch(() => {});
        await page.waitForTimeout(400);
        await scan(page, `${locale}${route} form errors @${vpName}`);
      }
    }
    // gallery lightbox
    await page.goto(`${BASE}/${locale}/sites/latin`, { waitUntil: 'load' });
    await page.locator('button[aria-haspopup="dialog"]').first().click();
    await page.waitForTimeout(500);
    await scan(page, `${locale}/sites/latin lightbox @${vpName}`);
    await page.close();
  }
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${OUT}/axe.json`, JSON.stringify(found, null, 1));
const byKey = new Map();
for (const f of found) {
  const k = `${f.impact} ${f.id} :: ${f.help}`;
  const g = byKey.get(k) ?? { pages: new Set(), n: 0, sample: f.sample };
  g.pages.add(f.label);
  g.n += f.n;
  byKey.set(k, g);
}
for (const [k, g] of [...byKey].sort()) {
  console.log(`${k}  [${g.pages.size} page-states, ${g.n} nodes]`);
  console.log('   e.g. ' + [...g.pages].slice(0, 4).join(' ; '));
  console.log('   ' + g.sample.join('\n   '));
}
console.log(found.length ? `${found.length} violations rows` : 'axe: no violations');
