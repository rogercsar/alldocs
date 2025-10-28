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
        name TEXT NOT NULL,
        number TEXT NOT NULL,
        frontImageUri TEXT,
        backImageUri TEXT,
        type TEXT,
        synced INTEGER DEFAULT 0,
        updatedAt INTEGER
      );`
    );
    // tenta adicionar coluna 'type' em bases existentes
    tx.executeSql('ALTER TABLE documents ADD COLUMN type TEXT;', [], () => {}, () => false);
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
        'SELECT * FROM documents ORDER BY updatedAt DESC;',
        [],
        (_, { rows }) => resolve(rows._array as DocumentItem[]),
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
    db.transaction(tx => {
      tx.executeSql(
        'INSERT INTO documents (name, number, frontImageUri, backImageUri, type, synced, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?);',
        [item.name, item.number, item.frontImageUri || '', item.backImageUri || '', item.type || 'Outros', item.synced ? 1 : 0, now],
        (_, result) => resolve(result.insertId as number),
        (_, err) => {
          reject(err);
          return false;
        }
      );
    });
  });
}

export function updateDocument(id: number, item: Partial<DocumentItem>): Promise<void> {
  if (Platform.OS === 'web') {
    const idx = memory.findIndex(m => m.id === id);
    if (idx >= 0) {
      memory[idx] = { ...memory[idx], ...item, updatedAt: Date.now() } as DocumentItem;
    }
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const now = Date.now();
    db.transaction(tx => {
      tx.executeSql(
        'UPDATE documents SET name=?, number=?, frontImageUri=?, backImageUri=?, type=?, synced=?, updatedAt=? WHERE id=?;',
        [item.name, item.number, item.frontImageUri || '', item.backImageUri || '', item.type || 'Outros', item.synced ? 1 : 0, now, id],
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