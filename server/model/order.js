import mongoose from 'mongoose';
const { Schema } = mongoose;

const orderSchema = new Schema({
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
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    maxlength: [50, 'Phone number too long'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    maxlength: [254, 'Email too long'],
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format'],
  },
  date: {
    type: Date,
  },
  street: {
    type: String,
    required: [true, 'Street address is required'],
    trim: true,
    maxlength: [200, 'Street address too long'],
  },
  city: {
    type: String,
    required: [true, 'City is required'],
    trim: true,
    maxlength: [100, 'City name too long'],
  },
  state: {
    type: String,
    required: [true, 'State is required'],
    trim: true,
    maxlength: [100, 'State name too long'],
  },
  postal: {
    type: String,
    required: [true, 'Postal code is required'],
    trim: true,
    maxlength: [20, 'Postal code too long'],
  },
  country: {
    type: String,
    required: [true, 'Country is required'],
    trim: true,
    maxlength: [100, 'Country name too long'],
  },
  totalPrice: {
    type: Number,
    required: [true, 'Total price is required'],
    min: [0.01, 'Total price must be greater than 0'],
    max: [1_000_000, 'Total price too large'],
  },
  products: {
    type: [{
      productID: {
        type: mongoose.Types.ObjectId,
        required: [true, 'Product id is required'],
      },
      productName: {
        type: String,
        trim: true,
        maxlength: [200, 'Product name too long'],
      },
      quantity: {
        type: Number,
        required: [true, 'Quantity is required'],
        min: [1, 'Quantity must be at least 1'],
        max: [50, 'Quantity cannot exceed 50'],
        validate: { validator: Number.isInteger, message: 'Quantity must be a whole number' },
      },
      color: {
        type: String,
        trim: true,
        maxlength: [50, 'Colour too long'],
      },
    }],
    required: [true, 'Products are required'],
    // An empty array passes `required` in Mongoose, so the bounds are written out (pricing.js allows 100 lines).
    validate: { validator: (list) => Array.isArray(list) && list.length >= 1 && list.length <= 100, message: 'An order has 1 to 100 lines' },
  },
  done: {
    type: Boolean,
    default: false,
  },
  // The PayPal order that paid for this one, set only after PayPal confirmed it was captured in full
  // for exactly totalPrice. Orders saved without it (older clients) have paymentVerified: false.
  paypalOrderId: {
    type: String,
    trim: true,
    maxlength: [40, 'PayPal order id too long'],
  },
  paymentVerified: {
    type: Boolean,
    default: false,
  },
  // Set when the customer's personal data was erased (admin Privacy page, docs/DATABASE.md): the order stays for
  // the shop's accounts, but its name, address, phone and e-mail are replaced.
  erasedAt: { type: Date },
}, { timestamps: true });

// One payment pays for one order: saving a second order with the same PayPal order id fails (E11000 -> 409).
orderSchema.index({ paypalOrderId: 1 }, { unique: true, partialFilterExpression: { paypalOrderId: { $type: 'string' } } });
orderSchema.index({ email: 1, createdAt: -1 }); // a customer's orders (and a data request, docs/DATABASE.md)
orderSchema.index({ done: 1, createdAt: -1 }); // "pending orders first" in the admin list and the dashboard
orderSchema.index({ createdAt: -1 }); // the default list, the CSV export, the per-day aggregation, recent orders

export default mongoose.model('Order', orderSchema, 'order');
