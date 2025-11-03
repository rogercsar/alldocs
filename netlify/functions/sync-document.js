const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function toSafeAppId(input) {
  const MAX = 2147483647;
  if (typeof input === 'number') {
    if (Number.isFinite(input) && input > 0 && input <= MAX) return input;
    input = String(input);
  }
  const s = String(input || '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  const res = Math.abs(h) % MAX;
  return res || 1;
}

// Função para determinar qual sub-tabela usar baseado no tipo de documento e subtipo
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
  // Quando for cartão de plano de saúde, usar doc_saude
  if (t.includes('cart') || t.includes('cartão') || t.includes('cartao')) {
    const isHealthSubtype = (
      sub.includes('saúde') || sub.includes('saude') || sub.includes('plano') ||
      sub.includes('odont') || sub.includes('odonto') || sub.includes('dent') ||
      sub.includes('seguro')
    );
    if (isHealthSubtype) return 'doc_saude';
    return 'doc_cartao';
  }
  // Tipo "Saúde" direto também mapeia para doc_saude
  if (t.includes('saúde') || t.includes('saude') || t.includes('odont') || t.includes('odonto') || t.includes('seguro')) return 'doc_saude';
  
  return null;
}

// Função para preparar dados específicos da sub-tabela
function prepareSubtableData(subtable, { userId, appId, type, issueDate, expiryDate, issuingState, issuingCity, issuingAuthority, electorZone, electorSection, cardSubtype, bank, cvc, cardBrand, plate, renavam, operator, beneficiaryNumber, plan }) {
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
  try {
    const { userId, appId, type, cardSubtype } = params;
    const subtable = getSubtableForType(type, cardSubtype);
    
    if (!subtable) {
      console.log(`Nenhuma sub-tabela encontrada para o tipo: ${type}`);
      return;
    }
    
    const data = prepareSubtableData(subtable, params);
    console.log(`Inserindo/atualizando na sub-tabela ${subtable}:`, JSON.stringify(data, null, 2));
    
    const { error } = await supabase
      .from(subtable)
      .upsert(data, { onConflict: 'user_id,app_id' });
      
    if (error) {
      console.error(`Erro ao fazer upsert na sub-tabela ${subtable}:`, error.message);
      throw error;
    }
    
    console.log(`Upsert realizado com sucesso na sub-tabela ${subtable}`);
  } catch (e) {
    console.warn('Subtable upsert failed:', e.message || String(e));
    throw e; // Re-throw para que o erro seja tratado pelo handler principal
  }
}

// Função para deletar dados das sub-tabelas
async function deleteFromSubtables({ userId, appId, type, cardSubtype }) {
  try {
    const subtable = getSubtableForType(type, cardSubtype);
    
    if (!subtable) {
      console.log(`Nenhuma sub-tabela encontrada para deletar o tipo: ${type}`);
      return;
    }
    
    console.log(`Deletando da sub-tabela ${subtable} para user_id: ${userId}, app_id: ${appId}`);
    
    const { error } = await supabase
      .from(subtable)
      .delete()
      .eq('user_id', userId)
      .eq('app_id', appId);
      
    if (error) {
      console.error(`Erro ao deletar da sub-tabela ${subtable}:`, error.message);
      throw error;
    }
    
    console.log(`Dados deletados com sucesso da sub-tabela ${subtable}`);
  } catch (e) {
    console.warn('Subtable delete failed:', e.message || String(e));
    // Não re-throw aqui para não impedir a deleção do documento principal
  }
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders() };
  }
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { id, name, number, frontPath, backPath, userId } = body;
    const {
      type,
      category,
      issueDate,
      expiryDate,
      issuingState,
      issuingCity,
      issuingAuthority,
      electorZone,
      electorSection,
      cardSubtype,
      bank,
      cvc,
      cardBrand,
      plate,
      renavam,
      operator,
      beneficiaryNumber,
      plan,
    } = body;

    if (!userId || typeof userId !== 'string') {
      return json({ error: 'Missing or invalid userId' }, 400);
    }

    if (event.httpMethod === 'POST') {
      const appId = toSafeAppId(id);
      if (!Number.isFinite(appId)) return json({ error: 'Invalid app_id' }, 400);

      // Upsert manual por (app_id, user_id) para evitar sobrescrita por constraint incorreta
      const { data: existing, error: selErr } = await supabase
        .from('documents')
        .select('id')
        .eq('app_id', appId)
        .eq('user_id', userId)
        .limit(1);
      if (selErr) throw selErr;

      // Descobre colunas disponíveis para montar payload compatível
      let columnSet = null;
      try {
        const { data: columnsData } = await supabase
          .from('information_schema.columns')
          .select('column_name')
          .eq('table_schema', 'public')
          .eq('table_name', 'documents');
        if (Array.isArray(columnsData)) {
          columnSet = new Set(columnsData.map((c) => c.column_name));
        }
      } catch (e) {
        // Se falhar a introspecção, usa um conjunto conhecido de colunas básicas
        console.warn('Falha na introspecção de colunas:', e.message);
        columnSet = new Set([
          'id', 'app_id', 'user_id', 'name', 'number', 
          'front_path', 'back_path', 'created_at', 'updated_at'
        ]);
      }

      const basePayload = {
        name,
        number,
        front_path: frontPath || null,
        back_path: backPath || null,
        updated_at: new Date().toISOString(),
      };

      const payload = { ...basePayload };
      const addIfPresent = (col, val) => {
        if (!columnSet || !columnSet.has(col)) {
          console.log(`Campo '${col}' não existe na tabela documents, ignorando.`);
          return;
        }
        payload[col] = val ?? null;
      };
      addIfPresent('type', type);
      addIfPresent('category', category);
      addIfPresent('issue_date', issueDate);
      addIfPresent('expiry_date', expiryDate);
      addIfPresent('issuing_state', issuingState);
      addIfPresent('issuing_city', issuingCity);
      addIfPresent('issuing_authority', issuingAuthority);
      addIfPresent('elector_zone', electorZone);
      addIfPresent('elector_section', electorSection);
      addIfPresent('card_subtype', cardSubtype);
      addIfPresent('bank', bank);
      addIfPresent('cvc', cvc);
      addIfPresent('card_brand', cardBrand);
      addIfPresent('plate', plate);
      addIfPresent('renavam', renavam);

      console.log(`Payload final para sync:`, JSON.stringify(payload, null, 2));
      console.log(`Colunas disponíveis:`, Array.from(columnSet || []).sort());

      if (Array.isArray(existing) && existing.length > 0) {
        const rowId = existing[0].id;
        let { error: updErr } = await supabase
          .from('documents')
          .update(payload)
          .eq('id', rowId);
        if (updErr) {
          console.warn(`Erro no update com payload completo:`, updErr.message);
          console.log(`Tentando com payload mínimo:`, JSON.stringify(basePayload, null, 2));
          // Qualquer erro: tenta payload mínimo
          ({ error: updErr } = await supabase
            .from('documents')
            .update(basePayload)
            .eq('id', rowId));
        }
        if (updErr) throw updErr;
      } else {
        let { error: insErr } = await supabase
          .from('documents')
          .insert({ app_id: appId, user_id: userId, ...payload });
        if (insErr) {
          console.warn(`Erro no insert com payload completo:`, insErr.message);
          console.log(`Tentando com payload mínimo:`, JSON.stringify({ app_id: appId, user_id: userId, ...basePayload }, null, 2));
          // Qualquer erro: tenta payload mínimo
          ({ error: insErr } = await supabase
            .from('documents')
            .insert({ app_id: appId, user_id: userId, ...basePayload }));
        }
        if (insErr) throw insErr;
      }
+     // Fazer upsert na sub-tabela apropriada
      await upsertSubtableForType({ 
        userId, 
        appId, 
        type, 
        category,
        issueDate, 
        expiryDate, 
        issuingState, 
        issuingCity, 
        issuingAuthority, 
        electorZone, 
        electorSection, 
        cardSubtype, 
        bank, 
        cvc, 
        cardBrand,
        plate,
        renavam,
        operator,
        beneficiaryNumber,
        plan
      });
      return json({ ok: true });
    }

    if (event.httpMethod === 'DELETE') {
      const appId = toSafeAppId(id);
      if (!Number.isFinite(appId)) return json({ error: 'Invalid app_id' }, 400);
      
      // Primeiro, buscar o documento para obter o tipo antes de deletar
      const { data: docData, error: fetchError } = await supabase
        .from('documents')
        .select('type, card_subtype')
        .eq('app_id', appId)
        .eq('user_id', userId)
        .limit(1);
        
      if (fetchError) throw fetchError;
      
      // Deletar das sub-tabelas primeiro (se o documento existir)
      if (Array.isArray(docData) && docData.length > 0) {
        const documentType = docData[0].type;
        const documentSubtype = docData[0].card_subtype || null;
        await deleteFromSubtables({ userId, appId, type: documentType, cardSubtype: documentSubtype });
      }
      
      // Depois deletar o documento principal
      const { data, error } = await supabase
        .from('documents')
        .delete()
        .eq('app_id', appId)
        .eq('user_id', userId);
        
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: 'Method not allowed' }, 405);
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
    'Access-Control-Allow-Methods': 'POST,DELETE,OPTIONS',
  };
}