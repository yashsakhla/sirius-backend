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

    // For now, phone is not available in Google ID token; initialize as empty string
    let phone = '';

    // Find user or create if doesn't exist
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        name,
        email,
        phone,   // Initialize phone as empty string or null
        cart: [],
        orders: [],
        address: '',
        premiumUser: false
      });
    }

    // Create JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || ''   // Include phone in response if set
      }
    });

  } catch (err) {
    console.error("Google login failed:", err);
    res.status(401).json({ message: 'Invalid Google ID token.' });
  }
};
