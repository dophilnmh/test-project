import mongoose from "mongoose";
const { Schema } = mongoose;

const loanSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    loanRef: {
      type: String,
      required: true,
      unique: true,
    },

    principalAmount: {
      type: Number,
      required: true,
    },

    interestRatePercent: {
      type: Number,
      required: true,
    },

    interestAmount: {
      type: Number,
      required: true,
    },

    totalRepayment: {
      type: Number,
      required: true,
    },

    monthlyInstallment: {
      type: Number,
      required: true,
    },

    loanDurationMonths: {
      type: Number,
      required: true,
    },

    disbursementDate: {
      type: Date,
      required: true,
    },

    dueDate: {
      type: Date,
      required: true,
    },

    balance: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      enum: ["active", "completed", "defaulted"],
      default: "active",
    },

    approvedBy: {
      type: String,
      required: true,
    },

    purpose: String,
  },
  { timestamps: true }
);

export default mongoose.models.Loan || mongoose.model("Loan", loanSchema);
