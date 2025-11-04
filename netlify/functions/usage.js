const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const params = event.queryStringParameters || {};
    const userId = params.user_id || event.headers['x-user-id'];
    if (!userId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'user_id is required' }) };
    }

    const { data: usageData, error: usageError } = await supabase
      .from('usage_cache')
      .select('used_bytes')
      .eq('user_id', userId)
      .single();

    if (usageError && usageError.code !== 'PGRST116') {
      return { statusCode: 500, body: JSON.stringify({ error: usageError.message }) };
    }

    const usedBytes = usageData ? usageData.used_bytes : 0;

    const { data: quotaData, error: quotaError } = await supabase
      .from('effective_quota_view')
      .select('effective_quota_bytes')
      .eq('user_id', userId)
      .single();

    if (quotaError && quotaError.code !== 'PGRST116') {
      return { statusCode: 500, body: JSON.stringify({ error: quotaError.message }) };
    }

    const defaultFreeQuota = 1 * 1024 * 1024 * 1024; // 1GB
    const effectiveQuotaBytes = quotaData ? quotaData.effective_quota_bytes : defaultFreeQuota;

    return {
      statusCode: 200,
      body: JSON.stringify({ used_bytes: usedBytes, effective_quota_bytes: effectiveQuotaBytes })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};