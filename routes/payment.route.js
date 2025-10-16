import express from 'express';
const router = express.Router();
import { authenticator } from '../middleware/authanticater.js';
import { createPhonePePayment, verifyWebhookAuth } from '../controller/payment.controller.js';

// define routes...
router.post("/create", authenticator, createPhonePePayment);

router.post("/verifyPayment", authenticator, verifyWebhookAuth);

export default router;