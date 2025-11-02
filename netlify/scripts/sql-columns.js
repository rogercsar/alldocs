require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[sql-columns] Faltam variáveis de ambiente. Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const table = process.argv[2] || 'documents';

(async () => {
  try {
    console.log(`[sql-columns] Descobrindo colunas da tabela '${table}' via SQL...`);
    
    // Usa uma query SQL direta para descobrir as colunas
    const { data, error } = await supabase
      .rpc('sql', {
        query: `
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = '${table}'
          ORDER BY ordinal_position;
        `
      });
    
    if (error) {
      console.log(`[sql-columns] Erro na query SQL:`, error.message);
      
      // Fallback: tenta descobrir via DESCRIBE ou similar
      const { data: descData, error: descError } = await supabase
        .rpc('sql', {
          query: `SELECT * FROM ${table} LIMIT 0;`
        });
      
      if (descError) {
        console.log(`[sql-columns] Erro no fallback:`, descError.message);
        
        // Último fallback: tenta uma query simples
        console.log(`[sql-columns] Tentando query simples na tabela...`);
        const { error: simpleError } = await supabase
          .from(table)
          .select('*')
          .limit(0);
        
        if (simpleError) {
          console.log(`[sql-columns] Tabela '${table}' não acessível:`, simpleError.message);
        } else {
          console.log(`[sql-columns] Tabela '${table}' existe e é acessível, mas não conseguimos listar as colunas.`);
        }
        return;
      }
      
      console.log(`[sql-columns] Fallback bem-sucedido, mas sem detalhes das colunas.`);
      return;
    }
    
    if (!data || data.length === 0) {
      console.log(`[sql-columns] Nenhuma coluna encontrada para a tabela '${table}'.`);
      return;
    }
    
    console.log(`[sql-columns] Colunas da tabela '${table}':`);
    console.log(JSON.stringify(data, null, 2));
    
  } catch (e) {
    console.error('[sql-columns] Erro:', e.message || String(e));
    process.exit(2);
  }
})();