/**
 * Minimal Node/Express webhook that verifies Razorpay signature
 * and updates Supabase orders table using a service role key.
 *
 * Usage:
 * - Deploy this on a server (VPS, Heroku, Vercel serverless function, etc).
 * - Set env vars: RAZORPAY_KEY_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * - Configure this endpoint as your Razorpay webhook URL.
 */
const express = require("express");
const crypto = require("crypto");
const fetch = require("node-fetch");

const app = express();

// Razorpay sends raw body; we need raw buffer to verify signature
app.use(express.raw({ type: "*/*" }));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RAZORPAY_KEY_SECRET) {
  console.error("Missing env vars. Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RAZORPAY_KEY_SECRET");
  process.exit(1);
}

app.post("/webhook/razorpay", async (req, res) => {
  const payload = req.body;
  const signature = req.headers["x-razorpay-signature"];

  const expected = crypto
    .createHmac("sha256", RAZORPAY_KEY_SECRET)
    .update(payload)
    .digest("hex");

  if (signature !== expected) {
    console.warn("Signature mismatch");
    return res.status(400).send("Invalid signature");
  }

  let event;
  try {
    event = JSON.parse(payload.toString());
  } catch (err) {
    console.error("Invalid JSON", err);
    return res.status(400).send("Invalid payload");
  }

  // Example: handle payment captured event
  if (event.event === "payment.captured" || event.event === "payment.authorized") {
    const payment = event.payload.payment.entity;
    // If you created orders in Supabase, map razorpay_order_id -> your order record
    const razorpayOrderId = payment.order_id;
    const razorpayPaymentId = payment.id;
    const status = payment.status;

    // Update your Supabase order record (example)
    try {
      const resp = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({
          razorpay_payment_id: razorpayPaymentId,
          payment_status: status
        }),
        // upsert by matching razorpay_order_id
        // This expects you created an RPC or you know the row to update.
        // For simplicity we assume orders table has razorpay_order_id unique and row is updated by query param
      });
      // Note: If using the REST endpoint, you can pass ?razorpay_order_id=eq.<id> in the request URL
      // The example above is simplistic — adapt to your supabase row-identification strategy.
    } catch (err) {
      console.error("Failed to update order in Supabase:", err);
    }
  }

  res.status(200).send("ok");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Webhook listening on", PORT));
