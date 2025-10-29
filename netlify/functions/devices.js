const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Tabela esperada no Supabase:
// create table if not exists public.user_devices (
//   user_id uuid not null,
//   device_id text not null,
//   platform text,
//   label text,
//   last_seen timestamp with time zone default now(),
//   primary key (user_id, device_id)
// );
// -- Ative RLS se quiser, as functions usam service role.

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders() };
  }

  try {
    if (event.httpMethod === 'GET') {
      const { userId } = event.queryStringParameters || {};
      if (!userId) return json({ error: 'Missing userId' }, 400);

      const { count, error } = await supabase
        .from('user_devices')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      if (error) throw error;
      return json({ count: count || 0 }, 200);
    }

    if (event.httpMethod === 'POST') {
      if (!event.body) return json({ error: 'Missing body' }, 400);
      const body = JSON.parse(event.body);
      const userId = body?.userId;
      const deviceId = body?.deviceId;
      const platform = body?.platform || null;
      const label = body?.label || null;
      if (!userId || !deviceId) return json({ error: 'Missing userId or deviceId' }, 400);

      const payload = { user_id: userId, device_id: deviceId, platform, label, last_seen: new Date().toISOString() };
      const { error } = await supabase
        .from('user_devices')
        .upsert(payload, { onConflict: 'user_id,device_id' });
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: 'Method not allowed' }, 405);
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
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  };
}