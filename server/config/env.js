import dotenv from 'dotenv';

dotenv.config();

const env = process.env;

// Variables the server cannot run without; index.js refuses to start if any is missing.
export const REQUIRED_ENV = [
  'DATABASEURL', 'JWT_SECRET', 'ADMIN_PASSWORD',
  'MAIL_FROM', 'MAIL_APP_PASSWORD', 'CLIENT_ID', 'CLIENT_SECRET',
];

export const missingEnv = () => REQUIRED_ENV.filter((k) => !env[k]);

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
