const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const BASE_URL = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:8888';

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const body = JSON.parse(event.body || '{}');
    const { plan_id, user_id } = body;

    if (!plan_id || !user_id) {
      return { statusCode: 400, body: JSON.stringify({ error: 'plan_id and user_id are required' }) };
    }

    const { data: plan, error } = await supabase
      .from('plans')
      .select('id, name, price_month')
      .eq('id', plan_id)
      .eq('is_active', true)
      .single();

    if (error || !plan) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Plan not found or inactive' }) };
    }

    const mpRes = await fetch(`${BASE_URL}/.netlify/functions/mercadopago-create-preference`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `Assinatura EVDocs - ${plan.name}`,
        price: Number(plan.price_month),
        metadata: { type: 'subscription', plan_id: plan.id, user_id }
      })
    });

    const pref = await mpRes.json();

    return { statusCode: 200, body: JSON.stringify({ preference: pref }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};