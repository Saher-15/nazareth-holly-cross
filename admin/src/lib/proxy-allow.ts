// Which API calls the browser may make through /api/proxy. Everything else is a 404 here, so the proxy can never be
// turned into an open relay (no sign-in, no arbitrary path, no method the contract does not have).

const ID = '[A-Za-z0-9_-]{1,64}';

type Rule = { method: string; pattern: RegExp };

const rules: Rule[] = [
  { method: 'GET', pattern: /^auth\/me$/ },
  { method: 'POST', pattern: /^auth\/password$/ },
  { method: 'POST', pattern: /^auth\/totp\/(setup|enable|disable)$/ },
  { method: 'GET', pattern: /^dashboard$/ },
  { method: 'GET', pattern: /^export\/(orders|candles|contacts|payments)\.csv$/ },
  // The payment ledger: read, and resolve with a note. There is no delete, on purpose (docs/ADMIN.md, Payments).
  { method: 'GET', pattern: /^payments$/ },
  { method: 'GET', pattern: new RegExp(`^payments/${ID}$`) },
  { method: 'PATCH', pattern: new RegExp(`^payments/${ID}$`) },
  // Live broadcasting (editor and owner; the API enforces the role). docs/LIVE.md.
  { method: 'GET', pattern: /^live$/ },
  { method: 'POST', pattern: /^live\/(start|stop)$/ },
  // Data-protection requests (owner only; the API enforces the role).
  { method: 'POST', pattern: /^privacy\/(lookup|erase)$/ },
  ...['orders', 'candles', 'contacts', 'site-reviews', 'product-reviews', 'prayers', 'products', 'users'].flatMap((resource): Rule[] => [
    { method: 'GET', pattern: new RegExp(`^${resource}$`) },
    { method: 'GET', pattern: new RegExp(`^${resource}/${ID}$`) },
    { method: 'PATCH', pattern: new RegExp(`^${resource}/${ID}$`) },
    { method: 'DELETE', pattern: new RegExp(`^${resource}/${ID}$`) },
  ]),
  { method: 'POST', pattern: /^products$/ },
  { method: 'PUT', pattern: new RegExp(`^products/${ID}$`) },
  { method: 'POST', pattern: /^users$/ },
  { method: 'GET', pattern: /^audit$/ },
];

/** `segments` is the catch-all route parameter, e.g. ['orders', 'abc123']. Returns the API path or null. */
export function resolveProxyPath(segments: string[] | undefined, method: string): string | null {
  if (!segments?.length || segments.length > 3) return null;
  if (segments.some((s) => !s || s === '.' || s === '..' || /[\\/?#%\0-\x1f]/.test(s))) return null;
  const path = segments.join('/');
  return rules.some((rule) => rule.method === method.toUpperCase() && rule.pattern.test(path)) ? `/admin/${path}` : null;
}

export const MAX_PROXY_BODY_BYTES = 64 * 1024;
