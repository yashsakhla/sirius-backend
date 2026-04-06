import mongoose from 'mongoose';

const ProductCategorySchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    allowsCustomerProductChoice: { type: Boolean, default: false },
  },
  { _id: false }
);

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  images: { type: [String], default: [] },
  /** Variants: [{ size, price, discountedPrice, basicPrice }]; Mixed supports legacy string[] until migrated */
  size: { type: [mongoose.Schema.Types.Mixed], default: [] },
  /** e.g. { type: "gift", allowsCustomerProductChoice: true } */
  productCategory: { type: ProductCategorySchema, default: undefined },
  /** @deprecated Unmigrated docs only; API maps into size[] */
  discountedPrice: Number,
  basicPrice: Number,
  category: String,
  active: { type: Boolean, default: true },
});

const Product = mongoose.model('Product', ProductSchema);
export default Product;
