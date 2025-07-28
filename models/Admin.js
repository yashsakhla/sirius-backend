// models/Admin.js
import mongoose from 'mongoose';

const adminSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ['admin'],
      default: 'admin',
    },
  },
  { timestamps: true }
);

// ✅ Force the collection name to 'admins'
const Admin = mongoose.model('Admin', adminSchema, 'admins');

export default Admin;
