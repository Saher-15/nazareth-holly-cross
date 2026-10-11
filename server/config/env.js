import dotenv from 'dotenv';

dotenv.config();

const env = process.env;

// Variables the server cannot run without; index.js refuses to start if any is missing.
// (ADMIN_PASSWORD is no longer one of them: the shared-password sign-in it served was removed on 2026-10-07.)
export const REQUIRED_ENV = [
  'DATABASEURL', 'JWT_SECRET',
  'MAIL_FROM', 'MAIL_APP_PASSWORD', 'CLIENT_ID', 'CLIENT_SECRET',
];

export const missingEnv = () => REQUIRED_ENV.filter((k) => !env[k]);

// Values copied from .env.example must never be used for real.
const PLACEHOLDERS = new Set([
  'your-very-long-random-secret-key-here',
  'changeme',
  'secret',
  'password',
]);

// Problems with the secrets themselves. `fatal` ones stop the server in production; the others are logged.
export function secretProblems() {
  const problems = [];
  const jwt = env.JWT_SECRET || '';
  if (PLACEHOLDERS.has(jwt.toLowerCase())) problems.push({ fatal: true, message: 'JWT_SECRET is a placeholder value' });
  // Fatal in production since the 2026-10-10 audit (H02): a short key can be guessed offline from one session token.
  // (The length is a floor, not a proof of randomness: generate it, e.g. `openssl rand -base64 48`.)
  else if (jwt && jwt.length < 32) problems.push({ fatal: true, message: 'JWT_SECRET is shorter than 32 characters' });
  // Nothing reads it any more; a leftover value is only a secret lying around (the owner deletes it on Render).
  if (env.ADMIN_PASSWORD) problems.push({ fatal: false, message: 'ADMIN_PASSWORD is set but no longer used: delete it from the environment' });
  return problems;
}

const paypalEnvironment = env.ENVIRONMENT || 'sandbox';

// How many reverse proxies stand between a visitor and this process (Express "trust proxy"). It decides which
// address every per-IP rate limit counts. 1 = the proxy that connects to us (Render's load balancer). On Render the
// traffic also passes through Cloudflare, which can make one hop too few: every visitor is then counted as the
// Cloudflare edge address. Raise it to 2 only after checking it (docs/INFRASTRUCTURE.md, "Rate limits behind
// Cloudflare"). Anything that is not a whole number from 1 to 5 falls back to 1.
const hops = Number(env.TRUST_PROXY_HOPS);
const trustProxyHops = Number.isInteger(hops) && hops >= 1 && hops <= 5 ? hops : 1;

export const config = {
  nodeEnv: env.NODE_ENV || 'development',
  isProd: env.NODE_ENV === 'production',
  port: env.PORT || 5000,
  trustProxyHops,
  databaseUrl: env.DATABASEURL,
  jwtSecret: env.JWT_SECRET,
  clientUrl: env.CLIENT_URL,
  // Production always fails closed; only local/test compatibility may explicitly opt out.
  requirePaymentProof: env.NODE_ENV === 'production' || env.REQUIRE_PAYMENT_PROOF !== 'false',
  // Comma-separated extra origins allowed by CORS (e.g. a new admin domain)
  extraOrigins: (env.EXTRA_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean),
  // Comma-separated browser origins of the NEW admin dashboard (docs/ADMIN.md). Exact origins, no wildcards.
  adminOrigins: (env.ADMIN_ORIGINS || '').split(',').map((o) => o.trim().replace(/\/+$/, '')).filter(Boolean),
  // Where the dashboard lives: the password-reset e-mail links to <adminAppUrl>/reset-password.
  adminAppUrl: (env.ADMIN_APP_URL || 'https://admin.nazarethholycross.com').trim().replace(/\/+$/, ''),
  // While NO admin account exists, a reset request for one of these addresses creates the first owner (with no usable
  // password) and mails it the link to choose one. Only the mailbox owner can finish. ADMIN_BOOTSTRAP_EMAILS="" turns it off.
  adminBootstrapEmails: (env.ADMIN_BOOTSTRAP_EMAILS ?? 'nazarethholycross@gmail.com').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean),
  // The public website (web/, Netlify). After a product changes the API asks it to refresh its cached shop pages at once
  // (services/siteRefresh.js -> POST <siteUrl>/api/revalidate with REVALIDATE_SECRET, the same random value on Render
  // and Netlify). Without the secret nothing is called and the site picks the change up within 10 minutes by itself.
  site: {
    url: (env.SITE_URL || 'https://nazarethholycross.com').trim().replace(/\/+$/, ''),
    revalidateSecret: (env.REVALIDATE_SECRET || '').trim(),
  },
  // Hosts a product photo may live on: the ones the website can show (web/next.config.ts images.remotePatterns and the
  // site's Content-Security-Policy img-src). Comma-separated host names; add one there before adding it here.
  // '1' = also accept local photo addresses (http://localhost) in production mode: the test harness only.
  productImageLocal: env.PRODUCT_IMAGE_LOCAL === '1',
  productImageHosts: (env.PRODUCT_IMAGE_HOSTS || 'firebasestorage.googleapis.com').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean),
  mail: {
    from: env.MAIL_FROM,
    appPassword: env.MAIL_APP_PASSWORD,
  },
  // Live broadcasting (docs/LIVE.md): Cloudflare Stream, WebRTC (WHIP in, WHEP out). Both are needed; without them the
  // feature says "not configured" and nothing else changes. The token is a secret: never logged, never sent anywhere
  // but to api.cloudflare.com.
  cloudflare: {
    accountId: (env.CF_ACCOUNT_ID || '').trim(),
    streamApiToken: (env.CF_STREAM_API_TOKEN || '').trim(),
  },
  paypal: {
    environment: paypalEnvironment,
    clientId: env.CLIENT_ID,
    clientSecret: env.CLIENT_SECRET,
    baseUrl: paypalEnvironment === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com',
  },
};
