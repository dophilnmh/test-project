import mongoose from 'mongoose';

const { Schema } = mongoose;

const merchOrderSchema = new Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MerchProduct',
      required: true,
      index: true,
    },
    organizerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organizer',
      default: null,
      index: true,
    },
    organizerName: { type: String, default: '' },
    productName: { type: String, required: true },
    unitPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    totalAmount: { type: Number, required: true, min: 0 },
    commissionPercent: { type: Number, default: 0, min: 0, max: 100 },
    platformCommissionAmount: { type: Number, default: 0, min: 0 },
    organizerEarningsAmount: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'KSH' },
    buyerEmail: { type: String, required: true, index: true },
    buyerName: { type: String, default: '' },
    buyerPhone: { type: String, default: '' },
    deliveryLocation: { type: String, default: '' },
    notes: { type: String, default: '' },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending',
      index: true,
    },
    paymentReference: { type: String, default: '', index: true },
    paidAt: { type: Date, default: null },
    status: {
      type: String,
      enum: [
        'pending',
        'confirmed',
        'packed',
        'shipped',
        'delivered',
        'cancelled',
      ],
      default: 'pending',
      index: true,
    },
  },
  { timestamps: true }
);

export default mongoose.models.MerchOrder ||
  mongoose.model('MerchOrder', merchOrderSchema);
