import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Review from '../models/Review.js';
import Offer from '../models/Offers.js';// Adjust import based on your project structure
import User from '../models/User.js';

/** Get averageRating & ratingCount per productId from Review collection */
async function getAverageRatingsByProductIds(productIds) {
  if (!productIds?.length) return {};
  const ids = productIds.map(id => (id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id)));
  const results = await Review.aggregate([
    { $match: { productId: { $in: ids } } },
    { $group: { _id: '$productId', averageRating: { $avg: '$rating' }, ratingCount: { $sum: 1 } } }
  ]);
  const map = {};
  results.forEach(r => {
    map[r._id.toString()] = {
      averageRating: Math.round(r.averageRating * 10) / 10,
      ratingCount: r.ratingCount
    };
  });
  return map;
}

/** Parse multipart / JSON fields that may be JSON strings */
function parseMaybeJson(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'string') {
    const t = value.trim();
    if (!t) return null;
    if (t.startsWith('[') || t.startsWith('{')) {
      try {
        return JSON.parse(t);
      } catch {
        return value;
      }
    }
    return value;
  }
  return value;
}

/**
 * Per-variant pricing (same rules as old product-level create):
 * - Admin `price` is the selling / discounted amount → discountedPrice
 * - basicPrice = discountedPrice × 2 (unless explicitly provided)
 * Stored shape: { size, price, discountedPrice, basicPrice } with price === discountedPrice
 */
function finalizeSizeVariantPricing(entry) {
  const sell =
    entry.discountedPrice != null
      ? parseFloat(String(entry.discountedPrice))
      : entry.price != null
        ? parseFloat(String(entry.price))
        : NaN;
  if (Number.isNaN(sell) || sell < 0) return null;
  const discountedPrice = sell;
  let basicPrice =
    entry.basicPrice != null ? parseFloat(String(entry.basicPrice)) : parseFloat((discountedPrice * 2).toFixed(2));
  if (Number.isNaN(basicPrice) || basicPrice < 0) {
    basicPrice = parseFloat((discountedPrice * 2).toFixed(2));
  }
  const price = discountedPrice;
  return { price, discountedPrice, basicPrice };
}

/** Build validated size[] for DB */
function normalizeSizeVariantsInput(raw) {
  const parsed = parseMaybeJson(raw);
  if (!Array.isArray(parsed) || parsed.length === 0) return null;
  const out = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object') continue;
    const sizeLabel =
      entry.size != null && String(entry.size).trim() ? String(entry.size).trim() : '';
    if (!sizeLabel) continue;
    const pricing = finalizeSizeVariantPricing(entry);
    if (!pricing) continue;
    out.push({
      size: sizeLabel,
      ...pricing,
    });
  }
  return out.length ? out : null;
}

function isSizeVariantObject(item) {
  return (
    item &&
    typeof item === 'object' &&
    !Array.isArray(item) &&
    (item.size != null || item.discountedPrice != null || item.price != null)
  );
}

/** Normalize product.size for API + legacy docs (string labels + root price, or old sizeOptions key) */
function enrichProductSizeForResponse(obj) {
  if (Array.isArray(obj.sizeOptions) && obj.sizeOptions.length > 0) {
    obj.size = obj.sizeOptions;
    delete obj.sizeOptions;
  }

  const sizeArr = obj.size;
  if (Array.isArray(sizeArr) && sizeArr.length > 0) {
    if (isSizeVariantObject(sizeArr[0])) {
      obj.size = sizeArr.map(item => {
        if (!item || typeof item !== 'object') return item;
        const sizeStr = item.size != null ? String(item.size).trim() : '';
        if (!sizeStr) return item;
        const pricing = finalizeSizeVariantPricing(item);
        if (!pricing) return { ...item, size: sizeStr };
        return { size: sizeStr, ...pricing };
      });
      delete obj.discountedPrice;
      delete obj.basicPrice;
      delete obj.price;
      delete obj.sizeOptions;
      if ('image' in obj) delete obj.image;
      return obj;
    }

    const legacyDiscounted = obj.discountedPrice != null ? Number(obj.discountedPrice) : NaN;
    const legacyBasic =
      obj.basicPrice != null ? Number(obj.basicPrice) : Number.isFinite(legacyDiscounted)
        ? Number((legacyDiscounted * 2).toFixed(2))
        : NaN;
    const labels = sizeArr.filter(v => v != null && v !== '').map(String);
    if (labels.length && Number.isFinite(legacyDiscounted)) {
      const basic = Number.isFinite(legacyBasic) ? legacyBasic : parseFloat((legacyDiscounted * 2).toFixed(2));
      obj.size = labels.map(sz => ({
        size: sz,
        price: legacyDiscounted,
        discountedPrice: legacyDiscounted,
        basicPrice: basic,
      }));
    }
  }

  delete obj.discountedPrice;
  delete obj.basicPrice;
  delete obj.price;
  delete obj.sizeOptions;
  if ('image' in obj) delete obj.image;
  return obj;
}

function getUnitPricesForSize(product, sizeKey) {
  const opts = product.size;
  if (!Array.isArray(opts) || !opts.length) return null;
  const key = sizeKey != null ? String(sizeKey).trim() : '';
  const opt = opts.find(o => o && String(o.size).trim() === key);
  if (!opt) return null;
  const d = Number(opt.discountedPrice ?? opt.price);
  const b = Number(opt.basicPrice);
  if (Number.isNaN(d)) return null;
  const basic = Number.isNaN(b) ? Number((d * 2).toFixed(2)) : b;
  return { discountedPrice: d, basicPrice: basic };
}

/**
 * Cart lines: if `size` is missing/empty and the product has exactly one variant, use that size
 * (backward compatible with clients that only send productId + qty for single-SKU products).
 */
function resolveCartLinePricing(resolvedProduct, requestedSize) {
  const trimmed =
    requestedSize != null && String(requestedSize).trim() !== '' && String(requestedSize).trim() !== 'null'
      ? String(requestedSize).trim()
      : '';
  if (trimmed) {
    const unit = getUnitPricesForSize(resolvedProduct, trimmed);
    return unit ? { resolvedSize: trimmed, unit } : null;
  }
  const opts = resolvedProduct.size;
  if (!Array.isArray(opts) || opts.length !== 1) return null;
  const one = opts[0];
  const label = one && one.size != null ? String(one.size).trim() : '';
  if (!label) return null;
  const unit = getUnitPricesForSize(resolvedProduct, label);
  return unit ? { resolvedSize: label, unit } : null;
}

/** Max perfumes a customer may pick for one gift bundle */
const MAX_GIFT_PERFUME_SLOTS = 4;

function normalizeProductCategory(raw) {
  const p = typeof raw === 'string' ? parseMaybeJson(raw) : raw;
  if (p == null || p === '') return undefined;
  if (typeof p !== 'object' || Array.isArray(p)) return undefined;
  const type = p.type != null ? String(p.type).trim() : '';
  if (!type) return undefined;
  return {
    type,
    allowsCustomerProductChoice: Boolean(p.allowsCustomerProductChoice),
  };
}

/**
 * POST body: { giftProductId, giftSize, chosenProducts: [{ productId, size }] }
 * Total = gift variant price + sum of each chosen perfume's variant price (max 4 slots, one size each, no duplicates).
 */
export const getGiftBundlePrice = async (req, res) => {
  try {
    const { giftProductId, giftSize, chosenProducts } = req.body;

    if (!giftProductId) {
      return res.status(400).json({ error: 'giftProductId is required' });
    }
    if (!mongoose.Types.ObjectId.isValid(String(giftProductId))) {
      return res.status(400).json({ error: 'Invalid giftProductId' });
    }
    if (giftSize == null || String(giftSize).trim() === '') {
      return res.status(400).json({ error: 'giftSize is required (variant on the gift product, e.g. packaging tier)' });
    }
    if (!Array.isArray(chosenProducts)) {
      return res.status(400).json({ error: 'chosenProducts must be an array' });
    }
    if (chosenProducts.length > MAX_GIFT_PERFUME_SLOTS) {
      return res.status(400).json({
        error: `A gift set allows at most ${MAX_GIFT_PERFUME_SLOTS} perfumes`,
        maxPerfumes: MAX_GIFT_PERFUME_SLOTS,
      });
    }

    const giftDoc = await Product.findById(giftProductId);
    if (!giftDoc || !giftDoc.active) {
      return res.status(404).json({ error: 'Gift product not found' });
    }

    const giftObj = enrichProductSizeForResponse(giftDoc.toObject());
    const pc = giftObj.productCategory;
    if (!pc || pc.type !== 'gift' || !pc.allowsCustomerProductChoice) {
      return res.status(400).json({
        error: 'This product is not a customizable gift (productCategory.type must be "gift" and allowsCustomerProductChoice true)',
      });
    }

    const giftUnits = getUnitPricesForSize(giftObj, giftSize);
    if (!giftUnits) {
      return res.status(400).json({ error: 'Invalid giftSize for this gift product' });
    }

    const giftIdStr = giftDoc._id.toString();
    const seenIds = new Set();

    for (const line of chosenProducts) {
      const pid = line?.productId;
      const sz = line?.size != null ? String(line.size).trim() : '';
      if (!pid || !sz) {
        return res.status(400).json({
          error: 'Each chosen item must include productId and a single size',
        });
      }
      const pidStr = String(pid);
      if (!mongoose.Types.ObjectId.isValid(pidStr)) {
        return res.status(400).json({ error: `Invalid productId: ${pidStr}` });
      }
      if (pidStr === giftIdStr) {
        return res.status(400).json({ error: 'The gift product itself cannot be listed in chosenProducts' });
      }
      if (seenIds.has(pidStr)) {
        return res.status(400).json({ error: 'Each perfume may appear only once in the gift set' });
      }
      seenIds.add(pidStr);
    }

    const idList = [...seenIds];
    const chosenDocs =
      idList.length > 0 ? await Product.find({ _id: { $in: idList }, active: true }) : [];

    if (idList.length !== chosenDocs.length) {
      const found = new Set(chosenDocs.map(d => d._id.toString()));
      const missing = idList.filter(id => !found.has(id));
      return res.status(404).json({ error: 'One or more chosen products were not found', missing });
    }

    let perfumesDiscounted = 0;
    let perfumesBasic = 0;
    const chosen = [];

    for (const line of chosenProducts) {
      const pidStr = String(line.productId);
      const sz = String(line.size).trim();
      const p = chosenDocs.find(d => d._id.toString() === pidStr);
      const pObj = enrichProductSizeForResponse(p.toObject());
      const innerCat = pObj.productCategory;
      if (innerCat?.type === 'gift' && innerCat?.allowsCustomerProductChoice) {
        return res.status(400).json({
          error: 'A customizable gift product cannot be added as a perfume inside another gift set',
          productId: pidStr,
        });
      }
      const unit = getUnitPricesForSize(pObj, sz);
      if (!unit) {
        return res.status(400).json({
          error: `Invalid size "${sz}" for product ${p.name || pidStr}`,
          productId: pidStr,
          size: sz,
        });
      }
      perfumesDiscounted += unit.discountedPrice;
      perfumesBasic += unit.basicPrice;
      chosen.push({
        productId: p._id,
        name: p.name,
        size: sz,
        price: unit.discountedPrice,
        discountedPrice: unit.discountedPrice,
        basicPrice: unit.basicPrice,
      });
    }

    const totalDiscounted = giftUnits.discountedPrice + perfumesDiscounted;
    const totalBasic = giftUnits.basicPrice + perfumesBasic;

    res.json({
      gift: {
        productId: giftDoc._id,
        name: giftDoc.name,
        size: String(giftSize).trim(),
        price: giftUnits.discountedPrice,
        discountedPrice: giftUnits.discountedPrice,
        basicPrice: giftUnits.basicPrice,
      },
      chosen,
      giftPortionDiscounted: +giftUnits.discountedPrice.toFixed(2),
      perfumesPortionDiscounted: +perfumesDiscounted.toFixed(2),
      totalDiscountedPrice: +totalDiscounted.toFixed(2),
      giftPortionBasic: +giftUnits.basicPrice.toFixed(2),
      perfumesPortionBasic: +perfumesBasic.toFixed(2),
      totalBasicPrice: +totalBasic.toFixed(2),
      maxPerfumes: MAX_GIFT_PERFUME_SLOTS,
      chosenCount: chosen.length,
    });
  } catch (err) {
    console.error('getGiftBundlePrice:', err);
    res.status(500).json({ error: 'Failed to calculate gift bundle price' });
  }
};

export const getGroupedProducts = async (req, res) => {
  try {
    const allProducts = await Product.find();
    const ratingMap = await getAverageRatingsByProductIds(allProducts.map(p => p._id));

    const categoryMap = new Map();
    allProducts.forEach(product => {
      const category = product.category || 'Others';
      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      const ratingData = ratingMap[product._id.toString()] || { averageRating: 0, ratingCount: 0 };
      const obj = enrichProductSizeForResponse(product.toObject());
      categoryMap.get(category).push({ ...obj, ...ratingData });
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
    const products = await Product.find().sort({ createdAt: -1 });
    const ratingMap = await getAverageRatingsByProductIds(products.map(p => p._id));
    const productsWithRating = products.map(p => {
      const ratingData = ratingMap[p._id.toString()] || { averageRating: 0, ratingCount: 0 };
      const obj = enrichProductSizeForResponse(p.toObject());
      return { ...obj, ...ratingData };
    });
    res.status(200).json(productsWithRating);
  } catch (err) {
    console.error('Error fetching Product:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getProductDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    const ratingMap = await getAverageRatingsByProductIds([product._id]);
    const ratingData = ratingMap[product._id.toString()] || { averageRating: 0, ratingCount: 0 };
    const obj = enrichProductSizeForResponse(product.toObject());
    res.status(200).json({ ...obj, ...ratingData });
  } catch (err) {
    console.error('Error fetching product details:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ✅ ADD PRODUCT REVIEW / RATING (stored in Review collection)
export const addProductReview = async (req, res) => {
  try {
    const { id: productId } = req.params;
    const { rating, comment, size } = req.body;

    if (rating == null) {
      return res.status(400).json({ message: 'Rating is required' });
    }

    const numericRating = Number(rating);
    if (Number.isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
      return res
        .status(400)
        .json({ message: 'Rating must be a number between 1 and 5' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const newReview = new Review({
      productId,
      user: req.user?.id || null,
      rating: numericRating,
      comment: comment || '',
      size: size || ''
    });
    await newReview.save();

    res.status(201).json({
      message: 'Review added successfully',
      review: newReview
    });
  } catch (error) {
    console.error('Error adding product review:', error);
    res.status(500).json({ message: 'Server error while adding review' });
  }
};

// ✅ GET REVIEWS BY PRODUCT ID
export const getProductReviews = async (req, res) => {
  try {
    const { id: productId } = req.params;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const reviews = await Review.find({ productId })
      .sort({ createdAt: -1 })
      .populate('user', 'name email');

    const ratingCount = reviews.length;
    const averageRating = ratingCount
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / ratingCount
      : 0;

    res.status(200).json({
      reviews,
      averageRating: Math.round(averageRating * 10) / 10,
      ratingCount
    });
  } catch (error) {
    console.error('Error fetching product reviews:', error);
    res.status(500).json({ message: 'Server error while fetching reviews' });
  }
};

export const createProduct = async (req, res) => {
  try {
    const { name, description, images, size, active, image } = req.body;
    const rawSizeVariants = size ?? req.body.sizeOptions ?? req.body.sizes;

    if (!name) {
      return res.status(400).json({ message: 'Required fields are missing (name)' });
    }
    const exists = await Product.findOne({ name });
    if (exists) {
      return res.status(400).json({ message: 'Product with this name already exists' });
    }

    const resolvedOptions = normalizeSizeVariantsInput(rawSizeVariants);
    if (!resolvedOptions) {
      return res.status(400).json({
        message:
          'size is required: array of variants with size + price (selling price) or discountedPrice; basicPrice defaults to 2× discountedPrice',
      });
    }

    // Accept images from multipart upload (preferred) OR JSON body.
    // Note: we no longer store a single `image` field; we always store `images[]`.
    let imageList = [];
    if (Array.isArray(req.files) && req.files.length) {
      imageList = req.files.map(f => `/uploads/products/${f.filename}`);
    } else if (Array.isArray(images)) {
      imageList = images.filter(Boolean);
    } else if (typeof images === 'string' && images.trim()) {
      // allow comma-separated string
      imageList = images.split(',').map(s => s.trim()).filter(Boolean);
    } else if (typeof image === 'string' && image.trim()) {
      // Backward compatibility: if older client sends `image`, treat it as a single-item `images[]`.
      imageList = [image.trim()];
    }

    const category = req.body.category;
    const productCategory = normalizeProductCategory(req.body.productCategory);

    const newProduct = new Product({
      name,
      description,
      images: imageList,
      size: resolvedOptions,
      category,
      active: active !== undefined ? active : true,
      ...(productCategory ? { productCategory } : {}),
    });
    await newProduct.save();
    res.status(201).json({
      message: 'Product created successfully',
      product: enrichProductSizeForResponse(newProduct.toObject()),
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
    const { name, description, images, size, category, active, image } = req.body;
    const rawSizeVariants = size ?? req.body.sizeOptions ?? req.body.sizes;

    let updateFields = {};
    if (name != null) updateFields.name = name;
    if (description != null) updateFields.description = description;
    if (category != null) updateFields.category = category;
    if (active != null) updateFields.active = active;

    // If multipart images uploaded, replace images with uploaded list.
    // If JSON body images provided, replace images with that list.
    if (Array.isArray(req.files) && req.files.length) {
      const imageList = req.files.map(f => `/uploads/products/${f.filename}`);
      updateFields.images = imageList;
    } else if (images != null) {
      let imageList = [];
      if (Array.isArray(images)) {
        imageList = images.filter(Boolean);
      } else if (typeof images === 'string' && images.trim()) {
        imageList = images.split(',').map(s => s.trim()).filter(Boolean);
      }
      updateFields.images = imageList;
    } else if (typeof image === 'string' && image.trim()) {
      // Backward compatibility: if older client sends `image`, treat it as single-item `images[]`.
      updateFields.images = [image.trim()];
    }

    if (rawSizeVariants != null) {
      const resolved = normalizeSizeVariantsInput(rawSizeVariants);
      if (!resolved) {
        return res.status(400).json({
          message:
            'size must be a non-empty array of variants with size + price or discountedPrice; basicPrice defaults to 2× discountedPrice',
        });
      }
      updateFields.size = resolved;
    }

    if (req.body.productCategory !== undefined) {
      const productCategory = normalizeProductCategory(req.body.productCategory);
      if (productCategory) updateFields.productCategory = productCategory;
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true }
    );
    if (!updatedProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.status(200).json({
      message: 'Product updated successfully',
      product: enrichProductSizeForResponse(updatedProduct.toObject()),
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
      if (!product) continue;

      const resolvedProduct = enrichProductSizeForResponse(product.toObject());
      const linePricing = resolveCartLinePricing(resolvedProduct, item.size);
      if (!linePricing) {
        const variantCount = Array.isArray(resolvedProduct.size) ? resolvedProduct.size.length : 0;
        const message =
          variantCount > 1
            ? 'Each cart line must include size when the product has multiple variants'
            : 'Each cart line must include a valid size that matches this product';
        return res.status(400).json({
          error: message,
          productId: item.productId,
          size: item.size ?? null,
        });
      }

      const { resolvedSize, unit } = linePricing;
      const qty = Number(item.qty) || 0;
      const discountedTotal = unit.discountedPrice * qty;
      const basicTotal = unit.basicPrice * qty;
      discountedSubtotal += discountedTotal;
      basicSubtotal += basicTotal;
      detailed.push({
        _id: product._id,
        name: product.name,
        size: resolvedSize,
        price: unit.discountedPrice,
        discountedPrice: unit.discountedPrice,
        basicPrice: unit.basicPrice,
        qty,
        discountedTotal,
        basicTotal,
      });
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
            const unitPrices = [];
            for (const item of products) {
              const p = dbProducts.find(x => x._id.toString() === item.productId);
              const r = p ? resolveCartLinePricing(enrichProductSizeForResponse(p.toObject()), item.size) : null;
              if (r) unitPrices.push(r.unit.discountedPrice);
            }
            if (unitPrices.length) {
              const cheapest = Math.min(...unitPrices);
              discount = cheapest * (premiumOffer.freeQty || 1);
            }
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
            const unitPrices = [];
            for (const item of products) {
              const p = dbProducts.find(x => x._id.toString() === item.productId);
              const r = p ? resolveCartLinePricing(enrichProductSizeForResponse(p.toObject()), item.size) : null;
              if (r) unitPrices.push(r.unit.discountedPrice);
            }
            if (unitPrices.length) {
              const cheapest = Math.min(...unitPrices);
              discount = cheapest * (offer.freeQty || 1);
            }
          }
        }
      }
    }
    
    // --- Tax and total (use discountedSubtotal for customer price!) ---
    const tax = +(discountedSubtotal * 0.02).toFixed(2);
    const deliveryCharges = 0;
    const total = Math.max(0, discountedSubtotal - discount + Math.round(tax) + deliveryCharges);

    res.json({
      discountedSubtotal: +discountedSubtotal.toFixed(2),
      basicSubtotal: +basicSubtotal.toFixed(2),
      discount: +discount.toFixed(2),
      tax: Math.round(tax),
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