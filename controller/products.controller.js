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
    const { name, description, image, size, category, price, active } = req.body;
    // 'price' from admin is 'discountedPrice'
    if (!name || !price) {
      return res.status(400).json({ message: 'Required fields are missing (name, price)' });
    }
    const exists = await Product.findOne({ name });
    if (exists) {
      return res.status(400).json({ message: 'Product with this name already exists' });
    }
    const discountedPrice = parseFloat(price);
    const basicPrice = parseFloat((discountedPrice * 1.10).toFixed(2));

    const newProduct = new Product({
      name,
      description,
      image,
      size,
      category,
      discountedPrice,
      basicPrice,
      active: active !== undefined ? active : true,
    });
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
    const { id } = req.params;
    const { name, description, image, size, category, discountedPrice, active } = req.body;

    let updateFields = {};
    if (name != null) updateFields.name = name;
    if (description != null) updateFields.description = description;
    if (image != null) updateFields.image = image;
    if (size != null) updateFields.size = size;
    if (category != null) updateFields.category = category;
    if (discountedPrice != null) {
      updateFields.discountedPrice = parseFloat(discountedPrice);
      updateFields.basicPrice = parseFloat((discountedPrice * 1.10).toFixed(2));
    }
    if (active != null) updateFields.active = active;

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true }
    );
    if (!updatedProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.status(200).json({ message: 'Product updated successfully', product: updatedProduct });
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

    // Default userType to Standard if auth missing
    let userType = "Standard";
    if (req.user && req.user.id) {
      const user = await User.findById(req.user.id).select('premiumUser');
      userType = user?.premiumUser ? 'Premium' : 'Standard';
    }

    // Get DB product info
    const productIds = products.map(item => item.productId);
    const dbProducts = await Product.find({ _id: { $in: productIds } });

    let discountedSubtotal = 0;
    let basicSubtotal = 0;
    const detailed = [];

    for (const item of products) {
      const product = dbProducts.find(p => p._id.toString() === item.productId);
      if (product) {
        const discountedTotal = (product.discountedPrice || product.price) * item.qty;
        const basicTotal = (product.basicPrice || (product.discountedPrice * 1.10) || (product.price * 1.10)) * item.qty;
        discountedSubtotal += discountedTotal;
        basicSubtotal += basicTotal;
        detailed.push({
          _id: product._id,
          name: product.name,
          discountedPrice: product.discountedPrice,
          basicPrice: product.basicPrice,
          qty: item.qty,
          discountedTotal,
          basicTotal
        });
      }
    }

    let discount = 0;
    let appliedOffer = null;

    // --- Offer & coupon logic: always based on discountedSubtotal ---

    if (userType === 'Premium' && (!couponCode || couponCode.trim() === '')) {
      const premiumOffer = await Offer.findOne({
        userType: 'Premium',
        premiumApplicability: 'All',
        active: true
      });

      if (premiumOffer) {
        appliedOffer = premiumOffer;
        if (premiumOffer.type === 'Percent' && premiumOffer.percent) {
          discount = (discountedSubtotal * premiumOffer.percent) / 100;
        } else if (premiumOffer.type === 'Free Delivery') {
          discount = 50; // your delivery fee
        } else if (premiumOffer.type === 'Buy X Get Y Free') {
          const totalQty = products.reduce((sum, item) => sum + item.qty, 0);
          if (totalQty >= premiumOffer.buyQty) {
            const cheapest = Math.min(...dbProducts.map(p => p.discountedPrice || p.price));
            discount = cheapest * (premiumOffer.freeQty || 1);
          }
        }
      }
    } else if (couponCode && couponCode.trim() !== '') {
      const userTypeFilter = userType === "Premium"
        ? { userType: { $in: ["Standard", "Premium"] } }
        : { userType: "Standard" };

      let offer = await Offer.findOne({
        code: couponCode.toUpperCase(),
        ...userTypeFilter,
        active: true,
      });

      if (offer && userType === 'Premium' && offer.userType === 'Premium' && offer.premiumApplicability) {
        if (offer.premiumApplicability !== 'All') offer = null;
      }

      if (offer) {
        appliedOffer = offer;
        if (offer.type === 'Percent' && offer.percent) {
          discount = (discountedSubtotal * offer.percent) / 100;
        } else if (offer.type === 'Free Delivery') {
          discount = 50;
        } else if (offer.type === 'Buy X Get Y Free') {
          const totalQty = products.reduce((sum, item) => sum + item.qty, 0);
          if (totalQty >= offer.buyQty) {
            const cheapest = Math.min(...dbProducts.map(p => p.discountedPrice || p.price));
            discount = cheapest * (offer.freeQty || 1);
          }
        }
      }
    }

    // --- Tax and total (use discountedSubtotal for customer price!) ---
    const tax = +(discountedSubtotal * 0.02).toFixed(2);
    const deliveryCharges = 0;
    const total = Math.max(0, discountedSubtotal - discount + tax + deliveryCharges);

    res.json({
      discountedSubtotal: +discountedSubtotal.toFixed(2),
      basicSubtotal: +basicSubtotal.toFixed(2),
      discount: +discount.toFixed(2),
      tax,
      deliveryCharges,
      total: +total.toFixed(2),
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