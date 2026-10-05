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

export const config = {
  nodeEnv: env.NODE_ENV || 'development',
  isProd: env.NODE_ENV === 'production',
  port: env.PORT || 5000,
  databaseUrl: env.DATABASEURL,
  jwtSecret: env.JWT_SECRET,
  adminPassword: env.ADMIN_PASSWORD,
  clientUrl: env.CLIENT_URL,
  // Comma-separated extra origins allowed by CORS (e.g. a new admin domain)
  extraOrigins: (env.EXTRA_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean),
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
