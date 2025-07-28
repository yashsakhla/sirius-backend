// controllers/admin.controller.js
import Admin from '../models/Admin.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const Adminlogin = async (req, res) => {
  const { username, password } = req.body;

  try {
    // 1. Find admin by username
    const admin = await Admin.findOne({username});
    console.log(admin, req.body);
    if (!admin) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // 2. Compare password using bcrypt
    const isMatch = await bcrypt.compare(password, admin.password);
    console.log(password,admin.password, isMatch)
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // 3. Create JWT Payload
    const payload = {
      id: admin._id,
      username: admin.username,
      role: 'admin',
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '1d',
    });

    // 4. Respond with token & admin info
    res.status(200).json({
      message: 'Admin login successful',
      token,
      admin: {
        username: admin.username,
        id: admin._id,
      },
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server Error. Try again later.' });
  }
};
