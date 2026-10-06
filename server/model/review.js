import mongoose from 'mongoose';
const { Schema } = mongoose;

const reviewSchema = new Schema({
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    minlength: [2, 'Name too short'],
    maxlength: [200, 'Name too long'],
  },
  email: {
    type: String,
    trim: true,
    maxlength: [200, 'Email too long'],
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format'], // an empty address is allowed (the field is optional)
    default: '',
  },
  // Where the reviewer is from (a country). Reviews written before this field existed keep it in `email` (the old
  // site sent it there); route/reviewRoute.js reads both. Never an e-mail address.
  place: {
    type: String,
    trim: true,
    maxlength: [200, 'Place too long'],
    default: '',
  },
  phone: {
    type: String,
    trim: true,
    maxlength: [100, 'Phone too long'],
    default: '000',
  },
  msg: {
    type: String,
    required: [true, 'Review message is required'],
    trim: true,
    minlength: [3, 'Review too short'],
    maxlength: [1000, 'Review cannot exceed 1000 characters'],
  },
  approved: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

reviewSchema.index({ approved: 1, createdAt: -1 }); // the public list (approved, newest first) and the admin filter
reviewSchema.index({ createdAt: -1 }); // the default admin list
reviewSchema.index({ email: 1 }); // a customer's data request (docs/DATABASE.md, erase)

export default mongoose.model('Review', reviewSchema, 'review');
