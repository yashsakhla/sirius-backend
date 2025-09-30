// server.js
import http from 'http';

import { connectDB } from './database/connection.js';
import { authenticator } from './middleware/authanticater.js';

import adminRouter from './routes/admin.route.js';
import authRouter from './routes/auth.route.js';
import productsRouter from './routes/products.route.js';
import userRouter from './routes/user.route.js'; // ✅ correct file
import categoryRoutes from './routes/category.route.js';
import orderRoutes from './routes/order.route.js'
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
dotenv.config();

const allowedOrigins = [
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

// CORS configuration options
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      // Origin allowed
      callback(null, true);
    } else {
      // Origin not allowed
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true, // Allow cookies and auth headers
  optionsSuccessStatus: 200 // Help legacy browser support
};

// Use CORS middleware
app.use(cors(corsOptions));

// To parse JSON bodies
app.use(express.json());

// ROUTES
app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/perfumes", productsRouter);
app.use("/api/user", userRouter);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);

// Create HTTP server
app.options('*', cors(corsOptions));

const server = http.createServer(app);
const PORT = process.env.PORT || 8080;

// Start DB and Server
connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
});
