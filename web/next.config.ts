import type { NextConfig } from 'next';
import path from 'node:path';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Baseline security headers for every response. A full Content-Security-Policy
// (PayPal, Firebase, analytics) is added once those integrations are ported.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig: NextConfig = {
  // Git worktrees share one node_modules through a junction outside their folder; set
  // TURBOPACK_ROOT=<a common parent folder> there so Turbopack accepts it. Unset in CI/production.
  ...(process.env.TURBOPACK_ROOT
    ? { turbopack: { root: path.resolve(process.env.TURBOPACK_ROOT) }, outputFileTracingRoot: path.resolve(process.env.TURBOPACK_ROOT) }
    : {}),
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [{ protocol: 'https', hostname: 'firebasestorage.googleapis.com' }],
  },
  // Addresses of the previous site keep working (search engines, shared links).
  async redirects() {
    const places = ['latin', 'greek', 'maryswell', 'oldcity', 'city'];
    return [
      ...places.map((slug) => ({ source: `/${slug}`, destination: `/sites/${slug}`, permanent: true })),
      { source: '/product/:id', destination: '/shop/:id', permanent: true },
      { source: '/checkoutcandle', destination: '/candle', permanent: true },
      { source: '/checkoutdonation', destination: '/donate', permanent: true },
    ];
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
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
