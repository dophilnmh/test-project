import mongoose from 'mongoose';

const { Schema } = mongoose;

const votingBallotSchema = new Schema(
  {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VotingCampaign',
      required: true,
      index: true,
    },
    nomineeId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    voterUserId: { type: String, required: true, index: true },
    voterName: { type: String, default: '' },
    voterRole: { type: String, default: 'user' },
  },
  { timestamps: true }
);

votingBallotSchema.index({ campaignId: 1, voterUserId: 1 }, { unique: true });

export default mongoose.models.VotingBallot ||
  mongoose.model('VotingBallot', votingBallotSchema);
