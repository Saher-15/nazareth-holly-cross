import type { NextConfig } from 'next';
import path from 'node:path';
import createNextIntlPlugin from 'next-intl/plugin';
import { HSTS_VALUE } from './src/lib/hsts';
import { locales } from './src/i18n/routing';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Security headers for every response. The Content-Security-Policy is not here: it carries a
// per-request nonce, so src/proxy.ts sets it (see src/lib/csp.ts and docs/SECURITY.md).
// Powerful browser features are off unless the site needs them. PayPal's iframes need `payment`
// (and passkeys); fullscreen/autoplay/picture-in-picture stay for the site's own videos and for Cloudflare Stream's
// player of the live broadcast on /live (docs/LIVE.md).
const permissionsPolicy = [
  'accelerometer=()',
  'autoplay=(self "https://*.cloudflarestream.com")',
  'bluetooth=()',
  'browsing-topics=()',
  'camera=()',
  'display-capture=()',
  'fullscreen=(self "https://*.cloudflarestream.com")',
  'geolocation=()',
  'gyroscope=()',
  'hid=()',
  'idle-detection=()',
  'magnetometer=()',
  'microphone=()',
  'midi=()',
  'payment=(self "https://www.paypal.com" "https://www.sandbox.paypal.com")',
  'picture-in-picture=(self "https://*.cloudflarestream.com")',
  'publickey-credentials-get=(self "https://www.paypal.com")',
  'screen-wake-lock=()',
  'serial=()',
  'usb=()',
  'xr-spatial-tracking=()',
].join(', ');

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: permissionsPolicy },
  { key: 'Strict-Transport-Security', value: HSTS_VALUE },
  // Other sites cannot hold a reference to our windows, except the PayPal popup we open ourselves.
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
  // Our files are not for embedding by other origins. (No COEP: it would block PayPal and Firebase media.)
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
];

const nextConfig: NextConfig = {
  // Git worktrees share one node_modules through a junction outside their folder; set
  // TURBOPACK_ROOT=<a common parent folder> there so Turbopack accepts it. Unset in CI/production.
  ...(process.env.TURBOPACK_ROOT
    ? { turbopack: { root: path.resolve(process.env.TURBOPACK_ROOT) }, outputFileTracingRoot: path.resolve(process.env.TURBOPACK_ROOT) }
    : {}),
  poweredByHeader: false,
  // Title, description, canonical, hreflang and Open Graph always in <head>, for every visitor and every crawler.
  // By default Next streams metadata into <body> when generateMetadata is still busy as the shell is sent, and only
  // a fixed list of "HTML-limited" bots (not Googlebot) gets it in <head>: the 868 product pages (whose metadata
  // waits for the catalogue) had it in <body>, where Google ignores rel=canonical and hreflang, and Lighthouse
  // reported "no meta description". Every generateMetadata here reads cached translations or the same cached
  // catalogue read the page itself awaits, so blocking on it costs no measurable time (docs/PERFORMANCE.md).
  htmlLimitedBots: /.*/,
  reactStrictMode: true,
  images: {
    formats: ['image/avif', 'image/webp'],
    // Optimised copies are kept for 31 days (the default is 4 hours, so a quiet page re-encoded its photos all the
    // time). Safe because a product photo's address carries a download token that changes with the file, and the
    // site's own photos are renamed when they change.
    minimumCacheTTL: 60 * 60 * 24 * 31,
    // The widths next/image may produce. 3840 and 2048 (the defaults) are never asked for by a photo that is at
    // most 2560 px wide; 828 and 1280 cover the common phone and laptop widths. `imageSizes` are for photos that
    // do not fill the width (cards, thumbnails).
    deviceSizes: [640, 828, 1080, 1280, 1920, 2560],
    imageSizes: [64, 128, 256, 384, 512],
    qualities: [75, 85],
    remotePatterns: [{ protocol: 'https', hostname: 'firebasestorage.googleapis.com' }],
  },
  // Addresses of the previous site keep working (search engines, shared links). The bare ones (/latin, /product/<id>)
  // are answered by src/proxy.ts with ONE permanent redirect straight to the page in the visitor's language
  // (src/lib/legacyPaths.ts); here only the language-prefixed forms (/en/latin), which the proxy leaves alone.
  async redirects() {
    const places = ['latin', 'greek', 'maryswell', 'oldcity', 'city'];
    const withLocale = (rule: { source: string; destination: string }) => [
      {
        source: `/:locale(${locales.join('|')})${rule.source}`,
        destination: `/:locale${rule.destination}`,
        permanent: true,
      },
    ];
    return [
      ...places.flatMap((slug) => withLocale({ source: `/${slug}`, destination: `/sites/${slug}` })),
      ...withLocale({ source: '/product/:id', destination: '/shop/:id' }),
      ...withLocale({ source: '/checkoutcandle', destination: '/candle' }),
      ...withLocale({ source: '/checkoutdonation', destination: '/donate' }),
      // The dashboard is its own site on its own origin (docs/ADMIN.md): /admin only forwards there. It is never served
      // under this domain, so a flaw in a public page can never reach the dashboard's session.
      ...['/admin', '/admin/:path*', `/:locale(${locales.join('|')})/admin`, `/:locale(${locales.join('|')})/admin/:path*`].map((source) => ({
        source,
        destination: source.endsWith(':path*') ? 'https://admin.nazarethholycross.com/:path*' : 'https://admin.nazarethholycross.com/',
        permanent: false,
      })),
    ];
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Photos and sounds in public/ are not fingerprinted, so by default the browser re-asks the server on every
      // visit (max-age=0). A day of freshness plus a week of stale-while-revalidate keeps repeat visits fast and
      // still lets a replaced file show up within a day.
      {
        source: '/:folder(images|sounds)/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }],
      },
      // The re-encoded videos (public/videos, see docs/PERFORMANCE.md). Change a film by giving it a new name.
      {
        source: '/videos/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000, stale-while-revalidate=604800' }],
      },
      // public/sw.js retires the service worker an older version of the site installed; never cache it.
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }] },
      // The pre-built AVIF/WebP files of the licensed photos (scripts/media): cached for a month, revalidated in the
      // background for another week. Change a crop by building a new id, not by overwriting a file.
      {
        source: '/images/nazareth-media/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000, stale-while-revalidate=604800' }],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
