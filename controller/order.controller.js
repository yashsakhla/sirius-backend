import Order from '../models/Order.js';
import User from '../models/User.js';

// ✅ User places an order
export const createOrder = async (req, res) => {
  try {
    const {
      products,
      coupon,
      offer,
      totalPrice,
      paymentMode,
    } = req.body;

    // ✅ Get email from JWT (already decoded by your middleware)
    const userEmail = req.user?.email;

    if (!products?.length || !userEmail || !totalPrice || !paymentMode) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    // ✅ Find user by email
    const user = await User.findOne({ email: userEmail });
    if (!user) {
      return res.status(401).json({ message: "User not found." });
    }

    // ✅ Create the order with owner from database
    const newOrder = new Order({
      products,
      coupon,
      offer,
      totalPrice,
      paymentMode,
      owner: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        city: user.city,
        address: user.address,
        userId: user._id,
      },
    });

    await newOrder.save();

    res.status(201).json({ message: "Order placed successfully", order: newOrder });
  } catch (err) {
    console.error("❌ Error placing order:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ Admin: get all orders
export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.status(200).json(orders);
  } catch (err) {
    console.error('Error fetching orders: ', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ✅ User: get their own orders
export const getUserOrders = async (req, res) => {
  try {
    const userId = req.params.id;

    const orders = await Order.find({ 'owner.userId': userId }).sort({ createdAt: -1 });
    res.status(200).json(orders);
  } catch (err) {
    console.error('Error fetching user orders:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ✅ Admin: update order status
export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['Processing', 'Dispatched', 'Delivered', 'Cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status update' });
    }

    const order = await Order.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.status(200).json({ message: 'Order updated', order });
  } catch (err) {
    console.error('Error updating order:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
