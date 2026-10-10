import mongoose from 'mongoose';

const { Schema } = mongoose;

// Site-wide settings the owner changes from the dashboard (docs/ADMIN.md, "Settings"). One document, key 'site'.
// Read through services/siteSettings.js (cached, with safe defaults), never directly by a route.
const siteSettingSchema = new Schema({
  key: { type: String, required: true, trim: true, maxlength: 40 },
  // The price of a prayer candle in USD (services/siteSettings.js holds the default and the limits).
  candlePrice: { type: Number, min: 1, max: 100 },
  updatedBy: {
    id: { type: Schema.Types.ObjectId, default: null },
    name: { type: String, trim: true, maxlength: [100, 'Name too long'], default: '' },
  },
}, { timestamps: true });

siteSettingSchema.index({ key: 1 }, { unique: true });

export default mongoose.model('SiteSetting', siteSettingSchema, 'siteSetting');
