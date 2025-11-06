import Order from '../models/Order.js';
import User from '../models/User.js';
import Offer from '../models/Offers.js';
import { getAuthToken, getPaymentStatus} from './payment.controller.js';
import axios from 'axios';

// ✅ User places an order
export async function createOrder(req, res) {
  try {
    const { products, coupon, offer, totalPrice, paymentMode, address, phone, productImg } = req.body;
    const userEmail = req.user?.email;

    if (!products?.length || !userEmail || !totalPrice || !paymentMode) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const user = await User.findOne({ email: userEmail });
    if (!user) {
      return res.status(401).json({ message: "User not found." });
    }

    // Generate a unique merchantOrderId for PhonePe
    const merchantOrderId = `ORDER_${Date.now()}`;

    // Create order record
    const newOrder = new Order({
      products,
      coupon,
      offer,
      totalPrice,
      paymentMode,
      merchantOrderId,
      productImg,
      paymentStatus: 'PENDING', // initial status
      owner: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        city: address.city,
        address: Object.values(address).join(", "),
        userId: user._id,
      }
    });

    await newOrder.save();

    // Now initiate PhonePe payment

    // Return order and payment initiation data to frontend together
return res.status(201).json({
      success: true,
      message: "Order created and payment initiated",
      order: newOrder,
    });

  } catch (err) {
    console.error("Error creating order and payment:", err);
    return res.status(500).json({ message: "Server error" });
  }
}




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
    const { Deliverystatus } = req.body;

    const validStatuses = ['Processing', 'Dispatched', 'Delivered', 'Cancelled'];
    if (!validStatuses.includes(Deliverystatus)) {
      return res.status(400).json({ message: 'Invalid status update' });
    }

    // Map of status to their respective date field in DB
    const statusDateFieldMap = {
      Processing: 'processingDate',
      Dispatched: 'dispatchDate',
      Delivered: 'deliveryDate',
    };

    // Build updateFields dynamically
    const updateFields = { Deliverystatus };
    if (statusDateFieldMap[Deliverystatus]) {
      updateFields[statusDateFieldMap[Deliverystatus]] = new Date();
    }

    const order = await Order.findByIdAndUpdate(id, { $set: updateFields }, { new: true });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.status(200).json({ message: 'Order updated', order });
  } catch (err) {
    console.error('Error updating order:', err);
    res.status(500).json({ message: 'Server error' });
  }
};


// orderService.js or similar
export async function updatePaymentStatusByMerchantOrderId(req, res) {
  try {
    const { merchantOrderId, paymentStatus, transactionId, token } = req.body;
    if (!['PENDING', 'COMPLETED', 'FAILED'].includes(paymentStatus)) {
      return res.status(400).json({ message: 'Invalid payment status update' });
    }

    const getPhonepeStatus = await getPaymentStatus(merchantOrderId, token);
    if (!getPhonepeStatus) {
      return res.status(400).json({ message: 'Failed to fetch payment status from PhonePe' });
    }

    const status = getPhonepeStatus.state;

    const update = { paymentStatus: status };
    if (transactionId) {
      update.transactionId = getPhonepeStatus.paymentDetails[0].transactionId;
    }

    const order = await Order.findOneAndUpdate(
      { merchantOrderId },
      update,
      { new: true }
    );

    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
    }

    return res.status(200).json({ success: true, message: 'Payment status updated', order, getPhonepeStatus });
  } catch (error) {
    console.error('Error updating payment status:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

