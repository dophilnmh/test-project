import mongoose from 'mongoose';

const { Schema } = mongoose;

const blogPublishOtpSchema = new Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BlogPost',
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

blogPublishOtpSchema.index({ postId: 1, email: 1, usedAt: 1 });

export default mongoose.models.BlogPublishOtp ||
  mongoose.model('BlogPublishOtp', blogPublishOtpSchema);
