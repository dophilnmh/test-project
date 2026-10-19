import mongoose from "mongoose";
const { Schema } = mongoose;

const loanRepaymentSchema = new Schema(
  {
    loan: {
      type: Schema.Types.ObjectId,
      ref: "Loan",
      required: true,
    },

    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    amountPaid: {
      type: Number,
      required: true,
    },

    paymentDate: {
      type: Date,
      default: Date.now,
    },

    modeOfPayment: {
      type: String,

      required: true,
    },

    paymentReference: String,

    recordedBy: {
      type: String,
      required: true,
    },

    balanceAfterPayment: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.models.LoanRepayment ||
  mongoose.model("LoanRepayment", loanRepaymentSchema);
