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

export function addDocument(item: DocumentItem): Promise<number> {
  const now = Date.now();
  const id = memId++;
  const normalized: DocumentItem = {
    ...item,
    id,
    type: item.type || 'Outros',
    issueDate: item.issueDate || '',
    expiryDate: item.expiryDate || '',
    issuingState: item.issuingState || '',
    issuingCity: item.issuingCity || '',
    issuingAuthority: item.issuingAuthority || '',
    electorZone: item.electorZone || '',
    electorSection: item.electorSection || '',
    updatedAt: now,
  };
  memory.push(normalized);
  return Promise.resolve(id);
}

export function updateDocument(id: number, item: Partial<DocumentItem>): Promise<void> {
  const idx = memory.findIndex(m => m.id === id);
  if (idx >= 0) {
    memory[idx] = { ...memory[idx], ...item, updatedAt: Date.now() } as DocumentItem;
  }
  return Promise.resolve();
}

export function deleteDocument(id: number): Promise<void> {
  const idx = memory.findIndex(m => m.id === id);
  if (idx >= 0) memory.splice(idx, 1);
  return Promise.resolve();
}