const { findCustomerIdByEmail, getOrigin } = require('./_lib/entitlements');

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

exports.handler = async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Missing STRIPE_SECRET_KEY env var' }) };
    }

    const raw = event.body || '{}';
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const email = String(parsed?.email || '').trim();
    const returnUrl = String(parsed?.returnUrl || '').trim();

    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
      return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Invalid email' }) };
    }

    const base = returnUrl || getOrigin(event);
    const customerId = await findCustomerIdByEmail(secretKey, email);
    if (!customerId) {
      return { statusCode: 404, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Customer not found' }) };
    }

    const portal = await stripePostForm(secretKey, '/billing_portal/sessions', {
      customer: customerId,
      return_url: `${base.replace(/\\/$/, '')}`,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: portal.url }),
    };
  } catch (err) {
    return {
      statusCode: err.status || 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || 'Portal error' }),
    };
  }
};

