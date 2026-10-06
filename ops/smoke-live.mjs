#!/usr/bin/env node
// Post-deploy smoke test of the LIVE site and API. Read-only: only GET requests, no form is filled, no PayPal button
// is pressed, nothing is written. Run it after every deploy (docs/ENGINEERING.md, section 3) and whenever the site
// "feels wrong" (docs/MONITORING.md). It prints PASS / WARN / FAIL per check and exits 1 when anything FAILED.
//
//   node ops/smoke-live.mjs                      full run in Microsoft Edge (about 1-2 minutes)
//   node ops/smoke-live.mjs --no-browser         HTTP checks only (no Playwright needed)
//   node ops/smoke-live.mjs --site https://deploy-preview-12--nazarethholycross.netlify.app   a deploy preview
//   node ops/smoke-live.mjs --api http://127.0.0.1:3912 --site http://localhost:3801          local servers
//
// Environment: PW_CHANNEL (default msedge; "chromium" uses Playwright's own browser), SMOKE_PAGE_BUDGET_MS (default 8000).
// Playwright is taken from web/node_modules (run `npm ci` in web/ once); nothing is installed by this script.
//
// It spends about 40 requests on the API's rate limit (200 per 15 minutes per address): it stops with a warning
// instead of running when fewer than 60 are left.

import { createRequire } from 'node:module';
import tls from 'node:tls';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const SITE = option('site', 'https://nazarethholycross.com').replace(/\/+$/, '');
const API = option('api', 'https://nazareth-holy-cross-api.onrender.com').replace(/\/+$/, '');
const NO_BROWSER = flag('no-browser');
const PAGE_BUDGET_MS = Number(process.env.SMOKE_PAGE_BUDGET_MS || 8000);
const isLive = new URL(SITE).hostname === 'nazarethholycross.com';
const UA = 'nhc-smoke/1.0 (post-deploy check, read-only)';

const results = [];
const counts = { PASS: 0, WARN: 0, FAIL: 0 };
function record(level, name, detail = '') {
  counts[level] += 1;
  results.push({ level, name, detail });
  console.log(`${level.padEnd(4)}  ${name}${detail ? `  ${detail}` : ''}`);
}
const pass = (name, detail) => record('PASS', name, detail);
const warn = (name, detail) => record('WARN', name, detail);
const fail = (name, detail) => record('FAIL', name, detail);
const check = (ok, name, detail, onFail = fail) => (ok ? pass(name, detail) : onFail(name, detail));

// A GET that does not follow redirects (the redirect chain is part of what is checked). 90 s covers a cold start.
async function get(url, { headers = {}, timeout = 90_000 } = {}) {
  const started = performance.now();
  const res = await fetch(url, { method: 'GET', redirect: 'manual', headers: { 'user-agent': UA, ...headers }, signal: AbortSignal.timeout(timeout) });
  const ms = Math.round(performance.now() - started);
  return { res, ms };
}

// ---------------------------------------------------------------------------------------------------------------------
// 1. API
// ---------------------------------------------------------------------------------------------------------------------
async function apiChecks() {
  console.log(`\n== API  ${API}`);
  let remaining = null;
  try {
    const { res, ms } = await get(`${API}/health`);
    const body = await res.json().catch(() => ({}));
    check(res.status === 200 && body.status === 'ok', 'API /health answers 200 ok', `${ms} ms`);
    check(body.database === 'up', 'API /health says the database is connected', `database=${body.database}`);
    if (ms > 10_000) warn('API cold start', `the first answer took ${(ms / 1000).toFixed(1)} s: the free Render plan had put it to sleep (docs/MONITORING.md)`);
    else if (ms > 3000) warn('API /health is slow', `${ms} ms`);
    const rl = res.headers.get('ratelimit') ?? '';
    remaining = Number(/remaining=(\d+)/.exec(rl)?.[1] ?? NaN);
    if (Number.isFinite(remaining)) check(remaining >= 60, 'API rate-limit allowance left for this address', `${remaining} of 200`, warn);
  } catch (err) {
    fail('API /health answers', String(err.cause?.code || err.message));
    return { remaining };
  }

  try {
    const { res, ms } = await get(`${API}/health/deep`);
    if (res.status === 404) warn('API /health/deep', 'not deployed yet (404); deploy the API to get the database check');
    else {
      const body = await res.json().catch(() => ({}));
      check(res.status === 200 && body.status === 'ok', 'API /health/deep: database ping succeeds', `${ms} ms, db ${body.database?.latencyMs ?? '?'} ms, up ${body.uptimeSeconds ?? '?'} s, version ${body.version ?? '?'} ${body.commit ?? ''}`);
      if (body.paypalMode) (isLive && body.paypalMode === 'sandbox' ? warn : pass)('API PayPal mode', `${body.paypalMode}${body.paypalMode === 'sandbox' ? ' (shop payments are not real yet)' : ''}`);
      if (typeof body.uptimeSeconds === 'number' && body.uptimeSeconds < 120) warn('API restarted just now', `up ${body.uptimeSeconds} s (a deploy, a crash, or a cold start)`);
    }
  } catch (err) {
    fail('API /health/deep answers', String(err.cause?.code || err.message));
  }

  try {
    const { res, ms } = await get(`${API}/product/catalog`);
    const body = await res.json().catch(() => null);
    const list = Array.isArray(body) ? body : body?.products ?? body?.items ?? [];
    check(res.status === 200 && list.length > 0, 'API /product/catalog returns products', `${list.length} items, ${ms} ms`);
    check(/max-age/.test(res.headers.get('cache-control') ?? ''), 'API catalog is cacheable', res.headers.get('cache-control') ?? 'no Cache-Control', warn);
  } catch (err) {
    fail('API /product/catalog answers', String(err.cause?.code || err.message));
  }

  // Live broadcasting (docs/LIVE.md): the status every page polls, the published recordings and the schedule of /live.
  for (const [path, shape] of [['/live/status', (b) => typeof b?.live === 'boolean'], ['/live/recordings', (b) => Array.isArray(b?.items)], ['/live/schedule', (b) => Array.isArray(b?.items)]]) {
    try {
      const { res, ms } = await get(`${API}${path}`);
      if (res.status === 404) {
        warn(`API ${path}`, 'not deployed yet (404)');
        continue;
      }
      const body = await res.json().catch(() => null);
      const detail = path === '/live/status' ? `live=${body?.live}` : `${body?.items?.length ?? '?'} items`;
      check(res.status === 200 && shape(body), `API ${path} answers`, `${detail}, ${ms} ms`);
    } catch (err) {
      fail(`API ${path} answers`, String(err.cause?.code || err.message));
    }
  }

  if (isLive) {
    for (const origin of ['https://nazarethholycross.com', 'https://www.nazarethholycross.com']) {
      try {
        const { res } = await get(`${API}/health`, { headers: { origin } });
        check(res.headers.get('access-control-allow-origin') === origin, `API allows the browser origin ${origin} (CORS)`, `status ${res.status}`);
      } catch (err) {
        fail(`API CORS for ${origin}`, String(err.message));
      }
    }
  }
  try {
    const { res } = await get(`${API}/health`, { headers: { origin: 'https://evil.example' } });
    check(res.status === 403, 'API refuses a stranger origin (CORS)', `status ${res.status}`);
  } catch (err) {
    fail('API CORS stranger origin', String(err.message));
  }
  return { remaining };
}

// ---------------------------------------------------------------------------------------------------------------------
// 2. Domain, TLS, redirects, headers, small files
// ---------------------------------------------------------------------------------------------------------------------
function certificate(hostname) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host: hostname, port: 443, servername: hostname, ALPNProtocols: ['h2', 'http/1.1'] }, () => {
      const cert = socket.getPeerCertificate();
      const info = { to: new Date(cert.valid_to), issuer: cert.issuer?.O, protocol: socket.getProtocol(), alpn: socket.alpnProtocol, san: cert.subjectaltname };
      socket.end();
      resolve(info);
    });
    socket.setTimeout(15_000, () => { socket.destroy(); reject(new Error('timeout')); });
    socket.on('error', reject);
  });
}

async function siteChecks() {
  const url = new URL(SITE);
  console.log(`\n== Domain, TLS, redirects, headers  ${SITE}`);

  if (url.protocol === 'https:') {
    try {
      const cert = await certificate(url.hostname);
      const days = Math.floor((cert.to.getTime() - Date.now()) / 86_400_000);
      check(days >= 7, 'TLS certificate is valid', `${days} days left, ${cert.issuer}, ${cert.protocol}, ${cert.alpn}`);
      if (days < 21) warn('TLS certificate renewal', `${days} days left: Netlify renews 30 days before the end; if this stays below 21, look at Netlify > Domain management > HTTPS`);
      check(cert.protocol === 'TLSv1.3' || cert.protocol === 'TLSv1.2', 'TLS version is 1.2 or 1.3', cert.protocol);
    } catch (err) {
      fail('TLS handshake', String(err.code || err.message));
    }
  }

  if (isLive) {
    // One address, no chains: every start must end on https://nazarethholycross.com/en within two redirects.
    const starts = ['http://nazarethholycross.com/', 'http://www.nazarethholycross.com/', 'https://www.nazarethholycross.com/', 'https://nazarethholycross.com/'];
    for (const start of starts) {
      let hops = 0;
      let current = start;
      let last = null;
      try {
        for (; hops < 6; hops += 1) {
          const { res } = await get(current);
          last = res;
          if (res.status < 300 || res.status >= 400) break;
          current = new URL(res.headers.get('location'), current).href;
        }
        const ok = last.status === 200 && current === 'https://nazarethholycross.com/en';
        check(ok, `${start} ends on https://nazarethholycross.com/en`, `${hops} redirect(s), final ${last.status} ${current}`);
        if (hops > 2) warn(`${start} redirect chain`, `${hops} hops (each costs a round trip; target: 2 or fewer, docs/INFRASTRUCTURE.md)`);
      } catch (err) {
        fail(`${start} redirects`, String(err.message));
      }
    }
    try {
      const { res } = await get('https://nazarethholycross.netlify.app/en');
      check(res.status === 301 || res.status === 308, 'the free netlify.app address redirects to the real domain', `status ${res.status}`, warn);
    } catch (err) {
      warn('netlify.app address', String(err.message));
    }
    // The dashboard lives on its own origin; /admin on the site only forwards there.
    try {
      const { res } = await get('https://nazarethholycross.com/admin');
      const location = res.headers.get('location') ?? '';
      check(res.status >= 300 && res.status < 400 && location.startsWith('https://admin.nazarethholycross.com/'), '/admin forwards to https://admin.nazarethholycross.com', `status ${res.status} -> ${location}`);
      const login = await get('https://admin.nazarethholycross.com/login');
      check(login.res.status === 200, 'the dashboard answers on https://admin.nazarethholycross.com/login', `status ${login.res.status}`);
    } catch (err) {
      fail('dashboard address', String(err.message));
    }
  }

  // Legacy addresses of the previous site keep working (netlify.toml / next.config.ts redirects).
  for (const [from, to] of [['/latin', '/en/sites/latin'], ['/checkoutcandle', '/en/candle']]) {
    try {
      let current = `${SITE}${from}`;
      let status = 0;
      for (let i = 0; i < 5; i += 1) {
        const { res } = await get(current);
        status = res.status;
        if (status < 300 || status >= 400) break;
        current = new URL(res.headers.get('location'), current).href;
      }
      check(status === 200 && current === `${SITE}${to}`, `legacy address ${from} reaches ${to}`, `final ${status} ${current.replace(SITE, '')}`);
    } catch (err) {
      fail(`legacy address ${from}`, String(err.message));
    }
  }

  // Headers of a page. HTML must never be shared between visitors (the CSP nonce differs per response).
  try {
    const { res, ms } = await get(`${SITE}/en`);
    const h = (name) => res.headers.get(name) ?? '';
    check(res.status === 200, 'home page /en answers 200', `${ms} ms`);
    check(/'nonce-[^']+'/.test(h('content-security-policy')) && /frame-ancestors 'none'/.test(h('content-security-policy')) && !/unsafe-eval/.test(h('content-security-policy')), 'Content-Security-Policy with a nonce, no unsafe-eval, frame-ancestors none');
    check(/max-age=63072000/.test(h('strict-transport-security')) && /includeSubDomains/.test(h('strict-transport-security')) && /preload/.test(h('strict-transport-security')), 'Strict-Transport-Security is 2 years + includeSubDomains + preload', h('strict-transport-security') || 'missing', warn);
    check(h('x-content-type-options') === 'nosniff', 'X-Content-Type-Options: nosniff');
    check(h('x-frame-options').toUpperCase() === 'DENY', 'X-Frame-Options: DENY');
    check(!!h('referrer-policy') && !!h('permissions-policy'), 'Referrer-Policy and Permissions-Policy present');
    check(/no-store|private/.test(h('cache-control')), 'HTML is not stored in a shared cache', h('cache-control'));
    check(/br|gzip/.test(h('content-encoding')), 'HTML is compressed', h('content-encoding') || 'none', warn);
    check(!h('x-powered-by'), 'no X-Powered-By header', h('x-powered-by'), warn);
  } catch (err) {
    fail('home page headers', String(err.message));
  }

  // A cached 404 after a deploy (the failure mode of 2026-10-05): the clean URL and a cache-busted one must agree.
  for (const path of ['/en', '/en/shop']) {
    try {
      const clean = await get(`${SITE}${path}`);
      const busted = await get(`${SITE}${path}?smoke=${Date.now()}`);
      check(clean.res.status === 200 && busted.res.status === 200, `no stale 404 on ${path}`, `clean ${clean.res.status}, cache-busted ${busted.res.status}${clean.res.status !== busted.res.status ? ' => an edge-cached error: Netlify > Deploys > Trigger deploy > Clear cache and deploy site' : ''}`);
    } catch (err) {
      fail(`stale-404 check ${path}`, String(err.message));
    }
  }

  // Not found is a real 404 (not a 200 "soft 404", not a redirect loop).
  try {
    const { res } = await get(`${SITE}/en/this-page-does-not-exist-smoke`);
    check(res.status === 404, 'an unknown page answers 404', `status ${res.status}`);
  } catch (err) {
    fail('404 behaviour', String(err.message));
  }

  // Small files.
  const files = [
    ['/robots.txt', /Sitemap:/i, 'text/plain'],
    ['/sitemap.xml', /<urlset/, 'xml'],
    ['/manifest.webmanifest', /"name"/, 'json'],
    ['/.well-known/security.txt', /^Contact:/m, 'text/plain'],
    ['/favicon.ico', null, 'icon'],
  ];
  for (const [path, pattern, kind] of files) {
    try {
      const { res } = await get(`${SITE}${path}`);
      const text = pattern ? await res.text() : '';
      const ok = res.status === 200 && (!pattern || pattern.test(text)) && (kind !== 'text/plain' || /text\/plain/.test(res.headers.get('content-type') ?? ''));
      // security.txt is new: until it is deployed a 404 is only a warning.
      const notYet = path === '/.well-known/security.txt' && res.status === 404;
      check(ok, `${path} is served`, `status ${res.status}${notYet ? ' (not deployed yet)' : ''}`, notYet ? warn : fail);
      if (path === '/.well-known/security.txt' && res.status === 200) {
        const expires = Date.parse(/^Expires:\s*(\S+)$/m.exec(text)?.[1] ?? '');
        const days = Math.floor((expires - Date.now()) / 86_400_000);
        check(Number.isFinite(days) && days > 30, 'security.txt is not about to expire', Number.isFinite(days) ? `${days} days left` : 'no Expires line', warn);
      }
      if (path === '/sitemap.xml' && res.status === 200) check((text.match(/<loc>/g) ?? []).length > 500, 'sitemap lists the pages of every language', `${(text.match(/<loc>/g) ?? []).length} URLs`, warn);
    } catch (err) {
      fail(`${path} is served`, String(err.message));
    }
  }

  // Static files carry long cache headers (Netlify's CDN, netlify.toml).
  try {
    const home = await (await fetch(`${SITE}/en`, { headers: { 'user-agent': UA } })).text();
    const chunk = /\/_next\/static\/chunks\/[^"'\\ ]+\.js/.exec(home)?.[0];
    if (chunk) {
      const { res } = await get(`${SITE}${chunk}`);
      check(/immutable/.test(res.headers.get('cache-control') ?? ''), 'build files are cached for a year (immutable)', res.headers.get('cache-control') ?? '');
    }
    const media = /\/images\/nazareth-media\/[^"'\\ ]+\.avif/.exec(home)?.[0];
    if (media) {
      const { res } = await get(`${SITE}${media}`);
      check(/max-age=(?!0)\d+/.test(res.headers.get('cache-control') ?? ''), 'photos in /images are browser-cacheable', res.headers.get('cache-control') ?? '', warn);
    }
  } catch (err) {
    warn('static asset headers', String(err.message));
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// 3. Pages in a real browser
// ---------------------------------------------------------------------------------------------------------------------
const PAGES = [
  ['/en', 'home'],
  ['/he', 'home (Hebrew, right to left)'],
  ['/ar', 'home (Arabic, right to left)'],
  ['/fr', 'home (French)'],
  ['/en/sites', 'holy sites'],
  ['/en/sites/latin', 'Latin church'],
  ['/en/sites/greek', 'Greek church'],
  ['/en/sites/maryswell', "Mary's Well"],
  ['/en/sites/oldcity', 'Old city'],
  ['/en/sites/city', 'City'],
  ['/en/tour', 'tour'],
  ['/en/candle', 'light a candle'],
  ['/en/shop', 'shop'],
  ['/he/shop', 'shop (Hebrew)'],
  ['/en/live', 'live'],
  ['/en/reviews', 'reviews'],
  ['/en/donate', 'donate'],
  ['/en/about', 'about'],
  ['/en/plan', 'plan your visit'],
  ['/en/visit', 'visit'],
  ['/en/gospel', 'gospel'],
  ['/en/gallery', 'gallery'],
  ['/en/prayers', 'prayers'],
  ['/en/contact', 'contact'],
  ['/en/faq', 'FAQ'],
  ['/en/shipping-returns', 'shipping and returns'],
  ['/en/privacy', 'privacy'],
  ['/en/terms', 'terms'],
  ['/en/credits', 'credits'],
];

async function productPath() {
  try {
    const { res } = await get(`${SITE}/sitemap.xml`);
    const xml = await res.text();
    const m = /<loc>[^<]*?(\/en\/shop\/[a-f0-9]{24})<\/loc>/.exec(xml);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

async function pageChecks() {
  console.log(`\n== Pages in ${process.env.PW_CHANNEL || 'msedge'}  ${SITE}`);
  let chromium;
  try {
    const require = createRequire(new URL('../web/package.json', import.meta.url));
    ({ chromium } = require('@playwright/test'));
  } catch {
    warn('pages', 'Playwright not found: run `npm ci` in web/ first, or use --no-browser');
    return;
  }
  const channel = process.env.PW_CHANNEL ?? 'msedge';
  let browser;
  try {
    browser = await chromium.launch(channel === 'chromium' ? {} : { channel });
  } catch (err) {
    fail('browser', `cannot start ${channel}: ${String(err.message).split('\n')[0]} (set PW_CHANNEL=chromium, or use --no-browser)`);
    return;
  }
  const context = await browser.newContext({ userAgent: `${UA} Playwright`, viewport: { width: 1280, height: 800 } });
  const pages = [...PAGES];
  const product = await productPath();
  if (product) pages.push([product, 'a product page']);
  else warn('product page', 'no product found in the sitemap');

  const origin = new URL(SITE).origin;
  for (const [path, label] of pages) {
    const page = await context.newPage();
    const problems = [];
    page.on('pageerror', (e) => problems.push(`script error: ${String(e.message).slice(0, 120)}`));
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      const text = m.text();
      if (/Content Security Policy|Refused to/i.test(text)) problems.push(`CSP violation: ${text.slice(0, 140)}`);
      else if (!/Failed to load resource/.test(text)) problems.push(`console error: ${text.slice(0, 120)}`);
    });
    page.on('response', (r) => {
      const u = r.url();
      if (r.status() >= 400 && (u.startsWith(origin) || u.startsWith(API))) problems.push(`${r.status()} ${u.replace(origin, '').replace(API, 'API').slice(0, 90)}`);
    });
    const started = performance.now();
    try {
      const response = await page.goto(`${SITE}${path}`, { waitUntil: 'load', timeout: 45_000 });
      const ms = Math.round(performance.now() - started);
      const status = response?.status() ?? 0;
      const h1 = await page.locator('h1').count();
      const lang = await page.locator('html').getAttribute('lang');
      const dir = await page.locator('html').getAttribute('dir');
      const wantRtl = /^\/(he|ar)(\/|$)/.test(path);
      const broken = await page.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.currentSrc && !i.closest('noscript')).length);
      const failures = [];
      if (status !== 200) failures.push(`status ${status}`);
      if (h1 < 1) failures.push('no <h1>');
      if (!lang) failures.push('no lang');
      if (wantRtl && dir !== 'rtl') failures.push(`dir=${dir}`);
      if (broken > 0) failures.push(`${broken} broken image(s)`);
      failures.push(...problems);
      if (failures.length) fail(`${path}  (${label})`, `${failures.join('; ')} [${ms} ms]`);
      else if (ms > PAGE_BUDGET_MS) warn(`${path}  (${label})`, `loaded in ${ms} ms (budget ${PAGE_BUDGET_MS} ms)`);
      else pass(`${path}  (${label})`, `${ms} ms`);
    } catch (err) {
      fail(`${path}  (${label})`, String(err.message).split('\n')[0]);
    } finally {
      await page.close();
    }
  }
  await browser.close();
}

// ---------------------------------------------------------------------------------------------------------------------
console.log(`Smoke test of the live site, read-only. Site ${SITE}, API ${API}, ${new Date().toISOString()}`);
const { remaining } = await apiChecks();
if (Number.isFinite(remaining) && remaining < 60) {
  warn('stopping', `only ${remaining} API requests left in this 15-minute window; the page checks would be throttled and look like failures. Try again in a few minutes.`);
} else {
  await siteChecks();
  if (!NO_BROWSER) await pageChecks();
}
console.log(`\n${counts.FAIL ? 'FAILED' : 'OK'}: ${counts.PASS} passed, ${counts.WARN} warning(s), ${counts.FAIL} failed`);
if (counts.FAIL) {
  console.log('Failed checks:');
  for (const r of results.filter((x) => x.level === 'FAIL')) console.log(`  - ${r.name}  ${r.detail}`);
}
process.exit(counts.FAIL ? 1 : 0);
