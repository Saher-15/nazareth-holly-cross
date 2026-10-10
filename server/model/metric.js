import mongoose from 'mongoose';

const { Schema } = mongoose;

// Anonymous counters of the sales funnel (services/metrics.js, docs/ANALYTICS.md): how many times something happened
// on a day, for one campaign. One document per (day, flow, event, source, medium, campaign), holding only `count`.
// NOTHING about a visitor is stored: no address, no browser, no identifier, no time of day. It cannot be linked to a
// person or to another row, which is why the site needs no cookie and no consent banner for it.
const metricSchema = new Schema({
  day: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ }, // UTC date
  flow: { type: String, required: true, maxlength: 20 }, // candle | order | donation
  event: { type: String, required: true, maxlength: 20 }, // view | cta | details | pay_start | paid
  // Where the visit came from, as the advertiser wrote it in the link (utm_source, utm_medium, utm_campaign); ''
  // for a visit without a campaign link.
  source: { type: String, default: '', maxlength: 60 },
  medium: { type: String, default: '', maxlength: 60 },
  campaign: { type: String, default: '', maxlength: 60 },
  count: { type: Number, default: 0, min: 0 },
});

// The row an event is added to; also the report's range read (day first).
metricSchema.index({ day: 1, flow: 1, event: 1, source: 1, medium: 1, campaign: 1 }, { unique: true });

export default mongoose.model('Metric', metricSchema, 'metric');
