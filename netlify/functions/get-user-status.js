const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders() };
  }
  if (event.httpMethod !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }
  try {
    const { userId } = event.queryStringParameters || {};
    if (!userId || userId === 'anonymous') {
      return json({ id: userId || null, is_premium: false }, 200);
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, is_premium')
      .eq('id', userId)
      .limit(1);

    if (error) {
      return json({ error: error.message }, 500);
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      // Perfil ainda não existe, considerar não-premium
      return json({ id: userId, is_premium: false }, 200);
    }

    return json({ id: row.id || userId, is_premium: !!row.is_premium });
  } catch (e) {
    console.error(e);
    return json({ error: e.message || String(e) }, 500);
  }
};

function json(payload, statusCode = 200) {
  return { statusCode, headers: corsHeaders(), body: JSON.stringify(payload) };
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
  };
}