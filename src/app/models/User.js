import mongoose from 'mongoose';

const { Schema } = mongoose;

function isMemberRole() {
  return (this.role || 'member') === 'member';
}

const userSchema = new Schema(
  {
    password: {
      type: String,
      required: true,
    },
    resetPasswordToken: {
      type: String,
      default: null,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
    },
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: false,
    },
    phone: {
      type: String,
      required: isMemberRole,
      default: '',
    },
    email: {
      type: String,
      required: true,
      unique: true,
      sparse: true,
    },
    idNumber: {
      type: String,
      required: isMemberRole,
      default: '',
    },
    dateOfBirth: {
      type: Date,
      required: isMemberRole,
      default: null,
    },
    gender: {
      type: String,
      required: isMemberRole,
      enum: ['male', 'female', 'other'],
      default: undefined,
    },
    address: {
      type: String,
      required: isMemberRole,
      default: '',
    },
    city: {
      type: String,
      required: isMemberRole,
      default: '',
    },
    county: {
      type: String,
      required: isMemberRole,
      default: '',
    },
    graduationYear: {
      type: Number,
      required: isMemberRole,
      default: null,
    },
    specialization: {
      type: String,
      required: isMemberRole,
      default: '',
    },
    currentEmployer: {
      type: String,
      required: isMemberRole,
      default: '',
    },
    occupation: {
      type: String,
      required: isMemberRole,
      default: '',
    },
    membershipCategory: {
      type: String,
      required: isMemberRole,
      enum: ['associate', 'full', 'student', 'honorary'],
      default: undefined,
    },
    passportPhoto: {
      type: String,
      required: isMemberRole,
      default: '',
    },
    registeredByAdmin: {
      type: Boolean,
      default: false,
    },
    registrationDate: {
      type: Date,
      default: Date.now,
    },
    membershipNumber: {
      type: String,
      required: false,
    },
    status: {
      type: String,
      default: 'Active',
    },
    role: {
      type: String,
      default: 'member',
    },
    notificationPhone: {
      type: String,
      default: '',
    },
    notificationEmailEnabled: {
      type: Boolean,
      default: true,
    },
    notificationSmsEnabled: {
      type: Boolean,
      default: false,
    },
    merchandiseCommissionPercent: {
      type: Number,
      default: 15,
      min: 0,
      max: 100,
    },
    votingCommissionPercent: {
      type: Number,
      default: 20,
      min: 0,
      max: 100,
    },
    contributions: {
      type: Map,
      of: [
        {
          amount: Number,
          date: Date,
          description: String,
          recordedBy: String,
          modeOfPayment: String,
          paymentReference: String,
        },
      ],
      default: {},
    },

    loans: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Loan',
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model('User', userSchema);
