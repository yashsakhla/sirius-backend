// server.js
import express from 'express';
import mongoose from 'mongoose';
import http from 'http';
import cors from "cors";

import { connectDB } from './database/connection.js';
import { authenticator } from './middleware/authanticater.js';

import adminRouter from './routes/admin.route.js';
import authRouter from './routes/auth.route.js';
import productsRouter from './routes/products.route.js';
import userRouter from './routes/user.route.js'; // ✅ correct file
import categoryRoutes from './routes/category.route.js';
import orderRoutes from './routes/order.route.js'
import dotenv from 'dotenv';
dotenv.config();

const allowedOrigins = [
  '*',
  'https://sirius-perfumes.vercel.app',
  'https://siriusperfumes.com',
  'http://localhost:3000',
  'http://localhost:3001',
  'https://vercel.com',
  'https://sirius-perfumes-yckn.vercel.app',
  'https://accounts.google.com',
  'http://api.siriusperfumes.com',
  'https://api.siriusperfumes.com',
  'http://siriusperfumes.com',
  'http://admin.siriusperfumes.com',
  'https://admin.siriusperfumes.com'
];



const app = express();
app.use(express.json());
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
    res.header('Access-Control-Allow-Origin', origin || '*');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});


// ROUTES
app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/perfumes", productsRouter);
app.use("/api/user", userRouter);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);

// Create HTTP server
const server = http.createServer(app);
const PORT = process.env.PORT || 8080;

// Start DB and Server
connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
});
