// routes/category.route.js
import express from 'express';
import { getCategories, createCategory, updateCategory } from '../controller/category.controller.js';
import {authenticator} from '../middleware/authanticater.js';
import {adminAuth} from '../middleware/adminAuth.js';
const router = express.Router();

router.get('/', getCategories);

router.post('/', authenticator, adminAuth, createCategory);

router.put('/:id', authenticator, adminAuth, updateCategory);

export default router;
