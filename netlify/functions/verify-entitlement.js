const { verifyProStatusByEmail } = require('./_lib/entitlements');

exports.handler = async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Missing STRIPE_SECRET_KEY env var' }) };
    }

    const priceId = process.env.STRIPE_PRICE_ID || '';
    const raw = event.body || '{}';
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const email = String(parsed?.email || '').trim();

    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
      return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Invalid email' }) };
    }

    const result = await verifyProStatusByEmail({ secretKey, priceId, email });
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(result) };
  } catch (err) {
    return { statusCode: err.status || 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: err.message || 'Verify error' }) };
  }
};

