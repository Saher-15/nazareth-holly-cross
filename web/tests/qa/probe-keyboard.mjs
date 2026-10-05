// Keyboard probe: Tab through each page; report focus that is invisible, off-screen, trapped or lost.
//   QA_BASE=... PW_CHANNEL=msedge node tests/qa/probe-keyboard.mjs
import { chromium } from '@playwright/test';
const BASE = process.env.QA_BASE ?? 'http://localhost:3603';
const b = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
const PAGES = ['/en', '/he', '/ar', '/en/sites', '/en/sites/latin', '/en/tour', '/en/about', '/en/candle', '/en/donate', '/en/checkout', '/en/cart', '/en/reviews', '/en/live', '/en/no-such'];
const VPS = { desktop: { width: 1366, height: 768 }, mobile: { width: 390, height: 844 } };

function describe(el) {
  if (!el || el === document.body) return null;
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  const ring = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
  const shadow = cs.boxShadow !== 'none';
  const parentRing = (() => {
    // some controls show focus on a wrapper via :focus-within or sibling; check ancestors up to 3 levels
    let p = el.parentElement;
    for (let i = 0; i < 3 && p; i++, p = p.parentElement) {
      const c = getComputedStyle(p);
      if (c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) > 0) return true;
    }
    return false;
  })();
  return {
    tag: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.getAttribute('aria-label') ? `[${el.getAttribute('aria-label').slice(0, 30)}]` : '') + ' "' + (el.textContent || '').trim().slice(0, 30) + '"',
    visible: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none',
    inViewport: r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth,
    ring,
    shadow,
    parentRing,
    tabindex: el.getAttribute('tabindex'),
    inert: !!el.closest('[inert],[aria-hidden="true"]'),
    top: Math.round(r.top + scrollY),
  };
}

for (const [vpName, viewport] of Object.entries(VPS)) {
  const ctx = await b.newContext({ viewport, hasTouch: vpName === 'mobile', isMobile: vpName === 'mobile' });
  await ctx.route('**/*', (r) => (new URL(r.request().url()).host === new URL(BASE).host ? r.continue() : r.abort()));
  await ctx.addInitScript(() => localStorage.setItem('nhc.cart.v1', JSON.stringify([{ _id: 'p1', name: 'Cross', price: 25, img: '/images/candle.jpg', color: '', quantity: 1 }])));
  for (const path of PAGES) {
    const page = await ctx.newPage();
    await page.goto(BASE + path, { waitUntil: 'load' });
    await page.waitForTimeout(600);
    const seen = [];
    const issues = [];
    for (let i = 0; i < 70; i++) {
      await page.keyboard.press('Tab');
      const d = await page.evaluate(describe, await page.evaluateHandle(() => document.activeElement));
      if (!d) { issues.push(`tab ${i}: focus on body (lost or end)`); break; }
      seen.push(d.tag);
      if (!d.visible) issues.push(`tab ${i}: focused element not visible: ${d.tag}`);
      else if (!d.ring && !d.shadow && !d.parentRing) issues.push(`tab ${i}: no focus indicator: ${d.tag}`);
      if (d.inert) issues.push(`tab ${i}: focus inside aria-hidden/inert: ${d.tag}`);
      if (seen.length > 2 && seen.slice(0, -1).includes(d.tag) && seen[0] === d.tag) break; // wrapped around
    }
    console.log(`${vpName} ${path}: ${seen.length} stops; ${issues.length ? issues.slice(0, 8).join('\n    ') : 'ok'}`);
    await page.close();
  }
  await ctx.close();
}
await b.close();
