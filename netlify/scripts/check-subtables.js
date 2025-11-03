const { createClient } = require('@supabase/supabase-js');

// Carrega variáveis de ambiente
require('dotenv').config({ path: '../.env' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Variáveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são necessárias');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkSubtables() {
  console.log('🔍 Verificando sub-tabelas no Supabase...\n');
  
  const subtables = [
    'doc_rg',
    'doc_cnh', 
    'doc_cpf',
    'doc_passaporte',
    'doc_eleitor',
    'doc_veiculo',
    'doc_cartao'
  ];
  
  try {
    // Verificar se as tabelas existem
    for (const table of subtables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);
          
        if (error) {
          console.log(`❌ Tabela ${table}: ${error.message}`);
        } else {
          console.log(`✅ Tabela ${table}: OK`);
        }
      } catch (e) {
        console.log(`❌ Tabela ${table}: ${e.message}`);
      }
    }
    
    // Verificar colunas da tabela documents testando inserção
    console.log('\n🔍 Verificando colunas da tabela documents...');
    try {
      // Testar se conseguimos fazer uma query com as colunas necessárias
      const { data: testData, error: testError } = await supabase
        .from('documents')
        .select('id, type, category, updated_at, front_path, back_path')
        .limit(1);
        
      if (testError) {
        console.log(`❌ Erro ao testar colunas: ${testError.message}`);
      } else {
        console.log('✅ Todas as colunas necessárias estão presentes na tabela documents');
      }
    } catch (e) {
      console.log(`❌ Erro ao verificar colunas: ${e.message}`);
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

checkSubtables();