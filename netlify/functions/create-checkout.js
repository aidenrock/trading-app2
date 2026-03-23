const { getOrigin } = require('./_lib/entitlements');

const API_BASE = 'https://api.stripe.com/v1';

function asJson(res) {
  return res.text().then((t) => {
    try {
      return JSON.parse(t);
    } catch {
      return { raw: t };
    }
  });
}

async function stripePostForm(secretKey, path, params) {
  const body = new URLSearchParams(params).toString();
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const data = await asJson(res);
  if (!res.ok) {
    const err = new Error(data?.error?.message || `Stripe error (${res.status})`);
    err.status = res.status;
    err.stripe = data;
    throw err;
  }
  return data;
}

function getBaseUrl(event) {
  const explicit = event?.body ? null : null; // keep structure simple
  return explicit || getOrigin(event);
}

exports.handler = async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const priceId = process.env.STRIPE_PRICE_ID;
    if (!secretKey || !priceId) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing STRIPE_SECRET_KEY or STRIPE_PRICE_ID env vars' }),
      };
    }

    const raw = event.body || '{}';
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const email = String(parsed?.email || '').trim();
    const returnUrl = String(parsed?.returnUrl || '').trim();

    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
      return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Invalid email' }) };
    }

    const base = returnUrl ? returnUrl.replace(/\\/$/, '') : getBaseUrl(event);
    const successQuery = process.env.STRIPE_SUCCESS_QUERY || 'pro=success';
    const cancelQuery = process.env.STRIPE_CANCEL_QUERY || 'pro=cancel';
    const success_url = `${base}/?${successQuery}`;
    const cancel_url = `${base}/?${cancelQuery}`;

    const session = await stripePostForm(secretKey, '/checkout/sessions', {
      mode: 'subscription',
      customer_email: email,
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      success_url,
      cancel_url,
      'metadata[email]': email,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: session.id, url: session.url }),
    };
  } catch (err) {
    return {
      statusCode: err.status || 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || 'Checkout error' }),
    };
  }
};

