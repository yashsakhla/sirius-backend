import express from 'express';
const router = express.Router();
import { Adminlogin } from '../controller/admin.controller.js';

// Public login route (no middleware)
router.post('/login', Adminlogin); 



export default router;
