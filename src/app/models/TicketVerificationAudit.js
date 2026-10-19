import mongoose from 'mongoose';

const { Schema } = mongoose;

const ticketVerificationAuditSchema = new Schema(
  {
    organizerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organizer',
      required: true,
      index: true,
    },
    verifier: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    ticketCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    outcome: {
      type: String,
      enum: ['missing_fields', 'invalid_ticket', 'already_used', 'verified'],
      required: true,
      index: true,
    },
    checkedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    eventTitle: { type: String, default: '' },
    tierName: { type: String, default: '' },
    quantity: { type: Number, default: 0 },
    message: { type: String, default: '' },
    requestSource: {
      type: String,
      enum: ['manual', 'scan', 'unknown'],
      default: 'unknown',
      index: true,
    },
  },
  { timestamps: true }
);

ticketVerificationAuditSchema.index({ organizerId: 1, checkedAt: -1 });
ticketVerificationAuditSchema.index({
  organizerId: 1,
  outcome: 1,
  checkedAt: -1,
});
ticketVerificationAuditSchema.index({
  organizerId: 1,
  verifier: 1,
  checkedAt: -1,
});
ticketVerificationAuditSchema.index({
  organizerId: 1,
  ticketCode: 1,
  checkedAt: -1,
});

export default mongoose.models.TicketVerificationAudit ||
  mongoose.model('TicketVerificationAudit', ticketVerificationAuditSchema);
