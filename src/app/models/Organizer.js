import mongoose from 'mongoose';

const { Schema } = mongoose;

const organizerTicketTypeSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    defaultPrice: { type: Number, default: 0, min: 0 },
    defaultSlots: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { _id: false }
);

const organizerVotePackageSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    votes: { type: Number, default: 1, min: 1 },
    price: { type: Number, default: 20, min: 1 },
    isActive: { type: Boolean, default: true },
  },
  { _id: false }
);

const promoterSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    phone: { type: String, default: '', trim: true },
    accessLevel: {
      type: String,
      enum: ['viewer', 'sales', 'editor'],
      default: 'viewer',
    },
    canManageTickets: { type: Boolean, default: false },
    canViewAnalytics: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
  },
  { _id: false }
);

const organizerSchema = new Schema(
  {
    organizationName: { type: String, required: true },
    contactName: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    phone: { type: String, required: true },
    county: { type: String, required: true },
    subCounty: { type: String, required: true },
    website: { type: String, default: '' },
    description: { type: String, default: '' },
    password: { type: String, required: true },
    notificationSmsEnabled: { type: Boolean, default: false },
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },
    role: { type: String, default: 'organizer' },
    status: { type: String, default: 'active' },
    settings: {
      ticketTypes: {
        type: [organizerTicketTypeSchema],
        default: [
          { name: 'vip', defaultPrice: 0, defaultSlots: 0, isActive: true },
          {
            name: 'regular',
            defaultPrice: 0,
            defaultSlots: 0,
            isActive: true,
          },
        ],
      },
      votePackages: {
        type: [organizerVotePackageSchema],
        default: [
          { name: 'Basic', votes: 1, price: 20, isActive: true },
          { name: 'Supporter', votes: 5, price: 100, isActive: true },
          { name: 'Champion', votes: 10, price: 200, isActive: true },
        ],
      },
      calendar: {
        timezone: { type: String, default: 'Africa/Nairobi' },
        weekStartsOn: {
          type: String,
          enum: ['monday', 'sunday'],
          default: 'monday',
        },
        defaultEventDurationHours: {
          type: Number,
          default: 4,
          min: 1,
          max: 24,
        },
      },
    },
    promoters: {
      type: [promoterSchema],
      default: [],
    },
  },
  { timestamps: true }
);

export default mongoose.models.Organizer ||
  mongoose.model('Organizer', organizerSchema);
