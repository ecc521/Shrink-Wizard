const functions = require("firebase-functions");
const admin = require("firebase-admin");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const crypto = require("crypto");

admin.initializeApp();
const db = admin.firestore();

// Helper to generate a classic cryptographically secure 16-character block key (XXXX-XXXX-XXXX-XXXX)
function generateLicenseKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let key = '';
  for (let i = 0; i < 16; i++) {
    if (i > 0 && i % 4 === 0) key += '-';
    key += chars.charAt(crypto.randomInt(chars.length));
  }
  return key;
}

// The secret key to verify the webhook actually came from Stripe
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
  } catch (err) {
    functions.logger.error("⚠️ Webhook signature verification failed.", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle a successful Pro License checkout
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    
    // Generate a classic 16-character License Key
    const newLicenseKey = generateLicenseKey();

    try {
      await db.collection("licenses").doc(newLicenseKey).set({
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        stripeSessionId: session.id,
        customerEmail: session.customer_details?.email || null,
        activations: 0,
        maxActivations: 5,
        isActive: true
      });
      functions.logger.info(`✅ Generated new 5-device license key: ${newLicenseKey} for ${session.customer_details?.email}`);
      
      // Note: Make sure your Stripe product uses Stripe's built-in customer emails 
      // or set up an email sender here (e.g. SendGrid/Resend) to email the customer their `newLicenseKey`.

    } catch (dbErr) {
      functions.logger.error("❌ Failed to save license to Firestore", dbErr);
      return res.status(500).send("Database Error");
    }
  }

  res.status(200).send("Success");
});

// Secure endpoint for the frontend to activate a license on a specific machine
exports.activateLicense = functions.https.onCall(async (data, context) => {
  const { licenseKey, machineId } = data;

  if (!licenseKey || !machineId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing licenseKey or machineId');
  }

  const licenseRef = db.collection("licenses").doc(licenseKey);
  
  return db.runTransaction(async (transaction) => {
    const doc = await transaction.get(licenseRef);

    if (!doc.exists || doc.data().isActive === false) {
      throw new functions.https.HttpsError('not-found', 'invalid-key');
    }

    const license = doc.data();
    const activeMachines = license.activeMachines || [];

    // If this machine is already registered on this key, return success (idempotent, no cost)
    if (activeMachines.includes(machineId)) {
      return { success: true, message: 'Already activated on this device.' };
    }

    // Checking the 5 device limit
    if (license.activations >= license.maxActivations) {
      throw new functions.https.HttpsError('resource-exhausted', 'limit-reached');
    }

    // It is a new machine and we have slots left. Increment and link.
    transaction.update(licenseRef, {
      activations: admin.firestore.FieldValue.increment(1),
      activeMachines: admin.firestore.FieldValue.arrayUnion(machineId)
    });

    return { success: true, message: 'License activated successfully.' };
  });
});
