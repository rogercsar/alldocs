const { createClient } = require('@supabase/supabase-js');
const mercadopago = require('mercadopago');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
mercadopago.configure({ access_token: MP_ACCESS_TOKEN });

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders() };
  }
  if (event.httpMethod !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const paymentId = body?.data?.id || body?.id;
    if (!paymentId) return json({ error: 'Invalid payload' }, 400);

    // Obtém detalhes do pagamento no Mercado Pago
    const { response } = await mercadopago.payment.get(paymentId);
    const payment = response;
    const status = payment?.status;
    const userId = payment?.metadata?.user_id || payment?.external_reference;

    if (!userId) return json({ error: 'Missing user_id metadata' }, 400);
    if (status !== 'approved') return json({ ok: true, status }, 200);

    const { error } = await supabase
      .from('user_profiles')
      .update({ is_premium: true })
      .eq('id', userId);
    if (error) throw error;

    return json({ ok: true, status: 'approved' });
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