import { supabase, STORAGE_BUCKET } from '../supabase';
import type { DocumentItem } from '../types';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || process.env.EXPO_PUBLIC_API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');

async function uploadImage(path: string, userId: string): Promise<string> {
  if (!path) return '';
  const fileName = `${userId}/${Date.now()}_${path.split('/').pop()}`;
  const file = await fetch(path);
  const blob = await file.blob();
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).upload(fileName, blob, { upsert: true });
  if (error) throw error;
  return data.path;
}

export async function syncDocumentAddOrUpdate(item: DocumentItem, userId: string) {
  try {
    const frontPath = item.frontImageUri ? await uploadImage(item.frontImageUri, userId).catch((e) => { console.error('[sync] front upload failed', e); return ''; }) : '';
    const backPath = item.backImageUri ? await uploadImage(item.backImageUri, userId).catch((e) => { console.error('[sync] back upload failed', e); return ''; }) : '';

    // Use a globally unique ID for remote sync to avoid collisions across devices
    // Evita tentar sincronizar com userId inválido
    if (!userId || userId === 'anonymous') {
      console.log('[sync] skip: no userId (login required)');
      return;
    }
    const isUuid = /^[0-9a-f-]{36}$/i.test(userId);
    if (!isUuid) {
      console.log('[sync] skip: invalid userId format', userId);
      return;
    }

    // Determina ID numérico para app_id (prioriza appId estável; fallback id local)
    const idForSync = (typeof (item as any).appId === 'number')
      ? (item as any).appId
      : (typeof (item as any).appId === 'string'
          ? parseInt((item as any).appId, 10)
          : (typeof item.id === 'number' ? item.id : NaN));
    if (!Number.isFinite(idForSync)) {
      console.log('[sync] skip: invalid appId/id for upsert', { appId: (item as any).appId, id: item.id });
      return;
    }
 
    const url = (API_BASE ? `${API_BASE}/.netlify/functions/sync-document` : '/.netlify/functions/sync-document');
    console.log('[sync] POST', url, { id: idForSync, userId, name: item.name, number: item.number });
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: idForSync,
        userId,
        name: item.name,
        number: item.number,
        frontPath: frontPath || null,
        backPath: backPath || null,
        type: (item as any).type,
        issueDate: (item as any).issueDate,
        expiryDate: (item as any).expiryDate,
        issuingState: (item as any).issuingState,
        issuingCity: (item as any).issuingCity,
        issuingAuthority: (item as any).issuingAuthority,
        electorZone: (item as any).electorZone,
        electorSection: (item as any).electorSection,
        updatedAt: (item as any).updatedAt || Date.now(),
      }),
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      console.error('[sync] upsert failed', resp.status, txt);
    } else {
      console.log('[sync] OK', resp.status);
    }
  } catch (e) {
    console.error('syncDocumentAddOrUpdate error', e);
  }
}

export async function syncDocumentDelete(appIdOrLocalId: string | number, userId: string) {
  try {
    const idNum = typeof appIdOrLocalId === 'number' ? appIdOrLocalId : parseInt(String(appIdOrLocalId), 10);
    if (!Number.isFinite(idNum)) {
      console.log('[sync] delete skip: invalid id', appIdOrLocalId);
      return;
    }
    const url = (API_BASE ? `${API_BASE}/.netlify/functions/sync-document` : '/.netlify/functions/sync-document');
    const resp = await fetch(url, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: idNum, userId }),
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      console.error('[sync] delete failed', resp.status, txt);
    }
  } catch (e) {
    console.error('syncDocumentDelete error', e);
  }
}