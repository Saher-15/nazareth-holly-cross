import crypto from 'node:crypto';
import { config } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

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
        // Idempotency key: only for requests that create something.
        ...(method === 'GET' ? {} : { 'PayPal-Request-Id': crypto.randomUUID() }),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new HttpError(502, `PayPal is unreachable: ${err.message}`);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new HttpError(502, `PayPal ${path} failed (${res.status}): ${json.message || json.name || 'unknown error'}`);
    error.upstreamStatus = res.status;
    throw error;
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

// Reads an order back from PayPal (its status, amount and captures).
export async function getOrder(orderId) {
  const token = await getAccessToken();
  return paypalFetch(`/v2/checkout/orders/${encodeURIComponent(orderId)}`, { token, method: 'GET' });
}

const cents = (value) => Math.round(Number(value) * 100);

export { verifiedCaptureStatus } from './paymentCapture.js';

// Proves that a PayPal order was really paid, in full: PayPal itself says it is COMPLETED, it holds one
// purchase for exactly `expectedAmount` USD, and completed captures for exactly that
// amount. Throws an HttpError otherwise (402 = not paid / does not match, 502 = PayPal could not be asked).
export async function assertPaid(orderId, expectedAmount) {
  let order;
  try {
    order = await getOrder(orderId);
  } catch (err) {
    if (err.upstreamStatus === 404) throw new HttpError(402, 'Payment not found');
    throw err;
  }

  const units = Array.isArray(order.purchase_units) ? order.purchase_units : [];
  const unit = units[0];
  if (order.status !== 'COMPLETED' || units.length !== 1 || !unit) {
    throw new HttpError(402, 'Payment was not completed');
  }
  if (unit.amount?.currency_code !== 'USD' || cents(unit.amount.value) !== cents(expectedAmount)) {
    console.error(
      `[${new Date().toISOString()}] PayPal order ${orderId} amount ${unit.amount?.value} ${unit.amount?.currency_code} does not match the order total ${expectedAmount}`,
    );
    throw new HttpError(402, 'Payment amount does not match the order');
  }
  const captures = Array.isArray(unit.payments?.captures) ? unit.payments.captures : [];
  const captured = captures
    .filter((c) => c.status === 'COMPLETED' && c.amount?.currency_code === 'USD' && /^\d+(?:\.\d{1,2})?$/.test(String(c.amount?.value)))
    .reduce((sum, c) => sum + cents(c.amount.value), 0);
  if (captures.some(c => c.status !== 'COMPLETED' || c.amount?.currency_code !== 'USD') || captured !== cents(expectedAmount)) throw new HttpError(402, 'Payment was not captured');

  return { id: order.id ?? orderId, amount: expectedAmount };
}
