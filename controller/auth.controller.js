import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const googleLogin = async (req, res) => {
  const { idToken } = req.body;

  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();

    const { name, email } = payload;
    let phone = '';

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        name,
        email,
        phone,
        cart: [],
        orders: [],
        address: '',
        premiumUser: false
      });
    }
    const token = jwt.sign(
      { id: user._id, email: user.email },
      "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",
      { expiresIn: "7d" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || ''
      }
    });
  } catch (err) {
    console.error("Google login failed:", err);
    res.status(401).json({ message: "Invalid Google ID token." });
  }
};
