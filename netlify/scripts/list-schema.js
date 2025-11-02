#!/usr/bin/env node
/*
  Lista o schema do Supabase: tabelas do schema público e colunas.
  Uso:
    node scripts/list-schema.js            -> lista tabelas em 'public'
    node scripts/list-schema.js documents  -> lista colunas da tabela 'documents'
    node scripts/list-schema.js <tabela> <schema>  -> lista colunas da tabela no schema especificado

  Requer variáveis de ambiente:
    - SUPABASE_URL
    - SUPABASE_SERVICE_ROLE_KEY (recomendado) OU SUPABASE_ANON_KEY (limitado)
*/
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || (!SERVICE_KEY && !ANON_KEY)) {
  console.error('[list-schema] Faltam variáveis de ambiente. Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const keyInUse = SERVICE_KEY || ANON_KEY;
const supabase = createClient(SUPABASE_URL, keyInUse);

const args = process.argv.slice(2);
const table = args[0] || null;
const schema = args[1] || 'public';

(async () => {
  try {
    if (table) {
      // Tenta usar SQL direto para obter colunas
      const { data, error } = await supabase.rpc('get_table_columns', { 
        table_name: table, 
        schema_name: schema 
      });
      
      if (error) {
        // Fallback: tenta uma query SQL simples
        const { data: fallbackData, error: fallbackError } = await supabase
          .from(table)
          .select('*')
          .limit(0);
        
        if (fallbackError) {
          console.log(JSON.stringify({ 
            schema, 
            table, 
            error: `Não foi possível acessar a tabela '${table}': ${fallbackError.message}`,
            suggestion: "Verifique se a tabela existe e se você tem permissões adequadas"
          }, null, 2));
          return;
        }
        
        console.log(JSON.stringify({ 
          schema, 
          table, 
          message: "Tabela existe mas não foi possível listar colunas detalhadas",
          note: "Use o Supabase Dashboard para ver o schema completo"
        }, null, 2));
        return;
      }
      
      console.log(JSON.stringify({ schema, table, columns: data || [] }, null, 2));
      return;
    }

    // Lista tabelas do schema público
    const { data: tables, error: tblErr } = await supabase
      .from('information_schema.tables')
      .select('table_name,table_type')
      .eq('table_schema', schema)
      .order('table_name');
      
    if (tblErr) {
      // Fallback: tenta listar algumas tabelas conhecidas
      const knownTables = ['documents', 'user_profiles', 'user_devices'];
      const existingTables = [];
      
      for (const tableName of knownTables) {
        try {
          const { error: testError } = await supabase
            .from(tableName)
            .select('*')
            .limit(0);
          if (!testError) {
            existingTables.push({ table_name: tableName, table_type: 'BASE TABLE' });
          }
        } catch {}
      }
      
      console.log(JSON.stringify({ 
        schema, 
        tables: existingTables,
        note: "Lista parcial - algumas tabelas podem não estar visíveis"
      }, null, 2));
      return;
    }

    console.log(JSON.stringify({ schema, tables: tables || [] }, null, 2));
  } catch (e) {
    console.error('[list-schema] Erro:', e.message || String(e));
    process.exit(2);
  }
})();