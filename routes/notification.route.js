import express from 'express';
import {
  getActiveNotifications,
  getAllNotificationsAdmin,
  createNotification,
  updateNotification,
  deleteNotification,
} from '../controller/notification.controller.js';
import { authenticator } from '../middleware/authanticater.js';
import { adminAuth } from '../middleware/adminAuth.js';

const router = express.Router();

// Public: active notifications for customers / storefront
router.get('/', getActiveNotifications);

// Admin
router.get('/admin', authenticator, adminAuth, getAllNotificationsAdmin);
router.post('/', authenticator, adminAuth, createNotification);
router.put('/:id', authenticator, adminAuth, updateNotification);
router.delete('/:id', authenticator, adminAuth, deleteNotification);

export default router;
