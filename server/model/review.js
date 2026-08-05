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

reviewSchema.index({ approved: 1 });
reviewSchema.index({ createdAt: -1 });

export default mongoose.model('Review', reviewSchema, 'review');
