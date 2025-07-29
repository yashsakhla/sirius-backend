// routes/products.route.js
import express from 'express';
import { getGroupedProducts, createProduct, getProductsList, updateProduct, deleteProduct, getCartPrice, createOffer, getOffers, updateOffer, verifyCouponCode } from '../controller/products.controller.js';
import { authenticator } from '../middleware/authanticater.js';
import { adminAuth } from '../middleware/adminAuth.js';

const router = express.Router();

// GET: Fetch grouped products by category
router.get('/products', getProductsList);
router.get('/category-products', getGroupedProducts);
router.post('/add-product', authenticator, adminAuth, createProduct)
router.put('/:id', authenticator, adminAuth, updateProduct)
router.delete('/:id', authenticator, adminAuth, deleteProduct)
router.post('/cart-price', authenticator, getCartPrice);
router.post('/offer', authenticator, adminAuth, createOffer);
router.get('/offer', authenticator, adminAuth, getOffers);
router.put('/offer/:code', authenticator, adminAuth, updateOffer);
router.post('/offer/verify', verifyCouponCode);

export default router;
