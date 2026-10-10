// Single place for build-time settings. Override any of them with a REACT_APP_* variable.
const env = process.env;

// Backend API (Render)
export const API_URL = env.REACT_APP_API_URL || 'https://nazareth-holy-cross-api-production.up.railway.app';

// PayPal client id (public). Must be from the same PayPal environment as the server's CLIENT_ID.
export const PAYPAL_CLIENT_ID =
  env.REACT_APP_PAYPAL_CLIENT_ID ||
  'AfhOc9ToAj72gf5KEowYfhpWShGRSpzSL-Ps2HYX4ky95KmVX8vNRb0o5FZ3AGw3muq8DIvDP0Ua2_ad';

// Google Analytics 4 measurement id
export const GA_MEASUREMENT_ID = env.REACT_APP_GA_MEASUREMENT_ID || 'G-VE42K6WP4H';
