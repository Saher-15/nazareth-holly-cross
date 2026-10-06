// The WCAG 2.2 AA checks axe-core cannot make on its own (docs/ACCESSIBILITY.md), on every public route:
//   1. contrast of text that sits on photographs, gradients or glass (axe reports it as "incomplete"): the text is made
//      transparent, the element is photographed, and the text colour is compared with every background pixel;
//      the 10% darkest/lightest pixels decide (1.4.3);
//   2. focus not obscured (2.4.11) and focus visible (2.4.7): Tab through the page and check that every focused
//      element shows an outline or shadow and is not entirely covered by the sticky header or a floating button;
//   3. text spacing (1.4.12): the WCAG test values are forced on every element and clipped text is reported.
//   QA_BASE=http://localhost:3871 PW_CHANNEL=msedge node tests/qa/a11y-probe.mjs
//   [QA_LOCALES=en,he] [QA_CHECKS=contrast,focus,spacing] [QA_ROUTES=/,/candle] [QA_SETTINGS=all] [QA_VIEWPORTS=phone] [QA_OUT=dir]
// Every request that leaves the local server is aborted.
import AxeBuilder from '@axe-core/playwright';
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = process.env.QA_BASE ?? 'http://localhost:3871';
const OUT = process.env.QA_OUT ?? './qa-report';
const LOCALES = (process.env.QA_LOCALES ?? 'en,he,ar').split(',');
const CHECKS = (process.env.QA_CHECKS ?? 'contrast,focus,spacing').split(',');
const ALL_VPS = { desktop: { width: 1366, height: 768 }, phone: { width: 390, height: 844 } };
const VPS = Object.fromEntries(Object.entries(ALL_VPS).filter(([name]) => (process.env.QA_VIEWPORTS ?? 'desktop,phone').split(',').includes(name)));
const ROUTES = (process.env.QA_ROUTES ?? [
  '/', '/sites', '/sites/latin', '/sites/greek', '/sites/maryswell', '/sites/oldcity', '/sites/city', '/tour', '/about',
  '/candle', '/donate', '/checkout', '/cart', '/wishlist', '/shop', '/reviews', '/live', '/plan', '/visit', '/gospel',
  '/gallery', '/prayers', '/contact', '/faq', '/shipping-returns', '/privacy', '/terms', '/credits', '/search',
  '/accessibility', '/no-such-page',
].join(',')).split(',').map((r) => (r === '/' ? '' : r));
const SETTINGS = process.env.QA_SETTINGS === 'all'
  ? { text: 200, contrast: true, links: true, motion: true, font: true, spacing: true, focus: true, cursor: true }
  : null;
const CART = [{ _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', name: 'Olive wood cross', price: 25, img: '/images/candle.jpg', color: '', quantity: 2 }];
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
const report = { contrast: [], focus: [], spacing: [], checked: { contrast: 0, focus: 0, spacing: 0 } };

// A blank page that turns PNG screenshots into pixels (a canvas does the decoding; no extra package).
const decoderCtx = await browser.newContext();
const decoder = await decoderCtx.newPage();
await decoder.setContent('<canvas></canvas>');
async function pixels(png) {
  return decoder.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.querySelector('canvas');
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    return Array.from(g.getImageData(0, 0, img.width, img.height).data);
  }, png.toString('base64'));
}
const lin = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

async function context(viewport, mobile) {
  // bypassCSP: the probe injects its own test styles (transparent text, the 1.4.12 spacing); the site itself never does.
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce', bypassCSP: true });
  const host = new URL(BASE).host;
  await ctx.route('**/*', (r) => (new URL(r.request().url()).host === host ? r.continue() : r.abort()));
  await ctx.addInitScript(
    ({ cart, settings }) => {
      try {
        localStorage.setItem('nhc.cart.v1', JSON.stringify(cart));
        if (settings) localStorage.setItem('nhc.a11y.v1', JSON.stringify(settings));
      } catch {}
    },
    { cart: CART, settings: SETTINGS },
  );
  return ctx;
}

async function load(page, url) {
  await page.goto(url, { waitUntil: 'load' });
  // Lazy images and reveals: walk down the page once so every photo is there, then back to the top.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += innerHeight * 0.8) {
      scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    scrollTo(0, 0);
  });
  await page.waitForTimeout(400);
}

// ---------------------------------------------------------------------------------------------------- 1. contrast
async function checkContrast(page, label, seen) {
  const result = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
  const targets = [...new Set(result.incomplete.flatMap((r) => r.nodes.map((n) => n.target[0])).filter((t) => typeof t === 'string'))]
    .filter((t) => !seen.has(`${label.split(' ')[0]} ${t}`));
  targets.forEach((t) => seen.add(`${label.split(' ')[0]} ${t}`));
  // First read every text colour (before anything is changed: colours have transitions).
  const infos = [];
  for (const selector of targets) {
    const info = await page
      .locator(selector)
      .first()
      .evaluate((node) => {
        const cs = getComputedStyle(node);
        const size = parseFloat(cs.fontSize);
        const bold = Number(cs.fontWeight) >= 700;
        // Computed colours may come back as color(srgb ...) (color-mix); a canvas turns any of them into 0-255 RGBA.
        const g = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
        g.fillStyle = cs.color;
        g.fillRect(0, 0, 1, 1);
        const d = g.getImageData(0, 0, 1, 1).data;
        return { color: [d[0], d[1], d[2]], alpha: d[3] / 255, large: size >= 24 || (bold && size >= 18.66), text: node.textContent.trim().slice(0, 50), visible: cs.visibility !== 'hidden' && cs.opacity !== '0' };
      })
      .catch(() => null);
    if (info && info.text && info.visible) infos.push({ selector, ...info });
  }
  if (!infos.length) return;
  // Then hide every glyph (shadows stay: they are part of the background the text is read on) and photograph the
  // box of the text itself, in the middle of the window so the sticky header is not in the picture.
  await page.addStyleTag({ content: '*{color:transparent!important;-webkit-text-fill-color:transparent!important;transition:none!important;caret-color:transparent!important}' });
  for (const info of infos) {
    const box = await page
      .locator(info.selector)
      .first()
      .evaluate((node) => {
        node.scrollIntoView({ block: 'center', inline: 'center' });
        // The element's own text (a badge or icon inside has its own colours): its direct text nodes, or all of it.
        const own = [...node.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
        const rects = (own.length ? own : [node]).map((n) => {
          const range = document.createRange();
          range.selectNodeContents(n);
          return range.getBoundingClientRect();
        });
        const r = {
          left: Math.min(...rects.map((q) => q.left)),
          top: Math.min(...rects.map((q) => q.top)),
          right: Math.max(...rects.map((q) => q.right)),
          bottom: Math.max(...rects.map((q) => q.bottom)),
        };
        const x = Math.max(0, r.left);
        const y = Math.max(0, r.top);
        return { x, y, width: Math.min(innerWidth, r.right) - x, height: Math.min(innerHeight, r.bottom) - y };
      })
      .catch(() => null);
    if (!box || box.width < 2 || box.height < 2) continue;
    const png = await page.screenshot({ clip: box, animations: 'disabled', timeout: 5000 }).catch(() => null);
    if (!png) continue;
    const px = await pixels(png);
    const ratios = [];
    for (let i = 0; i < px.length; i += 4 * 2) {
      const bg = [px[i], px[i + 1], px[i + 2]];
      const fg = info.color.map((c, k) => c * info.alpha + bg[k] * (1 - info.alpha));
      ratios.push(ratio(fg, bg));
    }
    ratios.sort((a, b) => a - b);
    const p10 = ratios[Math.floor(ratios.length * 0.1)];
    const need = info.large ? 3 : 4.5;
    report.checked.contrast += 1;
    if (process.env.QA_DEBUG) console.log(info.selector, JSON.stringify(info), p10);
    if (p10 < need) report.contrast.push({ label, selector: info.selector, text: info.text, p10: Number(p10.toFixed(2)), min: Number(ratios[0].toFixed(2)), need });
  }
  await page.evaluate(() => document.querySelectorAll('style').forEach((s) => s.textContent.startsWith('*{color:transparent') && s.remove()));
}

// ------------------------------------------------------------------------------------------ 2. focus seen and shown
async function checkFocus(page, label) {
  await page.evaluate(() => {
    scrollTo(0, 0);
    document.activeElement?.blur();
  });
  const visited = new Set();
  const inspect = () =>
    page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const id = el.outerHTML.slice(0, 120);
      const rect = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const shows = (s) => (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none';
      // The ring may be drawn on the element, on a wrapper (3 levels) or on the next sibling (styled radio/switch).
      let visible = shows(cs);
      for (let p = el.parentElement, n = 0; !visible && p && n < 3; p = p.parentElement, n += 1) visible = shows(getComputedStyle(p));
      if (!visible && el.nextElementSibling) visible = shows(getComputedStyle(el.nextElementSibling));
      // Entirely hidden (2.4.11): every sample point is covered by something that is not the element.
      const pts = [[0.5, 0.5], [0.15, 0.15], [0.85, 0.15], [0.15, 0.85], [0.85, 0.85]].map(([fx, fy]) => [rect.left + rect.width * fx, rect.top + rect.height * fy]);
      let shown = 0;
      let cover = '';
      for (const [x, y] of pts) {
        if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
        const hit = document.elementFromPoint(x, y);
        if (hit && (hit === el || el.contains(hit) || hit.contains(el) || hit.closest('label')?.contains(el))) shown += 1;
        else if (hit) cover = `${hit.tagName.toLowerCase()}.${String(hit.className).slice(0, 40)}`;
      }
      const opacity0 = cs.opacity === '0';
      return { id, visible, shown, cover, size: rect.width * rect.height, opacity0, text: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40) };
    });
  for (let i = 0; i < 90; i += 1) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(30);
    let r = await inspect();
    if (!r) continue;
    // Something that slides in on focus (the skip link) gets the time of its transition before it is judged.
    if (r.shown === 0 || !r.visible) {
      await page.waitForTimeout(350);
      r = await inspect();
    }
    if (visited.has(r.id)) break; // went round the page once
    visited.add(r.id);
    report.checked.focus += 1;
    if (r.size === 0) continue;
    if (!r.visible) report.focus.push({ label, problem: 'no visible focus indicator (2.4.7)', el: r.text || r.id });
    if (r.shown === 0 && !r.opacity0) report.focus.push({ label, problem: `focus entirely hidden (2.4.11) under ${r.cover}`, el: r.text || r.id });
  }
}

// ----------------------------------------------------------------------------------------------- 3. text spacing
async function checkSpacing(page, label) {
  await page.addStyleTag({
    content: '*{line-height:1.5!important;letter-spacing:0.12em!important;word-spacing:0.16em!important}p{margin-bottom:2em!important}',
  });
  await page.waitForTimeout(200);
  const clipped = await page.evaluate(() => {
    const out = new Set();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent.trim()) continue;
      const host = node.parentElement;
      if (!host || host.closest('[aria-hidden="true"], .visually-hidden, script, style, noscript, [hidden]')) continue;
      const hs = getComputedStyle(host);
      if (hs.visibility === 'hidden' || hs.display === 'none' || hs.opacity === '0') continue;
      range.selectNodeContents(node);
      const t = range.getBoundingClientRect();
      if (t.width === 0 || t.height === 0) continue;
      // The text is cut when a box that hides its overflow (itself or an ancestor) is smaller than the text.
      for (let box = host; box && box !== document.body; box = box.parentElement) {
        const cs = getComputedStyle(box);
        // Inside a scrolling box (a carousel, a strip of cards) the text is reached by scrolling, not cut.
        if (box !== host && /auto|scroll/.test(cs.overflowX + cs.overflowY)) break;
        const hx = /hidden|clip/.test(cs.overflowX);
        const hy = /hidden|clip/.test(cs.overflowY);
        if (!hx && !hy) continue;
        const b = box.getBoundingClientRect();
        if (b.width <= 1 || b.height <= 1) break; // visually hidden on purpose
        const cutX = hx && (t.left < b.left - 2 || t.right > b.right + 2);
        const cutY = hy && (t.top < b.top - 2 || t.bottom > b.bottom + 2);
        const ellipsis = hs.textOverflow === 'ellipsis' && host.scrollWidth > host.clientWidth + 1;
        if (cutX || cutY || ellipsis) {
          out.add(`${box.tagName.toLowerCase()}.${String(box.className).slice(0, 50)} cuts "${node.textContent.trim().slice(0, 40)}" ${cutX ? 'x' : ''}${cutY ? 'y' : ''}${ellipsis ? 'ellipsis' : ''}`);
          break;
        }
      }
    }
    return { out: [...out], sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  report.checked.spacing += 1;
  for (const c of clipped.out) report.spacing.push({ label, problem: c });
  if (clipped.sideways > 0) report.spacing.push({ label, problem: `page scrolls sideways by ${clipped.sideways}px` });
}

for (const [vpName, viewport] of Object.entries(VPS)) {
  const ctx = await context(viewport, vpName === 'phone');
  for (const locale of LOCALES) {
    const seen = new Set();
    for (const route of ROUTES) {
      const label = `${locale}${route || '/'} @${vpName}${SETTINGS ? ' +modes' : ''}`;
      const page = await ctx.newPage();
      try {
        if (CHECKS.includes('contrast')) {
          await load(page, `${BASE}/${locale}${route}`);
          await checkContrast(page, label, seen);
        }
        if (CHECKS.includes('focus')) {
          await page.goto(`${BASE}/${locale}${route}`, { waitUntil: 'load' });
          await page.waitForTimeout(300);
          await checkFocus(page, label);
        }
        if (CHECKS.includes('spacing')) {
          await page.goto(`${BASE}/${locale}${route}`, { waitUntil: 'load' });
          await checkSpacing(page, label);
        }
      } catch (e) {
        report.errors = [...(report.errors ?? []), `${label}: ${e.message.split('\n')[0]}`];
      }
      await page.close();
      // Progress and partial results, so a long run can be followed and is never lost.
      fs.appendFileSync(`${OUT}/a11y-probe.log`, `${label} contrast=${report.contrast.length} focus=${report.focus.length} spacing=${report.spacing.length}
`);
      fs.writeFileSync(`${OUT}/a11y-probe.partial.json`, JSON.stringify(report, null, 1));
    }
  }
  await ctx.close();
}
await browser.close();

fs.writeFileSync(`${OUT}/a11y-probe.json`, JSON.stringify(report, null, 1));
console.log(`checked: ${JSON.stringify(report.checked)}`);
for (const kind of ['contrast', 'focus', 'spacing']) {
  console.log(`${kind}: ${report[kind].length} problems`);
  for (const p of report[kind].slice(0, 60)) console.log(`  ${JSON.stringify(p)}`);
}
if (report.errors) console.log('errors:', report.errors);
