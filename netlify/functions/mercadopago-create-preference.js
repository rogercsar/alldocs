const { MercadoPagoConfig, Preference } = require('mercadopago');
const { createClient } = require('@supabase/supabase-js');

const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders() };
  }
  if (event.httpMethod !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }
  try {
    if (!ACCESS_TOKEN) {
      throw new Error('Missing MP_ACCESS_TOKEN environment variable');
    }
    const client = new MercadoPagoConfig({ accessToken: ACCESS_TOKEN });
    const preferenceApi = new Preference(client);

    const { planId } = JSON.parse(event.body);
    if (!planId) {
      return json({ error: 'Missing planId' }, 400);
    }
    const token = event.headers.authorization.split(' ')[1];
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError) {
      return json({ error: 'Invalid token' }, 401);
    }
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('id', planId)
      .single();
    if (planError || !plan) {
      return json({ error: 'Plan not found' }, 404);
    }

    const preference = {
      items: [
        { title: plan.name, quantity: 1, unit_price: plan.price_month, currency_id: 'BRL' },
      ],
      payer: { email: user.email },
      back_urls: {
        success: process.env.SUCCESS_URL || 'https://your-app-success-url.example',
        failure: process.env.FAILURE_URL || 'https://your-app-failure-url.example',
        pending: process.env.PENDING_URL || 'https://your-app-pending-url.example',
      },
      auto_return: 'approved',
      notification_url: process.env.WEBHOOK_URL || `${process.env.URL}/.netlify/functions/pagamento-webhook`,
      metadata: { user_id: user.id, plan_id: plan.id },
      external_reference: user.id,
    };

    const result = await preferenceApi.create({ body: preference });
    return json({ id: result.id, init_point: result.init_point });
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