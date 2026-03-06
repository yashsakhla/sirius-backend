import mongoose from 'mongoose';

const ReviewSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'users' },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: String,
  size: String,
  createdAt: { type: Date, default: Date.now }
});

const Review = mongoose.model('Review', ReviewSchema);
export default Review;
