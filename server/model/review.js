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
  country: {
    type: String,
    required: [true, 'Country is required'],
    trim: true,
    maxlength: [100, 'Country name too long'],
  },
  message: {
    type: String,
    required: [true, 'Review message is required'],
    trim: true,
    minlength: [5, 'Review too short'],
    maxlength: [1000, 'Review cannot exceed 1000 characters'],
  },
  approved: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

reviewSchema.index({ approved: 1 });
reviewSchema.index({ createdAt: -1 });

export default mongoose.model('Review', reviewSchema, 'review');
