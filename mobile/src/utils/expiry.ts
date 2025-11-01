import type { DocumentItem } from '../types';

// Converte string de data (DD/MM/YYYY, YYYY-MM-DD ou ISO) para Date
export function parseExpiryDate(expiry?: string | null): Date | null {
  if (!expiry) return null;
  const s = String(expiry).trim();
  // DD/MM/YYYY
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const dd = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10) - 1;
    const yyyy = parseInt(m[3], 10);
    return new Date(yyyy, mm, dd, 9, 0, 0, 0);
  }
  // YYYY-MM-DD
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m2) {
    const yyyy = parseInt(m2[1], 10);
    const mm = parseInt(m2[2], 10) - 1;
    const dd = parseInt(m2[3], 10);
    return new Date(yyyy, mm, dd, 9, 0, 0, 0);
  }
  // ISO padrão
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function isExpired(expiry?: string | null, ref?: Date): boolean {
  const e = parseExpiryDate(expiry);
  if (!e) return false;
  const now = ref ?? new Date();
  return e.getTime() <= now.getTime();
}

export function isExpiringSoon(expiry?: string | null, daysWindow = 30, ref?: Date): boolean {
  const e = parseExpiryDate(expiry);
  if (!e) return false;
  const now = ref ?? new Date();
  const msUntil = e.getTime() - now.getTime();
  if (msUntil <= 0) return false;
  const windowMs = daysWindow * 24 * 60 * 60 * 1000;
  return msUntil <= windowMs;
}

export function buildExpiryAlerts(docs: DocumentItem[], options?: { daysWindow?: number; ref?: Date }): string[] {
  const alerts: string[] = [];
  const now = options?.ref ?? new Date();
  const daysWindow = options?.daysWindow ?? 30;
  docs.forEach((doc) => {
    const name = doc.name || 'Documento';
    const expStr = doc.expiryDate || undefined;
    const exp = parseExpiryDate(expStr);
    if (!exp) return;
    const msUntil = exp.getTime() - now.getTime();
    if (msUntil <= 0) {
      alerts.push(`Documento '${name}' está vencido desde ${doc.expiryDate}.`);
    } else if (msUntil <= daysWindow * 24 * 60 * 60 * 1000) {
      const days = Math.max(1, Math.ceil(msUntil / (24 * 60 * 60 * 1000)));
      alerts.push(`Documento '${name}' vence em ${days} dia${days > 1 ? 's' : ''} (${doc.expiryDate}).`);
    }
  });
  return alerts;
}

export function filterByExpiry(docs: DocumentItem[], mode: 'all' | 'expired' | 'soon', options?: { daysWindow?: number; ref?: Date }): DocumentItem[] {
  const ref = options?.ref ?? new Date();
  const daysWindow = options?.daysWindow ?? 30;
  switch (mode) {
    case 'expired':
      return docs.filter((d) => isExpired(d.expiryDate, ref));
    case 'soon':
      return docs.filter((d) => !isExpired(d.expiryDate, ref) && isExpiringSoon(d.expiryDate, daysWindow, ref));
    default:
      return docs;
  }
}