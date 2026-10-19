import mongoose from 'mongoose';

const { Schema } = mongoose;

const fundApprovalTokenSchema = new Schema(
  {
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FundRequest',
      required: true,
      index: true,
    },
    approverEmail: { type: String, required: true, trim: true, index: true },
    approverLabel: { type: String, default: '' },
    tokenHash: { type: String, required: true, index: true },
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
    approvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

fundApprovalTokenSchema.index(
  { requestId: 1, approverEmail: 1 },
  { unique: true }
);

export default mongoose.models.FundApprovalToken ||
  mongoose.model('FundApprovalToken', fundApprovalTokenSchema);
