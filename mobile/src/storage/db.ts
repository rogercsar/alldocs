import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import type { DocumentItem } from '../types';

let db: SQLite.SQLiteDatabase | null = null;
if (Platform.OS !== 'web') {
  db = SQLite.openDatabase('alldocs.db');
}
const memory: DocumentItem[] = [];
let memId = 1;

export function initDb() {
  if (Platform.OS === 'web') {
    return;
  }
  db.transaction(tx => {
    tx.executeSql(
      `CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        appId TEXT,
        name TEXT NOT NULL,
        number TEXT NOT NULL,
        frontImageUri TEXT,
        backImageUri TEXT,
        type TEXT,
        category TEXT,
        issueDate TEXT,
        expiryDate TEXT,
        issuingState TEXT,
        issuingCity TEXT,
        issuingAuthority TEXT,
        electorZone TEXT,
        electorSection TEXT,
        cardSubtype TEXT,
        bank TEXT,
        cvc TEXT,
        cardBrand TEXT,
        favorite INTEGER DEFAULT 0,
        synced INTEGER DEFAULT 0,
        updatedAt INTEGER
      );`
    );
    // tenta adicionar colunas em bases existentes
    tx.executeSql('ALTER TABLE documents ADD COLUMN appId TEXT;', [], () => {}, () => false);
    tx.executeSql('ALTER TABLE documents ADD COLUMN type TEXT;', [], () => {}, () => false);
    tx.executeSql('ALTER TABLE documents ADD COLUMN issueDate TEXT;', [], () => {}, () => false);
    tx.executeSql('ALTER TABLE documents ADD COLUMN expiryDate TEXT;', [], () => {}, () => false);
    tx.executeSql('ALTER TABLE documents ADD COLUMN issuingState TEXT;', [], () => {}, () => false);
    tx.executeSql('ALTER TABLE documents ADD COLUMN issuingCity TEXT;', [], () => {}, () => false);
    tx.executeSql('ALTER TABLE documents ADD COLUMN issuingAuthority TEXT;', [], () => {}, () => false);
    tx.executeSql('ALTER TABLE documents ADD COLUMN electorZone TEXT;', [], () => {}, () => false);
    tx.executeSql('ALTER TABLE documents ADD COLUMN electorSection TEXT;', [], () => {}, () => false);
    tx.executeSql('ALTER TABLE documents ADD COLUMN cardSubtype TEXT;', [], () => {}, () => false);
    tx.executeSql('ALTER TABLE documents ADD COLUMN bank TEXT;', [], () => {}, () => false);
    tx.executeSql('ALTER TABLE documents ADD COLUMN cvc TEXT;', [], () => {}, () => false);
    tx.executeSql('ALTER TABLE documents ADD COLUMN cardBrand TEXT;', [], () => {}, () => false);
    tx.executeSql('ALTER TABLE documents ADD COLUMN favorite INTEGER DEFAULT 0;', [], () => {}, () => false);
    tx.executeSql('ALTER TABLE documents ADD COLUMN synced INTEGER DEFAULT 0;', [], () => {}, () => false);
    tx.executeSql('ALTER TABLE documents ADD COLUMN updatedAt INTEGER;', [], () => {}, () => false);
  });
}

export function getDocuments(): Promise<DocumentItem[]> {
  if (Platform.OS === 'web') {
    const sorted = [...memory].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return Promise.resolve(sorted);
  }
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        'SELECT id, appId, name, number, frontImageUri, backImageUri, type, category, issueDate, expiryDate, issuingState, issuingCity, issuingAuthority, electorZone, electorSection, cardSubtype, bank, cvc, cardBrand, favorite, synced, updatedAt FROM documents ORDER BY updatedAt DESC;',
        [],
        (_, { rows }) => {
          const items: DocumentItem[] = [];
          for (let i = 0; i < rows.length; i++) {
            items.push(rows.item(i) as DocumentItem);
          }
          resolve(items);
        },
        (_, err) => {
          reject(err);
          return false;
        }
      );
    });
  });
}

export function countDocuments(): Promise<number> {
  if (Platform.OS === 'web') {
    return Promise.resolve(memory.length);
  }
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        'SELECT COUNT(*) as cnt FROM documents;',
        [],
        (_, { rows }) => resolve(rows.item(0).cnt as number),
        (_, err) => {
          reject(err);
          return false;
        }
      );
    });
  });
}

export async function saveImageToLocal(uri: string): Promise<string> {
  // No web, apenas retorna a URI, pois o expo-file-system não está disponível
  // Em plataformas nativas, pode-se copiar para cache/local app storage
  return uri;
}

export function addDocument(item: DocumentItem): Promise<number> {
  if (Platform.OS === 'web') {
    const now = Date.now();
    const id = memId++;
    memory.push({ ...item, id, updatedAt: now });
    return Promise.resolve(id);
  }
  return new Promise((resolve, reject) => {
    const now = Date.now();
    const appId = item.appId || `${now}-${Math.random().toString(36).slice(2, 10)}`;
    db.transaction(tx => {
      tx.executeSql(
        'INSERT INTO documents (appId, name, number, frontImageUri, backImageUri, type, category, issueDate, expiryDate, issuingState, issuingCity, issuingAuthority, electorZone, electorSection, cardSubtype, bank, cvc, cardBrand, favorite, synced, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);',
        [
          appId,
          item.name,
          item.number,
          item.frontImageUri || '',
          item.backImageUri || '',
          item.type || 'Outros',
          item.category || '',
          item.issueDate || '',
          item.expiryDate || '',
          item.issuingState || '',
          item.issuingCity || '',
          item.issuingAuthority || '',
          item.electorZone || '',
          item.electorSection || '',
          item.cardSubtype || '',
          item.bank || '',
          item.cvc || '',
          item.cardBrand || '',
          item.favorite ? 1 : 0,
          item.synced ? 1 : 0,
          now,
        ],
        (_, result) => resolve(result.insertId as number),
        (_, err) => {
          reject(err);
          return false;
        }
      );
    });
  });
}

export function updateDocument(item: DocumentItem): Promise<void> {
  if (Platform.OS === 'web') {
    const idx = memory.findIndex(m => m.id === item.id);
    if (idx >= 0) {
      memory[idx] = { ...memory[idx], ...item, updatedAt: Date.now() } as DocumentItem;
    }
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        'UPDATE documents SET appId = COALESCE(appId, ?), name=?, number=?, frontImageUri=?, backImageUri=?, type=?, category=?, issueDate=?, expiryDate=?, issuingState=?, issuingCity=?, issuingAuthority=?, electorZone=?, electorSection=?, cardSubtype=?, bank=?, cvc=?, cardBrand=?, favorite=?, synced=?, updatedAt=? WHERE id=?;',
        [
          item.appId || null,
          item.name,
          item.number,
          item.frontImageUri || null,
          item.backImageUri || null,
          item.type || null,
          item.category || null,
          item.issueDate || null,
          item.expiryDate || null,
          item.issuingState || null,
          item.issuingCity || null,
          item.issuingAuthority || null,
          item.electorZone || null,
          item.electorSection || null,
          item.cardSubtype || null,
          item.bank || null,
          item.cvc || null,
          item.cardBrand || null,
          item.favorite ? 1 : 0,
          0,
          Date.now(),
          item.id,
        ],
        () => resolve(),
        (_, err) => {
          reject(err);
          return false;
        }
      );
    });
  });
}

export function deleteDocument(id: number): Promise<void> {
  if (Platform.OS === 'web') {
    const idx = memory.findIndex(m => m.id === id);
    if (idx >= 0) memory.splice(idx, 1);
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql('DELETE FROM documents WHERE id=?;', [id], () => resolve(), (_, err) => {
        reject(err);
        return false;
      });
    });
  });
}