import express from 'express';
const router = express.Router();
import { authenticator } from '../middleware/authanticater.js';
import { updateAccount,getAccountDetails, getAllUsers } from '../controller/user.controller.js';
import { adminAuth } from '../middleware/adminAuth.js';

// define routes...
router.get("/account", authenticator, getAccountDetails);
router.put('/update-account', authenticator, updateAccount);
router.get('/', authenticator, adminAuth, getAllUsers);

export default router;
