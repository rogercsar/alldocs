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

    const meta = payment?.metadata || {};
    const type = meta?.type || 'legacy';

    if (type === 'subscription') {
      const planId = meta.plan_id;
      // Se não houver plan_id, mantém comportamento legado
      if (!planId) {
        const { error: profErr } = await supabase
          .from('user_profiles')
          .update({ is_premium: true })
          .eq('id', userId);
        if (profErr) throw profErr;
      } else {
        const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data: existing, error: selErr } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('user_id', userId)
          .limit(1);
        if (selErr) throw selErr;

        if (Array.isArray(existing) && existing.length > 0) {
          const subId = existing[0].id;
          const { error: updErr } = await supabase
            .from('subscriptions')
            .update({ plan_id: planId, status: 'active', current_period_end: periodEnd, updated_at: new Date().toISOString() })
            .eq('id', subId);
          if (updErr) throw updErr;
        } else {
          const { error: insErr } = await supabase
            .from('subscriptions')
            .insert({ user_id: userId, plan_id: planId, status: 'active', current_period_end: periodEnd, created_at: new Date().toISOString() });
          if (insErr) throw insErr;
        }

        // Marca também o perfil como premium para compatibilidade com fluxos existentes
        const { error: profErr } = await supabase
          .from('user_profiles')
          .update({ is_premium: true })
          .eq('id', userId);
        if (profErr) throw profErr;
      }
    } else if (type === 'storage_addon') {
      const bytes = Number(meta.bytes || 0);
      if (bytes > 0) {
        const { error: addonErr } = await supabase
          .from('storage_addons')
          .insert({ user_id: userId, bytes, status: 'active', created_at: new Date().toISOString() });
        if (addonErr) throw addonErr;
      }
    } else {
      // Comportamento legado: apenas marca premium
      const { error: profErr } = await supabase
        .from('user_profiles')
        .update({ is_premium: true })
        .eq('id', userId);
      if (profErr) throw profErr;
    }

    return json({ ok: true, status: 'approved', type });
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