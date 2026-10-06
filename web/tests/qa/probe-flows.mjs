// Exploratory probe of cross-cutting behaviour; prints findings. QA_BASE=... PW_CHANNEL=msedge node tests/qa/probe-flows.mjs
import { chromium } from '@playwright/test';
const BASE = process.env.QA_BASE ?? 'http://localhost:3603';
const b = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
const out = (...a) => console.log(...a);
const block = (ctx) => ctx.route('**/*', (r) => (new URL(r.request().url()).host === new URL(BASE).host ? r.continue() : r.abort()));
const LINE = [{ _id: 'p1', name: 'Cross', price: 25, img: '/images/candle.jpg', color: '', quantity: 1 }];

// 1. language switch keeps path, query, hash; back button
{
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  await block(ctx);
  const page = await ctx.newPage();
  for (const start of ['/en/sites/latin', '/en/sites/latin#place-gallery', '/en/reviews?x=1', '/en/shop?page=2']) {
    await page.goto(BASE + start);
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /language/i }).click();
    await page.getByRole('button', { name: 'עברית' }).click();
    await page.waitForURL(/\/he\//);
    await page.waitForTimeout(400);
    out(`lang switch ${start} -> ${page.url().replace(BASE, '')}  html lang=${await page.locator('html').getAttribute('lang')} dir=${await page.locator('html').getAttribute('dir')}`);
    await page.goBack().catch(() => {});
    await page.waitForTimeout(400);
    out(`   back -> ${page.url().replace(BASE, '')}`);
  }
  // history: navigate client-side home -> sites -> latin, then back/forward
  await page.goto(BASE + '/en');
  await page.getByRole('link', { name: 'Holy sites' }).first().click();
  await page.waitForURL(/\/en\/sites$/);
  await page.locator('a[href="/en/sites/latin"]').first().click();
  await page.waitForURL(/latin$/);
  await page.goBack(); await page.waitForURL(/\/en\/sites$/);
  await page.goBack(); await page.waitForURL(/\/en$/);
  await page.goForward(); await page.waitForURL(/\/en\/sites$/);
  out('history back/forward ok; h1 =', await page.locator('h1').first().textContent());
  await ctx.close();
}

// 2. mobile menu: closed links must not be focusable / visible
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await block(ctx);
  const page = await ctx.newPage();
  await page.goto(BASE + '/en');
  const info = await page.evaluate(() => {
    const nav = document.getElementById('main-nav');
    const cs = getComputedStyle(nav);
    const links = [...nav.querySelectorAll('a')].map((a) => {
      const r = a.getBoundingClientRect();
      return { vis: getComputedStyle(a).visibility, w: r.width, top: r.top };
    });
    return { display: cs.display, visibility: cs.visibility, transform: cs.transform, links: links.slice(0, 2) };
  });
  out('closed mobile nav:', JSON.stringify(info));
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  out('after 3 tabs focus is on:', await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 120)));
  await ctx.close();
}

// 3. offline: after load, go offline and try client navigation, a form, and reload
{
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  await block(ctx);
  const page = await ctx.newPage();
  await page.goto(BASE + '/en/reviews');
  await page.waitForTimeout(800);
  await ctx.setOffline(true);
  await page.getByRole('link', { name: 'Tour' }).first().click();
  await page.waitForTimeout(2500);
  out('offline nav ->', page.url().replace(BASE, ''), '| title:', await page.title());
  await ctx.setOffline(false);
  await ctx.close();
}

// 4. slow network: delay all JS/CSS/images by 600ms; page must still end up interactive and without errors
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  await ctx.route('**/*', async (r) => {
    if (new URL(r.request().url()).host !== new URL(BASE).host) return r.abort();
    await new Promise((res) => setTimeout(res, 600));
    return r.continue();
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 150)));
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 150)));
  const t0 = Date.now();
  await page.goto(BASE + '/en/candle', { waitUntil: 'load' });
  const nameInput = page.getByLabel('First name');
  await nameInput.fill('Anna');
  out(`slow network: candle usable after ${Date.now() - t0}ms; errors:`, errs.filter((e) => !/ERR_FAILED/.test(e)));
  await ctx.close();
}

// 5. reflow: 320px (400% zoom) and 200% zoom emulation
for (const [label, w, h] of [['320x256 (400% zoom)', 320, 256], ['683x384 (200% zoom)', 683, 384]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  await block(ctx);
  await ctx.addInitScript((l) => localStorage.setItem('nhc.cart.v1', JSON.stringify(l)), LINE);
  const bad = [];
  for (const loc of ['en', 'he', 'de', 'ru']) {
    for (const p of ['', '/sites', '/sites/latin', '/tour', '/about', '/candle', '/donate', '/checkout', '/cart', '/reviews', '/live']) {
      const page = await ctx.newPage();
      await page.goto(`${BASE}/${loc}${p}`);
      await page.waitForTimeout(350);
      const over = await page.evaluate(() => {
        const d = document.documentElement;
        const wide = [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(); return r.right > d.clientWidth + 1 && getComputedStyle(e).position !== 'fixed' && !e.closest('[aria-hidden=true]'); }).slice(0, 2).map((e) => e.tagName + '.' + String(e.className).slice(0, 40));
        return { sw: d.scrollWidth - d.clientWidth, wide };
      });
      if (over.sw > 1) bad.push(`${loc}${p || '/'} +${over.sw}px ${over.wide.join(',')}`);
      await page.close();
    }
  }
  out(`reflow ${label}:`, bad.length ? bad : 'no horizontal scroll');
  await ctx.close();
}

// 6. reduced motion: nothing hidden waiting for an animation; no running CSS animations of decorative loops
{
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' });
  await block(ctx);
  const page = await ctx.newPage();
  for (const p of ['/en', '/en/candle', '/en/live']) {
    await page.goto(BASE + p);
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => {
      const anims = document.getAnimations().filter((a) => a.playState === 'running').map((a) => (a.effect?.target?.className?.toString?.() ?? '') + ':' + (a.animationName ?? a.transitionProperty ?? '')).slice(0, 8);
      const hidden = [...document.querySelectorAll('.ui-reveal')].filter((e) => getComputedStyle(e).opacity === '0').length;
      return { running: anims, revealHidden: hidden, smooth: getComputedStyle(document.documentElement).scrollBehavior };
    });
    out('reduced-motion', p, JSON.stringify(r));
  }
  await ctx.close();
}
await b.close();
