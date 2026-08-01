import mongoose from 'mongoose';
const { Schema } = mongoose;

const contactSchema = new Schema({
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    minlength: [2, 'Name too short'],
    maxlength: [200, 'Name too long'],
  },
  email: {
    type: String,
    required: [true, 'Email field is required'],
    trim: true,
    maxlength: [500, 'Email field too long'],
  },
  phone: {
    type: String,
    trim: true,
    maxlength: [50, 'Phone too long'],
    default: '',
  },
  msg: {
    type: String,
    required: [true, 'Message is required'],
    trim: true,
    minlength: [3, 'Message too short'],
    maxlength: [2000, 'Message cannot exceed 2000 characters'],
  },
  done: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

contactSchema.index({ done: 1 });
contactSchema.index({ createdAt: -1 });

export default mongoose.model('Contact', contactSchema, 'contact');
