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
    const frontPath = item.frontImageUri ? await uploadImage(item.frontImageUri, userId) : null;
    const backPath = item.backImageUri ? await uploadImage(item.backImageUri, userId) : null;

    // Use a globally unique ID for remote sync to avoid collisions across devices
    const idForSync = (item as any).appId || String(item.id);

    const url = `${API_BASE}/.netlify/functions/sync-document`;
    console.log('[sync] POST', url, { id: idForSync, userId, name: item.name, number: item.number });
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: idForSync,
        userId,
        name: item.name,
        number: item.number,
        frontPath,
        backPath,
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
      console.error('syncDocumentAddOrUpdate failed', resp.status, txt);
    } else {
      console.log('[sync] OK', resp.status);
    }
  } catch (e) {
    console.error('syncDocumentAddOrUpdate error', e);
  }
}

export async function syncDocumentDelete(appIdOrLocalId: string | number, userId: string) {
  try {
    const id = typeof appIdOrLocalId === 'string' ? appIdOrLocalId : String(appIdOrLocalId);
    const resp = await fetch('/.netlify/functions/sync-document', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, userId }),
    });
    if (!resp.ok) {
      console.error('syncDocumentDelete failed', await resp.text());
    }
  } catch (e) {
    console.error('syncDocumentDelete error', e);
  }
}