// models/Contribution.js
import mongoose from "mongoose";

const contributionSchema = new mongoose.Schema(
  {
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    type: {
      type: String,
      required: true, // monthly, registration, welfare...
      index: true,
    },

    description: String,

    modeOfPayment: String,

    paymentReference: {
      type: String,
      required: true,
      unique: true, // 🚫 no duplicates EVER
    },

    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // or Admin if you have Admin model
      required: true,
    },

    date: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

export default mongoose.models.Contribution ||
  mongoose.model("Contribution", contributionSchema);
