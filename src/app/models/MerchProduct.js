import mongoose from 'mongoose';

const { Schema } = mongoose;

const merchProductSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    description: { type: String, required: true, trim: true },
    category: { type: String, default: 'General', trim: true, index: true },
    imageUrl: { type: String, default: '' },
    imageUrls: { type: [String], default: [] },
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'KSH' },
    stock: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['draft', 'active', 'out_of_stock', 'archived'],
      default: 'draft',
      index: true,
    },
    organizerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organizer',
      default: null,
      index: true,
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      default: null,
      index: true,
    },
    organizerName: { type: String, default: '' },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    commissionPercent: { type: Number, default: null, min: 0, max: 100 },
    approvalNote: { type: String, default: '' },
    approvedByEmail: { type: String, default: '' },
    approvedAt: { type: Date, default: null },
    createdByEmail: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.models.MerchProduct ||
  mongoose.model('MerchProduct', merchProductSchema);
