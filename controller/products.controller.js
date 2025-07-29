import Product from '../models/Product.js';
import Offer from '../models/Offers.js';// Adjust import based on your project structure
import User from '../models/User.js';

export const getGroupedProducts = async (req, res) => {
  try {
    const allProducts = await Product.find();

    const categoryMap = new Map();
    allProducts.forEach(product => {
      const category = product.category || 'Others';
      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category).push(product);
    });

    const grouped = Array.from(categoryMap.entries()).map(([category, products]) => ({
      category,
      products
    }));

    res.json(grouped);
  } catch (error) {
    console.error('Error fetching grouped products:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getProductsList = async (req, res) => {
  try {
    const product = await Product.find().sort({ createdAt: -1 });
    res.status(200).json(product);
  } catch (err) {
    console.error('Error fetching Product:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createProduct = async (req, res) => {
  try {
    const { name, description, image, price, size, category, active } = req.body;

    // ✅ Validate required fields
    if (!name || !price) {
      return res.status(400).json({ message: 'Required fields are missing (name, price)' });
    }

    // ✅ Check if a product already exists with the same name
    const exists = await Product.findOne({ name });
    if (exists) {
      return res.status(400).json({ message: 'Product with this name already exists' });
    }

    // ✅ Create a new Product instance (don't set `id`)
    const newProduct = new Product({
      name,
      description,
      image,
      price,
      size,
      category,
      active: active !== undefined ? active : true, // default to true
    });

    // ✅ Save to database
    await newProduct.save();

    res.status(201).json({
      message: 'Product created successfully',
      product: newProduct,
    });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ message: 'Server error while creating product' });
  }
};

// ✅ UPDATE PRODUCT
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params; // this is _id from MongoDB
    const { name, description, price, image, active } = req.body;

    const updateFields = {};
    if (name !== undefined) updateFields.name = name;
    if (description !== undefined) updateFields.description = description;
    if (price !== undefined) updateFields.price = price;
    if (image !== undefined) updateFields.image = image;
    if (active !== undefined) updateFields.active = active;

    const updatedProduct = await Product.findByIdAndUpdate(
      id, // _id from MongoDB
      { $set: updateFields },
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.status(200).json({
      message: 'Product updated successfully',
      product: updatedProduct,
    });
  } catch (error) {
    console.error('❌ Error updating product:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// ✅ DELETE PRODUCT
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params; // this is _id

    const deletedProduct = await Product.findByIdAndDelete(id);

    if (!deletedProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting product:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Calculate cart price based on products and coupon code
 * POST /api/products/cart-price
 */

export const getCartPrice = async (req, res) => {
  try {
    const { products, couponCode } = req.body;

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'No products provided' });
    }

    // Default userType to Standard if unauthenticated
    let userType = "Standard";

    if (req.user && req.user.id) {
      const user = await User.findById(req.user.id).select('premiumUser');
      userType = user?.premiumUser ? 'Premium' : 'Standard';
    }

    const productIds = products.map(item => item.productId);
    const dbProducts = await Product.find({ _id: { $in: productIds } });

    let subtotal = 0;
    const detailed = [];

    for (const item of products) {
      const product = dbProducts.find(p => p._id.toString() === item.productId);
      if (product) {
        const itemTotal = product.price * item.qty;
        subtotal += itemTotal;
        detailed.push({
          _id: product._id,
          name: product.name,
          price: product.price,
          qty: item.qty,
          total: itemTotal
        });
      }
    }

    let discount = 0;
    let appliedOffer = null;

    /**
     * Calculate offer and discount:
     * - If user is Premium and no couponCode given:
     *   - Find any premium offer with premiumApplicability = 'All'
     *   - Apply that offer's discount percent if of type 'Percent'
     * - Else (if couponCode provided), apply normal logic
     */

    if (userType === 'Premium' && (!couponCode || couponCode.trim() === '')) {
      // Find any premium coupon with premiumApplicability = 'All'
      const premiumOffer = await Offer.findOne({
        userType: 'Premium',
        premiumApplicability: 'All',
        active: true
      });

      if (premiumOffer) {
        appliedOffer = premiumOffer;

        if (premiumOffer.type === 'Percent' && premiumOffer.percent) {
          discount = (subtotal * premiumOffer.percent) / 100;
        } else if (premiumOffer.type === 'Free Delivery') {
          discount = 50; // or your delivery fee
        } else if (premiumOffer.type === 'Buy X Get Y Free') {
          const totalQty = products.reduce((sum, item) => sum + item.qty, 0);
          if (totalQty >= premiumOffer.buyQty) {
            const cheapest = Math.min(...dbProducts.map(p => p.price));
            discount = cheapest * (premiumOffer.freeQty || 1);
          }
        }
      }
    } else if (couponCode && couponCode.trim() !== '') {
      // Normal flow with user-supplied couponCode
      const userTypeFilter = userType === "Premium"
        ? { userType: { $in: ["Standard", "Premium"] } }
        : { userType: "Standard" };

      let offer = await Offer.findOne({
        code: couponCode.toUpperCase(),
        ...userTypeFilter,
        active: true,
      });

      if (offer && userType === 'Premium') {
        if (offer.userType === 'Premium' && offer.premiumApplicability) {
          if (offer.premiumApplicability !== 'All') {
            offer = null; // Not applicable coupon
          }
        }
      }

      if (offer) {
        appliedOffer = offer;

        if (offer.type === 'Percent' && offer.percent) {
          discount = (subtotal * offer.percent) / 100;
        } else if (offer.type === 'Free Delivery') {
          discount = 50;
        } else if (offer.type === 'Buy X Get Y Free') {
          const totalQty = products.reduce((sum, item) => sum + item.qty, 0);
          if (totalQty >= offer.buyQty) {
            const cheapest = Math.min(...dbProducts.map(p => p.price));
            discount = cheapest * (offer.freeQty || 1);
          }
        }
      }
    }

    // Compute tax and delivery
    const tax = +(subtotal * 0.02).toFixed(2);
    const deliveryCharges = 75;
    const total = Math.max(0, subtotal - discount + tax + deliveryCharges);

    res.json({
      subtotal,
      discount,
      tax,
      deliveryCharges,
      total,
      couponApplied: appliedOffer?.code || null,
      detailed
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to calculate cart price' });
  }
};





export const createOffer = async (req, res) => {
  try {
    const offer = await Offer.create(req.body);
    res.status(201).json(offer);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Get all offers
 * GET /api/products/offer
 */
export const getOffers = async (req, res) => {
  try {
    const offers = await Offer.find(); // returns an array
    res.status(200).json(offers);     // ✅ sends array to frontend
  } catch (error) {
    console.error('Error fetching offers:', error);
    res.status(500).json({ error: 'Failed to fetch offers' });
  }
};

/**
 * Update an existing offer by code
 * PUT /api/products/offer/:code
 */
export const updateOffer = async (req, res) => {
  try {
    const updated = await Offer.findOneAndUpdate(
      { code: req.params.code.toUpperCase() },
      req.body,
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Offer not found' });
    return res.status(200).json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Verify an offer code
 * POST /api/products/offer/verify
 */
export const verifyCouponCode = async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ valid: false, error: 'Code is required' });

  const offer = await Offer.findOne({ code: code.toUpperCase() });
  if (!offer) return res.status(404).json({ valid: false });

  res.json({ valid: true, offer });
};