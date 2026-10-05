import type { NextConfig } from 'next';
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
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
