// controller/auth.controller.js
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const googleLogin = async (req, res) => {
  const { idToken } = req.body;

  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    const { name, email } = payload;

    // Find user or create new
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        name,
        email,
        cart: [],
        orders: [],
        address: '',
        premiumUser: false
      });
    }

    // ✅ Now create your own backend session token
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      message: 'Login successful',
      token, // 🔐 use this JWT for future requests
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });

  } catch (err) {
    console.error("Google login failed:", err);
    res.status(401).json({ message: 'Invalid Google ID token.' });
  }
};


