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
    trim: true,
    maxlength: [50, 'Phone number too long'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format'],
  },
  date: {
    type: Date,
  },
  street: {
    type: String,
    trim: true,
    maxlength: [200, 'Street address too long'],
  },
  city: {
    type: String,
    trim: true,
    maxlength: [100, 'City name too long'],
  },
  state: {
    type: String,
    trim: true,
    maxlength: [100, 'State name too long'],
  },
  postal: {
    type: String,
    trim: true,
    maxlength: [20, 'Postal code too long'],
  },
  country: {
    type: String,
    trim: true,
    maxlength: [100, 'Country name too long'],
  },
  totalPrice: {
    type: Number,
    required: [true, 'Total price is required'],
    min: [0.01, 'Total price must be greater than 0'],
  },
  products: {
    type: [{
      productID: {
        type: mongoose.Types.ObjectId,
      },
      productName: {
        type: String,
        trim: true,
      },
      quantity: {
        type: Number,
        min: [1, 'Quantity must be at least 1'],
      },
      color: {
        type: String,
        trim: true,
      },
    }],
    required: [true, 'Products are required'],
  },
  done: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

orderSchema.index({ email: 1 });
orderSchema.index({ done: 1 });
orderSchema.index({ createdAt: -1 });

export default mongoose.model('Order', orderSchema, 'order');
