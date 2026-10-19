import mongoose from 'mongoose';

const { Schema } = mongoose;

const blogPostSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, index: true },
    excerpt: { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true },
    coverImageUrl: { type: String, default: '' },
    category: { type: String, default: 'General', trim: true, index: true },
    tags: { type: [String], default: [] },
    authorName: { type: String, default: 'NimblyPolls Team', trim: true },
    readMinutes: { type: Number, default: 3, min: 1 },
    status: {
      type: String,
      enum: ['draft', 'pending_approval', 'published', 'rejected', 'archived'],
      default: 'pending_approval',
      index: true,
    },
    rejectionReason: { type: String, default: '' },
    approvedByEmail: { type: String, default: '' },
    approvedAt: { type: Date, default: null },
    publishedAt: { type: Date, default: null, index: true },
    createdByEmail: { type: String, default: '' },
  },
  { timestamps: true }
);

blogPostSchema.index({ status: 1, publishedAt: -1 });

export default mongoose.models.BlogPost ||
  mongoose.model('BlogPost', blogPostSchema);
