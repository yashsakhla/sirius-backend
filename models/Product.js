import mongoose from 'mongoose';

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  image: String,
  discountedPrice: { type: Number, required: true },  // price as given by admin
  basicPrice: { type: Number, required: true },   
  size: String,
  category: String,
  active: { type: Boolean, default: true }
});

const Product = mongoose.model('Product', ProductSchema);
export default Product;