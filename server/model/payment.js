import mongoose from 'mongoose';
const { Schema } = mongoose;

// The payment ledger: one document per PayPal order the API created. It is the shop's own record that money moved,
// written by the server BEFORE the customer can pay (create_order) and updated when PayPal confirms the capture
// (complete_order), independently of whatever the browser does afterwards. If the browser never gets to save the
// order or the candle (offline, tab closed), the payment is still here, "captured" and not linked to anything,
// and the dashboard's Payments page and `scripts/reconcile-payments.js` list it.
//
//   created   the PayPal order exists, the customer has not (yet) paid
//   captured  PayPal confirmed the money
//   failed    PayPal refused the capture (a later retry on the same PayPal order can still succeed)

export const PAYMENT_TYPES = ['order', 'candle', 'donation', 'unknown']; // 'unknown': a legacy client that sent no type
export const PAYMENT_STATUSES = ['created', 'captured', 'failed'];
export const LINK_KINDS = ['order', 'candle'];

// A captured order/candle payment that is still not linked to a saved record after this long is "unfulfilled": the
// customer has paid and the shop has nothing to ship or light. Before that the browser is simply still posting it.
export const PAYMENT_GRACE_MS = 10 * 60 * 1000;

const paymentSchema = new Schema({
  paypalOrderId: {
    type: String,
    required: [true, 'PayPal order id is required'],
    trim: true,
    minlength: [10, 'PayPal order id too short'],
    maxlength: [40, 'PayPal order id too long'],
  },
  type: { type: String, enum: PAYMENT_TYPES, required: true },
  amount: { type: Number, required: true, min: [0, 'Amount cannot be negative'], max: [1_000_000, 'Amount too large'] },
  currency: { type: String, default: 'USD', trim: true, uppercase: true, minlength: 3, maxlength: 3 },
  status: { type: String, enum: PAYMENT_STATUSES, default: 'created' },
  capturedAt: { type: Date, default: null },
  // What PayPal says about the payer (a personal-data field: see docs/DATABASE.md, erased with the customer's data).
  payerEmail: { type: String, trim: true, lowercase: true, maxlength: [254, 'Email too long'] },
  payerName: { type: String, trim: true, maxlength: [200, 'Name too long'] },
  donorName: { type: String, trim: true, maxlength: [100, 'Name too long'] }, // donations: what the donor typed (optional)
  // The order or candle request this payment paid for. Empty until the browser's second call arrives.
  linkedTo: {
    kind: { type: String, enum: LINK_KINDS },
    id: { type: Schema.Types.ObjectId },
  },
  // An admin who looked at an unfulfilled payment and dealt with it (refund, shipped by hand, test payment...).
  resolvedAt: { type: Date, default: null },
  resolvedBy: { type: String, trim: true, maxlength: [100, 'Name too long'] },
  notes: { type: String, trim: true, maxlength: [1000, 'Note too long'] },
}, { timestamps: true });

// One PayPal order, one ledger row (also what makes "one payment pays for one thing" hold).
paymentSchema.index({ paypalOrderId: 1 }, { unique: true });
// The Payments page and the dashboard: newest first, by status or type, unfulfilled ones.
paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ type: 1, createdAt: -1 });
paymentSchema.index({ createdAt: -1 });
// From an order or candle back to its payment, and the GDPR lookup by payer address.
paymentSchema.index({ 'linkedTo.id': 1 }, { sparse: true });
paymentSchema.index({ payerEmail: 1 }, { sparse: true });

export default mongoose.model('Payment', paymentSchema, 'payment');
