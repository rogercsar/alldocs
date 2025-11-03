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

async function upsertSubtableForType({ userId, appId, type, issueDate, expiryDate, issuingState, issuingCity, issuingAuthority, electorZone, electorSection, cardSubtype, bank, cvc, cardBrand }) {
  try {
    const t = (type || '').toLowerCase();
    if (!t) return;
    if (t.includes('rg')) {
      await supabase
        .from('doc_rg')
        .upsert({ user_id: userId, app_id: appId, issue_date: issueDate || null, expiry_date: expiryDate || null, issuing_state: issuingState || null, issuing_city: issuingCity || null, issuing_authority: issuingAuthority || null }, { onConflict: 'user_id,app_id' });
      return;
    }
    if (t.includes('cnh')) {
      await supabase
        .from('doc_cnh')
        .upsert({ user_id: userId, app_id: appId, issue_date: issueDate || null, expiry_date: expiryDate || null, issuing_state: issuingState || null, issuing_city: issuingCity || null, issuing_authority: issuingAuthority || null }, { onConflict: 'user_id,app_id' });
      return;
    }
    if (t.includes('cpf')) {
      await supabase
        .from('doc_cpf')
        .upsert({ user_id: userId, app_id: appId }, { onConflict: 'user_id,app_id' });
      return;
    }
    if (t.includes('passaport') || t.includes('passaporte')) {
      await supabase
        .from('doc_passaporte')
        .upsert({ user_id: userId, app_id: appId, issue_date: issueDate || null, expiry_date: expiryDate || null }, { onConflict: 'user_id,app_id' });
      return;
    }
    if (t.includes('eleitor')) {
      await supabase
        .from('doc_eleitor')
        .upsert({ user_id: userId, app_id: appId, elector_zone: electorZone || null, elector_section: electorSection || null }, { onConflict: 'user_id,app_id' });
      return;
    }
    if (t.includes('veículo') || t.includes('veiculo')) {
      await supabase
        .from('doc_veiculo')
        .upsert({ user_id: userId, app_id: appId }, { onConflict: 'user_id,app_id' });
      return;
    }
    if (t.includes('cart')) {
      await supabase
        .from('doc_cartao')
        .upsert({ user_id: userId, app_id: appId, subtype: cardSubtype || null, brand: cardBrand || null, bank: bank || null, cvc: cvc || null }, { onConflict: 'user_id,app_id' });
      return;
    }
  } catch (e) {
    console.warn('Subtable upsert failed:', e.message || String(e));
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
+     await upsertSubtableForType({ userId, appId, type, issueDate, expiryDate, issuingState, issuingCity, issuingAuthority, electorZone, electorSection, cardSubtype, bank, cvc, cardBrand });
      return json({ ok: true });
    }

    if (event.httpMethod === 'DELETE') {
      const appId = toSafeAppId(id);
      if (!Number.isFinite(appId)) return json({ error: 'Invalid app_id' }, 400);
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