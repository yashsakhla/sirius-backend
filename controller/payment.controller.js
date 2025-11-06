import axios from 'axios';


export async function getAuthToken() {
  const params = new URLSearchParams();
  params.append('client_id', process.env.PHONEPE_CLIENT_ID);
  params.append('client_secret', process.env.PHONEPE_CLIENT_SECRET);
  params.append('grant_type', 'client_credentials');
  params.append('client_version', '1');

  const response = await axios.post(
    'https://api.phonepe.com/apis/identity-manager/v1/oauth/token',
    params.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  return response.data.access_token;
}

export async function getPhonePeToken(req, res) {
  try {
    const { totalPrice, merchantOrderId } = req.body;
    const token = await getAuthToken();
    const tokenResponse = await axios.post(
      "https://api.phonepe.com/apis/pg/checkout/v2/pay",
      {
        merchantId: process.env.PHONEPE_MERCHANT_ID,
        merchantOrderId,
        amount: totalPrice * 100,
        paymentFlow: {
          type: "PG_CHECKOUT",
          message: "Payment for Sirius Perfumes Order",
          merchantUrls: {
            redirectUrl: "https://www.siriusperfumes.com/payment-success"
          }
        }
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `O-Bearer ${token}`
        }
      }
    );

    return res.json({
      token: token, // this is what PhonePe iframe needs
      redirectUrl: tokenResponse.data?.redirectUrl,
      data: tokenResponse.data
    });
  } catch (err) {
    console.error(err.response?.data || err.message);
    return res.status(500).json({ error: "Failed to generate token" });
  }
}

export async function getPaymentStatus(merchantOrderId, token) {
  try {
    if (!merchantOrderId) {
      return { error: "Missing merchantOrderId" };
    }
    const response = await axios.get(
      `	https://api.phonepe.com/apis/pg/checkout/v2/order/${merchantOrderId}/status`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `O-Bearer ${token}`,
          "X-Merchant-Id": process.env.PHONEPE_MERCHANT_ID
        }
      }
    );

    return response.data;
  } catch (err) {
    return err.response?.data || err.message;
  }
}
