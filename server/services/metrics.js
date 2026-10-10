import mongoose from 'mongoose';
import Metric from '../model/metric.js';
import Candle from '../model/candle.js';
import Order from '../model/order.js';

// The sales funnel, counted without cookies (owner's brief of 2026-10-10, phase 2; docs/ANALYTICS.md).
//
// The website tells the API "this happened" (POST /track): a candle page was opened, the order button was pressed,
// the details were filled in, a payment was started, a payment was completed. Each is added to an anonymous daily
// counter (model/metric.js). The campaign comes from the link the advertiser used (utm_source, utm_medium,
// utm_campaign), so the owner can see how many paying customers each campaign brought.
//
// What is deliberately NOT done: no visitor identifier, no cookie, no address, no browser name, no third party.
// The price of that: these are counts of events, not of people (one person opening the page twice counts twice).
// Purchases are also counted from the real paid orders and candles (the truth), next to the browser's own count.

export const FLOWS = ['candle', 'order', 'donation'];
export const EVENTS = ['view', 'cta', 'details', 'pay_start', 'paid'];
/** A day holds at most this many different rows: beyond it new campaign names are counted together as "other". */
export const MAX_ROWS_PER_DAY = 400;
export const MAX_RANGE_DAYS = 366;

const LABEL = /^[a-z0-9][a-z0-9_.+-]{0,59}$/;
/** A campaign label as it is stored: lower case, a short plain token, or '' when it is anything else. */
export const cleanLabel = (value) => {
  if (typeof value !== 'string') return '';
  const text = value.trim().toLowerCase().replace(/\s+/g, '_');
  return LABEL.test(text) ? text : '';
};

const BOT = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|externalhit|whatsapp|telegram|slack|discord|embed|monitor|uptime|curl|wget|python|node-fetch|axios|okhttp/i;
/** Requests that are not a person looking at the page: crawlers, link previews, monitors, scripts. */
export const looksAutomated = (userAgent) => typeof userAgent !== 'string' || userAgent.length < 20 || BOT.test(userAgent);

export const dayOf = (date) => date.toISOString().slice(0, 10);

/** Adds one to today's counter. Returns false (and counts nothing) for anything that is not a known event. */
export async function recordEvent(input, { now = new Date() } = {}) {
  const flow = typeof input?.flow === 'string' ? input.flow : '';
  const event = typeof input?.event === 'string' ? input.event : '';
  if (!FLOWS.includes(flow) || !EVENTS.includes(event)) return false;
  const day = dayOf(now);
  let key = { day, flow, event, source: cleanLabel(input.source), medium: cleanLabel(input.medium), campaign: cleanLabel(input.campaign) };

  // The usual case: the row exists already.
  const added = await Metric.updateOne(key, { $inc: { count: 1 } });
  if (added.matchedCount) return true;
  // A new row. Campaign names come from the address bar, so anyone can invent them: a day never grows past
  // MAX_ROWS_PER_DAY rows; later inventions are counted together.
  if ((key.source || key.medium || key.campaign) && (await Metric.countDocuments({ day })) >= MAX_ROWS_PER_DAY) {
    key = { day, flow, event, source: 'other', medium: '', campaign: '' };
  }
  await Metric.updateOne(key, { $inc: { count: 1 } }, { upsert: true });
  return true;
}

const emptyCounts = () => Object.fromEntries(EVENTS.map((event) => [event, 0]));
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const isDay = (text) => typeof text === 'string' && DAY.test(text) && !Number.isNaN(Date.parse(`${text}T00:00:00Z`));

/** The report's range: valid days, from <= to, at most MAX_RANGE_DAYS; the default is the last 30 days. */
export function reportRange(query = {}, now = new Date()) {
  const to = isDay(query.to) ? query.to : dayOf(now);
  const fallback = dayOf(new Date(Date.parse(`${to}T00:00:00Z`) - 29 * 86400000));
  let from = isDay(query.from) && query.from <= to ? query.from : fallback;
  const earliest = dayOf(new Date(Date.parse(`${to}T00:00:00Z`) - (MAX_RANGE_DAYS - 1) * 86400000));
  if (from < earliest) from = earliest;
  return { from, to };
}

/**
 * The funnel of one flow between two days (inclusive):
 * { from, to, flow, totals, campaigns: [{ source, medium, campaign, ...counts }], days: [{ day, ...counts }], paidConfirmed }
 * `paidConfirmed` is the number of paid candles or orders saved in those days: the truth the browser's "paid" count is
 * compared with (it is not split by campaign: an order does not know its campaign).
 */
export async function funnelReport({ from, to, flow = 'candle' }) {
  const rows = await Metric.find({ day: mongoose.trusted({ $gte: from, $lte: to }), flow }).lean();
  const totals = emptyCounts();
  const campaigns = new Map();
  const days = new Map();
  for (const row of rows) {
    if (!EVENTS.includes(row.event)) continue;
    const count = Number(row.count) || 0;
    totals[row.event] += count;
    const name = JSON.stringify([row.source ?? '', row.medium ?? '', row.campaign ?? '']);
    if (!campaigns.has(name)) campaigns.set(name, { source: row.source ?? '', medium: row.medium ?? '', campaign: row.campaign ?? '', ...emptyCounts() });
    campaigns.get(name)[row.event] += count;
    if (!days.has(row.day)) days.set(row.day, { day: row.day, ...emptyCounts() });
    days.get(row.day)[row.event] += count;
  }

  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(Date.parse(`${to}T00:00:00Z`) + 86400000);
  const within = { createdAt: mongoose.trusted({ $gte: start, $lt: end }), paymentVerified: true };
  const paidConfirmed = flow === 'candle' ? await Candle.countDocuments(within) : flow === 'order' ? await Order.countDocuments(within) : null;

  return {
    from,
    to,
    flow,
    totals,
    campaigns: [...campaigns.values()].sort((a, b) => b.paid - a.paid || b.view - a.view || a.source.localeCompare(b.source)),
    days: [...days.values()].sort((a, b) => a.day.localeCompare(b.day)),
    paidConfirmed,
  };
}
