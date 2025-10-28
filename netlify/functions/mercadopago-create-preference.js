const mercadopago = require('mercadopago');

const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

mercadopago.configure({ access_token: ACCESS_TOKEN });

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders() };
  }
  if (event.httpMethod !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }
  try {
    const payload = event.body ? JSON.parse(event.body) : {};
    const userId = payload.userId;
    const email = payload.email || undefined;
    const itemTitle = payload.itemTitle || 'AllDocs Premium - Pagamento Único';
    const price = typeof payload.price === 'number' ? payload.price : 19.9;

    if (!userId) return json({ error: 'Missing userId' }, 400);

    const preference = {
      items: [
        { title: itemTitle, quantity: 1, unit_price: price, currency_id: 'BRL' },
      ],
      payer: email ? { email } : undefined,
      back_urls: {
        success: process.env.SUCCESS_URL || 'https://your-app-success-url.example',
        failure: process.env.FAILURE_URL || 'https://your-app-failure-url.example',
        pending: process.env.PENDING_URL || 'https://your-app-pending-url.example',
      },
      auto_return: 'approved',
      notification_url: process.env.WEBHOOK_URL || `${process.env.URL}/.netlify/functions/pagamento-webhook`,
      metadata: { user_id: userId },
      external_reference: userId,
    };

    const { body } = await mercadopago.preferences.create(preference);
    return json({ id: body.id, init_point: body.init_point });
  } catch (e) {
    console.error(e);
    return json({ error: e.message }, 500);
  }
};

function json(payload, statusCode = 200) {
  return { statusCode, headers: corsHeaders(), body: JSON.stringify(payload) };
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
  };
}