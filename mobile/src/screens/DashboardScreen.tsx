import React, { useEffect, useState, useCallback, useLayoutEffect, useRef, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, Share, Alert, Pressable, Animated, Modal, TextInput, ScrollView, Platform, Linking, useWindowDimensions } from 'react-native';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { getDocuments, initDb, countDocuments, deleteDocument, updateDocument, addDocument } from '../storage/db';
import { syncDocumentDelete, syncDocumentAddOrUpdate } from '../storage/sync';
import type { DocumentItem } from '../types';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../supabase';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme/colors';
import ShareSheet from '../components/ShareSheet';
import StorageUsageCard from '../components/StorageUsageCard';
import * as Clipboard from 'expo-clipboard';
import { useToast } from '../components/Toast';
import { scheduleExpiryNotifications } from '../utils/notifications';
import { buildExpiryAlerts, filterByExpiry, isExpired, isExpiringSoon, parseExpiryDate } from '../utils/expiry';

const primaryColor = colors.brandPrimary;
const bgColor = colors.bg;
const dangerColor = colors.danger;

function normalizeDocType(raw?: string): string {
  const t = (raw || '').toLowerCase().trim();
  if (!t) return 'Outros';
  if (t.includes('rg')) return 'RG';
  if (t.includes('cnh')) return 'CNH';
  if (t.includes('cpf')) return 'CPF';
  if (t.includes('passaport') || t.includes('passaporte')) return 'Passaporte';
  if (t.includes('comprovante')) return 'Comprovante de endereço';
  if (t.includes('veículo') || t.includes('veiculo') || t.includes('documento do veículo')) return 'Documento do veículo';
  if (t.includes('eleitor') || t.includes('título')) return 'Título de Eleitor';
  if (t.includes('cart') || t.includes('cartão') || t.includes('cartao')) return 'Cartões';
  if (t.includes('certid')) return 'Certidões';
  return 'Outros';
}

function accentBgForType(type?: string): string {
  switch (normalizeDocType(type)) {
    case 'Cartões': return '#FEF2F2'; // vermelho sutil
    case 'RG': return '#EFF6FF'; // azul sutil
    case 'CNH': return '#ECFDF5'; // verde sutil
    case 'Documento do veículo': return '#F0FDF4'; // verde ainda mais claro
    case 'Comprovante de endereço': return '#E0F2FE'; // celeste sutil
    case 'Passaporte': return '#F5F3FF'; // roxo muito claro
    case 'Certidões': return '#F5F3FF'; // roxo muito claro
    case 'Título de Eleitor': return '#DBEAFE'; // azul claro
    case 'CPF': return '#FEF3C7'; // âmbar claro
    case 'Outros': return '#F3F4F6'; // cinza claro
    default: return '#E6E6FA';
  }
}


function iconForType(type?: string): { name: keyof typeof Ionicons.glyphMap; color: string } {
  switch (type) {
    case 'RG':
      return { name: 'person', color: '#2563EB' } as any;
    case 'CNH':
    case 'Documento do veículo':
      return { name: 'car', color: '#10B981' } as any;
    case 'CPF':
      return { name: 'finger-print', color: '#F59E0B' } as any;
    case 'Passaporte':
      return { name: 'airplane', color: '#7C3AED' } as any;
    case 'Comprovante de endereço':
      return { name: 'home', color: '#EF4444' } as any;
    case 'Cartões':
      return { name: 'card', color: '#0EA5E9' } as any;
    case 'Certidões':
      return { name: 'document-text', color: '#6B7280' } as any;
    default:
      return { name: 'document', color: '#6B7280' } as any;
  }
}

function brandIconName(brand?: string) {
  switch ((brand || '').toLowerCase()) {
    case 'visa': return 'cc-visa';
    case 'mastercard': return 'cc-mastercard';
    case 'american express': return 'cc-amex';
    case 'discover': return 'cc-discover';
    case 'diners club': return 'cc-diners-club';
    case 'jcb': return 'cc-jcb';
    case 'elo': return 'credit-card';
    case 'hipercard': return 'credit-card';
    default: return 'credit-card';
  }
}

function categoryForDoc(d: DocumentItem): string {
  const t = (d.type || '').toLowerCase();
  const sub = (d.cardSubtype || '').toLowerCase();
  const rawName = (d.name || '').toLowerCase();
  const name = rawName;
  const tokens = rawName.replace(/[.\-_/]/g, ' ').split(/\s+/).map(s => s.trim()).filter(Boolean);
  const hasToken = (tok: string) => tokens.includes(tok);
  // Heurísticas para Trabalho
  if (
    name.includes('trabalho') || name.includes('carteira de trabalho') || name.includes('ctps') || name.includes('profission') ||
    name.includes('emprego') || hasToken('rh') || name.includes('recursos humanos') || hasToken('nis') || hasToken('pis') || name.includes('pis/pasep')
  ) return 'Trabalho';
  // Heurísticas para Estudo
  if (
    name.includes('estud') || name.includes('carteira estudantil') || name.includes('estudante') || name.includes('escolar') || name.includes('univers') || name.includes('matricul') || name.includes('faculdade') ||
    name.includes('boletim') || name.includes('diploma') || name.includes('histórico') || name.includes('historico') || name.includes('registro acadêmico') || name.includes('registro academico') || hasToken('ra') || name.includes('aluno')
  ) return 'Estudo';
  // Demais categorias por tipo/subtipo
  if (t.includes('veículo') || t.includes('veiculo') || sub.includes('transporte')) return 'Transporte';
  if (sub.includes('saúde') || sub.includes('saude') || sub.includes('plano')) return 'Saúde';
  if (t.includes('cart')) return 'Financeiro';
  return 'Pessoais';
}
// Preferir categoria salva quando existir
function displayCategory(d: DocumentItem): string {
  return d.category || categoryForDoc(d);
}

function accentColorForCategory(cat?: string): string | null {
  switch (cat) {
    case 'Financeiro': return '#EF4444';
    case 'Saúde': return '#10B981';
    case 'Transporte': return '#22C55E';
    case 'Trabalho': return '#F59E0B';
    case 'Estudo': return '#8B5CF6';
    case 'Pessoais': return '#3B82F6';
    default: return null;
  }
}

// Fundo do card por categoria (tons suaves)
function accentBgForCategory(cat?: string): string {
  const c = (cat || '').toLowerCase();
  if (c.includes('financeiro')) return 'rgba(239, 68, 68, 0.10)';   // vermelho suave
  if (c.includes('saúde')) return 'rgba(16, 185, 129, 0.10)';       // verde suave
  if (c.includes('transporte')) return 'rgba(34, 197, 94, 0.12)';   // verde médio
  if (c.includes('trabalho')) return 'rgba(245, 158, 11, 0.12)';    // amarelo suave
  if (c.includes('estudo')) return 'rgba(139, 92, 246, 0.10)';      // roxo suave
  if (c.includes('pessoais')) return 'rgba(59, 130, 246, 0.10)';    // azul suave
  return 'rgba(158, 158, 158, 0.08)';                               // cinza neutro
}

export default function DashboardScreen({ onAdd, onOpen, onUpgrade, onLogout, userId }: { onAdd: () => void; onOpen: (doc: DocumentItem) => void; onUpgrade: (tab?: 'premium' | 'buy-storage') => void; onLogout?: () => void; userId: string; }) {
  const navigation = useNavigation<any>();
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        userId && userId !== 'anonymous' ? (
          <StorageUsageCard userId={userId} onOpenUpgrade={() => navigation.navigate('Upgrade', { initialTab: isPremiumPlan ? 'buy-storage' : 'premium' })} variant="header" />
        ) : null
      ),
    });
  }, [navigation, userId, isPremiumPlan]);
  const { showToast } = useToast();
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [limitReached, setLimitReached] = useState(false);
  const [deviceCount, setDeviceCount] = useState<number | null>(null);
  const [deviceLimit, setDeviceLimit] = useState<number | null>(null);
  const [isPremiumDevices, setIsPremiumDevices] = useState<boolean>(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [shareDoc, setShareDoc] = useState<DocumentItem | null>(null);
  const { width } = useWindowDimensions();
  const showBrandText = Platform.OS !== 'web' || width >= 420;
  const [isPremiumPlan, setIsPremiumPlan] = useState<boolean>(false);
  const menuScale = useRef(new Animated.Value(0.95)).current;
  const menuOpacity = useRef(new Animated.Value(0)).current;
  const [isTypeMenuOpen, setIsTypeMenuOpen] = useState(false);
  const typeMenuScale = useRef(new Animated.Value(0.95)).current;
  const typeMenuOpacity = useRef(new Animated.Value(0)).current;
const allowsNativeDriver = Platform.OS !== 'web';

  // Busca e filtros
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [syncedOnly, setSyncedOnly] = useState(false);
  const [expiryFilter, setExpiryFilter] = useState<'all' | 'expired' | 'soon'>('all');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [loadingDocs, setLoadingDocs] = useState(false);

  const filteredDocs = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byTextAndType = docs.filter((d) => {
      const matchesQuery = !q || (d.name?.toLowerCase().includes(q) || d.number?.toLowerCase().includes(q));
      const matchesSync = !syncedOnly || (d.synced === 1);
      const matchesFav = !favoritesOnly || (d.favorite === 1);
      const matchesCat = !categoryFilter || displayCategory(d) === categoryFilter;
      return matchesQuery && matchesSync && matchesFav && matchesCat;
    });
    return filterByExpiry(byTextAndType, expiryFilter);
  }, [docs, query, syncedOnly, favoritesOnly, expiryFilter, categoryFilter]);

  const expiredCount = useMemo(() => filterByExpiry(docs, 'expired').length, [docs]);
  const soonCount = useMemo(() => filterByExpiry(docs, 'soon').length, [docs]);

  const load = useCallback(async () => {
    setMenuFor(null);
    initDb();
    setLoadingDocs(true);
    const [items, cnt] = await Promise.all([getDocuments(), countDocuments()]);
    let docCount = cnt;
    
    console.log('[dashboard] load start', {
      userId,
      base: process.env.EXPO_PUBLIC_API_BASE || process.env.EXPO_PUBLIC_API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : ''),
      localCount: items.length,
    });

    // Tenta sincronizar pendentes (criados/atualizados no web sem login)
    try {
      if (userId && userId !== 'anonymous') {
        const unsynced = items.filter(d => d.synced !== 1);
        for (const doc of unsynced) {
          try {
            await syncDocumentAddOrUpdate({ id: doc.id, appId: doc.appId, name: doc.name, number: doc.number, frontImageUri: doc.frontImageUri, backImageUri: doc.backImageUri }, userId);
            await updateDocument({ ...doc, synced: 1 });
          } catch (e) {
            console.log('[sync] deferred sync failed', e);
          }
        }
      }
    } catch {}

    const base = process.env.EXPO_PUBLIC_API_BASE || process.env.EXPO_PUBLIC_API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
    let isPremium = false;
    let usedRemote = false;
    try {
      if (base && userId && userId !== 'anonymous') {
        const res = await fetch(`${base}/.netlify/functions/get-user-status?userId=${userId}`);
        if (res.ok) {
          const json = await res.json();
          isPremium = !!json?.is_premium;
        }
      }
    } catch {}

    // Tenta carregar documentos remotos do Supabase
    try {
      if (userId && userId !== 'anonymous') {
        console.log('[dashboard] supabase query start');
        const selectUnified = 'app_id,name,number,front_path,back_path,updated_at,type,issue_date,expiry_date,issuing_state,issuing_city,issuing_authority,elector_zone,elector_section,card_subtype,card_brand,bank,cvc';
        const selectDocs = 'app_id,name,number,front_path,back_path,updated_at,type,issue_date,expiry_date,issuing_state,issuing_city,issuing_authority';

        let rows: any = null;
         let fromUnified = false;
 
         // Tenta view unificada primeiro
         const { data: vrows, error: verr } = await supabase
           .from('documents_unified_view')
           .select(selectUnified)
           .eq('user_id', userId)
           .order('updated_at', { ascending: false });
 
         if (!verr && vrows && vrows.length) {
           rows = vrows;
           fromUnified = true;
         } else {
          const { data: remote, error } = await supabase
            .from('documents')
            .select(selectDocs)
            .eq('user_id', userId)
            .order('updated_at', { ascending: false });
          rows = remote;
          if ((error && error.message && /api key|apikey/i.test(error.message)) || (!rows || rows.length === 0)) {
            // Fallback robusto: tenta REST com view e depois com a tabela
            if (SUPABASE_URL && SUPABASE_ANON_KEY) {
              const { data: sessionData } = await supabase.auth.getSession();
              const accessToken = (sessionData as any)?.session?.access_token as string | undefined;
              const headers: any = { apikey: SUPABASE_ANON_KEY };
              if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
              const qsUnified = new URLSearchParams({
                select: selectUnified,
                order: 'updated_at.desc',
              });
              let r = await fetch(`${SUPABASE_URL}/rest/v1/documents_unified_view?${qsUnified.toString()}&user_id=eq.${encodeURIComponent(userId)}&apikey=${encodeURIComponent(SUPABASE_ANON_KEY)}`, { headers });
              if (r.ok) {
                rows = await r.json();
              } else {
                const qsDocs = new URLSearchParams({
                  select: selectDocs,
                  order: 'updated_at.desc',
                });
                r = await fetch(`${SUPABASE_URL}/rest/v1/documents?${qsDocs.toString()}&user_id=eq.${encodeURIComponent(userId)}&apikey=${encodeURIComponent(SUPABASE_ANON_KEY)}`, { headers });
                if (r.ok) {
                  rows = await r.json();
                } else {
                  const body = await r.text();
                  console.warn('[rest fallback] status', r.status, body);
                }
              }
            }
          }
        }

        if (rows && rows.length > 0) {
          console.log('[dashboard] remote rows', rows.length);
          // Consulta em lote dos metadados de doc_eleitor para todos os app_ids relevantes
          const eleitorAppIds = rows
            .filter((d: any) => ((d.type || '') as string).toLowerCase().includes('eleitor'))
            .map((d: any) => d.app_id);
          let eleMap = new Map<number, { zone?: string; section?: string }>();
          if (eleitorAppIds.length > 0) {
            try {
              const { data: eleRows } = await supabase
                .from('doc_eleitor')
                .select('app_id,elector_zone,elector_section')
                .eq('user_id', userId)
                .in('app_id', eleitorAppIds);
              if (eleRows && eleRows.length) {
                for (const e of eleRows as any[]) {
                  eleMap.set((e as any).app_id, { zone: (e as any).elector_zone, section: (e as any).elector_section });
                }
              }
            } catch {}
          }

          // Consulta em lote dos metadados de RG
          const rgAppIds = rows
            .filter((d: any) => ((d.type || '') as string).toLowerCase().includes('rg'))
            .map((d: any) => d.app_id);
          let rgMap = new Map<number, { issue_date?: any; issuing_state?: any; issuing_city?: any; issuing_authority?: any }>();
          if (rgAppIds.length > 0) {
            try {
              const { data: rgRows } = await supabase
                .from('doc_rg')
                .select('app_id,issue_date,issuing_state,issuing_city,issuing_authority')
                .eq('user_id', userId)
                .in('app_id', rgAppIds);
              if (rgRows && rgRows.length) {
                for (const r of rgRows as any[]) {
                  rgMap.set((r as any).app_id, {
                    issue_date: (r as any).issue_date,
                    issuing_state: (r as any).issuing_state,
                    issuing_city: (r as any).issuing_city,
                    issuing_authority: (r as any).issuing_authority,
                  });
                }
              }
            } catch {}
          }

          // Consulta em lote dos metadados de CNH
          const cnhAppIds = rows
            .filter((d: any) => ((d.type || '') as string).toLowerCase().includes('cnh'))
            .map((d: any) => d.app_id);
          let cnhMap = new Map<number, { issue_date?: any; expiry_date?: any; issuing_state?: any; issuing_city?: any; issuing_authority?: any }>();
          if (cnhAppIds.length > 0) {
            try {
              const { data: cnhRows } = await supabase
                .from('doc_cnh')
                .select('app_id,issue_date,expiry_date,issuing_state,issuing_city,issuing_authority')
                .eq('user_id', userId)
                .in('app_id', cnhAppIds);
              if (cnhRows && cnhRows.length) {
                for (const c of cnhRows as any[]) {
                  cnhMap.set((c as any).app_id, {
                    issue_date: (c as any).issue_date,
                    expiry_date: (c as any).expiry_date,
                    issuing_state: (c as any).issuing_state,
                    issuing_city: (c as any).issuing_city,
                    issuing_authority: (c as any).issuing_authority,
                  });
                }
              }
            } catch {}
          }

          // Busca URLs assinadas em lote para todos os app_ids
          let signedMap: Record<number, { frontSignedUrl?: string | null; backSignedUrl?: string | null }> = {};
          try {
            const appIds = Array.from(new Set(rows.map((d: any) => d.app_id).filter((x: any) => x != null)));
            if (base && userId && appIds.length > 0) {
              const r = await fetch(`${base}/.netlify/functions/signed-urls`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, appIds }),
              });
              if (r.ok) {
                signedMap = await r.json();
              } else {
                const pairs = await Promise.all(appIds.map(async (id: number) => {
                  try {
                    const rr = await fetch(`${base}/.netlify/functions/signed-urls?userId=${encodeURIComponent(userId)}&appId=${encodeURIComponent(id)}`);
                    if (rr.ok) return [id, await rr.json()] as const;
                  } catch {}
                  return [id, { frontSignedUrl: '', backSignedUrl: '' }] as const;
                }));
                signedMap = Object.fromEntries(pairs);
              }
            }
          } catch {}

          const mapped: DocumentItem[] = await Promise.all(
            rows.map(async (d: any) => {
              const s = (signedMap as any)[d.app_id] || {};
              const front = s.frontSignedUrl || '';
              const back = s.backSignedUrl || '';
              const obj: any = {
                appId: d.app_id,
                name: d.name,
                number: d.number,
                frontImageUri: front,
                backImageUri: back,
                type: d.type || undefined,
                issueDate: d.issue_date || undefined,
                expiryDate: d.expiry_date || undefined,
                issuingState: d.issuing_state || undefined,
                issuingCity: d.issuing_city || undefined,
                issuingAuthority: d.issuing_authority || undefined,
                electorZone: d.elector_zone || undefined,
                electorSection: d.elector_section || undefined,
                cardSubtype: d.card_subtype || undefined,
                bank: d.bank || undefined,
                cvc: d.cvc || undefined,
                cardBrand: d.card_brand || undefined,
                synced: 1,
                updatedAt: d.updated_at ? new Date(d.updated_at).getTime() : undefined,
              } as DocumentItem;
              // Hidratação em lote: usar mapas lidos de doc_rg e doc_cnh
              const rg = rgMap.get(d.app_id);
              if (rg) {
                if (obj.issueDate == null && rg.issue_date != null) obj.issueDate = rg.issue_date as any;
                if (obj.issuingState == null && rg.issuing_state != null) obj.issuingState = rg.issuing_state as any;
                if (obj.issuingCity == null && rg.issuing_city != null) obj.issuingCity = rg.issuing_city as any;
                if (obj.issuingAuthority == null && rg.issuing_authority != null) obj.issuingAuthority = rg.issuing_authority as any;
              }
              const cnh = cnhMap.get(d.app_id);
              if (cnh) {
                if (obj.issueDate == null && cnh.issue_date != null) obj.issueDate = cnh.issue_date as any;
                if (obj.expiryDate == null && cnh.expiry_date != null) obj.expiryDate = cnh.expiry_date as any;
                if (obj.issuingState == null && cnh.issuing_state != null) obj.issuingState = cnh.issuing_state as any;
                if (obj.issuingCity == null && cnh.issuing_city != null) obj.issuingCity = cnh.issuing_city as any;
                if (obj.issuingAuthority == null && cnh.issuing_authority != null) obj.issuingAuthority = cnh.issuing_authority as any;
              }
              // Hidratação em lote: usar mapa lido de doc_eleitor
              const e = eleMap.get(d.app_id);
              if (e) {
                if (obj.electorZone == null) obj.electorZone = e.zone as any;
                if (obj.electorSection == null) obj.electorSection = e.section as any;
              }
              return obj as DocumentItem;
            })
          );

          const safeId = (v: any) => {
            const MAX = 2147483647;
            if (typeof v === 'number') return (v > 0 && v <= MAX) ? v : (Math.abs(v) % MAX) || 1;
            const s = String(v || '');
            let h = 2166136261;
            for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h += (h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24); }
            return (Math.abs(h) % MAX) || 1;
          };
          const byKey = new Map<string, DocumentItem>();
          for (const loc of items) {
            const k = String(safeId((loc as any).appId ?? loc.id));
            byKey.set(k, loc);
          }
          for (const rem of mapped) {
            const matchLoc = items.find(loc => {
              const keyNum = safeId((loc as any).appId ?? loc.id);
              return (
                String(keyNum) === String(rem.appId) &&
                (
                  (loc.number && rem.number && loc.number === rem.number) ||
                  (loc.name && rem.name && loc.name === rem.name) ||
                  (loc.cardSubtype && rem.cardSubtype && loc.cardSubtype === rem.cardSubtype)
                )
              );
            });
            const targetKey = matchLoc ? String(safeId((matchLoc as any).appId ?? matchLoc.id)) : String(rem.appId);
            const prev = byKey.get(targetKey);
            const mergedItem: DocumentItem = {
              ...(prev || {}),
              ...(rem || {}),
              name: rem.name || prev?.name || 'Documento',
              number: rem.number || prev?.number || '',
              frontImageUri: rem.frontImageUri || prev?.frontImageUri,
              backImageUri: rem.backImageUri || prev?.backImageUri,
              // Preserva campos de tipo/brand/datas se remoto vier vazio
              type: (rem as any)?.type ?? (prev as any)?.type,
              cardBrand: (rem as any)?.cardBrand ?? (prev as any)?.cardBrand,
              cardSubtype: (rem as any)?.cardSubtype ?? (prev as any)?.cardSubtype,
              issueDate: (rem as any)?.issueDate ?? (prev as any)?.issueDate,
              expiryDate: (rem as any)?.expiryDate ?? (prev as any)?.expiryDate,
              // Preserva metadados de RG/CNH/Eleitor quando remoto está vazio
              issuingState: (rem as any)?.issuingState ?? (prev as any)?.issuingState,
              issuingCity: (rem as any)?.issuingCity ?? (prev as any)?.issuingCity,
              issuingAuthority: (rem as any)?.issuingAuthority ?? (prev as any)?.issuingAuthority,
              electorZone: (rem as any)?.electorZone ?? (prev as any)?.electorZone,
              electorSection: (rem as any)?.electorSection ?? (prev as any)?.electorSection,
              // Preserva campos de cartões quando remoto está vazio
              bank: (rem as any)?.bank ?? (prev as any)?.bank,
              cvc: (rem as any)?.cvc ?? (prev as any)?.cvc,
              updatedAt: rem.updatedAt ?? prev?.updatedAt,
            } as DocumentItem;
            byKey.set(targetKey, mergedItem);
          }
          const merged = Array.from(byKey.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
          console.log('[dashboard] set remote docs', merged.length);
          setDocs(merged);
          docCount = merged.length;
          usedRemote = true;
        }
      }
    } catch (e) {
      console.warn('[dashboard] supabase load error', e);
    }

    // Fallback para documentos locais (apenas se remoto não foi usado)
    if (!usedRemote) {
      console.log('[dashboard] using local items', items.length);
      setDocs(items);
    } else {
      console.log('[dashboard] remote docs already set, skipping local fallback');
    }
    setLimitReached(!isPremium && docCount >= 4);
    setLoadingDocs(false);
      }, [userId]);

      useEffect(() => {
        load();
      }, [load]);

      useEffect(() => {
        (async () => {
          if (!Array.isArray(docs) || !docs.length) return;
          try {
            const SecureStore = await import('expo-secure-store');
            const pref = await SecureStore.getItemAsync('notificationsEnabled');
            if (pref === 'true') {
              scheduleExpiryNotifications(docs).catch(() => {});
            }
          } catch {
            // Sem SecureStore no Web; não agenda automaticamente
          }
        })();
      }, [docs]);

      useEffect(() => {
        if (headerMenuOpen) {
          menuScale.setValue(0.95);
          menuOpacity.setValue(0);
          Animated.parallel([
            Animated.timing(menuScale, { toValue: 1, duration: 140, useNativeDriver: allowsNativeDriver }),
            Animated.timing(menuOpacity, { toValue: 1, duration: 140, useNativeDriver: allowsNativeDriver }),
          ]).start();
        }
      }, [headerMenuOpen]);

      const logout = async () => {
        try { await supabase.auth.signOut(); } catch {}
        onLogout?.();
      };

      useLayoutEffect(() => {
        navigation.setOptions({
          headerTitle: '',
          headerTitleAlign: 'left',
          headerLeft: () => (
            <View style={{ flexDirection:'row', alignItems:'center', paddingLeft: 8 }}>
              {logoError ? (
                <>
                  <Ionicons name='document-text' size={28} color={colors.text} />
                  {showBrandText && (
                    <Text style={{ marginLeft: 8, color: colors.text, fontSize: 18, fontWeight: '800', fontFamily: Platform.OS === 'web' ? undefined : 'Nunito_700Bold' }}>EVDocs</Text>
                  )}
                </>
              ) : (
                <>
                  <Image source={require('../../assets/icon.png')} onError={() => setLogoError(true)} style={{ width: Platform.OS === 'web' ? 40 : 70, height: Platform.OS === 'web' ? 40 : 70 }} />
                  {showBrandText && (
                    <Text style={{ marginLeft:  8, color: colors.text, fontSize: 18, fontWeight: '800', fontFamily: Platform.OS === 'web' ? undefined : 'Nunito_700Bold' }}>EVDocs</Text>
                  )}
                </>
              )}
            </View>
          ),
          headerRight: () => (
            <View style={{ flexDirection:'row', alignItems:'center' }}>
              {userId && userId !== 'anonymous' ? (
                <View style={{ marginRight: 8 }}>
                  <StorageUsageCard userId={userId} onOpenUpgrade={() => navigation.navigate('Upgrade', { initialTab: isPremiumPlan ? 'buy-storage' : 'premium' })} variant="header" />
                </View>
              ) : null}
              <View style={{ position:'relative', paddingVertical:6, paddingHorizontal:10, marginRight: 6 }}>
                <TouchableOpacity onPress={() => setNotificationsOpen(true)}>
                  <Ionicons name={notifMessages.length ? 'notifications' : 'notifications-outline'} size={22} color={colors.text} />
                </TouchableOpacity>
                {notifMessages.length > 0 && (
                  <View style={{ position:'absolute', top:2, right:6, backgroundColor: dangerColor, borderRadius:9, minWidth:18, height:18, alignItems:'center', justifyContent:'center', paddingHorizontal:3 }}>
                    <Text style={{ color:'#fff', fontSize:10, fontWeight:'800' }}>{notifMessages.length > 9 ? '9+' : String(notifMessages.length)}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={() => setHeaderMenuOpen(true)} style={{ paddingVertical:6, paddingHorizontal:10, marginRight: 10 }}>
                <Ionicons name='ellipsis-vertical' size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
          ),
        });
      }, [navigation, load, logoError, width, isPremiumPlan]);

      const onEdit = (doc: DocumentItem) => {
        navigation.navigate('Edit', { doc });
      };

      const onShare = async (doc: DocumentItem) => {
        // Abrir folha de compartilhamento com links seguros quando possível
        setShareDoc(doc);
      };

      function keyForItem(d: DocumentItem): string {
      return String(d.appId || d.id || `${d.name}-${d.number}-${d.type || 'Outros'}`);
    }

      const onToggleFavorite = async (doc: DocumentItem) => {
        try {
          if (doc.id) {
            await updateDocument({ ...doc, favorite: doc.favorite ? 0 : 1, synced: 0 });
          } else {
            await addDocument({ ...doc, favorite: doc.favorite ? 0 : 1, synced: 0 });
          }
          await load();
          showToast(doc.favorite ? 'Removido dos favoritos' : 'Adicionado aos favoritos', { type: 'success' });
        } catch (e) {
          Alert.alert('Erro ao atualizar favorito', String(e));
        }
      };

      const onDelete = useCallback((doc: DocumentItem) => {
        const name = doc.name || 'Documento';
        Alert.alert(
          'Excluir documento',
          `Tem certeza que deseja excluir "${name}"?`,
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Excluir',
              style: 'destructive',
              onPress: async () => {
                try {
                  const itemKey = keyForItem(doc);
                  console.log('[dashboard] delete confirm', { key: itemKey, appId: (doc as any).appId, name: doc.name, number: doc.number });
                  setMenuFor(null);
                  setDocs((prev) => prev.filter((d) => keyForItem(d) !== itemKey));
                  const localDocs = await getDocuments().catch(() => []);
                  const localMatch = localDocs.find((d: any) => keyForItem(d) === itemKey);
                  if (localMatch && (localMatch as any).id) {
                    await deleteDocument((localMatch as any).id).catch((e) => console.error('[dashboard] local delete error', e));
                  }
                  const userId = auth?.userId;
                  const canSync = !!userId && userId !== 'anonymous' && /^[0-9a-f-]{36}$/i.test(userId);
                  if (canSync) {
                    const forSync = (doc as any).appId ?? (localMatch as any)?.id ?? doc.number ?? doc.name ?? itemKey;
                    await syncDocumentDelete(forSync, userId).catch((e) => console.error('[dashboard] remote delete error', e));
                  } else {
                    console.log('[dashboard] skip remote delete: invalid userId');
                  }
                  load();
                  showToast('Documento excluído.', { type: 'success' });
                } catch (e) {
                  console.error('[dashboard] onDelete error', e);
                  showToast('Erro ao excluir documento.', { type: 'error' });
                }
              },
            },
          ]
        );
      }, [userId, load]);
      const [hoveredKey, setHoveredKey] = useState<string | null>(null);
       const [focusedKey, setFocusedKey] = useState<string | null>(null);
      const renderItem = ({ item }: { item: DocumentItem }) => {
        const icon = iconForType(item.type);
        const hasId = typeof item.id === 'number';
        const itemKey = keyForItem(item);
        const isOpen = menuFor === itemKey;
        const accentBg = accentBgForCategory(displayCategory(item));
        return (
          <Pressable onPress={() => onOpen(item)} onHoverIn={() => setHoveredKey(itemKey)} onHoverOut={() => setHoveredKey((k) => (k === itemKey ? null : k))} onFocus={() => setFocusedKey(itemKey)} onBlur={() => setFocusedKey((k) => (k === itemKey ? null : k))} style={({ pressed }) => ({ flex:1, margin:8, padding:14, backgroundColor: accentBg, borderWidth:1, borderColor:'#E5E7EB', borderRadius:12, shadowColor:'#000', shadowOpacity:0.06, shadowRadius:12, elevation: isOpen ? 12 : 2, zIndex: isOpen ? 1000 : 0, overflow:'visible', opacity: pressed || hoveredKey === itemKey ? 0.97 : 1, transform: [{ scale: pressed ? 0.98 : hoveredKey === itemKey ? 0.99 : 1 }], outlineWidth: Platform.OS === 'web' && focusedKey === itemKey ? 2 : 0, outlineColor: Platform.OS === 'web' && focusedKey === itemKey ? '#60A5FA' : 'transparent', outlineStyle: Platform.OS === 'web' && focusedKey === itemKey ? 'solid' : 'none' })}>
            <View style={{ flexDirection:'row', alignItems:'center' }}>
              <View style={{ width:36, height:36, borderRadius:8, backgroundColor:'#F9FAFB', alignItems:'center', justifyContent:'center', marginRight:10 }}>
                {item.type === 'Cartões' && !!item.cardBrand ? (
                  <FontAwesome name={brandIconName(item.cardBrand) as any} size={20} color={'#374151'} />
                ) : (
                  <Ionicons name={icon.name} size={22} color={accentColorForCategory(displayCategory(item)) || icon.color} />
                )}
              </View>
              <View style={{ flex:1 }}>
                <Text style={{ fontSize:16, fontWeight:'800', color:'#111827' }}>{item.name}</Text>
                <Text style={{ fontSize:12, color:'#6B7280', marginTop:2, fontWeight:'500' }}>{item.type || 'Documento'}</Text>
              </View>
              <TouchableOpacity onPress={() => setMenuFor(itemKey)}>
                <Ionicons name='ellipsis-vertical' size={20} color={'#9CA3AF'} />
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize:12, color:'#374151', marginTop:10 }}>{item.number || '—'}</Text>

            <View style={{ flexDirection:'row', flexWrap:'wrap', marginTop:8 }}>
              {item.cardSubtype ? (
                <View style={{ paddingVertical:4, paddingHorizontal:8, borderRadius:9999, backgroundColor:'#EEF2FF', marginRight:6, marginBottom:6 }}>
                  <Text style={{ fontSize:11, fontWeight:'700', color:'#334155' }}>{item.cardSubtype}</Text>
                </View>
              ) : null}
              {item.cardBrand ? (
                <View style={{ paddingVertical:4, paddingHorizontal:8, borderRadius:9999, backgroundColor:'#F5F3FF', marginRight:6, marginBottom:6, flexDirection:'row', alignItems:'center' }}>
                  <FontAwesome name={brandIconName(item.cardBrand) as any} size={14} color={'#4B5563'} />
                  <Text style={{ fontSize:11, fontWeight:'700', color:'#4B5563', marginLeft:6 }}>{item.cardBrand}</Text>
                </View>
              ) : null}
              {item.bank ? (
                <View style={{ paddingVertical:4, paddingHorizontal:8, borderRadius:9999, backgroundColor:'#ECFDF5', marginRight:6, marginBottom:6 }}>
                  <Text style={{ fontSize:11, fontWeight:'700', color:'#065F46' }}>{item.bank}</Text>
                </View>
              ) : null}
              {item.expiryDate ? (() => {
                  const d = parseExpiryDate(item.expiryDate);
                  const days = d ? Math.ceil((d.getTime() - Date.now()) / (1000*60*60*24)) : null;
                  const expired = isExpired(item.expiryDate);
                  const soon = isExpiringSoon(item.expiryDate);
                  if (expired) return (
                    <View style={{ paddingVertical:4, paddingHorizontal:8, borderRadius:9999, backgroundColor:'#FEE2E2', marginRight:6, marginBottom:6, flexDirection:'row', alignItems:'center' }}>
                      <Ionicons name='alert-circle' size={14} color={'#EF4444'} />
                      <Text style={{ fontSize:11, fontWeight:'700', color:'#EF4444', marginLeft:6 }}>Vencido</Text>
                    </View>
                  );
                  if (soon && days !== null) return (
                    <View style={{ paddingVertical:4, paddingHorizontal:8, borderRadius:9999, backgroundColor:'#FEF3C7', marginRight:6, marginBottom:6, flexDirection:'row', alignItems:'center' }}>
                      <Ionicons name='alert-circle' size={14} color={'#F59E0B'} />
                      <Text style={{ fontSize:11, fontWeight:'700', color:'#F59E0B', marginLeft:6 }}>Vence em {days} dias</Text>
                    </View>
                  );
                  return null;
                })() : null}
              {(item.issueDate && (item.type === 'RG' || item.type === 'CNH')) ? (
                <View style={{ paddingVertical:4, paddingHorizontal:8, borderRadius:9999, backgroundColor:'#F3F4F6', borderWidth:1, borderColor:'#E5E7EB', marginRight:6, marginBottom:6 }}>
                  <Text style={{ fontSize:11, fontWeight:'700', color:'#374151' }}>Exp.: {item.issueDate}</Text>
                </View>
              ) : null}
              {(item.electorZone || item.electorSection) && item.type === 'Título de Eleitor' ? (
                <View style={{ paddingVertical:4, paddingHorizontal:8, borderRadius:9999, backgroundColor:'#DBEAFE', marginRight:6, marginBottom:6 }}>
                  <Text style={{ fontSize:11, fontWeight:'700', color:'#0C4A6E' }}>Zona {item.electorZone || '—'} • Seção {item.electorSection || '—'}</Text>
                </View>
              ) : null}
              <View style={{ paddingVertical:4, paddingHorizontal:8, borderRadius:9999, backgroundColor:'#F3F4F6', borderWidth:1, borderColor:'#E5E7EB', marginRight:6, marginBottom:6 }}>
                <Text style={{ fontSize:11, fontWeight:'700', color:'#374151' }}>{displayCategory(item)}</Text>
              </View>
            </View>

            {hoveredKey === itemKey && (
              <View style={{ position:'absolute', right:12, bottom:12, flexDirection:'row' }}>
                {item.number ? (
                  <TouchableOpacity onPress={() => Clipboard.setStringAsync(item.number!)} style={{ backgroundColor:'#111827', paddingVertical:6, paddingHorizontal:10, borderRadius:9999, marginLeft:8, flexDirection:'row', alignItems:'center' }}>
                    <Ionicons name='copy-outline' size={14} color={'#fff'} style={{ marginRight:6 }} />
                    <Text style={{ color:'#fff', fontSize:12, fontWeight:'700' }}>Copiar número</Text>
                  </TouchableOpacity>
                ) : null}
                {item.frontImageUri ? (
                  <TouchableOpacity onPress={() => Linking.openURL(item.frontImageUri!)} style={{ backgroundColor:'#111827', paddingVertical:6, paddingHorizontal:10, borderRadius:9999, marginLeft:8, flexDirection:'row', alignItems:'center' }}>
                    <Ionicons name='download-outline' size={14} color={'#fff'} style={{ marginRight:6 }} />
                    <Text style={{ color:'#fff', fontSize:12, fontWeight:'700' }}>Baixar frente</Text>
                  </TouchableOpacity>
                ) : null}
                {item.backImageUri ? (
                  <TouchableOpacity onPress={() => Linking.openURL(item.backImageUri!)} style={{ backgroundColor:'#111827', paddingVertical:6, paddingHorizontal:10, borderRadius:9999, marginLeft:8, flexDirection:'row', alignItems:'center' }}>
                    <Ionicons name='download-outline' size={14} color={'#fff'} style={{ marginRight:6 }} />
                    <Text style={{ color:'#fff', fontSize:12, fontWeight:'700' }}>Baixar verso</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}

            {isOpen && (
                <Pressable onStartShouldSetResponder={() => true} style={{ position:'absolute', right:14, top:14, backgroundColor:'#fff', borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, shadowColor:'#000', shadowOpacity:0.08, shadowRadius:14, elevation:12, zIndex: 2000 }}>
                  <TouchableOpacity onPress={() => { setMenuFor(null); onToggleFavorite(item); }} style={{ paddingVertical:10, paddingHorizontal:14, flexDirection:'row', alignItems:'center' }}>
                    <Ionicons name={item.favorite ? 'star' : 'star-outline'} size={18} color={primaryColor} style={{ marginRight:8 }} />
                    <Text style={{ fontSize:14, color: primaryColor, fontWeight:'600' }}>{item.favorite ? 'Desfavoritar' : 'Favoritar'}</Text>
                  </TouchableOpacity>
                  <View style={{ height:1, backgroundColor:'#E5E7EB' }} />
                  <TouchableOpacity onPress={() => { setMenuFor(null); onEdit(item); }} style={{ paddingVertical:10, paddingHorizontal:14, flexDirection:'row', alignItems:'center' }}>
                    <Ionicons name='create-outline' size={18} color={'#111827'} style={{ marginRight:8 }} />
                    <Text style={{ fontSize:14, color: '#111827', fontWeight:'600' }}>Editar</Text>
                  </TouchableOpacity>
                  <View style={{ height:1, backgroundColor:'#E5E7EB' }} />
                  <TouchableOpacity onPress={() => { setMenuFor(null); onShare(item); }} style={{ paddingVertical:10, paddingHorizontal:14, flexDirection:'row', alignItems:'center' }}>
                    <Ionicons name='share-social-outline' size={18} color={primaryColor} style={{ marginRight:8 }} />
                    <Text style={{ fontSize:14, color: primaryColor, fontWeight:'600' }}>Compartilhar</Text>
                  </TouchableOpacity>
                  <View style={{ height:1, backgroundColor:'#E5E7EB' }} />
                  <TouchableOpacity onPress={() => { setMenuFor(null); onDelete(item); }} style={{ paddingVertical:10, paddingHorizontal:14, flexDirection:'row', alignItems:'center' }}>
                    <Ionicons name='trash-outline' size={18} color={dangerColor} style={{ marginRight:8 }} />
                    <Text style={{ fontSize:14, color: dangerColor, fontWeight:'600' }}>Excluir</Text>
                  </TouchableOpacity>
                </Pressable>
              )}
          </Pressable>
        );
      }; // end renderItem

      useEffect(() => {
        let cancelled = false;
        (async () => {
          try {
            if (!userId || userId === 'anonymous') return;
            const base = process.env.EXPO_PUBLIC_API_BASE || process.env.EXPO_PUBLIC_API_BASE_URL || (typeof window !== 'undefined' ? (window as any).location.origin : '');
            if (!base) return;
            const res = await fetch(`${base}/.netlify/functions/devices?userId=${encodeURIComponent(userId)}`);
            if (!res.ok) return;
            const j = await res.json();
            if (!cancelled) {
              setDeviceCount(j?.count ?? null);
              setDeviceLimit(j?.limit ?? null);
              setIsPremiumDevices(!!j?.is_premium);
            }
          } catch {}
        })();
        return () => { cancelled = true; };
      }, [userId]);

      const deviceLimitReached = deviceCount !== null && deviceLimit !== null && deviceCount >= deviceLimit;
      const notifMessages: string[] = [];
      if (deviceLimitReached) {
        notifMessages.push(isPremiumDevices
          ? `Limite premium de dispositivos atingido (${deviceCount}/${deviceLimit}).`
          : `Limite de dispositivos atingido (${deviceCount}/${deviceLimit}). Faça upgrade para adicionar mais.`);
      }
      if (limitReached) notifMessages.push('Limite gratuito de 4 documentos atingido. Desbloqueie Premium.');

      // Alertas de vencimento de documentos (util compartilhado)
      buildExpiryAlerts(docs).forEach((msg) => notifMessages.push(msg));

      const [notificationsOpen, setNotificationsOpen] = useState(false);

      useLayoutEffect(() => {
        navigation.setOptions({
          headerTitle: '',
          headerTitleAlign: 'left',
          headerLeft: () => (
            <View style={{ flexDirection:'row', alignItems:'center', paddingLeft: 8 }}>
              {logoError ? (
                <>
                  <Ionicons name='document-text' size={28} color={colors.text} />
                  <Text style={{ marginLeft: 8, color: colors.text, fontSize: 18, fontWeight: '800', fontFamily: 'Inter' }}>EVDocs</Text>
                </>
              ) : (
                <>
                  <Image source={require('../../assets/icon.png')} onError={() => setLogoError(true)} style={{ width:70, height:70 }} />
                  <Text style={{ marginLeft: 8, color: colors.text, fontSize: 18, fontWeight: '800', fontFamily: 'Inter' }}>EVDocs</Text>
                </>
              )}
            </View>
          ),
          headerRight: () => (
            <View style={{ flexDirection:'row', alignItems:'center' }}>
              {userId && userId !== 'anonymous' ? (
                <View style={{ marginRight: 8 }}>
                  <StorageUsageCard userId={userId} onOpenUpgrade={(tab) => navigation.navigate('Upgrade', { initialTab: tab })} variant="header" />
                </View>
              ) : null}
              <View style={{ position:'relative', paddingVertical:6, paddingHorizontal:10, marginRight: 6 }}>
                <TouchableOpacity onPress={() => setNotificationsOpen(true)}>
                  <Ionicons name={notifMessages.length ? 'notifications' : 'notifications-outline'} size={22} color={colors.text} />
                </TouchableOpacity>
                {notifMessages.length > 0 && (
                  <View style={{ position:'absolute', top:2, right:6, backgroundColor: dangerColor, borderRadius:9, minWidth:18, height:18, alignItems:'center', justifyContent:'center', paddingHorizontal:3 }}>
                    <Text style={{ color:'#fff', fontSize:10, fontWeight:'800' }}>{notifMessages.length > 9 ? '9+' : String(notifMessages.length)}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={() => setHeaderMenuOpen(true)} style={{ paddingVertical:6, paddingHorizontal:10, marginRight: 10 }}>
                <Ionicons name='ellipsis-vertical' size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
          ),
        });
      }, [navigation, logoError, notifMessages.length]);

      // Dropdown de tipos: animação de abertura/fechamento
      useEffect(() => {
        if (isTypeMenuOpen) {
          Animated.parallel([
            Animated.timing(typeMenuScale, { toValue: 1, duration: 120, useNativeDriver: allowsNativeDriver }),
            Animated.timing(typeMenuOpacity, { toValue: 1, duration: 120, useNativeDriver: allowsNativeDriver }),
          ]).start();
        } else {
          Animated.parallel([
            Animated.timing(typeMenuScale, { toValue: 0.95, duration: 100, useNativeDriver: allowsNativeDriver }),
            Animated.timing(typeMenuOpacity, { toValue: 0, duration: 100, useNativeDriver: allowsNativeDriver }),
          ]).start();
        }
      }, [isTypeMenuOpen]);

      return (
        <View style={{ flex:1, backgroundColor: bgColor }}>

          {/* Busca e filtros */}
          <View style={{ paddingHorizontal:16, paddingTop:8 }}>
            <View style={{ flexDirection:'row', alignItems:'center' }}>
              <View style={{ flex:1, position:'relative' }}>
                <Ionicons name='search' size={18} color={'#6B7280'} style={{ position:'absolute', left: 12, top: 10, zIndex:1 }} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder='Buscar por nome ou número…'
                  placeholderTextColor={'#9CA3AF'}
                  style={{ backgroundColor:'#F9FAFB', borderWidth:1, borderColor:'#D1D5DB', paddingVertical:10, paddingLeft:36, paddingRight:12, borderRadius:10 }}
                />
              </View>
              <Pressable onPress={() => setIsTypeMenuOpen(true)} style={{ marginLeft:8, flexBasis:160, borderWidth:1, borderColor:'#D1D5DB', backgroundColor:'#fff', paddingVertical:10, paddingHorizontal:12, borderRadius:10, flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
                <Text style={{ color:'#374151', fontWeight:'600' }}>{categoryFilter ?? 'Categoria'}</Text>
                <Ionicons name='chevron-down' size={16} color={'#6B7280'} />
              </Pressable>
            </View>
            <View style={{ flexDirection:'row', marginTop:8 }}>
              {renderChip('Favoritos', favoritesOnly === true, () => setFavoritesOnly(!favoritesOnly))}
              {renderChip('Todos', expiryFilter === 'all', () => setExpiryFilter('all'))}
              {renderChip(`Vencidos (${expiredCount})`, expiryFilter === 'expired', () => setExpiryFilter('expired'))}
              {renderChip(`Até 30 dias (${soonCount})`, expiryFilter === 'soon', () => setExpiryFilter('soon'))}
            </View>

          </View>

          {null}

          {isTypeMenuOpen && (
      <>
        <Pressable onPress={() => setIsTypeMenuOpen(false)} style={{ position:'absolute', left:0, right:0, top:0, bottom:0, zIndex:30, backgroundColor:'rgba(17,24,39,0.03)' }} />
        <Animated.View style={{ position:'absolute', top: 64, right: 16, opacity: typeMenuOpacity, transform:[{ scale: typeMenuScale }], zIndex:40 }}>
          <View style={{ backgroundColor:'#fff', borderWidth:1, borderColor:'#E5E7EB', borderRadius:12, shadowColor:'#000', shadowOpacity:0.12, shadowRadius:18, elevation:4, overflow:'hidden', minWidth: 180 }}>
            {['Todos','Pessoais','Financeiro','Saúde','Transporte','Trabalho','Estudo'].map((label) => (
              <Pressable key={label} onPress={() => { setIsTypeMenuOpen(false); setCategoryFilter(label === 'Todos' ? null : label); }} style={({ pressed }) => ({ paddingVertical:12, paddingHorizontal:14, flexDirection:'row', alignItems:'center', backgroundColor: pressed ? '#F9FAFB' : '#fff' })}>
                <Text style={{ fontSize:14, color:'#111827', fontWeight:'700' }}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      </>
  )}

          {notifMessages.length > 0 && (
            <TouchableOpacity onPress={() => setNotificationsOpen(true)} style={{ marginHorizontal:16, marginBottom:8, paddingVertical:8, paddingHorizontal:12, backgroundColor:'#FEF9C3', borderRadius:8, borderWidth:1, borderColor:'#FDE68A' }}>
              <View style={{ flexDirection:'row', alignItems:'center' }}>
                <Ionicons name='alert-circle-outline' size={18} color={'#92400E'} style={{ marginRight:6 }} />
                <Text style={{ color:'#92400E' }}>Você tem {notifMessages.length} notificação(ões). Toque para ver.</Text>
              </View>
            </TouchableOpacity>
          )}

          {docs.length === 0 ? (
            <View style={{ flex:1, alignItems:'center', justifyContent:'center', paddingHorizontal:16 }}>
              <Image source={require('../../assets/splash-icon.png')} style={{ width:120, height:120, opacity:0.85, marginBottom:12 }} />
              <Text style={{ fontSize:18, fontWeight:'700', color:'#111827', textAlign:'center' }}>Nenhum documento por aqui…</Text>
              <Text style={{ color:'#6B7280', textAlign:'center', marginTop:4, marginBottom:12 }}>Adicione seu primeiro documento para começar.</Text>
              <TouchableOpacity onPress={onAdd} style={{ backgroundColor: primaryColor, paddingVertical:12, paddingHorizontal:18, borderRadius:12, flexDirection:'row', alignItems:'center' }}>
                <Ionicons name='add' size={18} color='#fff' style={{ marginRight:6 }} />
                <Text style={{ color:'#fff', fontWeight:'700' }}>Novo</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={filteredDocs}
              keyExtractor={(item) => keyForItem(item)}
              renderItem={renderItem}
              numColumns={2}
              columnWrapperStyle={{ justifyContent:'space-between', paddingHorizontal:8 }}
              contentContainerStyle={{ paddingBottom: 100, paddingTop: 8 }}
            />
          )}

          {menuFor !== null && (
            <Pressable onPress={() => setMenuFor(null)} style={{ position:'absolute', left:0, right:0, top:0, bottom:0, zIndex:10 }} />
          )}

          {/* Modal de notificações */}
          <Modal visible={notificationsOpen} transparent animationType="fade" onRequestClose={() => setNotificationsOpen(false)}>
            <Pressable onPress={() => setNotificationsOpen(false)} style={{ flex:1, backgroundColor:'rgba(0,0,0,0.2)', justifyContent:'center', padding:16 }}>
              <Pressable onStartShouldSetResponder={() => true} style={{ backgroundColor:'#fff', borderRadius:12, padding:12, maxHeight:'70%' }}>
                <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                  <Text style={{ fontSize:16, fontWeight:'800', color:'#111827' }}>Notificações</Text>
                  <TouchableOpacity onPress={() => setNotificationsOpen(false)}>
                    <Text style={{ color: colors.brandPrimary, fontWeight:'700' }}>Fechar</Text>
                  </TouchableOpacity>
                </View>
                {notifMessages.length === 0 ? (
                  <Text style={{ color:'#6B7280' }}>Sem notificações no momento.</Text>
                ) : (
                  <View>
                    {notifMessages.map((msg, idx) => (
                      <View key={idx} style={{ paddingVertical:8, flexDirection:'row', alignItems:'flex-start' }}>
                        <Ionicons name='information-circle-outline' size={18} color={colors.brandPrimary} style={{ marginRight:8, marginTop:2 }} />
                        <Text style={{ color:'#111827' }}>{msg}</Text>
                      </View>
                    ))}
                    <View style={{ height:8 }} />
                    <TouchableOpacity onPress={() => onUpgrade && onUpgrade('premium')} style={{ alignSelf:'flex-start', borderWidth:1, borderColor: colors.brandPrimary, borderRadius:8, paddingVertical:8, paddingHorizontal:12 }}>
                      <Text style={{ color: colors.brandPrimary, fontWeight:'700' }}>Ver planos</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </Pressable>
            </Pressable>
          </Modal>

          {headerMenuOpen && (
            <>
              <Pressable onPress={() => setHeaderMenuOpen(false)} style={{ position:'absolute', left:0, right:0, top:0, bottom:0, zIndex:30, backgroundColor:'rgba(17,24,39,0.03)' }} />
              <Animated.View style={{ position:'absolute', top: 8, right: 10, opacity: menuOpacity, transform:[{ scale: menuScale }], zIndex:40 }}>
                <View style={{ position:'absolute', top:-6, right:16, width:12, height:12, backgroundColor:'#fff', transform:[{ rotate:'45deg' }], borderTopColor:'#E5E7EB', borderLeftColor:'#E5E7EB', borderTopWidth:1, borderLeftWidth:1 }} />
                <View style={{ backgroundColor:'#fff', borderWidth:1, borderColor:'#E5E7EB', borderRadius:12, shadowColor:'#000', shadowOpacity:0.12, shadowRadius:18, elevation:4, overflow:'hidden', minWidth: 220 }}>
                  <Pressable onPress={() => { setHeaderMenuOpen(false); load(); }} style={({ pressed }) => ({ paddingVertical:12, paddingHorizontal:14, flexDirection:'row', alignItems:'center', backgroundColor: pressed ? '#F9FAFB' : '#fff' })}>
                    <Ionicons name='refresh' size={18} color={primaryColor} style={{ marginRight:10 }} />
                    <Text style={{ fontSize:15, color: primaryColor, fontWeight:'700' }}>Atualizar</Text>
                  </Pressable>
                  <View style={{ height:1, backgroundColor:'#F3F4F6' }} />
                  <Pressable onPress={() => { setHeaderMenuOpen(false); navigation.navigate('Profile'); }} style={({ pressed }) => ({ paddingVertical:12, paddingHorizontal:14, flexDirection:'row', alignItems:'center', backgroundColor: pressed ? '#F9FAFB' : '#fff' })}>
                    <Ionicons name='person-circle' size={18} color={'#111827'} style={{ marginRight:10 }} />
                    <Text style={{ fontSize:15, color:'#111827', fontWeight:'700' }}>Perfil</Text>
                  </Pressable>
                  <View style={{ height:1, backgroundColor:'#F3F4F6' }} />
                  <Pressable onPress={() => { setHeaderMenuOpen(false); navigation.navigate('Notifications'); }} style={({ pressed }) => ({ paddingVertical:12, paddingHorizontal:14, flexDirection:'row', alignItems:'center', backgroundColor: pressed ? '#F9FAFB' : '#fff' })}>
                    <Ionicons name='notifications' size={18} color={'#111827'} style={{ marginRight:10 }} />
                    <Text style={{ fontSize:15, color:'#111827', fontWeight:'700' }}>Notificações</Text>
                  </Pressable>
                  <View style={{ height:1, backgroundColor:'#F3F4F6' }} />
                  <Pressable onPress={() => { setHeaderMenuOpen(false); logout(); }} style={({ pressed }) => ({ paddingVertical:12, paddingHorizontal:14, flexDirection:'row', alignItems:'center', backgroundColor: pressed ? '#EFEFEF' : '#fff' })}>
                    <Ionicons name='log-out' size={18} color={dangerColor} style={{ marginRight:10 }} />
                    <Text style={{ fontSize:15, color: dangerColor, fontWeight:'700' }}>Sair</Text>
                  </Pressable>
                </View>
              </Animated.View>
            </>
          )}
          
          <TouchableOpacity onPress={onAdd} style={{ position:'absolute', bottom:20, right:20, backgroundColor: primaryColor, paddingVertical:16, paddingHorizontal:18, borderRadius:30, shadowColor:'#000', shadowOpacity:0.15, shadowRadius:10, elevation:4, flexDirection:'row', alignItems:'center' }}>
            <Ionicons name='add' size={20} color='#fff' style={{ marginRight:6 }} />
            <Text style={{ color:'#fff', fontWeight:'800', fontSize:16 }}>Novo</Text>
          </TouchableOpacity>
        {shareDoc && (
          <ShareSheet visible={true} onClose={() => setShareDoc(null)} document={shareDoc} userId={userId} />
        )}
        </View>
      );
    }

    function renderChip(label: string, active: boolean, onPress: () => void) {
      return (
        <TouchableOpacity onPress={onPress} style={{ flexDirection:'row', alignItems:'center', paddingVertical:8, paddingHorizontal:12, borderRadius:20, borderWidth:1, borderColor: active ? primaryColor : '#E5E7EB', backgroundColor: active ? '#EFF6FF' : '#fff', marginRight:8 }}>
          <Text style={{ color: active ? primaryColor : '#374151', fontWeight:'600' }}>{label}</Text>
        </TouchableOpacity>
      );
    }