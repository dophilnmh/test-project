// /app/models/TicketOrder.js

import mongoose from 'mongoose';

const { Schema } = mongoose;

const ticketOrderSchema = new Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true,
    },
    organizerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organizer',
      required: true,
      index: true,
    },
    eventTitle: { type: String, required: true },
    referralCampaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VotingCampaign',
      default: null,
      index: true,
    },
    referralCompetitionEventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      default: null,
      index: true,
    },
    referralContestantId: { type: String, default: '', index: true },
    referralContestantName: { type: String, default: '', index: true },
    referralContestantCategory: { type: String, default: '', index: true },
    tierName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 40,
    },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    commissionPercent: { type: Number, default: 20, min: 0, max: 100 },
    platformCommissionAmount: { type: Number, default: 0, min: 0 },
    organizerEarningsAmount: { type: Number, default: 0, min: 0 },
    customerPhone: { type: String, default: '' },
    customerEmail: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending',
      index: true,
    },
    merchantRequestId: { type: String, default: '', index: true },
    checkoutRequestId: {
      type: String,
      default: '',
      index: true,
      unique: true,
      sparse: true,
    },
    mpesaReceiptNumber: { type: String, default: '' },
    paidAt: { type: Date, default: null },
    resultCode: { type: Number, default: null },
    resultDesc: { type: String, default: '' },
    ticketCode: {
      type: String,
      default: null, // CHANGED: from '' to null
      unique: true, // ADDED: ensures uniqueness
      sparse: true, // ADDED: allows multiple null values
      index: true,
    },
    entryCode: {
      type: String,
      default: null, // CHANGED: from '' to null
      unique: true, // ADDED: ensures uniqueness
      sparse: true, // ADDED: allows multiple null values
      index: true,
    },
    entryStatus: {
      type: String,
      enum: ['pending', 'verified'],
      default: 'pending',
      index: true,
    },
    entryVerifiedAt: { type: Date, default: null },
    entryVerifiedBy: { type: String, default: '' },
    ticketPdfSentAt: { type: Date, default: null },
    recoveredBy: { type: String, default: '' },
    recoveredAt: { type: Date, default: null },
    recoveryNote: { type: String, default: '' },
  },
  { timestamps: true }
);

// Add compound indexes for better query performance
ticketOrderSchema.index({ eventId: 1, status: 1 });
ticketOrderSchema.index({ organizerId: 1, status: 1 });
ticketOrderSchema.index({ ticketCode: 1, entryStatus: 1 });

export default mongoose.models.TicketOrder ||
  mongoose.model('TicketOrder', ticketOrderSchema);
