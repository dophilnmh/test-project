import mongoose from 'mongoose';

const { Schema } = mongoose;

const nomineeSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, default: 'General', trim: true },
    tagline: { type: String, default: '', trim: true },
    imageUrl: { type: String, default: '' },
    voteCount: { type: Number, default: 0, min: 0 },
  },
  { _id: true }
);

const votingPackageSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    votes: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: true }
);

const votingCampaignSchema = new Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      default: null,
      index: true,
    },
    organizerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organizer',
      default: null,
      index: true,
    },
    organizerName: { type: String, default: '', trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    category: { type: String, default: 'General', trim: true },
    bannerUrl: { type: String, default: '' },
    startDateTime: { type: Date, required: true, index: true },
    endDateTime: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ['draft', 'pending', 'live', 'ended', 'archived'],
      default: 'draft',
      index: true,
    },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    commissionPercent: { type: Number, default: 20, min: 0, max: 100 },
    organizerEarningsPercent: { type: Number, default: 80, min: 0, max: 100 },
    resultVisibility: {
      type: String,
      enum: ['live', 'after_end'],
      default: 'live',
    },
    voteDisplayMode: {
      type: String,
      enum: ['real', 'real_plus_dummy'],
      default: 'real',
    },
    publicVoteDisplay: {
      type: String,
      enum: ['count', 'percent', 'hide'],
      default: 'count',
    },
    maxVotesPerVoter: { type: Number, default: 1000, min: 1 },
    contestants: {
      type: [nomineeSchema],
      default: [],
      validate: {
        validator: (value) => Array.isArray(value) && value.length > 1,
        message: 'At least 2 contestants are required.',
      },
    },
    nominees: {
      type: [nomineeSchema],
      default: [],
      validate: {
        validator: (value) => Array.isArray(value) && value.length > 1,
        message: 'At least 2 nominees are required.',
      },
    },
    votingPackages: {
      type: [votingPackageSchema],
      default: [],
    },
    totalVotes: { type: Number, default: 0, min: 0 },
    createdByEmail: { type: String, default: '' },
  },
  { timestamps: true }
);

votingCampaignSchema.index({ category: 1, status: 1, endDateTime: -1 });

export default mongoose.models.VotingCampaign ||
  mongoose.model('VotingCampaign', votingCampaignSchema);
