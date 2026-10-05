import { config } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';
import { v4 as uuidv4 } from 'uuid';

const { baseUrl, clientId, clientSecret } = config.paypal;

const TIMEOUT_MS = 15_000;

async function paypalFetch(path, { token, body, method = 'POST' } = {}) {
  let res;
  try {
    res = await fetch(baseUrl + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'PayPal-Request-Id': uuidv4(),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new HttpError(502, `PayPal is unreachable: ${err.message}`);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new HttpError(502, `PayPal ${path} failed (${res.status}): ${json.message || json.name || 'unknown error'}`);
  }
  return json;
}

// PayPal access tokens live for hours; asking for a new one on every request doubles the calls
// of each checkout. The token is kept until a minute before it expires.
let cachedToken = null;
let cachedUntil = 0;

export function clearAccessTokenCache() {
  cachedToken = null;
  cachedUntil = 0;
}

export async function getAccessToken() {
  if (cachedToken && Date.now() < cachedUntil) return cachedToken;
  let res;
  try {
    res = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new HttpError(502, `PayPal is unreachable: ${err.message}`);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    throw new HttpError(502, `PayPal authentication failed (${res.status})`);
  }
  if (Number.isFinite(json.expires_in) && json.expires_in > 120) {
    cachedToken = json.access_token;
    cachedUntil = Date.now() + (json.expires_in - 60) * 1000;
  }
  return json.access_token;
}

// Creates a CAPTURE order for `amount` USD and returns PayPal's order object.
export async function createOrder(amount) {
  const token = await getAccessToken();
  return paypalFetch('/v2/checkout/orders', {
    token,
    body: {
      intent: 'CAPTURE',
      purchase_units: [{ amount: { currency_code: 'USD', value: amount.toFixed(2) } }],
    },
  });
}

// Captures an approved order and returns PayPal's capture result (check .status).
export async function captureOrder(orderId) {
  const token = await getAccessToken();
  return paypalFetch(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, { token });
}
