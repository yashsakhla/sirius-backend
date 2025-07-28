import mongoose from 'mongoose';

const OfferSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  desc: String,
  type: {
    type: String,
    enum: ['Percent', 'Free Delivery', 'Buy X Get Y Free'],
    required: true
  },
  percent: Number,
  buyQty: Number,
  freeQty: Number,
  active: Boolean
}, { timestamps: true });

const Offer = mongoose.model('Offer', OfferSchema);
export default Offer;
