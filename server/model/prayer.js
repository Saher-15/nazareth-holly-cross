import mongoose from 'mongoose';

const prayerSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  country:  { type: String, required: true, trim: true },
  prayer:   { type: String, required: true, trim: true },
  category: {
    type: String,
    enum: ['Peace', 'Health', 'Gratitude', 'Family', 'Personal', 'World Peace'],
    default: 'Personal',
  },
  likes: { type: Number, default: 0 },
}, { timestamps: true, toJSON: { virtuals: true } });

export default mongoose.model('Prayer', prayerSchema);
