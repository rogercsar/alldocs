const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function toSafeAppId(input) {
  const MAX = 2147483647;
  if (typeof input === 'number') {
    if (Number.isFinite(input) && input > 0 && input <= MAX) return input;
    input = String(input);
  }
  const s = String(input || '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  const res = Math.abs(h) % MAX;
  return res || 1;
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders() };
  }
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { id, name, number, frontPath, backPath, userId } = body;

    if (!userId || typeof userId !== 'string') {
      return json({ error: 'Missing or invalid userId' }, 400);
    }

    if (event.httpMethod === 'POST') {
      const appId = toSafeAppId(id);
      if (!Number.isFinite(appId)) return json({ error: 'Invalid app_id' }, 400);

      // Upsert manual por (app_id, user_id) para evitar sobrescrita por constraint incorreta
      const { data: existing, error: selErr } = await supabase
        .from('documents')
        .select('id')
        .eq('app_id', appId)
        .eq('user_id', userId)
        .limit(1);
      if (selErr) throw selErr;

      const payload = {
        name,
        number,
        front_path: frontPath || null,
        back_path: backPath || null,
        updated_at: new Date().toISOString(),
      };

      if (Array.isArray(existing) && existing.length > 0) {
        const rowId = existing[0].id;
        const { error: updErr } = await supabase
          .from('documents')
          .update(payload)
          .eq('id', rowId);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase
          .from('documents')
          .insert({ app_id: appId, user_id: userId, ...payload });
        if (insErr) throw insErr;
      }
      return json({ ok: true });
    }

    if (event.httpMethod === 'DELETE') {
      const appId = toSafeAppId(id);
      if (!Number.isFinite(appId)) return json({ error: 'Invalid app_id' }, 400);
      const { data, error } = await supabase
        .from('documents')
        .delete()
        .eq('app_id', appId)
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