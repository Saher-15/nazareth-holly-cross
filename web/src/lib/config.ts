// Public build-time settings. Override with NEXT_PUBLIC_* variables per environment.
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'https://nazareth-holy-cross-api.onrender.com';

// Must belong to the same PayPal environment (sandbox/live) as the API's CLIENT_ID.
export const PAYPAL_CLIENT_ID =
  process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ??
  'AfhOc9ToAj72gf5KEowYfhpWShGRSpzSL-Ps2HYX4ky95KmVX8vNRb0o5FZ3AGw3muq8DIvDP0Ua2_ad';

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://nazarethholycross.com';

export const CONTACT_EMAIL = 'nazarethholycross@gmail.com';

// The brand name as printed in metadata, structured data and the title template. (Messages hold the
// same text as `site.name` for visible copy.)
export const SITE_NAME = 'Nazareth Holy Cross';
