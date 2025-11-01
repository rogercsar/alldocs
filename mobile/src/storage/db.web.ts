import type { DocumentItem } from '../types';

const memory: DocumentItem[] = [];
let memId = 1;

export function initDb() {
  // Web: sem SQLite; usa armazenamento em memória
}

export function getDocuments(): Promise<DocumentItem[]> {
  const sorted = [...memory].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return Promise.resolve(sorted);
}

export function countDocuments(): Promise<number> {
  return Promise.resolve(memory.length);
}

export async function saveImageToLocal(srcUri: string): Promise<string> {
  if (!srcUri) return '';
  // Web: mantém a URI como está (File/Blob/URL)
  return srcUri;
}

export async function addDocument(item: DocumentItem): Promise<number> {
  const now = Date.now();
  const id = memId++;
  const appId = item.appId || `${now}-${Math.random().toString(36).slice(2, 10)}`;
  const normalized: DocumentItem = {
    ...item,
    id,
    appId,
    type: item.type || 'Outros',
    issueDate: item.issueDate || '',
    expiryDate: item.expiryDate || '',
    issuingState: item.issuingState || '',
    issuingCity: item.issuingCity || '',
    issuingAuthority: item.issuingAuthority || '',
    electorZone: item.electorZone || '',
    electorSection: item.electorSection || '',
    // Campos de Cartões
    cardSubtype: item.cardSubtype || '',
    bank: item.bank || '',
    cvc: item.cvc || '',
    cardBrand: item.cardBrand || '',
    synced: 0,
    updatedAt: now,
  };
  memory.unshift(normalized);
  return id;
}

export function updateDocument(item: DocumentItem): Promise<void> {
  const now = Date.now();
  const idx = memory.findIndex(d => (item.appId ? d.appId === item.appId : d.id === item.id));
  if (idx >= 0) {
    memory[idx] = { ...memory[idx], ...item, updatedAt: now, appId: memory[idx].appId || item.appId } as DocumentItem;
  }
  return Promise.resolve();
}

export function deleteDocument(id: number): Promise<void> {
  const idx = memory.findIndex(m => m.id === id);
  if (idx >= 0) memory.splice(idx, 1);
  return Promise.resolve();
}