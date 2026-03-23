const crypto = require('crypto');

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifyStripeWebhookSignature({ secret, signatureHeader, payload }) {
  if (!signatureHeader) return false;
  if (!secret) return false;

  // Header looks like: t=149...,v1=5e...,v1=...
  const parts = signatureHeader.split(',').map((p) => p.trim());
  let timestamp = null;
  const providedSigs = [];

  for (const part of parts) {
    if (part.startsWith('t=')) {
      timestamp = part.slice(2);
    } else if (part.startsWith('v1=')) {
      providedSigs.push(part.slice(3));
    }
  }

  if (!timestamp || !providedSigs.length) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const expectedSig = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  return providedSigs.some((sig) => timingSafeEqual(sig, expectedSig));
}

exports.handler = async function handler(event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sigHeader =
    event?.headers?.['stripe-signature'] ||
    event?.headers?.['Stripe-Signature'] ||
    event?.headers?.['STRIPE-SIGNATURE'];

  const payload = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8')
    : event.body || '';

  const ok = verifyStripeWebhookSignature({ secret, signatureHeader: sigHeader, payload });
  if (!ok) {
    return { statusCode: 400, body: 'Invalid Stripe signature' };
  }

  let evt;
  try {
    evt = JSON.parse(payload);
  } catch {
    return { statusCode: 400, body: 'Invalid payload JSON' };
  }

  // We currently verify entitlement on demand from Stripe (no persistent store),
  // but keeping the webhook endpoint lets Stripe validate lifecycle events cleanly.
  // You can later expand this to write to a KV store / database.
  console.log('Stripe webhook received:', evt.type);

  return { statusCode: 200, body: 'ok' };
};

