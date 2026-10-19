import mongoose from 'mongoose';

const { Schema } = mongoose;

const contactMessageSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, index: true },
    phone: { type: String, default: '', trim: true },
    subject: { type: String, required: true, trim: true, index: true },
    message: { type: String, required: true, trim: true },
    source: { type: String, default: 'website', trim: true },
    status: {
      type: String,
      enum: ['new', 'in_progress', 'resolved', 'archived'],
      default: 'new',
      index: true,
    },
    repliedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

contactMessageSchema.index({ status: 1, createdAt: -1 });

export default mongoose.models.ContactMessage ||
  mongoose.model('ContactMessage', contactMessageSchema);
