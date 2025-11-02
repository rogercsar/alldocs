const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Cria client com service role para garantir acesso a information_schema
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders() };
  }
  if (event.httpMethod !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const params = event.queryStringParameters || {};
    const schema = params.schema || 'public';
    const table = params.table || null;
    const mode = params.mode || (table ? 'columns' : 'tables');

    if (mode === 'columns') {
      if (!table) return json({ error: 'Missing table parameter' }, 400);
      const { data, error } = await supabase
        .from('information_schema.columns')
        .select('column_name,data_type,is_nullable,ordinal_position')
        .eq('table_schema', schema)
        .eq('table_name', table)
        .order('ordinal_position');
      if (error) throw error;
      return json({ schema, table, columns: Array.isArray(data) ? data : [] });
    }

    // Lista tabelas do schema
    const { data: tables, error: tblErr } = await supabase
      .from('information_schema.tables')
      .select('table_name,table_type')
      .eq('table_schema', schema)
      .order('table_name');
    if (tblErr) throw tblErr;

    return json({ schema, tables: Array.isArray(tables) ? tables : [] });
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