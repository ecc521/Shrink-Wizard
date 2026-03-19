const functions = require("firebase-functions");
const admin = require("firebase-admin");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const crypto = require("crypto");

admin.initializeApp();

// Generate a random 16-character license key format: SW-XXXX-XXXX-XXXX-XXXX
function generatePasskey() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let key = "SW-";
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    if (i < 3) key += "-";
  }
  return key;
}

exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    // Verify the webhook is actually from our Stripe account
    event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
  } catch (err) {
    functions.logger.error("Webhook signature verification failed", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle successful checkout
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const customerEmail = session.customer_details?.email;
    const checkoutId = session.id;
    
    // 1. Generate the base license string
    const licenseKey = generatePasskey();
    
    // 2. Cryptographically sign the license using Ed25519 (Offline Verification)
    // The private key must be safely stored in Google Cloud Secret Manager or Firebase env vars
    let signatureHex = "MOCK_SIGNATURE";
    if (process.env.LICENSE_PRIVATE_KEY) {
       try {
         const privateKey = crypto.createPrivateKey({
           key: Buffer.from(process.env.LICENSE_PRIVATE_KEY, 'base64'),
           format: 'der',
           type: 'pkcs8'
         });
         signatureHex = crypto.sign(null, Buffer.from(licenseKey), privateKey).toString('hex');
       } catch (e) {
         functions.logger.error("Failed to sign license key. Check your env var format.", e);
       }
    }

    // 3. Store in Firestore
    const db = admin.firestore();
    await db.collection("licenses").doc(licenseKey).set({
      email: customerEmail,
      signature: signatureHex,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      stripeCheckoutId: checkoutId,
      status: "active"
    });

    functions.logger.info(`Successfully generated and stored License Key: ${licenseKey} for ${customerEmail}`);

    // TODO: Depending on the merchant setup, integrate Postmark or Firebase Extensions 
    // to actually email the generated licenseKey and signatureHex to customerEmail.
  }

  res.json({received: true});
});
