import Order from '../models/Order.js';
import User from '../models/User.js';
import { getPaymentStatus } from './payment.controller.js';

function normalizeGiftBundles(raw) {
  if (raw == null) return undefined;
  if (!Array.isArray(raw)) return undefined;
  const out = [];
  for (const bundle of raw) {
    if (!bundle || typeof bundle !== 'object') continue;
    const giftProductId = bundle.giftProductId != null ? String(bundle.giftProductId).trim() : '';
    const giftSize = bundle.giftSize != null ? String(bundle.giftSize).trim() : '';
    if (!giftProductId || !giftSize) continue;
    const chosen = Array.isArray(bundle.chosenProducts)
      ? bundle.chosenProducts
          .filter(c => c && typeof c === 'object')
          .map(c => ({
            productId: String(c.productId ?? '').trim(),
            size: String(c.size ?? '').trim(),
          }))
          .filter(c => c.productId && c.size)
      : [];
    out.push({ giftProductId, giftSize, chosenProducts: chosen });
  }
  return out.length ? out : undefined;
}

function formatAddressForOwner(address) {
  if (address == null) return '';
  if (typeof address === 'object' && !Array.isArray(address)) {
    const parts = [
      address.line1,
      address.line2,
      address.line3,
      address.city,
      address.state,
      address.pincode,
      address.zip,
      address.country,
    ].filter(v => v != null && String(v).trim() !== '');
    return parts.map(String).join(', ');
  }
  return String(address);
}

// ✅ User places an order
export async function createOrder(req, res) {
  try {
    const {
      products,
      coupon,
      offer,
      totalPrice,
      paymentMode,
      address,
      phone,
      productImg,
      giftBundles,
      amountPayableNow,
      codAdvanceAmount,
      codAdvancePercent,
      codBalanceOnDelivery,
    } = req.body;
    const userEmail = req.user?.email;

    const productList = Array.isArray(products) ? products : [];
    const normalizedGifts = normalizeGiftBundles(giftBundles);

    if (!userEmail || totalPrice == null || !paymentMode) {
      return res.status(400).json({ message: "Missing required fields (totalPrice, paymentMode, auth)." });
    }
    if (productList.length === 0 && !normalizedGifts?.length) {
      return res.status(400).json({ message: "Provide products and/or giftBundles." });
    }

    const user = await User.findOne({ email: userEmail });
    if (!user) {
      return res.status(401).json({ message: "User not found." });
    }

    const cityFromAddress =
      address && typeof address === 'object' && !Array.isArray(address) ? address.city : undefined;

    // Generate a unique merchantOrderId for PhonePe
    const merchantOrderId = `ORDER_${Date.now()}`;

    const orderPayload = {
      products: productList,
      coupon,
      offer,
      totalPrice,
      paymentMode,
      merchantOrderId,
      productImg,
      paymentStatus: 'PENDING',
      owner: {
        name: user.name,
        email: user.email,
        phone: phone != null && String(phone).trim() !== '' ? String(phone).trim() : user.phone,
        city: cityFromAddress ?? user.city,
        address: formatAddressForOwner(address),
        userId: user._id,
      },
    };

    if (address && typeof address === 'object' && !Array.isArray(address)) {
      orderPayload.deliveryAddress = address;
    }

    if (normalizedGifts) {
      orderPayload.giftBundles = normalizedGifts;
    }

    if (amountPayableNow != null && !Number.isNaN(Number(amountPayableNow))) {
      orderPayload.amountPayableNow = Number(amountPayableNow);
    }
    if (codAdvanceAmount != null && !Number.isNaN(Number(codAdvanceAmount))) {
      orderPayload.codAdvanceAmount = Number(codAdvanceAmount);
    }
    if (codAdvancePercent != null && !Number.isNaN(Number(codAdvancePercent))) {
      orderPayload.codAdvancePercent = Number(codAdvancePercent);
    }
    if (codBalanceOnDelivery != null && !Number.isNaN(Number(codBalanceOnDelivery))) {
      orderPayload.codBalanceOnDelivery = Number(codBalanceOnDelivery);
    }

    const newOrder = new Order(orderPayload);

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

