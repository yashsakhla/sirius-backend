import express from 'express';
const router = express.Router();
import { authenticator } from '../middleware/authanticater.js';
import { getPhonePeToken } from '../controller/payment.controller.js';
import { updatePaymentStatusByMerchantOrderId } from '../controller/order.controller.js';

// define routes...

router.post("/token", authenticator, getPhonePeToken);

router.get("/get-payment-status",authenticator, )

router.post("/update-order-status", updatePaymentStatusByMerchantOrderId)

export default router;