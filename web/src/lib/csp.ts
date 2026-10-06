// Content-Security-Policy, built per request so every response carries its own nonce.
// Used by src/proxy.ts. Kept free of Next imports so it can be unit-tested.
//
// What the site needs, and nothing else:
//   - its own scripts/styles/fonts (next/font self-hosts, no Google Fonts)
//   - the API (browser calls: forms, payments) and PayPal (SDK script, button iframes, XHR, images)
//   - Firebase Storage for product images (through next/image, and direct in the cart) and the videos
//   - Cloudflare Stream's player page, framed on /live while a broadcast is live (frame-src only)
//
// script-src uses a nonce + 'strict-dynamic': Next.js tags its own scripts with the nonce, and the
// scripts they load (the PayPal SDK) inherit the trust. The host sources are only a fallback for
// old browsers that do not understand 'strict-dynamic'.

export const PAYPAL_HOSTS = ['https://www.paypal.com', 'https://*.paypal.com', 'https://*.paypalobjects.com'];
export const FIREBASE_STORAGE = 'https://firebasestorage.googleapis.com';
/** Cloudflare Stream's player pages (customer-<code>.cloudflarestream.com): the live broadcast on /live (docs/LIVE.md). */
export const CLOUDFLARE_STREAM = 'https://*.cloudflarestream.com';

export type CspOptions = {
  nonce: string;
  /** `next dev`: React needs eval for debugging, and Fast Refresh uses a websocket and inline styles. */
  isDev?: boolean;
  /** Origin of the API the browser talks to (from NEXT_PUBLIC_API_URL). */
  apiOrigin?: string;
  /** Ask browsers to load http:// subresources over https://. Production over https only. */
  upgradeInsecure?: boolean;
};

/** A fresh, unguessable nonce (128 random bits, base64). */
export function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/** "https://host:port" of a URL, or undefined when it is not a valid http(s) URL. */
export function originOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const { protocol, origin } = new URL(url);
    return protocol === 'https:' || protocol === 'http:' ? origin : undefined;
  } catch {
    return undefined;
  }
}

export function buildCsp({ nonce, isDev = false, apiOrigin, upgradeInsecure = false }: CspOptions): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...PAYPAL_HOSTS, ...(isDev ? ["'unsafe-eval'"] : [])],
    // Style elements need the nonce. Inline style="" attributes cannot carry one, so they are allowed on
    // their own (style-src-attr): they cannot run script, and React/Next emit them for CSS variables.
    'style-src': ["'self'", isDev ? "'unsafe-inline'" : `'nonce-${nonce}'`],
    'style-src-attr': ["'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', FIREBASE_STORAGE, ...PAYPAL_HOSTS],
    'media-src': ["'self'", 'blob:', FIREBASE_STORAGE],
    'font-src': ["'self'"],
    'connect-src': ["'self'", ...(apiOrigin ? [apiOrigin] : []), ...PAYPAL_HOSTS, ...(isDev ? ['ws://localhost:*', 'ws://127.0.0.1:*'] : [])],
    'frame-src': [...PAYPAL_HOSTS, CLOUDFLARE_STREAM],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };

  const parts = Object.entries(directives).map(([name, values]) => `${name} ${values.join(' ')}`);
  if (upgradeInsecure) parts.push('upgrade-insecure-requests');
  return parts.join('; ');
}

/** Hosts that are plain http on purpose (local development, tests): never upgrade requests to them. */
export function isLocalHost(host: string | null | undefined): boolean {
  const name = (host ?? '').replace(/:\d+$/, '').replace(/^\[|\]$/g, '').toLowerCase();
  return name === 'localhost' || name === '127.0.0.1' || name === '::1' || name.endsWith('.localhost');
}
