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
  if (!userId || userId === 'anonymous') return;
  try {
    const frontPath = item.frontImageUri ? await uploadImage(item.frontImageUri, userId) : '';
    const backPath = item.backImageUri ? await uploadImage(item.backImageUri, userId) : '';

    const res = await fetch(`${API_BASE}/.netlify/functions/sync-document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: item.id,
        name: item.name,
        number: item.number,
        frontPath,
        backPath,
        userId,
      }),
    });
    if (!res.ok) throw new Error('Failed to sync');
  } catch (e: any) {
    if (e?.message?.includes('Bucket not found')) {
      console.warn(`Storage bucket '${STORAGE_BUCKET}' não existe no projeto Supabase atual. Crie o bucket ou atualize EXPO_PUBLIC_SUPABASE_BUCKET.`);
    }
    console.warn('Sync failed, will retry later', e);
  }
}

export async function syncDocumentDelete(id: number, userId: string) {
  if (!userId || userId === 'anonymous') return;
  try {
    const res = await fetch(`${API_BASE}/.netlify/functions/sync-document`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, userId }),
    });
    if (!res.ok) throw new Error('Failed to delete sync');
  } catch (e) {
    console.warn('Delete sync failed, will retry later', e);
  }
}