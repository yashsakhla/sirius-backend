// models/Order.js
import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    products: [{ type: String, required: true }], // could be product names or IDs (improvable)
    date: { type: Date, default: Date.now },
    Deliverystatus: {
      type: String,
      enum: ['Processing', 'Dispatched', 'Delivered', 'Cancelled'],
      default: 'Processing'
    },
    paymentStatus: { type: String, enum: ['Pending', 'Completed', 'Failed'], default: 'Pending' },
    transactionId: { type: String },
    owner: {
      name: String,
      email: String,
      phone: String,
      city: String,
      address: String,
      userId: { type: mongoose.Types.ObjectId, required: true }, // add user ID for user-specific lookup
    },
    coupon: { type: String },
    offer: { type: String },
    totalPrice: { type: Number, required: true },
    paymentMode: { type: String, enum: ['Cash', 'Credit Card', 'UPI'] },
  },
  { timestamps: true }
);

export default mongoose.model('Order', orderSchema, 'orders');
