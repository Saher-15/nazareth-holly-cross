import mongoose from 'mongoose';
const { Schema } = mongoose;

const candleSchema = new Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    minlength: [1, 'First name too short'],
    maxlength: [100, 'First name too long'],
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    minlength: [1, 'Last name too short'],
    maxlength: [100, 'Last name too long'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format'],
  },
  prayer: {
    type: String,
    required: [true, 'Prayer is required'],
    trim: true,
    minlength: [5, 'Prayer must be at least 5 characters'],
    maxlength: [1000, 'Prayer cannot exceed 1000 characters'],
  },
  done: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

candleSchema.index({ email: 1 });
candleSchema.index({ done: 1 });
candleSchema.index({ createdAt: -1 });

export default mongoose.model('Candle', candleSchema, 'candle');
