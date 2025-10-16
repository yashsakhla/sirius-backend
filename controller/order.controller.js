import Order from '../models/Order.js';
import User from '../models/User.js';
import Offer from '../models/Offers.js';
import {createPhonePePayment, getAuthToken} from './payment.controller.js';
import axios from 'axios';

// ✅ User places an order
export async function createOrder(req, res) {
  try {
    const { products, coupon, offer, totalPrice, paymentMode, address, phone } = req.body;
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
      paymentStatus: 'Pending', // initial status
      owner: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        city: address.city,
        address: address.address,
        userId: user._id,
      }
    });

    await newOrder.save();

    // Now initiate PhonePe payment
      try {
    const token = await getAuthToken();
    const totalAmount = req.body.totalPrice; // Amount in paise (e.g., 100 paise = ₹1)

    const requestHeaders = {
      "Content-Type": "application/json",
      "Authorization": `O-Bearer ${token}`
    };
// Use merchant ID from environment variables
    const requestBody = {
        "merchantOrderId": process.env.PHONEPE_MERCHANT_ID,
      "amount": totalAmount * 100, // Convert to paise
      "expireAfter": 1200,
      "metaInfo": {
        "udf1": "additional-information-1",
        "udf2": "additional-information-2",
        "udf3": "additional-information-3",
        "udf4": "additional-information-4",
        "udf5": "additional-information-5"
      },
      "paymentFlow": {
        "type": "PG_CHECKOUT",
        "message": "Payment message used for collect requests",
        "merchantUrls": {
          "redirectUrl": "https://siriusperfumes.com/cart" // set your redirect URL here
        }
      }
    };

    const options = {
      method: 'POST',
      url: 'https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/pay',
      headers: requestHeaders,
      data: requestBody
    };

    const response = await axios.request(options);
    console.log(response.data);
        return res.status(201).json({
      success: true,
      message: "Order created and payment initiated",
      order: newOrder,
      payment: response.data
    });

  } catch (error) {
    console.error("Error in creating payment:", error.response?.data || error.message);
    return res.status(500).json({ error: "Payment failed" });
  }
    // Return order and payment initiation data to frontend together


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

// orderService.js or similar
export async function updatePaymentStatusByMerchantOrderId(merchantOrderId, paymentStatus, transactionId = null) {
  if (!['Pending', 'Completed', 'Failed', 'CONFIRMED'].includes(paymentStatus)) {
    throw new Error('Invalid payment status update');
  }

  const update = { paymentStatus };
  if (transactionId) {
    update.transactionId = transactionId;
  }

  const order = await Order.findOneAndUpdate(
    { merchantOrderId },
    update,
    { new: true }
  );

  if (!order) {
    throw new Error('Order not found');
  }
  return order;
}

