const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'documents';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders() };
  }
  try {
    // Suporte GET (single) e POST (batch)
    if (event.httpMethod === 'POST') {
      const body = event.body ? JSON.parse(event.body) : {};
      const userId = body.userId;
      const appIds = Array.isArray(body.appIds) ? body.appIds.filter((x) => typeof x === 'number' || typeof x === 'string').map((x) => parseInt(x, 10)) : [];
      const ttlParam = body.ttl ? parseInt(body.ttl, 10) : 3600;
      const expiresSeconds = Math.min(Math.max(ttlParam, 300), 7 * 24 * 60 * 60);
      const intent = body.intent || 'download';
      if (!userId || (intent !== 'upload' && appIds.length === 0)) return json({ error: 'Missing userId or appIds' }, 400);

      // Enforcement de quota para uploads
      if (intent === 'upload') {
        const expectedBytes = Number(body.expectedBytes || 0);
        const { data: usageData, error: usageErr } = await supabase
          .from('usage_cache')
          .select('used_bytes')
          .eq('user_id', userId)
          .single();
        if (usageErr && usageErr.code !== 'PGRST116') throw usageErr;
        const usedBytes = usageData?.used_bytes || 0;

        const { data: quotaData, error: quotaErr } = await supabase
          .from('effective_quota_view')
          .select('effective_quota_bytes')
          .eq('user_id', userId)
          .single();
        if (quotaErr && quotaErr.code !== 'PGRST116') throw quotaErr;
        const defaultFreeQuota = 1 * 1024 * 1024 * 1024; // 1GB
        const effectiveQuotaBytes = quotaData?.effective_quota_bytes ?? defaultFreeQuota;

        if (expectedBytes > 0 && usedBytes + expectedBytes > effectiveQuotaBytes) {
          return json({ error: 'quota_exceeded', used_bytes: usedBytes, effective_quota_bytes: effectiveQuotaBytes }, 409);
        }
        return json({ allowed: true, used_bytes: usedBytes, effective_quota_bytes: effectiveQuotaBytes }, 200);
      }

      // Busca todos os paths de uma vez
      const { data, error } = await supabase
        .from('documents')
        .select('app_id, front_path, back_path')
        .eq('user_id', userId)
        .in('app_id', appIds);
      if (error) throw error;

      const map = {};
      const tasks = [];
      for (const row of (data || [])) {
        const appId = row.app_id;
        map[appId] = { frontSignedUrl: null, backSignedUrl: null };
        if (row.front_path) {
          tasks.push((async () => {
            const { data: signedFront, error: signErrF } = await supabase.storage
              .from(SUPABASE_BUCKET)
              .createSignedUrl(row.front_path, expiresSeconds);
            if (signErrF) throw signErrF;
            map[appId].frontSignedUrl = signedFront?.signedUrl || null;
          })());
        }
        if (row.back_path) {
          tasks.push((async () => {
            const { data: signedBack, error: signErrB } = await supabase.storage
              .from(SUPABASE_BUCKET)
              .createSignedUrl(row.back_path, expiresSeconds);
            if (signErrB) throw signErrB;
            map[appId].backSignedUrl = signedBack?.signedUrl || null;
          })());
        }
      }
      await Promise.all(tasks);
      return json(map);
    }

    // GET: single documento
    const params = event.queryStringParameters || {};
    const userId = params.userId;
    const appId = params.appId ? parseInt(params.appId, 10) : undefined;
    const ttlParam = params.ttl ? parseInt(params.ttl, 10) : 3600;
    const expiresSeconds = Math.min(Math.max(ttlParam, 300), 7 * 24 * 60 * 60);
    if (!userId || !appId) return json({ error: 'Missing userId or appId' }, 400);

    const { data, error } = await supabase
      .from('documents')
      .select('front_path, back_path')
      .eq('user_id', userId)
      .eq('app_id', appId)
      .limit(1);
    if (error) throw error;

    const doc = Array.isArray(data) ? data[0] : data;
    if (!doc) {
      return json({ frontSignedUrl: null, backSignedUrl: null }, 200);
    }

    let frontSignedUrl = null;
    let backSignedUrl = null;

    if (doc?.front_path) {
      const { data: signedFront, error: signErrF } = await supabase.storage
        .from(SUPABASE_BUCKET)
        .createSignedUrl(doc.front_path, expiresSeconds);
        if (signErrF) throw signErrF;
        frontSignedUrl = signedFront?.signedUrl || null;
    }

    if (doc?.back_path) {
      const { data: signedBack, error: signErrB } = await supabase.storage
        .from(SUPABASE_BUCKET)
        .createSignedUrl(doc.back_path, expiresSeconds);
        if (signErrB) throw signErrB;
        backSignedUrl = signedBack?.signedUrl || null;
    }

    return json({ frontSignedUrl, backSignedUrl });
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
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  };
}