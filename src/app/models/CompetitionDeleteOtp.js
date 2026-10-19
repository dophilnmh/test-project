import mongoose from 'mongoose';

const { Schema } = mongoose;

const competitionDeleteOtpSchema = new Schema(
  {
    competitionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true,
    },
    email: { type: String, required: true, trim: true, index: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

competitionDeleteOtpSchema.index({ competitionId: 1, email: 1, usedAt: 1 });

export default mongoose.models.CompetitionDeleteOtp ||
  mongoose.model('CompetitionDeleteOtp', competitionDeleteOtpSchema);
