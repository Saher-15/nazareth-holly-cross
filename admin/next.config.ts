import type { NextConfig } from 'next';
import path from 'node:path';

// Static security headers for every response. The Content-Security-Policy is not here: it carries a per-request
// nonce, so src/proxy.ts sets it (see src/lib/csp.ts). Nothing the admin shows may be embedded, indexed or cached.
const permissionsPolicy = [
  'accelerometer=()',
  'autoplay=()',
  'bluetooth=()',
  'camera=()',
  'display-capture=()',
  'geolocation=()',
  'gyroscope=()',
  'hid=()',
  'magnetometer=()',
  'microphone=()',
  'midi=()',
  'payment=()',
  'serial=()',
  'usb=()',
  'xr-spatial-tracking=()',
].join(', ');

// The Live page (docs/LIVE.md) is the one place that may use the camera and the microphone (and keep the screen on
// while broadcasting). A browser applies the policy of the page it LOADED, so the dashboard links to /live with a full
// page load (AppShell FULL_LOAD); everywhere else they stay off.
const livePermissionsPolicy = permissionsPolicy
  .replace('camera=()', 'camera=(self)')
  .replace('microphone=()', 'microphone=(self)')
  .replace('autoplay=()', 'autoplay=(self)');

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: permissionsPolicy },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet' },
];

const nextConfig: NextConfig = {
  // Git worktrees share one node_modules through a junction outside their folder; set
  // TURBOPACK_ROOT=<a common parent folder> there so Turbopack accepts it. Unset in CI/production.
  ...(process.env.TURBOPACK_ROOT
    ? { turbopack: { root: path.resolve(process.env.TURBOPACK_ROOT) }, outputFileTracingRoot: path.resolve(process.env.TURBOPACK_ROOT) }
    : {}),
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    // Built assets under /_next/static keep Next's own immutable caching; every page and API answer is private
    // (src/proxy.ts sets no-store).
    // When two entries match, the later one wins for the same header: /live gets its own Permissions-Policy.
    return [
      { source: '/:path*', headers: securityHeaders },
      { source: '/live', headers: [{ key: 'Permissions-Policy', value: livePermissionsPolicy }] },
    ];
  },
};

export default nextConfig;
