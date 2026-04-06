import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    heading: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    content: { type: String, default: '' },
    /** Image URL (e.g. CDN or /uploads/...) */
    image: { type: String, default: '' },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  { timestamps: true }
);

notificationSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);
