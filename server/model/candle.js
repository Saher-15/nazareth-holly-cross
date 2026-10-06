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
    maxlength: [254, 'Email too long'],
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
  // The PayPal order that paid for this candle (the $3 payment), set when the browser sent it and PayPal (or the
  // payment ledger, model/payment.js) confirmed it was captured. Requests saved without it (older clients) have
  // paymentVerified: false.
  paypalOrderId: {
    type: String,
    trim: true,
    maxlength: [40, 'PayPal order id too long'],
  },
  paymentVerified: {
    type: Boolean,
    default: false,
  },
  erasedAt: { type: Date }, // the requester's personal data was erased (docs/DATABASE.md); the paid request stays
}, { timestamps: true });

// One payment lights one candle (a second request with the same PayPal order id fails: E11000 -> 409).
candleSchema.index({ paypalOrderId: 1 }, { unique: true, partialFilterExpression: { paypalOrderId: { $type: 'string' } } });
candleSchema.index({ done: 1, createdAt: -1 }); // the admin list "pending first"
candleSchema.index({ createdAt: -1 }); // the default list, the CSV export, the dashboard's recent and per-day counts
candleSchema.index({ email: 1 }); // a customer's data request (docs/DATABASE.md, erase)

export default mongoose.model('Candle', candleSchema, 'candle');
