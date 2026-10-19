import mongoose from 'mongoose';

const { Schema } = mongoose;

const eventTierSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 40,
    },
    price: { type: Number, required: true, min: 0 },
    description: { type: String, default: '', trim: true, maxlength: 20000 },
    isActive: { type: Boolean, default: true },
    totalSlots: { type: Number, required: true, min: 0 },
    remainingSlots: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const eventContestantSchema = new Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    profileImageUrl: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    votes: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const eventCompetitionVotePackageSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 60,
  },
  votes: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 1 },
  isActive: { type: Boolean, default: true },
});

const eventCommercialTermsSchema = new Schema(
  {
    ticketCommissionPercent: { type: Number, default: 20, min: 0, max: 100 },
    merchandiseCommissionPercent: {
      type: Number,
      default: 15,
      min: 0,
      max: 100,
    },
    votingCommissionPercent: { type: Number, default: 20, min: 0, max: 100 },
  },
  { _id: false }
);

const eventSchema = new Schema(
  {
    organizerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organizer',
      required: true,
      index: true,
    },
    organizerName: { type: String, required: true },
    submittedByName: { type: String, default: '' },
    submittedByEmail: { type: String, default: '' },
    submittedByRole: { type: String, default: '' },
    title: { type: String, required: true },
    eventType: {
      type: String,
      enum: ['ticketing', 'competition'],
      default: 'ticketing',
      index: true,
    },
    description: { type: String, required: true },
    category: { type: String, required: true },
    venue: { type: String, required: true },
    city: { type: String, required: true },
    bannerUrl: { type: String, default: '' },
    startDateTime: { type: Date, required: true, index: true },
    endDateTime: { type: Date, required: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    rejectionReason: { type: String, default: '' },
    publishedAt: { type: Date, default: null },
    commercialTerms: {
      type: eventCommercialTermsSchema,
      default: () => ({}),
    },
    tiers: {
      type: [eventTierSchema],
      validate: {
        validator(value) {
          if (this.eventType === 'competition') return true;
          return Array.isArray(value) && value.length > 0;
        },
        message: 'At least one ticket tier is required for ticketing events.',
      },
    },
    competition: {
      categories: { type: [String], default: [] },
      maxVotesPerTransaction: {
        type: Number,
        default: 1000,
        min: 1,
        max: 10000,
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
      contestants: {
        type: [eventContestantSchema],
        default: [],
        validate: {
          validator(value) {
            if (this.eventType !== 'competition') return true;
            return Array.isArray(value) && value.length > 0;
          },
          message:
            'At least one contestant is required for competition events.',
        },
      },
      votePackages: {
        type: [eventCompetitionVotePackageSchema],
        default: [],
        validate: {
          validator(value) {
            if (this.eventType !== 'competition') return true;
            return (
              Array.isArray(value) &&
              value.some((item) => item?.isActive !== false)
            );
          },
          message:
            'At least one active vote package is required for competition events.',
        },
      },
    },
  },
  { timestamps: true }
);

export default mongoose.models.Event || mongoose.model('Event', eventSchema);
