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

// Simular as funções do sync-document.js
function toSafeAppId(input) {
  if (typeof input === 'string') {
    const parsed = parseInt(input, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return Number.isFinite(input) ? input : null;
}

function getSubtableForType(type, cardSubtype) {
  const t = (type || '').toLowerCase();
  const sub = (cardSubtype || '').toLowerCase();
  if (!t) return null;
  
  if (t.includes('rg')) return 'doc_rg';
  if (t.includes('cnh')) return 'doc_cnh';
  if (t.includes('cpf')) return 'doc_cpf';
  if (t.includes('passaport') || t.includes('passaporte')) return 'doc_passaporte';
  if (t.includes('eleitor') || t.includes('título')) return 'doc_eleitor';
  if (t.includes('veículo') || t.includes('veiculo') || t.includes('documento do veículo')) return 'doc_veiculo';
  if (t.includes('cart')) {
    const isHealthSubtype = (
      sub.includes('saúde') || sub.includes('saude') || sub.includes('plano') ||
      sub.includes('odont') || sub.includes('odonto') || sub.includes('dent') ||
      sub.includes('seguro')
    );
    if (isHealthSubtype) return 'doc_saude';
    return 'doc_cartao';
  }
  if (t.includes('saúde') || t.includes('saude') || sub.includes('odont') || sub.includes('odonto') || sub.includes('seguro')) return 'doc_saude';
  return null;
}

function prepareSubtableData(subtable, params) {
  const { userId, appId, issueDate, expiryDate, issuingState, issuingCity, issuingAuthority, electorZone, electorSection, cardSubtype, bank, cvc, cardBrand, plate, renavam, operator, beneficiaryNumber, plan } = params;
  
  const baseData = { user_id: userId, app_id: appId };
  
  switch (subtable) {
    case 'doc_rg':
      return {
        ...baseData,
        issue_date: issueDate || null,
        issuing_state: issuingState || null,
        issuing_city: issuingCity || null,
        issuing_authority: issuingAuthority || null
      };
    case 'doc_cnh':
      return {
        ...baseData,
        issue_date: issueDate || null,
        expiry_date: expiryDate || null,
        issuing_state: issuingState || null,
        issuing_city: issuingCity || null,
        issuing_authority: issuingAuthority || null
      };
    case 'doc_cpf':
      return baseData;
    case 'doc_passaporte':
      return {
        ...baseData,
        issue_date: issueDate || null,
        expiry_date: expiryDate || null,
        issuing_authority: issuingAuthority || null
      };
    case 'doc_eleitor':
      return {
        ...baseData,
        elector_zone: electorZone || null,
        elector_section: electorSection || null
      };
    case 'doc_veiculo':
      return {
        ...baseData,
        plate: plate || null,
        renavam: renavam || null
      };
    case 'doc_cartao':
      return {
        ...baseData,
        subtype: cardSubtype || null,
        brand: cardBrand || null,
        bank: bank || null,
        cvc: cvc || null,
        expiry_date: expiryDate || null
      };
    case 'doc_saude':
      return {
        ...baseData,
        operator: operator || null,
        beneficiary_number: beneficiaryNumber || null,
        plan: plan || null,
        expiry_date: expiryDate || null
      };
    default:
      return baseData;
  }
}

async function upsertSubtableForType(params) {
  const { userId, appId, type, cardSubtype } = params;
  const subtable = getSubtableForType(type, cardSubtype);
  
  if (!subtable) {
    console.log(`⚠️  Tipo '${type}' não mapeado para sub-tabela, ignorando.`);
    return;
  }
  
  const data = prepareSubtableData(subtable, params);
  console.log(`📝 Inserindo/atualizando em ${subtable}:`, data);
  
  try {
    const { error: insertError } = await supabase
      .from(subtable)
      .upsert(data, { onConflict: 'user_id,app_id' });
      
    if (insertError) {
      console.error(`❌ Erro ao fazer upsert em ${subtable}:`, insertError.message);
      throw insertError;
    }
    
    console.log(`✅ Upsert em ${subtable} realizado com sucesso`);

    const { data: found, error: selectError } = await supabase
      .from(subtable)
      .select('*')
      .eq('user_id', userId)
      .eq('app_id', appId);
      
    if (selectError) {
      console.error(`❌ Erro ao consultar ${subtable} após upsert:`, selectError.message);
      throw selectError;
    }
    
    if (!found || found.length === 0) {
      throw new Error(`Nenhum dado encontrado em ${subtable} para o documento recém inserido.`);
    }
    
    console.log(`✅ Dados encontrados em ${subtable}:`, found[0]);
    if (subtable === 'doc_saude') {
      const s = found[0];
      console.log(`   operator: ${s.operator}, beneficiary_number: ${s.beneficiary_number}, plan: ${s.plan}, expiry_date: ${s.expiry_date}`);
    }
  } catch (e) {
    console.error(`❌ Erro geral no upsert ${subtable}:`, e.message);
    throw e;
  }
}

async function deleteFromSubtables({ userId, appId, type, cardSubtype }) {
  const subtable = getSubtableForType(type, cardSubtype);
  
  if (!subtable) {
    console.log(`⚠️  Tipo '${type}' não mapeado para sub-tabela, ignorando delete.`);
    return;
  }
  
  console.log(`🗑️  Deletando de ${subtable} para user_id=${userId}, app_id=${appId}`);
  
  try {
    const { error } = await supabase
      .from(subtable)
      .delete()
      .eq('user_id', userId)
      .eq('app_id', appId);
      
    if (error) {
      console.error(`❌ Erro ao deletar de ${subtable}:`, error.message);
      throw error;
    }
    
    console.log(`✅ Delete de ${subtable} realizado com sucesso`);
  } catch (e) {
    console.error(`❌ Erro geral no delete ${subtable}:`, e.message);
    throw e;
  }
}

async function testIntegration() {
  console.log('🧪 Testando integração completa das sub-tabelas...\n');
  
  // Primeiro, vamos buscar um usuário existente ou usar um UUID válido
  let testUserId;
  try {
    const { data: users, error } = await supabase
      .from('documents')
      .select('user_id')
      .limit(1);
      
    if (error || !users || users.length === 0) {
      console.log('⚠️  Nenhum usuário encontrado, criando dados de teste sem FK...');
      // Vamos testar apenas as sub-tabelas diretamente
      await testSubtablesOnly();
      return;
    }
    
    testUserId = users[0].user_id;
    console.log(`✅ Usando usuário existente: ${testUserId}`);
  } catch (e) {
    console.log('⚠️  Erro ao buscar usuário, testando apenas sub-tabelas...');
    await testSubtablesOnly();
    return;
  }
  
  const testAppId = 999999; // ID de teste alto para não conflitar
  
  const testCases = [
    {
      name: 'RG',
      type: 'RG',
      category: 'Pessoais',
      issueDate: '2020-01-15',
      issuingState: 'SP',
      issuingCity: 'São Paulo',
      issuingAuthority: 'SSP'
    },
    {
      name: 'CNH',
      type: 'CNH',
      category: 'Transporte',
      issueDate: '2021-03-10',
      expiryDate: '2026-03-10',
      issuingState: 'RJ',
      issuingAuthority: 'DETRAN'
    },
    {
      name: 'Cartão de Crédito',
      type: 'Cartão',
      category: 'Financeiro',
      cardSubtype: 'crédito',
      bank: 'Banco do Brasil',
      cardBrand: 'Visa',
      cvc: '123',
      expiryDate: '2025-12-31'
    },
    {
      name: 'Carteirinha Plano de Saúde',
      type: 'Cartão',
      category: 'Saúde',
      cardSubtype: 'plano_saude',
      operator: 'Unimed',
      beneficiaryNumber: 'BEN123456',
      plan: 'Nacional Premium',
      expiryDate: '2026-06-30'
    },
    {
      name: 'Carteirinha Odontológico',
      type: 'Cartão',
      category: 'Saúde',
      cardSubtype: 'odontológico',
      operator: 'OdontoCompany',
      beneficiaryNumber: 'ODONTO123',
      plan: 'Integral Odonto',
      expiryDate: '2026-11-30'
    },
    {
      name: 'Carteirinha Seguro Saúde',
      type: 'Cartão',
      category: 'Saúde',
      cardSubtype: 'seguro',
      operator: 'SulAmérica',
      beneficiaryNumber: 'SEG123456',
      plan: 'Premium Seguro Saúde',
      expiryDate: '2027-01-31'
    }
  ];
  
  try {
    // Teste 1: Inserir documentos e sub-tabelas
    console.log('📝 Teste 1: Inserindo documentos e dados nas sub-tabelas...\n');
    
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      const currentAppId = testAppId + i;
      
      console.log(`➡️  Testando ${testCase.name}...`);
      
      // Inserir na tabela principal
      const { error: docError } = await supabase
        .from('documents')
        .upsert({
          app_id: currentAppId,
          user_id: testUserId,
          name: testCase.name,
          number: `TEST-${currentAppId}`,
          type: testCase.type,
          category: testCase.category,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,app_id' });
        
      if (docError) {
        console.error(`❌ Erro ao inserir documento ${testCase.name}:`, docError.message);
        continue;
      }
      
      // Inserir na sub-tabela
      await upsertSubtableForType({
        userId: testUserId,
        appId: currentAppId,
        type: testCase.type,
        ...testCase
      });
      
      console.log(`✅ ${testCase.name} inserido com sucesso\n`);
    }
    
    // Teste 2: Verificar se os dados foram inseridos corretamente
    console.log('🔍 Teste 2: Verificando dados inseridos...\n');
    
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      const currentAppId = testAppId + i;
      const subtable = getSubtableForType(testCase.type, testCase.cardSubtype);
      
      if (subtable) {
        const { data, error } = await supabase
          .from(subtable)
          .select('*')
          .eq('user_id', testUserId)
          .eq('app_id', currentAppId);
        
        // Se for doc_saude, exibir campos esperados
        if (subtable === 'doc_saude' && data && data.length > 0) {
          console.log('🩺 Saúde:', {
            operator: data[0].operator,
            beneficiary_number: data[0].beneficiary_number,
            plan: data[0].plan,
            expiry_date: data[0].expiry_date
          });
        }
          
        if (error) {
          console.error(`❌ Erro ao consultar ${subtable}:`, error.message);
        } else if (data && data.length > 0) {
          console.log(`✅ Dados encontrados em ${subtable}:`, data[0]);
        } else {
          console.log(`⚠️  Nenhum dado encontrado em ${subtable}`);
        }
      }
    }
    
    // Teste 3: Deletar dados
    console.log('\n🗑️  Teste 3: Deletando dados de teste...\n');
    
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      const currentAppId = testAppId + i;
      
      console.log(`➡️  Deletando ${testCase.name}...`);
      
      // Deletar da sub-tabela primeiro
      await deleteFromSubtables({
        userId: testUserId,
        appId: currentAppId,
        type: testCase.type,
        cardSubtype: testCase.cardSubtype
      });
      
      // Deletar da tabela principal
      const { error: docError } = await supabase
        .from('documents')
        .delete()
        .eq('user_id', testUserId)
        .eq('app_id', currentAppId);
        
      if (docError) {
        console.error(`❌ Erro ao deletar documento ${testCase.name}:`, docError.message);
      } else {
        console.log(`✅ ${testCase.name} deletado com sucesso`);
      }
    }
    
    console.log('\n🎉 Teste de integração concluído com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
  }
}

async function testSubtablesOnly() {
  console.log('🧪 Testando apenas as sub-tabelas (sem FK)...\n');
  
  const testUserId = '00000000-0000-0000-0000-000000000001';
  const testAppId = 999999;
  
  const testCases = [
    {
      name: 'RG',
      type: 'RG',
      issueDate: '2020-01-15',
      issuingState: 'SP',
      issuingCity: 'São Paulo',
      issuingAuthority: 'SSP'
    },
    {
      name: 'Cartão',
      type: 'Cartão',
      cardSubtype: 'crédito',
      bank: 'Banco do Brasil',
      cardBrand: 'Visa'
    }
  ];
  
  try {
    console.log('📝 Teste: Inserindo dados diretamente nas sub-tabelas...\n');
    
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      const currentAppId = testAppId + i;
      
      console.log(`➡️  Testando ${testCase.name}...`);
      
      await upsertSubtableForType({
        userId: testUserId,
        appId: currentAppId,
        type: testCase.type,
        ...testCase
      });
      
      console.log(`✅ ${testCase.name} inserido na sub-tabela com sucesso\n`);
    }
    
    console.log('🔍 Verificando dados inseridos...\n');
    
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      const currentAppId = testAppId + i;
      const subtable = getSubtableForType(testCase.type, testCase.cardSubtype);
      
      if (subtable) {
        const { data, error } = await supabase
          .from(subtable)
          .select('*')
          .eq('user_id', testUserId)
          .eq('app_id', currentAppId);
          
        if (error) {
          console.error(`❌ Erro ao consultar ${subtable}:`, error.message);
        } else if (data && data.length > 0) {
          console.log(`✅ Dados encontrados em ${subtable}:`, data[0]);
        } else {
          console.log(`⚠️  Nenhum dado encontrado em ${subtable}`);
        }
      }
    }
    
    console.log('\n🗑️  Limpando dados de teste...\n');
    
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      const currentAppId = testAppId + i;
      
      await deleteFromSubtables({
        userId: testUserId,
        appId: currentAppId,
        type: testCase.type,
        cardSubtype: testCase.cardSubtype
      });
    }
    
    console.log('🎉 Teste das sub-tabelas concluído com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
  }
}

testIntegration();