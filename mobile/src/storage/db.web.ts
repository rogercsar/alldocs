import type { DocumentItem } from '../types';

// Persistência simples no Web para suportar offline e sobreviver a refresh
const STORAGE_KEY = 'alldocs_documents';

function loadMemory(): DocumentItem[] {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveMemory(items: DocumentItem[]): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

let memory: DocumentItem[] = loadMemory();
let memId = (memory.reduce((max, d) => Math.max(max, d.id || 0), 0) || 0) + 1;

export function initDb() {
  // Web: sem SQLite; usa armazenamento persistente via localStorage
  memory = loadMemory();
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
    category: item.category || '',
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
  saveMemory(memory);
  return id;
}

export function updateDocument(item: DocumentItem): Promise<void> {
  const now = Date.now();
  const idx = memory.findIndex(d => d.id === item.id);
  if (idx >= 0) {
    memory[idx] = {
      ...memory[idx],
      ...item,
      updatedAt: now,
    };
    // mantém posição pelo updatedAt em próxima leitura
    saveMemory(memory);
  }
  return Promise.resolve();
}

export function deleteDocument(id: number): Promise<void> {
  memory = memory.filter(d => d.id !== id);
  saveMemory(memory);
  return Promise.resolve();
}