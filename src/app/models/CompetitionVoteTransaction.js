import mongoose from 'mongoose';

const { Schema } = mongoose;

const competitionVoteTransactionSchema = new Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true,
    },
    organizerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organizer',
      default: null,
      index: true,
    },
    contestantKey: { type: String, required: true, index: true },
    contestantName: { type: String, default: '' },
    contestantCategory: { type: String, default: '' },
    packageId: { type: String, default: '' },
    packageName: { type: String, default: '' },
    voterEmail: { type: String, default: '' },
    voterPhone: { type: String, required: true },
    votes: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    commissionPercent: { type: Number, default: 20, min: 0, max: 100 },
    platformCommissionAmount: { type: Number, default: 0, min: 0 },
    organizerEarningsAmount: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending',
      index: true,
    },
    merchantRequestId: { type: String, default: '', index: true },
    checkoutRequestId: {
      type: String,
      default: '',
      index: true,
      unique: true,
      sparse: true,
    },
    mpesaReceiptNumber: { type: String, default: '' },
    paidAt: { type: Date, default: null },
    resultCode: { type: Number, default: null },
    resultDesc: { type: String, default: '' },
    recoveredBy: { type: String, default: '' },
    recoveredAt: { type: Date, default: null },
    recoveryNote: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.models.CompetitionVoteTransaction ||
  mongoose.model(
    'CompetitionVoteTransaction',
    competitionVoteTransactionSchema
  );
