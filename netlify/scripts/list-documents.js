require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[list-documents] Faltam variáveis de ambiente. Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('id,app_id,user_id,name,number,updated_at')
      .order('updated_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('[list-documents] Erro:', e.message || String(e));
    process.exit(2);
  }
})();