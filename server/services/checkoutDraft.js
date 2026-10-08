import { HttpError } from '../utils/httpError.js';
import { isEmail } from '../utils/validate.js';

const ORDER_FIELDS = { firstName: 100, lastName: 100, phone: 50, email: 254, street: 200, city: 100, state: 100, postal: 20, country: 100 };
const CANDLE_FIELDS = { firstName: 100, lastName: 100, email: 254, prayer: 1000 };

// Store only validated delivery/prayer fields. Prices and product lines always come from the server quote.
export function validateFulfilment(type, raw) {
  const fields = type === 'order' ? ORDER_FIELDS : type === 'candle' ? CANDLE_FIELDS : null;
  if (!fields || !raw || typeof raw !== 'object' || Array.isArray(raw)) throw new HttpError(422, 'Invalid checkout details');
  const result = {};
  for (const [field, max] of Object.entries(fields)) {
    const value = typeof raw[field] === 'number' && Number.isFinite(raw[field]) ? String(raw[field]) : raw[field];
    if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new HttpError(422, 'Invalid checkout details');
    result[field] = value.trim();
  }
  if (!isEmail(result.email) || (type === 'candle' && result.prayer.length < 5)) throw new HttpError(422, 'Invalid checkout details');
  result.email = result.email.toLowerCase();
  return result;
}
