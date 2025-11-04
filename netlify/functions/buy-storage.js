const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const BASE_URL = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:8888';

const ADDON_PLANS = [
  { id: 'addon_10gb', name: '+10GB de Armazenamento', price: 19.90, bytes: 10 * 1024 * 1024 * 1024 },
  { id: 'addon_50gb', name: '+50GB de Armazenamento', price: 79.90, bytes: 50 * 1024 * 1024 * 1024 },
];

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const body = JSON.parse(event.body || '{}');
    const { addon_id, user_id } = body;

    if (!addon_id || !user_id) {
      return { statusCode: 400, body: JSON.stringify({ error: 'addon_id and user_id are required' }) };
    }

    const addon = ADDON_PLANS.find(p => p.id === addon_id);
    if (!addon) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Add-on not found' }) };
    }

    const mpRes = await fetch(`${BASE_URL}/.netlify/functions/mercadopago-create-preference`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `EVDocs - ${addon.name}`,
        price: addon.price,
        metadata: { type: 'storage_addon', addon_id: addon.id, user_id, bytes: addon.bytes }
      })
    });

    const pref = await mpRes.json();

    return { statusCode: 200, body: JSON.stringify({ preference: pref }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};