require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[discover-columns] Faltam variáveis de ambiente. Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const table = process.argv[2] || 'documents';

(async () => {
  try {
    console.log(`[discover-columns] Descobrindo colunas da tabela '${table}'...`);
    
    // Tenta fazer uma query que retorna 1 linha para descobrir as colunas
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(1);
    
    if (error) {
      console.error(`[discover-columns] Erro ao acessar tabela '${table}':`, error.message);
      process.exit(2);
    }
    
    if (!data || data.length === 0) {
      console.log(`[discover-columns] Tabela '${table}' está vazia. Tentando inserir um registro de teste...`);
      
      // Tenta inserir um registro mínimo para descobrir quais campos são obrigatórios
      const testRecord = {
        user_id: '00000000-0000-0000-0000-000000000000', // UUID de teste
        name: 'test-discovery',
        number: 'TEST-001',
        front_path: '/test/front.jpg',
        back_path: '/test/back.jpg'
      };
      
      const { data: insertData, error: insertError } = await supabase
        .from(table)
        .insert(testRecord)
        .select();
      
      if (insertError) {
        console.log(`[discover-columns] Erro ao inserir registro de teste:`, insertError.message);
        console.log(`[discover-columns] Isso nos ajuda a entender quais campos são obrigatórios.`);
      } else {
        console.log(`[discover-columns] Registro de teste inserido com sucesso!`);
        console.log(`[discover-columns] Colunas descobertas:`, Object.keys(insertData[0]));
        
        // Remove o registro de teste
        await supabase
          .from(table)
          .delete()
          .eq('name', 'test-discovery');
        console.log(`[discover-columns] Registro de teste removido.`);
      }
      return;
    }
    
    const columns = Object.keys(data[0]);
    console.log(`[discover-columns] Colunas encontradas na tabela '${table}':`);
    console.log(JSON.stringify(columns, null, 2));
    
    console.log(`\n[discover-columns] Exemplo de registro:`);
    console.log(JSON.stringify(data[0], null, 2));
    
  } catch (e) {
    console.error('[discover-columns] Erro:', e.message || String(e));
    process.exit(2);
  }
})();