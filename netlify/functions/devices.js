const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FREE_DEVICE_LIMIT = parseInt(process.env.FREE_DEVICE_LIMIT || '2', 10);
const PREMIUM_DEVICE_LIMIT = parseInt(process.env.PREMIUM_DEVICE_LIMIT || '0', 10); // 0 = ilimitado
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
      const { userId, mode } = event.queryStringParameters || {};
      if (!userId) return json({ error: 'Missing userId' }, 400);

      if (mode === 'list') {
        const { data, error } = await supabase
          .from('user_devices')
          .select('device_id, platform, label, last_seen')
          .eq('user_id', userId)
          .order('last_seen', { ascending: false });
        if (error) throw error;
        return json({ devices: Array.isArray(data) ? data : [], count: Array.isArray(data) ? data.length : 0 }, 200);
      }

      const { count, error } = await supabase
        .from('user_devices')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      if (error) throw error;

      // Determina se é premium para ajustar o limite
      let isPremium = false;
      try {
        const { data: prof, error: profErr } = await supabase
          .from('user_profiles')
          .select('is_premium')
          .eq('id', userId)
          .limit(1);
        if (profErr) throw profErr;
        const row = Array.isArray(prof) ? prof[0] : prof;
        isPremium = !!row?.is_premium;
      } catch {}

      // Premium: usa PREMIUM_DEVICE_LIMIT se > 0; caso contrário, ilimitado (null)
      const limit = isPremium ? (PREMIUM_DEVICE_LIMIT > 0 ? PREMIUM_DEVICE_LIMIT : null) : FREE_DEVICE_LIMIT;
      return json({ count: count || 0, limit, is_premium: isPremium }, 200);
    }

    if (event.httpMethod === 'POST') {
      if (!event.body) return json({ error: 'Missing body' }, 400);
      const body = JSON.parse(event.body);
      const userId = body?.userId;
      const deviceId = body?.deviceId;
      const platform = body?.platform || null;
      const label = body?.label || null;
      if (!userId || !deviceId) return json({ error: 'Missing userId or deviceId' }, 400);

      // Verifica plano do usuário para limitar dispositivos no freemium
      let isPremium = false;
      try {
        const { data: prof, error: profErr } = await supabase
          .from('user_profiles')
          .select('is_premium')
          .eq('id', userId)
          .limit(1);
        if (profErr) throw profErr;
        const row = Array.isArray(prof) ? prof[0] : prof;
        isPremium = !!row?.is_premium;
      } catch (e) {
        // Se falhar a leitura do perfil, assume freemium para segurança
        isPremium = false;
      }

      // Impede registrar um novo dispositivo além do limite configurado
      // Freemium: usa FREE_DEVICE_LIMIT; Premium: usa PREMIUM_DEVICE_LIMIT quando > 0
      const limitToEnforce = !isPremium ? FREE_DEVICE_LIMIT : (PREMIUM_DEVICE_LIMIT > 0 ? PREMIUM_DEVICE_LIMIT : null);
      if (limitToEnforce != null) {
        const { data: existingRows, error: existErr } = await supabase
          .from('user_devices')
          .select('device_id')
          .eq('user_id', userId)
          .eq('device_id', deviceId)
          .limit(1);
        if (existErr) throw existErr;

        const alreadyRegistered = Array.isArray(existingRows) && existingRows.length > 0;
        const { count: currentCount, error: countErr } = await supabase
          .from('user_devices')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);
        if (countErr) throw countErr;

        if (!alreadyRegistered && (currentCount || 0) >= limitToEnforce) {
          return json({ error: 'device_limit_reached', limit: limitToEnforce }, 409);
        }
      }

      const payload = { user_id: userId, device_id: deviceId, platform, label, last_seen: new Date().toISOString() };
      const { error } = await supabase
        .from('user_devices')
        .upsert(payload, { onConflict: 'user_id,device_id' });
      if (error) throw error;
      return json({ ok: true });
    }

    if (event.httpMethod === 'DELETE') {
      if (!event.body) return json({ error: 'Missing body' }, 400);
      const body = JSON.parse(event.body);
      const userId = body?.userId;
      const deviceId = body?.deviceId;
      if (!userId || !deviceId) return json({ error: 'Missing userId or deviceId' }, 400);
      const { error } = await supabase
        .from('user_devices')
        .delete()
        .eq('user_id', userId)
        .eq('device_id', deviceId);
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
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  };
}