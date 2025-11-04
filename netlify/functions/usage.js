const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'documents';

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

    if (usageError) {
      const code = usageError.code || '';
      const msg = usageError.message || '';
      const missingTable = code === '42P01' || msg.includes('Could not find the table') || (msg.includes('relation') && msg.includes('does not exist'));
      const noRows = code === 'PGRST116';
      if (!missingTable && !noRows) {
        return { statusCode: 500, body: JSON.stringify({ error: usageError.message }) };
      }
    }

    let usedBytes = usageData ? usageData.used_bytes : 0;

    // Fallback: se o cache estiver vazio/zero, calcula somando arquivos do bucket
    if (!usedBytes || usedBytes <= 0) {
      try {
        const { data: files, error: listErr } = await supabase.storage
          .from(SUPABASE_BUCKET)
          .list(userId, { limit: 1000, offset: 0, sortBy: { column: 'name', order: 'asc' } });
        if (!listErr && Array.isArray(files)) {
          const sum = files.reduce((acc, f) => acc + (typeof f.size === 'number' ? f.size : (f?.metadata?.size || 0)), 0);
          if (sum > 0) {
            usedBytes = sum;
            // Atualiza/sem cache para futuras consultas
            try {
              await supabase
                .from('usage_cache')
                .upsert({ user_id: userId, used_bytes: sum, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
            } catch {}
          }
        }
      } catch {}
    }

    const { data: quotaData, error: quotaError } = await supabase
      .from('effective_quota_view')
      .select('effective_quota_bytes')
      .eq('user_id', userId)
      .single();

    if (quotaError) {
      const code = quotaError.code || '';
      const msg = quotaError.message || '';
      const missingView = code === '42P01' || msg.includes('Could not find the table') || (msg.includes('relation') && msg.includes('does not exist'));
      const noRows = code === 'PGRST116';
      if (!missingView && !noRows) {
        return { statusCode: 500, body: JSON.stringify({ error: quotaError.message }) };
      }
    }

    // Determina base de quota por status premium quando a view não retorna valor
    const defaultFreeQuota = 1 * 1024 * 1024 * 1024; // 1GB
    const defaultPremiumQuota = 5 * 1024 * 1024 * 1024; // 5GB

    let effectiveQuotaBytes = quotaData ? quotaData.effective_quota_bytes : null;

    if (!effectiveQuotaBytes || effectiveQuotaBytes <= 0) {
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
      } catch {
        isPremium = false; // fallback seguro
      }

      // Soma de addons ativos
      let addonBytes = 0;
      try {
        const { data: addons, error: addonErr } = await supabase
          .from('storage_addons')
          .select('bytes, status')
          .eq('user_id', userId)
          .eq('status', 'active');
        if (addonErr) throw addonErr;
        if (Array.isArray(addons)) {
          addonBytes = addons.reduce((acc, a) => acc + (Number(a?.bytes) || 0), 0);
        }
      } catch {
        addonBytes = 0;
      }

      effectiveQuotaBytes = (isPremium ? defaultPremiumQuota : defaultFreeQuota) + addonBytes;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ used_bytes: usedBytes, effective_quota_bytes: effectiveQuotaBytes })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};