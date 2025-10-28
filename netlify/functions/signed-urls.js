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
    const params = event.queryStringParameters || {};
    const userId = params.userId;
    const appId = params.appId ? parseInt(params.appId, 10) : undefined;
    if (!userId || !appId) return json({ error: 'Missing userId or appId' }, 400);

    const { data: doc, error } = await supabase
      .from('documents')
      .select('front_path, back_path')
      .eq('user_id', userId)
      .eq('app_id', appId)
      .single();
    if (error) throw error;

    let frontSignedUrl = null;
    let backSignedUrl = null;

    if (doc?.front_path) {
      const { data: signedFront, error: signErrF } = await supabase.storage
        .from(SUPABASE_BUCKET)
        .createSignedUrl(doc.front_path, 60 * 60);
      if (signErrF) throw signErrF;
      frontSignedUrl = signedFront?.signedUrl || null;
    }

    if (doc?.back_path) {
      const { data: signedBack, error: signErrB } = await supabase.storage
        .from(SUPABASE_BUCKET)
        .createSignedUrl(doc.back_path, 60 * 60);
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
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
  };
}