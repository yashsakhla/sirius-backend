import User from '../models/User.js';

export const getAccountDetails = async (req, res) => {
  const userId = req.user.id;

  try {
    const user = await User.findById(userId).select("-__v");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      name: user.name,
      email: user.email,
      phone: user.phone || "",          // Added phone here
      address: user.address,            // Returning as object
      cart: user.cart,
      orders: user.orders,
      premiumUser: user.premiumUser
    });
  } catch (err) {
    console.error("Error fetching user:", err);
    res.status(500).json({ message: "Server error" });
  }
};



export const updateAccount = async (req, res) => {
  const userId = req.user.id;
  const { name, address, phone } = req.body;

  try {
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (address !== undefined) updates.address = address;
    if (phone !== undefined) updates.phone = phone;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No data provided for update.' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.json({
      name: updatedUser.name,
      email: updatedUser.email,
      phone: updatedUser.phone || "",   // Include phone here
      address: updatedUser.address,
      cart: updatedUser.cart,
      orders: updatedUser.orders,
      premiumUser: updatedUser.premiumUser
    });
  } catch (err) {
    console.error('Error updating account:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};


export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.status(200).json(users);
  } catch (error) {
    console.error('❌ Error fetching users:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};