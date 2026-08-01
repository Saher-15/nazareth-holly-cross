import mongoose from 'mongoose';
const { Schema } = mongoose;

const productSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [200, 'Name cannot exceed 200 characters'],
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0.01, 'Price must be greater than 0'],
    max: [10000, 'Price cannot exceed 10000'],
  },
  img: {
    type: String,
    required: [true, 'Main image URL is required'],
    trim: true,
  },
  additionalImageUrls: [{ type: String, trim: true }],
  description: {
    type: String,
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters'],
  },
  uuidv4_: {
    type: String,
    trim: true,
  },
  rate: {
    type: Number,
    default: 1,
    min: [0, 'Rate cannot be negative'],
    max: [5, 'Rate cannot exceed 5'],
  },
  color: [{ type: String, trim: true }],
  stock: {
    type: Number,
    default: null,
    min: [0, 'Stock cannot be negative'],
  },
}, { timestamps: true });

productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ price: 1 });
productSchema.index({ rate: -1 });

export default mongoose.model('Product', productSchema, 'product');
