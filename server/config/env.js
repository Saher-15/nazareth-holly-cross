import dotenv from 'dotenv';

dotenv.config();

const env = process.env;

// Variables the server cannot run without; index.js refuses to start if any is missing.
export const REQUIRED_ENV = [
  'DATABASEURL', 'JWT_SECRET', 'ADMIN_PASSWORD',
  'MAIL_FROM', 'MAIL_APP_PASSWORD', 'CLIENT_ID', 'CLIENT_SECRET',
];

export const missingEnv = () => REQUIRED_ENV.filter((k) => !env[k]);

// Values copied from .env.example must never be used for real.
const PLACEHOLDERS = new Set([
  'your-very-long-random-secret-key-here',
  'your-secure-admin-password',
  'changeme',
  'secret',
  'password',
]);

// Problems with the secrets themselves. `fatal` ones stop the server in production; the others are logged.
export function secretProblems() {
  const problems = [];
  const jwt = env.JWT_SECRET || '';
  const pass = env.ADMIN_PASSWORD || '';
  if (PLACEHOLDERS.has(jwt.toLowerCase())) problems.push({ fatal: true, message: 'JWT_SECRET is a placeholder value' });
  else if (jwt && jwt.length < 32) problems.push({ fatal: false, message: 'JWT_SECRET is shorter than 32 characters' });
  if (PLACEHOLDERS.has(pass.toLowerCase())) problems.push({ fatal: true, message: 'ADMIN_PASSWORD is a placeholder value' });
  else if (pass && pass.length < 12) problems.push({ fatal: false, message: 'ADMIN_PASSWORD is shorter than 12 characters' });
  if (jwt && pass && jwt === pass) problems.push({ fatal: true, message: 'JWT_SECRET and ADMIN_PASSWORD must not be the same value' });
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
  adminPassword: env.ADMIN_PASSWORD,
  clientUrl: env.CLIENT_URL,
  // When "true", /order/newOrder refuses an order that does not carry a paypalOrderId PayPal confirmed.
  // Off until every client sends it (the current CRA site does not); then switch it on.
  requirePaymentProof: env.REQUIRE_PAYMENT_PROOF === 'true',
  // Comma-separated extra origins allowed by CORS (e.g. a new admin domain)
  extraOrigins: (env.EXTRA_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean),
  // Comma-separated browser origins of the NEW admin dashboard (docs/ADMIN.md). Exact origins, no wildcards.
  adminOrigins: (env.ADMIN_ORIGINS || '').split(',').map((o) => o.trim().replace(/\/+$/, '')).filter(Boolean),
  mail: {
    from: env.MAIL_FROM,
    appPassword: env.MAIL_APP_PASSWORD,
  },
  paypal: {
    environment: paypalEnvironment,
    clientId: env.CLIENT_ID,
    clientSecret: env.CLIENT_SECRET,
    baseUrl: paypalEnvironment === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com',
  },
};
