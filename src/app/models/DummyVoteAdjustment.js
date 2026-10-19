import mongoose from 'mongoose';

const { Schema } = mongoose;

const dummyVoteAdjustmentSchema = new Schema(
  {
    targetType: {
      type: String,
      enum: ['competition_event', 'campaign_vote'],
      required: true,
      index: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    contestantKey: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    contestantName: {
      type: String,
      default: '',
      trim: true,
    },
    contestantCategory: {
      type: String,
      default: '',
      trim: true,
    },
    dummyVotes: {
      type: Number,
      default: 0,
      min: 0,
    },
    updatedByEmail: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true }
);

dummyVoteAdjustmentSchema.index(
  { targetType: 1, targetId: 1, contestantKey: 1 },
  { unique: true }
);

export default mongoose.models.DummyVoteAdjustment ||
  mongoose.model('DummyVoteAdjustment', dummyVoteAdjustmentSchema);
