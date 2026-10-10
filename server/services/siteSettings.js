import SiteSetting from '../model/siteSetting.js';
import { HttpError } from '../utils/httpError.js';

// Settings the owner changes from the dashboard (model/siteSetting.js). Read often (every candle payment), changed
// rarely: cached for 30 seconds, and the cache is dropped at once when the owner saves a change.

export const CANDLE_PRICE_DEFAULT = 3; // USD, the price before anyone changed it
export const CANDLE_PRICE_MIN = 1;
export const CANDLE_PRICE_MAX = 100;
export const SETTINGS_CACHE_MS = 30_000;
const KEY = 'site';

let cache = null; // { at, value }

export function resetSettingsCache() {
  cache = null;
}

// A price the shop can charge: a number of dollars and cents within the limits (PayPal takes two decimals).
export function validCandlePrice(value) {
  return typeof value === 'number' && Number.isFinite(value)
    && value >= CANDLE_PRICE_MIN && value <= CANDLE_PRICE_MAX
    && Math.abs(Math.round(value * 100) - value * 100) < 1e-6;
}

async function read() {
  const doc = await SiteSetting.findOne({ key: KEY }).lean();
  return {
    candlePrice: validCandlePrice(doc?.candlePrice) ? doc.candlePrice : CANDLE_PRICE_DEFAULT,
    updatedAt: doc?.updatedAt ?? null,
    updatedBy: doc?.updatedBy?.name ?? '',
  };
}

export async function getSettings(now = Date.now()) {
  if (cache && now - cache.at < SETTINGS_CACHE_MS) return cache.value;
  const value = await read();
  cache = { at: now, value };
  return value;
}

// The price create_order charges for a new candle. A payment already started keeps the price it was created with
// (the ledger's amount, route/candleRoute.js): a change here never blocks a customer who has paid.
export async function getCandlePrice(now = Date.now()) {
  return (await getSettings(now)).candlePrice;
}

export async function setCandlePrice(price, actor) {
  if (!validCandlePrice(price)) {
    throw new HttpError(400, `Invalid price: between ${CANDLE_PRICE_MIN} and ${CANDLE_PRICE_MAX} USD, at most two decimals`);
  }
  const before = await read();
  await SiteSetting.findOneAndUpdate(
    { key: KEY },
    { $set: { candlePrice: price, updatedBy: { id: actor?.id ?? null, name: actor?.name ?? '' } } },
    { upsert: true, new: true, runValidators: true },
  );
  resetSettingsCache();
  return { from: before.candlePrice, to: price };
}
