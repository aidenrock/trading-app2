const API_BASE = 'https://api.stripe.com/v1';

function getOrigin(event) {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, '');
  const origin = event?.headers?.origin;
  if (origin) return origin.replace(/\/$/, '');
  const host = event?.headers?.host;
  const proto = event?.headers?.['x-forwarded-proto'] || 'https';
  if (host) return `${proto}://${host}`.replace(/\/$/, '');
  return '';
}

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

async function stripeGet(secretKey, path, query) {
  const qs = query ? `?${new URLSearchParams(query).toString()}` : '';
  const res = await fetch(`${API_BASE}${path}${qs}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${secretKey}` },
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

async function findCustomerIdByEmail(secretKey, email) {
  // Stripe Search API: https://stripe.com/docs/api/customers/search
  const query = `email:"${email}"`;
  const result = await stripePostForm(secretKey, '/customers/search', { query, limit: '1' });
  const customer = result?.data?.[0];
  return customer?.id || null;
}

async function verifyProStatusByEmail({ secretKey, priceId, email }) {
  const customerId = await findCustomerIdByEmail(secretKey, email);
  if (!customerId) return { isPro: false, status: 'no_customer' };

  const subs = await stripeGet(secretKey, '/subscriptions', {
    customer: customerId,
    status: 'active',
    limit: '5',
  });

  const activeSubs = subs?.data || [];
  if (!activeSubs.length) return { isPro: false, status: 'no_active_subscription' };

  // If multiple tiers exist, only unlock when the subscription includes the expected price.
  if (priceId) {
    const matching = activeSubs.find((s) => s?.items?.data?.some((it) => it?.price?.id === priceId));
    if (!matching) return { isPro: false, status: 'wrong_price' };
    return { isPro: true, status: 'active', subscriptionId: matching.id };
  }

  return { isPro: true, status: 'active', subscriptionId: activeSubs[0].id };
}

module.exports = {
  getOrigin,
  verifyProStatusByEmail,
  findCustomerIdByEmail,
};

