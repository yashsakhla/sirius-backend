// models/Order.js
import mongoose from 'mongoose';

const giftChosenLineSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true },
    size: { type: String, required: true },
  },
  { _id: false }
);

const giftBundleLineSchema = new mongoose.Schema(
  {
    giftProductId: { type: String, required: true },
    giftSize: { type: String, required: true },
    chosenProducts: { type: [giftChosenLineSchema], default: [] },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    products: { type: [String], default: [] },
    productImg: { type: String },
    /** Custom gift sets: [{ giftProductId, giftSize, chosenProducts: [{ productId, size }] }] */
    giftBundles: { type: [giftBundleLineSchema], default: undefined },
    date: { type: Date, default: Date.now },
    Deliverystatus: {
      type: String,
      enum: ['Processing', 'Dispatched', 'Delivered', 'Cancelled'],
      default: 'Processing',
    },
    paymentStatus: { type: String, enum: ['PENDING', 'COMPLETED', 'FAILED'], default: 'PENDING' },
    merchantOrderId: { type: String, required: true, unique: true },
    transactionId: { type: String },
    owner: {
      name: String,
      email: String,
      phone: String,
      city: String,
      address: String,
      userId: { type: mongoose.Types.ObjectId, required: true },
    },
    /** Raw address object from checkout (line1, line2, city, state, pincode, …) */
    deliveryAddress: { type: mongoose.Schema.Types.Mixed },
    coupon: { type: String },
    offer: { type: String },
    totalPrice: { type: Number, required: true },
    /** COD / partial payment breakdown */
    amountPayableNow: { type: Number },
    codAdvanceAmount: { type: Number },
    codAdvancePercent: { type: Number },
    codBalanceOnDelivery: { type: Number },
    processingDate: { type: Date, default: Date.now },
    dispatchDate: { type: Date, default: Date.now },
    deliveryDate: { type: Date, default: Date.now },
    paymentMode: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model('Order', orderSchema, 'orders');
