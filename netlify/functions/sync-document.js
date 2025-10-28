const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders() };
  }
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { id, name, number, frontPath, backPath, userId } = body;

    if (event.httpMethod === 'POST') {
      const { data, error } = await supabase
        .from('documents')
        .upsert({
          app_id: id,
          user_id: userId,
          name,
          number,
          front_path: frontPath || null,
          back_path: backPath || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'app_id,user_id' });
      if (error) throw error;
      return json({ ok: true });
    }

    if (event.httpMethod === 'DELETE') {
      const { data, error } = await supabase
        .from('documents')
        .delete()
        .eq('app_id', id)
        .eq('user_id', userId);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: 'Method not allowed' }, 405);
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
    'Access-Control-Allow-Methods': 'POST,DELETE,OPTIONS',
  };
}