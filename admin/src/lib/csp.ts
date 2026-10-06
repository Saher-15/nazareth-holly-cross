// Content-Security-Policy with a per-request nonce (set in src/proxy.ts, applied by Next.js to its own scripts).
// No inline script or style is allowed without the nonce, no eval in production, nothing may frame the admin.

export type CspOptions = {
  nonce: string;
  dev?: boolean;
  /** Keep `upgrade-insecure-requests` off on plain-http localhost, where it would break every asset. */
  upgradeInsecure?: boolean;
  extraImgSrc?: string[];
  firebase?: boolean;
  /** The Live page (/live): the browser publishes the camera to Cloudflare Stream (WHIP), so it may connect there. */
  live?: boolean;
};

const FIREBASE = 'https://firebasestorage.googleapis.com';
/** Cloudflare Stream's customer hosts (customer-<code>.cloudflarestream.com): the WHIP publish address lives there. */
export const CLOUDFLARE_STREAM = 'https://*.cloudflarestream.com';

export function parseOrigins(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(s));
}

export function buildCsp({ nonce, dev = false, upgradeInsecure = true, extraImgSrc = [], firebase = true, live = false }: CspOptions): string {
  const img = ["'self'", 'data:', 'blob:', FIREBASE, ...extraImgSrc];
  const connect = ["'self'", ...(firebase ? [FIREBASE] : []), ...(live ? [CLOUDFLARE_STREAM] : [])];
  const directives = [
    ["default-src", "'self'"],
    ['script-src', `'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`],
    // Styles are external files or carry the nonce; React inline style="" attributes are not used (style-src-attr 'none').
    ['style-src', dev ? "'self' 'unsafe-inline'" : `'self' 'nonce-${nonce}'`],
    ...(dev ? [] : [['style-src-attr', "'none'"]]),
    ['img-src', img.join(' ')],
    ['font-src', "'self'"],
    ['connect-src', dev ? `${connect.join(' ')} ws: wss:` : connect.join(' ')],
    ['media-src', "'none'"],
    ['object-src', "'none'"],
    ['base-uri', "'none'"],
    ['form-action', "'self'"],
    ['frame-ancestors', "'none'"],
    ['manifest-src', "'self'"],
    ['worker-src', "'none'"],
  ];
  const parts = directives.map(([name, value]) => `${name} ${value}`);
  if (upgradeInsecure && !dev) parts.push('upgrade-insecure-requests');
  return parts.join('; ');
}

export function makeNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
