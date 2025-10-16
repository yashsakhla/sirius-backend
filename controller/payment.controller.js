import axios from 'axios';
import { v4 as uuidv4 } from 'uuid'; // For unique orderId, install with: npm install uuid
import { updatePaymentStatus, updatePaymentStatusByMerchantOrderId } from './order.controller';

export async function getAuthToken() {
  const params = new URLSearchParams();
  params.append('client_id', process.env.PHONEPE_CLIENT_ID);
  params.append('client_secret', process.env.PHONEPE_CLIENT_SECRET);
  params.append('grant_type', 'client_credentials');
  params.append('client_version', '1');

  const response = await axios.post(
    'https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token',
    params.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  return response.data.access_token;
}

export async function createPhonePePayment(req, res) {
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
}

export async function verifyWebhookAuth(req, res) {
  try {
    const authHeader = req.headers['authorization'];
    const expectedAuth = process.env.WEBHOOK_AUTH_HEADER;

    if (!authHeader || authHeader !== expectedAuth) {
      return res.status(401).json({ error: "Unauthorized webhook request" });
    }

    const { merchantOrderId, paymentStatus, transactionId } = req.body;

    if (!merchantOrderId || !paymentStatus) {
      return res.status(400).json({ error: "Invalid webhook payload" });
    }

    // call refactored service function
    const updatedOrder = await updatePaymentStatusByMerchantOrderId(
      merchantOrderId,
      paymentStatus === "SUCCESS" || paymentStatus === "COMPLETED" ? "CONFIRMED" : "FAILED",
      transactionId
    );

    return res.status(200).send("Webhook received and order updated");

  } catch (error) {
    console.error("Webhook handler error:", error);
    return res.status(500).send("Internal Server Error");
  }
}

