import mongoose from 'mongoose';

const { Schema } = mongoose;

const fundRequestSchema = new Schema(
  {
    organizerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organizer',
      required: true,
      index: true,
    },
    organizerName: { type: String, required: true },
    organizerEmail: { type: String, required: true, index: true },
    organizerPhone: { type: String, default: '' },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      default: null,
      index: true,
    },
    sourceType: {
      type: String,
      enum: ['event', 'merchandise'],
      default: 'event',
      index: true,
    },
    merchProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MerchProduct',
      default: null,
      index: true,
    },
    eventTitle: { type: String, default: '' },
    mpesaNumber: { type: String, required: true },
    accountName: { type: String, default: '' },
    amount: { type: Number, required: true, min: 1 },
    transactionCost: { type: Number, default: 0, min: 0 },
    requestPurpose: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'pending_email_approval', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    reviewedByName: { type: String, default: '' },
    reviewedByEmail: { type: String, default: '' },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, default: '' },
    emailApprovalRequired: { type: Number, default: 2, min: 1, max: 2 },
    emailApprovalCompleted: { type: Number, default: 0, min: 0, max: 2 },
    emailApprovalSummary: { type: [String], default: [] },
    emailApprovalRequestedAt: { type: Date, default: null },
    emailApprovalCompletedAt: { type: Date, default: null },
    notificationSentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.models.FundRequest ||
  mongoose.model('FundRequest', fundRequestSchema);
