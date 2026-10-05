// Exhaustive QA matrix (not part of the regular e2e suite: it is slow and writes a report).
//   node tests/qa/matrix.mjs            -> every locale x route x viewport against QA_BASE
//   QA_LOCALES=en,he QA_VIEWPORTS=mobile node tests/qa/matrix.mjs   -> a slice
// Output: QA_OUT (default ./qa-report) / matrix.json + links.json, and a one-line summary per issue on stdout.
// Run it against a production build: `next start -p 3603`, QA_BASE=http://localhost:3603, PW_CHANNEL=msedge.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.QA_BASE ?? 'http://localhost:3603';
const OUT = process.env.QA_OUT ?? './qa-report';
const CHANNEL = process.env.PW_CHANNEL || undefined;
const ALL_LOCALES = ['en', 'fr', 'es', 'de', 'it', 'pt', 'pl', 'ru', 'el', 'he', 'ar'];
const LOCALES = (process.env.QA_LOCALES ?? ALL_LOCALES.join(',')).split(',');
const ALL_VIEWPORTS = {
  desktop: { width: 1366, height: 768 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
  small: { width: 360, height: 640 },
};
const VIEWPORTS = (process.env.QA_VIEWPORTS ?? Object.keys(ALL_VIEWPORTS).join(',')).split(',');
const ROUTES = [
  '',
  '/sites',
  '/sites/latin',
  '/sites/greek',
  '/sites/maryswell',
  '/sites/oldcity',
  '/sites/city',
  '/tour',
  '/about',
  '/candle',
  '/donate',
  '/checkout',
  '/cart',
  '/reviews',
  '/live',
  '/no-such-page-404',
];
const CONCURRENCY = Number(process.env.QA_CONCURRENCY ?? 6);
const baseHost = new URL(BASE).host;

fs.mkdirSync(OUT, { recursive: true });

// Runs inside the page: structural checks.
function inspectPage() {
  const out = {};
  const h = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter((e) => e.offsetParent !== null || getComputedStyle(e).position === 'fixed');
  out.h1 = document.querySelectorAll('h1').length;
  const levels = h.map((e) => Number(e.tagName[1]));
  out.headingSkips = [];
  for (let i = 1; i < levels.length; i++) if (levels[i] - levels[i - 1] > 1) out.headingSkips.push(`h${levels[i - 1]}->h${levels[i]} "${h[i].textContent.trim().slice(0, 40)}"`);
  if (levels.length && levels[0] !== 1) out.headingSkips.push(`first heading is h${levels[0]}`);
  out.emptyHeadings = h.filter((e) => !e.textContent.trim()).length;
  out.landmarks = {
    main: document.querySelectorAll('main,[role=main]').length,
    banner: document.querySelectorAll('header,[role=banner]').length,
    contentinfo: document.querySelectorAll('footer,[role=contentinfo]').length,
    nav: document.querySelectorAll('nav,[role=navigation]').length,
  };
  out.hscroll = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth;
  out.imgs = [...document.images].map((i) => ({
    src: (i.currentSrc || i.src).slice(0, 140),
    alt: i.getAttribute('alt'),
    ok: i.complete && i.naturalWidth > 0,
    lazy: i.loading === 'lazy',
    w: i.clientWidth,
    nw: i.naturalWidth,
  }));
  out.links = [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'));
  out.unnamedLinks = [...document.querySelectorAll('a[href]')].filter((a) => !(a.textContent.trim() || a.getAttribute('aria-label') || a.querySelector('img[alt]:not([alt=""])') || a.getAttribute('aria-labelledby') || a.title)).length;
  out.unnamedButtons = [...document.querySelectorAll('button')].filter((a) => !(a.textContent.trim() || a.getAttribute('aria-label') || a.getAttribute('aria-labelledby') || a.title || a.querySelector('img[alt]:not([alt=""])'))).length;
  const meta = (sel, attr = 'content') => document.querySelector(sel)?.getAttribute(attr) ?? null;
  out.meta = {
    title: document.title,
    description: meta('meta[name=description]'),
    canonical: meta('link[rel=canonical]', 'href'),
    hreflang: [...document.querySelectorAll('link[rel=alternate][hreflang]')].map((l) => l.getAttribute('hreflang') + '=' + l.getAttribute('href')),
    ogTitle: meta('meta[property="og:title"]'),
    ogDescription: meta('meta[property="og:description"]'),
    ogImage: meta('meta[property="og:image"]'),
    ogUrl: meta('meta[property="og:url"]'),
    ogLocale: meta('meta[property="og:locale"]'),
    twitterCard: meta('meta[name="twitter:card"]'),
    robots: meta('meta[name=robots]'),
    viewport: meta('meta[name=viewport]'),
  };
  out.jsonld = [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => {
    try {
      const j = JSON.parse(s.textContent);
      return { ok: true, types: [].concat(j['@graph'] ?? j).map((x) => x['@type']).flat() };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  });
  out.lang = document.documentElement.lang;
  out.dir = document.documentElement.dir;
  out.bodyBg = getComputedStyle(document.body).backgroundColor;
  // Text that still looks like an untranslated key, e.g. "home.heroTitle" or "site.nav.x".
  const text = document.body.innerText;
  out.keyLeaks = [...new Set(text.match(/\b[a-z][A-Za-z]+(\.[a-zA-Z0-9]+){1,4}\b/g) ?? [])].filter((s) => /^(site|home|places|placesPage|shop|checkout|cart|candle|donate|live|reviews|about|tour|header\w*|common|nav|footer)\./.test(s));
  out.visibleFocusables = document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]').length;
  return out;
}

async function scrollThrough(page) {
  await page.evaluate(async () => {
    const step = Math.max(250, window.innerHeight * 0.4);
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 160));
    }
    await new Promise((r) => setTimeout(r, 1200));
    window.scrollTo(0, 0);
  });
}

async function checkOne(browser, ctxCache, locale, route, vpName) {
  const key = vpName;
  let ctx = ctxCache.get(key);
  if (!ctx) {
    ctx = await browser.newContext({ viewport: ALL_VIEWPORTS[vpName], isMobile: vpName === 'mobile' || vpName === 'small', hasTouch: vpName === 'mobile' || vpName === 'small' });
    // Third parties (YouTube, PayPal, fonts CDN...) are blocked and counted, never contacted.
    await ctx.route('**/*', (r) => {
      const u = new URL(r.request().url());
      if (u.host === baseHost || u.protocol === 'data:' || u.protocol === 'blob:') return r.continue();
      blocked.add(u.host);
      return r.abort();
    });
    ctxCache.set(key, ctx);
  }
  const page = await ctx.newPage();
  const url = `${BASE}/${locale}${route}`;
  const rec = { locale, route: route || '/', vp: vpName, url, console: [], pageErrors: [], failed: [], badResponses: [] };
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') rec.console.push(`${m.type()}: ${m.text().slice(0, 300)}`);
  });
  page.on('pageerror', (e) => rec.pageErrors.push(String(e).slice(0, 300)));
  page.on('requestfailed', (r) => {
    const u = new URL(r.url());
    if (u.host !== baseHost) return; // blocked third parties
    rec.failed.push(`${r.method()} ${r.url().slice(0, 140)} ${r.failure()?.errorText}`);
  });
  page.on('response', (r) => {
    const u = new URL(r.url());
    if (u.host === baseHost && r.status() >= 400 && r.url() !== url) rec.badResponses.push(`${r.status()} ${r.url().slice(0, 140)}`);
  });
  try {
    const resp = await page.goto(url, { waitUntil: 'load', timeout: 45_000 });
    rec.status = resp?.status();
    await scrollThrough(page);
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    Object.assign(rec, await page.evaluate(inspectPage));
  } catch (e) {
    rec.error = String(e).slice(0, 300);
  } finally {
    await page.close();
  }
  return rec;
}

const blocked = new Set();
const browser = await chromium.launch({ channel: CHANNEL });
const jobs = [];
for (const vp of VIEWPORTS) for (const l of LOCALES) for (const r of ROUTES) jobs.push([l, r, vp]);
const results = [];
const caches = Array.from({ length: CONCURRENCY }, () => new Map());
let next = 0;
async function worker(i) {
  while (next < jobs.length) {
    const j = jobs[next++];
    results.push(await checkOne(browser, caches[i], ...j));
  }
}
const t0 = Date.now();
await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i)));
await browser.close();

fs.writeFileSync(path.join(OUT, 'matrix.json'), JSON.stringify({ blocked: [...blocked], results }, null, 1));

// ---- analyse ----
const issues = [];
const add = (r, sev, msg) => issues.push(`${sev} ${r.locale}${r.route === '/' ? '' : r.route} @${r.vp}: ${msg}`);
const is404 = (r) => r.route === '/no-such-page-404';
for (const r of results) {
  if (r.error) { add(r, 'ERR', r.error); continue; }
  const expected = is404(r) ? 404 : 200;
  if (r.status !== expected) add(r, 'HIGH', `status ${r.status}, expected ${expected}`);
  for (const c of r.console) {
    if (/net::ERR_FAILED/.test(c)) continue; // a blocked third party (hero video etc.)
    if (is404(r) && /status of 404/.test(c)) continue; // the document itself
    if (/preloaded using link preload but not used/.test(c)) add(r, 'LOW', `console ${c.slice(0, 110)}`);
    else add(r, 'MED', `console ${c}`);
  }
  for (const c of r.pageErrors) add(r, 'HIGH', `pageerror ${c}`);
  for (const c of r.failed) add(r, 'MED', `request failed ${c}`);
  for (const c of r.badResponses) add(r, 'MED', `bad response ${c}`);
  if (r.hscroll > 1) add(r, 'MED', `horizontal scroll +${r.hscroll}px`);
  if (r.h1 !== 1) add(r, 'MED', `${r.h1} h1`);
  for (const s of r.headingSkips ?? []) add(r, 'LOW', `heading order ${s}`);
  if (r.emptyHeadings) add(r, 'LOW', `${r.emptyHeadings} empty headings`);
  if (r.landmarks.main !== 1) add(r, 'MED', `${r.landmarks.main} main landmarks`);
  if (r.landmarks.banner < 1 || r.landmarks.contentinfo < 1 || r.landmarks.nav < 1) add(r, 'MED', `landmarks ${JSON.stringify(r.landmarks)}`);
  for (const i of r.imgs) {
    if (i.alt === null) add(r, 'MED', `img without alt ${i.src}`);
    if (!i.ok && i.lazy && i.w === 0) continue; // off-screen lightbox preloads
    if (!i.ok && !i.lazy) add(r, 'MED', `img not loaded ${i.src}`);
    else if (!i.ok) add(r, 'LOW', `lazy img not loaded after scroll ${i.src}`);
  }
  if (r.unnamedLinks) add(r, 'MED', `${r.unnamedLinks} links without name`);
  if (r.unnamedButtons) add(r, 'MED', `${r.unnamedButtons} buttons without name`);
  if (r.lang !== r.locale) add(r, 'HIGH', `lang=${r.lang}`);
  if (r.dir !== (['he', 'ar'].includes(r.locale) ? 'rtl' : 'ltr')) add(r, 'HIGH', `dir=${r.dir}`);
  const m = r.meta;
  if (!m.title) add(r, 'MED', 'no title');
  if (!m.description) add(r, 'MED', 'no meta description');
  if (!m.viewport) add(r, 'MED', 'no viewport meta');
  if (!is404(r)) {
    const want = `/${r.locale}${r.route === '/' ? '' : r.route}`;
    if (!m.canonical || !m.canonical.endsWith(want)) add(r, 'MED', `canonical ${m.canonical} (want ...${want})`);
    if (m.hreflang.length < 12) add(r, 'MED', `hreflang count ${m.hreflang.length}`);
    if (!m.ogTitle || !m.ogDescription) add(r, 'LOW', 'og title/description missing');
    if (!m.ogImage) add(r, 'LOW', 'og:image missing');
    if (m.ogLocale && !m.ogLocale.toLowerCase().startsWith(r.locale)) add(r, 'LOW', `og:locale ${m.ogLocale}`);
    if (!m.twitterCard) add(r, 'LOW', 'twitter:card missing');
  }
  for (const j of r.jsonld) if (!j.ok) add(r, 'MED', `JSON-LD invalid ${j.error}`);
  for (const k of r.keyLeaks ?? []) add(r, 'MED', `looks like a raw message key: ${k}`);
}
fs.writeFileSync(path.join(OUT, 'issues.txt'), issues.join('\n'));

// group identical issues across locales to keep the summary readable
const grouped = new Map();
for (const line of issues) {
  const k = line.replace(/^(\S+) \S+ @\S+: /, '$1 ').replace(/\d+px/, 'Npx');
  grouped.set(k, (grouped.get(k) ?? 0) + 1);
}
console.log(`pages checked: ${results.length} in ${((Date.now() - t0) / 1000).toFixed(0)}s; issues: ${issues.length}; blocked third-party hosts: ${[...blocked].join(', ') || 'none'}`);
for (const [k, n] of [...grouped].sort((a, b) => b[1] - a[1]).slice(0, 80)) console.log(`${String(n).padStart(4)}x ${k}`);

// ---- link crawl ----
const links = new Set();
for (const r of results) for (const h of r.links ?? []) {
  if (!h || h.startsWith('#') || /^(mailto:|tel:|javascript:)/.test(h)) continue;
  if (/^https?:\/\//.test(h) && new URL(h).host !== baseHost) continue;
  const u = new URL(h, `${BASE}/${r.locale}`);
  u.hash = '';
  links.add(u.pathname + u.search);
}
const linkRes = [];
const arr = [...links];
let li = 0;
await Promise.all(
  Array.from({ length: 8 }, async () => {
    while (li < arr.length) {
      const l = arr[li++];
      try {
        const res = await fetch(BASE + l, { redirect: 'follow' });
        linkRes.push({ link: l, status: res.status, final: res.url.replace(BASE, '') });
      } catch (e) {
        linkRes.push({ link: l, status: 0, error: String(e) });
      }
    }
  }),
);
fs.writeFileSync(path.join(OUT, 'links.json'), JSON.stringify(linkRes, null, 1));
const badLinks = linkRes.filter((l) => l.status !== 200);
console.log(`internal links crawled: ${arr.length}; non-200: ${badLinks.length}`);
for (const b of badLinks.slice(0, 40)) console.log(`  ${b.status} ${b.link} -> ${b.final ?? b.error}`);
