import { config } from '../config/env.js';

// Asks the public website to rebuild its cached shop pages now (docs/ADMIN.md 4.2, "The website after a product change").
//
// The site (web/, Next.js on Netlify) keeps the catalogue for 10 minutes. After a product is created, changed or deleted
// in the dashboard the API calls POST <SITE_URL>/api/revalidate (web/src/app/api/revalidate/route.ts) with the shared
// REVALIDATE_SECRET in the Authorization header and the product's id; the site then drops its cached catalogue and
// product pages, so the next visitor sees the change. The answer to the dashboard says what happened:
//   'done'    the site confirmed: the change is on the website now
//   'off'     REVALIDATE_SECRET is not set (or too short): nothing was called; the site shows it within 10 minutes
//   'failed'  the site did not confirm in time (or refused): it still shows the change within 10 minutes
// The secret is never logged and goes nowhere but to SITE_URL.

export const REFRESH_TIMEOUT_MS = 5000;
const MIN_SECRET = 32;
const ID = /^[a-f0-9]{24}$/i;

export const siteRefreshConfigured = () => config.site.revalidateSecret.length >= MIN_SECRET && /^https?:\/\//.test(config.site.url);

/** Never throws. `productIds`: the products that changed (their own pages are rebuilt too). */
export async function refreshSite(productIds = [], { fetchImpl = globalThis.fetch, timeoutMs = REFRESH_TIMEOUT_MS } = {}) {
  if (!siteRefreshConfigured()) return 'off';
  const ids = [...new Set(productIds.map(String).filter((id) => ID.test(id)))].slice(0, 50);
  try {
    const res = await fetchImpl(`${config.site.url}/api/revalidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.site.revalidateSecret}` },
      body: JSON.stringify({ scope: 'shop', productIds: ids }),
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.ok) return 'done';
    console.warn(`[site-refresh] the website answered ${res.status}`);
    return 'failed';
  } catch (error) {
    console.warn(`[site-refresh] the website could not be reached (${error?.name ?? 'error'})`);
    return 'failed';
  }
}
