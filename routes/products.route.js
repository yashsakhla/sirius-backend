// routes/products.route.js
import express from 'express';
import { getGroupedProducts, createProduct, getProductsList, getProductDetails, updateProduct, deleteProduct, getCartPrice, getGiftBundlePrice, createOffer, getOffers, updateOffer, verifyCouponCode, addProductReview, getProductReviews } from '../controller/products.controller.js';
import { authenticator } from '../middleware/authanticater.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { uploadProductImages } from '../middleware/upload.js';

const router = express.Router();

// GET: Fetch grouped products by category
router.get('/products', getProductsList);
router.get('/product/:id', getProductDetails);
router.get('/product/:id/reviews', getProductReviews);
router.get('/category-products', getGroupedProducts);
router.post('/product/:id/review', authenticator, addProductReview);
router.post('/add-product', authenticator, adminAuth, uploadProductImages.array('images', 10), createProduct)
router.put('/:id', authenticator, adminAuth, uploadProductImages.array('images', 10), updateProduct)
router.delete('/:id', authenticator, adminAuth, deleteProduct)
router.post('/cart-price', authenticator, getCartPrice);
router.post('/gift-bundle-price', authenticator, getGiftBundlePrice);
router.post('/offer', authenticator, adminAuth, createOffer);
router.get('/offer', authenticator, adminAuth, getOffers);
router.put('/offer/:code', authenticator, adminAuth, updateOffer);
router.post('/offer/verify', verifyCouponCode);

export default router;