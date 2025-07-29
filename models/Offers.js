import mongoose from 'mongoose';

const OfferSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  desc: String,
  type: {
    type: String,
    enum: ['Percent', 'Free Delivery', 'Buy X Get Y Free'],
    required: true,
  },
  percent: Number,
  buyQty: Number,
  freeQty: Number,
  active: { type: Boolean, default: true },

  // New fields
  userType: {
    type: String,
    enum: ['Standard', 'Premium'],
    default: 'Standard',
  },
  premiumApplicability: {
    type: String,
    enum: ['All', 'Limited'],
    // only required if userType is Premium, optional otherwise
    default: null,
  },

  operationId: {
    type: Number,
    enum: [0, 1], // 0 = None, 1 = Convert Into Member
    default: 0,
  },
  operationName: {
    type: String,
    enum: ['None', 'Convert Into Member'],
    default: 'None',
  },
}, { timestamps: true });

// Optional: pre-save hook to clear premiumApplicability if userType is Standard
OfferSchema.pre('save', function (next) {
  if (this.userType !== 'Premium') {
    this.premiumApplicability = null;
  }
  next();
});

const Offer = mongoose.model('Offer', OfferSchema);
export default Offer;
