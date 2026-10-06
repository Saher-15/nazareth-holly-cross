// WCAG 2.2 AA sweep of EVERY public route (docs/ACCESSIBILITY.md): axe-core on each page in en/he/ar at desktop
// and phone width, a reflow check at 320 px, and the same pages again with the accessibility panel's modes on.
//   QA_BASE=http://localhost:3871 PW_CHANNEL=msedge node tests/qa/a11y-audit.mjs
//   [QA_LOCALES=en,he,ar] [QA_MODES=0|1] [QA_OUT=dir] [QA_ROUTES=/about,/faq]
// Output: QA_OUT (default ./qa-report)/a11y-audit.json and one line per rule on stdout. Every request that leaves
// the local server is aborted, so nothing reaches the real API from the browser.
import AxeBuilder from '@axe-core/playwright';
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = process.env.QA_BASE ?? 'http://localhost:3871';
const OUT = process.env.QA_OUT ?? './qa-report';
const LOCALES = (process.env.QA_LOCALES ?? 'en,he,ar').split(',');
const WITH_MODES = process.env.QA_MODES !== '0';
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const VPS = { desktop: { width: 1366, height: 768 }, phone: { width: 390, height: 844 } };
const CART = [{ _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', name: 'Olive wood cross', price: 25, img: '/images/candle.jpg', color: '', quantity: 2 }];
const ALL_ROUTES = [
  '', '/sites', '/sites/latin', '/sites/greek', '/sites/maryswell', '/sites/oldcity', '/sites/city', '/tour', '/about',
  '/candle', '/donate', '/checkout', '/cart', '/wishlist', '/shop', '/reviews', '/live', '/plan', '/visit', '/gospel',
  '/gallery', '/prayers', '/contact', '/faq', '/shipping-returns', '/privacy', '/terms', '/credits', '/search',
  '/search?q=nazareth', '/accessibility', '/no-such-page',
];
const ROUTES = process.env.QA_ROUTES ? process.env.QA_ROUTES.split(',') : ALL_ROUTES;
// The panel's settings as the pre-paint script reads them (src/lib/a11y.ts).
const ALL_MODES = { text: 200, contrast: true, links: true, motion: true, font: true, spacing: true, focus: true };
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
const found = [];
const reflow = [];

async function scan(page, label) {
  const r = await new AxeBuilder({ page }).withTags(TAGS).exclude('iframe').analyze();
  for (const v of r.violations) {
    found.push({
      label,
      id: v.id,
      impact: v.impact,
      tags: v.tags.filter((t) => /^wcag\d/.test(t)),
      help: v.help,
      n: v.nodes.length,
      sample: v.nodes.slice(0, 3).map((n) => `${n.target.join(' ')} :: ${(n.failureSummary ?? '').split('\n').slice(1, 3).join(' | ').slice(0, 200)}`),
    });
  }
}

async function context(viewport, mobile, settings) {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
  const host = new URL(BASE).host;
  await ctx.route('**/*', (r) => (new URL(r.request().url()).host === host ? r.continue() : r.abort()));
  await ctx.addInitScript(
    ({ cart, settings }) => {
      try {
        localStorage.setItem('nhc.cart.v1', JSON.stringify(cart));
        if (settings) localStorage.setItem('nhc.a11y.v1', JSON.stringify(settings));
      } catch {}
    },
    { cart: CART, settings },
  );
  return ctx;
}

// A real product page: the first product link of the shop (read on the server from the live catalogue).
async function productPath(ctx) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}/en/shop`, { waitUntil: 'load' });
  const href = await page.locator('main a[href*="/shop/"]').first().getAttribute('href').catch(() => null);
  await page.close();
  return href ? href.replace(/^\/en/, '') : null;
}

const passes = [['plain', null]];
if (WITH_MODES) passes.push(['modes', ALL_MODES]);

for (const [passName, settings] of passes) {
  for (const [vpName, viewport] of Object.entries(VPS)) {
    const ctx = await context(viewport, vpName === 'phone', settings);
    const product = await productPath(ctx);
    const routes = product && !process.env.QA_ROUTES ? [...ROUTES, product] : ROUTES;
    for (const locale of LOCALES) {
      for (const route of routes) {
        const page = await ctx.newPage();
        await page.goto(`${BASE}/${locale}${route}`, { waitUntil: 'load' });
        await page.waitForTimeout(600);
        await scan(page, `${passName} ${locale}${route || '/'} @${vpName}`);
        await page.close();
      }
    }
    await ctx.close();
  }
  // Reflow (1.4.10): 320 CSS px wide, no sideways scroll.
  const ctx = await context({ width: 320, height: 640 }, true, settings);
  for (const locale of LOCALES) {
    for (const route of ROUTES) {
      const page = await ctx.newPage();
      await page.goto(`${BASE}/${locale}${route}`, { waitUntil: 'load' });
      await page.waitForTimeout(300);
      const over = await page.evaluate(() => {
        const width = document.documentElement.clientWidth;
        const sideways = document.documentElement.scrollWidth - width;
        // The widest offenders, to know what to fix.
        const wide = [...document.querySelectorAll('body *')]
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && (r.right > width + 1 || r.left < -1) && getComputedStyle(el).position !== 'fixed';
          })
          .slice(0, 4)
          .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}`);
        return { sideways, wide };
      });
      if (over.sideways > 0) reflow.push({ label: `${passName} ${locale}${route || '/'} @320`, ...over });
      await page.close();
    }
  }
  await ctx.close();
}

await browser.close();
fs.writeFileSync(`${OUT}/a11y-audit.json`, JSON.stringify({ found, reflow }, null, 1));
const byRule = new Map();
for (const f of found) {
  const key = `${f.impact} ${f.id} [${f.tags.join(',')}]`;
  const entry = byRule.get(key) ?? { pages: 0, nodes: 0, example: f };
  entry.pages += 1;
  entry.nodes += f.n;
  byRule.set(key, entry);
}
console.log(`axe: ${found.length} page-level violations, ${byRule.size} distinct rules`);
for (const [key, e] of byRule) console.log(`${key}: ${e.pages} pages, ${e.nodes} nodes; e.g. ${e.example.label} -> ${e.example.sample[0]}`);
console.log(`reflow at 320 px: ${reflow.length} pages scroll sideways`);
for (const r of reflow) console.log(`  ${r.label}: ${r.sideways}px ${r.wide.join(' ')}`);
