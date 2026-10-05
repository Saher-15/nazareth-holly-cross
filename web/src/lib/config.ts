// Public build-time settings. Override with NEXT_PUBLIC_* variables per environment.
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'https://nazareth-holy-cross-api.onrender.com';

// Must belong to the same PayPal environment (sandbox/live) as the API's CLIENT_ID.
export const PAYPAL_CLIENT_ID =
  process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ??
  'AfhOc9ToAj72gf5KEowYfhpWShGRSpzSL-Ps2HYX4ky95KmVX8vNRb0o5FZ3AGw3muq8DIvDP0Ua2_ad';

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://nazarethholycross.com';

export const CONTACT_EMAIL = 'nazarethholycross@gmail.com';

// Optional: the organisation's WhatsApp number with country code (digits, e.g. 972501234567). When it is set the
// contact page offers a "Message us on WhatsApp" link; nothing is shown while it is empty.
export const CONTACT_WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP ?? '';
