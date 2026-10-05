import { config } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';
import { v4 as uuidv4 } from 'uuid';

const { baseUrl, clientId, clientSecret } = config.paypal;

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

export async function getAccessToken() {
  let res;
  try {
    res = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: 'grant_type=client_credentials',
    });
  } catch (err) {
    throw new HttpError(502, `PayPal is unreachable: ${err.message}`);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    throw new HttpError(502, `PayPal authentication failed (${res.status})`);
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
