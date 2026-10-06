import mongoose from 'mongoose';
const { Schema } = mongoose;

// The storefront categories an admin can force on a product (services/catalog.js infers one from the name when none
// is set). catalog.js's CATEGORIES must equal this list: a test compares them.
export const PRODUCT_CATEGORIES = ['stained-glass', 'rosaries', 'necklaces', 'bracelets', 'bibles', 'crosses', 'holy-land', 'gifts'];

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
    maxlength: [2048, 'Image address too long'],
  },
  additionalImageUrls: {
    type: [{ type: String, trim: true, maxlength: [2048, 'Image address too long'] }],
    validate: { validator: (list) => list.length <= 20, message: 'At most 20 extra images' },
  },
  description: {
    type: String,
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters'],
  },
  uuidv4_: {
    type: String,
    trim: true,
    maxlength: [64, 'Id too long'],
  },
  rate: {
    type: Number,
    default: 1,
    min: [0, 'Rate cannot be negative'],
    max: [5, 'Rate cannot exceed 5'],
  },
  color: {
    type: [{ type: String, trim: true, maxlength: [50, 'Colour too long'] }],
    validate: { validator: (list) => list.length <= 20, message: 'At most 20 colours' },
  },
  // Units in stock; null = not tracked. Whole units, never negative.
  stock: {
    type: Number,
    default: null,
    min: [0, 'Stock cannot be negative'],
    max: [1_000_000, 'Stock too large'],
    validate: {
      validator: (value) => value === null || value === undefined || Number.isInteger(value),
      message: 'Stock must be a whole number',
    },
  },
  // Optional override of the category the storefront infers from the name (services/catalog.js, CATEGORIES).
  // null = infer from the name.
  category: {
    type: String,
    trim: true,
    enum: [...PRODUCT_CATEGORIES, null],
    default: undefined,
  },
}, { timestamps: true });

productSchema.index({ name: 'text', description: 'text' }); // site search (one text index per collection)
productSchema.index({ price: 1 }); // sort / filter by price
productSchema.index({ category: 1, price: 1 }); // the shop's category pages, cheapest first
productSchema.index({ rate: -1, _id: 1 }); // GET /product/getNProducts: featured first, with a stable order for paging
productSchema.index({ createdAt: -1 }); // the admin list and the legacy list: newest first
productSchema.index({ stock: 1 }); // low / out of stock filters and the dashboard's low-stock list

export default mongoose.model('Product', productSchema, 'product');
