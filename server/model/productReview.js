import mongoose from 'mongoose';
const { Schema } = mongoose;

// A visitor's star rating + comment on one product (shown on the product page and in the shop).
const productReviewSchema = new Schema({
  product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name too short'],
    maxlength: [80, 'Name too long'],
  },
  country: { type: String, trim: true, maxlength: [80, 'Country too long'], default: '' },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be 1 to 5'],
    max: [5, 'Rating must be 1 to 5'],
    validate: { validator: Number.isInteger, message: 'Rating must be a whole number' },
  },
  title: { type: String, trim: true, maxlength: [120, 'Title too long'], default: '' },
  comment: {
    type: String,
    required: [true, 'Comment is required'],
    trim: true,
    minlength: [3, 'Comment too short'],
    maxlength: [1000, 'Comment cannot exceed 1000 characters'],
  },
  approved: { type: Boolean, default: true },
  // Salted hash of the sender's IP, kept only to spot abuse; never returned by the API.
  ipHash: { type: String, select: false, maxlength: [64, 'Hash too long'] },
}, { timestamps: true });

// The product page: this product's approved reviews, newest first (also serves "all reviews of a product").
productReviewSchema.index({ product: 1, approved: 1, createdAt: -1 });
// The admin list filtered by approved/hidden, and the catalogue's rating aggregation ($match approved).
productReviewSchema.index({ approved: 1, createdAt: -1 });
productReviewSchema.index({ createdAt: -1 });

export default mongoose.model('ProductReview', productReviewSchema, 'productReview');
