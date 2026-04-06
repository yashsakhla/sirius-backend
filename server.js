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
import paymentRoutes from './routes/payment.route.js';
import notificationRoutes from './routes/notification.route.js';
import path from 'path';
dotenv.config();


const app = express();

const allowedOrigins = [
  "https://www.siriusperfumes.com",
  "https://siriusperfumes.com",
  "http://localhost:3000",
  "http://localhost:3001",
  "https://sirius-perfumes.vercel.app",
  "https://sirius-perfumes-yckn.vercel.app",
  "https://vercel.com",
  "https://accounts.google.com",
  "http://api.siriusperfumes.com",
  "https://api.siriusperfumes.com",
  "http://siriusperfumes.com",
  "http://admin.siriusperfumes.com",
  "https://admin.siriusperfumes.com",
];

// Apply before body parsers so OPTIONS preflight is handled consistently
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Accept",
      "Origin",
      "X-Requested-With",
    ],
    credentials: true,
    maxAge: 86400,
  })
);

app.use(express.json());

// serve uploaded product images
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));


// ROUTES
app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/perfumes", productsRouter);
app.use("/api/user", userRouter);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/notifications', notificationRoutes);

// Create HTTP server
const server = http.createServer(app);
const PORT = process.env.PORT || 8080;

// Start DB and Server
connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
});
