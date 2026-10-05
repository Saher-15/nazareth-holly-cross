import mongoose from 'mongoose';

export const PRAYER_CATEGORIES = ['Peace', 'Health', 'Gratitude', 'Family', 'Personal', 'World Peace'];

// Lengths are bounded (the request body is capped at 10 KB, but a prayer wall should not hold essays).
const prayerSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true, maxlength: [200, 'Name too long'] },
  country:  { type: String, required: true, trim: true, maxlength: [100, 'Country too long'] },
  prayer:   { type: String, required: true, trim: true, maxlength: [2000, 'Prayer cannot exceed 2000 characters'] },
  category: {
    type: String,
    enum: PRAYER_CATEGORIES,
    default: 'Personal',
  },
  likes: { type: Number, default: 0, min: 0 },
}, { timestamps: true, toJSON: { virtuals: true } });

export default mongoose.model('Prayer', prayerSchema);
