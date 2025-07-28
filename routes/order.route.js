import express from 'express';
import {
  createOrder,
  getAllOrders,
  getUserOrders,
  updateOrderStatus
} from '../controller/order.controller.js';

import { authenticator } from '../middleware/authanticater.js';
import { adminAuth } from '../middleware/adminAuth.js';

const router = express.Router();

// POST — User places order
router.post('/', authenticator, createOrder);

// GET — Admin gets all orders
router.get('/', authenticator, adminAuth, getAllOrders);

// GET — User gets their own orders
router.get('/user/:id', authenticator, getUserOrders);

// PUT — Admin updates order status
router.put('/:id/status', authenticator, adminAuth, updateOrderStatus);

export default router;
