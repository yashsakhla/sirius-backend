import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  name: { type: String, required: true },
  phone: { type: String, required: true, default:" " },
  email: { type: String, required: true, unique: true },
  address: {
    line1: String,
    line2: String,
    city: String,
    state: String,
    pincode: String
  },
  cart: Array,
  orders: Array,
  premiumUser: { type: Boolean, default: false }
}, {
  timestamps: true
});

// ✅ Safely export the model without risk of OverwriteModelError
export default mongoose.models.users || mongoose.model('users', userSchema);