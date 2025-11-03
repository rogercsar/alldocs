import React, { useEffect, useState, useCallback, useLayoutEffect, useRef, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, Share, Alert, Pressable, Animated, Modal, TextInput, ScrollView, Platform } from 'react-native';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { getDocuments, initDb, countDocuments, deleteDocument, updateDocument, addDocument } from '../storage/db';
import { syncDocumentDelete, syncDocumentAddOrUpdate } from '../storage/sync';
import type { DocumentItem } from '../types';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../supabase';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme/colors';
import ShareSheet from '../components/ShareSheet';
import { useToast } from '../components/Toast';
import { scheduleExpiryNotifications } from '../utils/notifications';
import { buildExpiryAlerts, filterByExpiry } from '../utils/expiry';

const primaryColor = colors.brandPrimary;
const bgColor = colors.bg;
const dangerColor = colors.danger;


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

export default function DashboardScreen({ onAdd, onOpen, onUpgrade, onLogout, userId }: { onAdd: () => void; onOpen: (doc: DocumentItem) => void; onUpgrade: () => void; onLogout?: () => void; userId: string; }) {
  const navigation = useNavigation<any>();
  const { showToast } = useToast();
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [limitReached, setLimitReached] = useState(false);
  const [deviceCount, setDeviceCount] = useState<number | null>(null);
  const [deviceLimit, setDeviceLimit] = useState<number | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [shareDoc, setShareDoc] = useState<DocumentItem | null>(null);
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

  const filteredDocs = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byTextAndType = docs.filter((d) => {
      const matchesQuery = !q || (d.name?.toLowerCase().includes(q) || d.number?.toLowerCase().includes(q));
      const matchesType = !typeFilter || (d.type === typeFilter);
      const matchesSync = !syncedOnly || (d.synced === 1);
      const matchesFav = !favoritesOnly || (d.favorite === 1);
      return matchesQuery && matchesType && matchesSync && matchesFav;
    });
    return filterByExpiry(byTextAndType, expiryFilter);
  }, [docs, query, typeFilter, syncedOnly, favoritesOnly, expiryFilter]);

  const expiredCount = useMemo(() => filterByExpiry(docs, 'expired').length, [docs]);
  const soonCount = useMemo(() => filterByExpiry(docs, 'soon').length, [docs]);

  const load = useCallback(async () => {
    setMenuFor(null);
    initDb();
    const [items, cnt] = await Promise.all([getDocuments(), countDocuments()]);
    
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
        const { data: remote, error } = await supabase
          .from('documents')
          .select('app_id,name,number,front_path,back_path,updated_at')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false });

        let rows = remote;
        if ((error && error.message && /api key|apikey/i.test(error.message)) || (!rows || rows.length === 0)) {
          // Fallback robusto: chamada direta PostgREST com apikey na URL
          if (SUPABASE_URL && SUPABASE_ANON_KEY) {
            const qs = new URLSearchParams({
              select: 'app_id,name,number,front_path,back_path,updated_at',
              order: 'updated_at.desc',
            });
            const restUrl = `${SUPABASE_URL}/rest/v1/documents?${qs.toString()}&user_id=eq.${encodeURIComponent(userId)}&apikey=${encodeURIComponent(SUPABASE_ANON_KEY)}`;
            const { data: sessionData } = await supabase.auth.getSession();
            const accessToken = (sessionData as any)?.session?.access_token as string | undefined;
            const headers: any = { apikey: SUPABASE_ANON_KEY };
            if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
            const r = await fetch(restUrl, { headers });
            if (r.ok) {
              rows = await r.json();
            } else {
              const body = await r.text();
              console.warn('[rest fallback] status', r.status, body);
            }
          }
        }

        if (rows && rows.length > 0) {
          console.log('[dashboard] remote rows', rows.length);
          const mapped: DocumentItem[] = await Promise.all(
            rows.map(async (d: any) => {
              let front = '';
              let back = '';
              if (base) {
                try {
                  const r = await fetch(`${base}/.netlify/functions/signed-urls?userId=${userId}&appId=${d.app_id}`);
                  if (r.ok) {
                    const j = await r.json();
                    front = j.frontSignedUrl || '';
                    back = j.backSignedUrl || '';
                  }
                } catch {}
              }
              return {
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
              updatedAt: rem.updatedAt ?? prev?.updatedAt,
            };
            byKey.set(targetKey, mergedItem);
          }
          const merged = Array.from(byKey.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
          console.log('[dashboard] set remote docs', merged.length);
          setDocs(merged);
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
    setLimitReached(!isPremium && cnt >= 4);
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
                <Ionicons name='document-text' size={28} color={colors.text} />
              ) : (
                <Image source={require('../../assets/icon.png')} onError={() => setLogoError(true)} style={{ width:70, height:70 }} />
              )}
            </View>
          ),
          headerRight: () => (
            <View style={{ flexDirection:'row', alignItems:'center' }}>
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
      }, [navigation, load, logoError]);

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

      const onDelete = useCallback(async (doc: DocumentItem) => {
        try {
          const itemKey = keyForItem(doc);
          console.log('[dashboard] delete click', { key: itemKey, appId: (doc as any).appId, name: doc.name, number: doc.number });
      
          // Fecha o menu imediatamente
          setMenuFor(null);
      
          // Remoção otimista do estado atual
          setDocs((prev) => prev.filter((d) => keyForItem(d) !== itemKey));
      
          // Remoção local
          const localDocs = await getDocuments().catch(() => []);
          const localMatch = localDocs.find((d: any) => keyForItem(d) === itemKey);
          if (localMatch && (localMatch as any).id) {
            await deleteDocument((localMatch as any).id).catch((e) => console.error('[dashboard] local delete error', e));
          }
      
          // Remoção remota
          const userId = auth?.userId;
          const canSync = !!userId && userId !== 'anonymous' && /^[0-9a-f-]{36}$/i.test(userId);
          if (canSync) {
            const forSync = (doc as any).appId ?? (localMatch as any)?.id ?? doc.number ?? doc.name ?? itemKey;
            await syncDocumentDelete(forSync, userId!).catch((e) => console.error('[dashboard] remote delete error', e));
          } else {
            console.log('[dashboard] skip remote delete: invalid userId');
          }
      
          // Recarrega em background para refletir estado do servidor
          load();
          showToast('Documento excluído.');
        } catch (e) {
          console.error('[dashboard] onDelete error', e);
          showToast('Erro ao excluir documento.');
        }
      }, [auth, load]);
      const renderItem = ({ item }: { item: DocumentItem }) => {
        const icon = iconForType(item.type);
        const hasId = typeof item.id === 'number';
        const itemKey = keyForItem(item);
        const isOpen = menuFor === itemKey;
        const accentBg = item.type === 'Cartões' ? '#FEF2F2' : item.type === 'RG' ? '#EFF6FF' : item.type === 'CNH' ? '#ECFDF5' : '#fff';
        return (
          <TouchableOpacity onPress={() => onOpen(item)} style={{ flex:1, margin:8, padding:14, backgroundColor: accentBg, borderWidth:1, borderColor:'#E5E7EB', borderRadius:12, shadowColor:'#000', shadowOpacity:0.06, shadowRadius:12, elevation: isOpen ? 12 : 2, zIndex: isOpen ? 1000 : 0, overflow:'visible' }}>
            <View style={{ flexDirection:'row', alignItems:'center' }}>
              <View style={{ width:36, height:36, borderRadius:8, backgroundColor:'#F9FAFB', alignItems:'center', justifyContent:'center', marginRight:10 }}>
                {item.type === 'Cartões' && !!item.cardBrand ? (
                  <FontAwesome name={brandIconName(item.cardBrand) as any} size={20} color={'#374151'} />
                ) : (
                  <Ionicons name={icon.name} size={22} color={icon.color} />
                )}
              </View>
              <View style={{ flex:1 }}>
                <Text style={{ fontSize:16, fontWeight:'700', color:'#111827' }}>{item.name}</Text>
                <Text style={{ fontSize:12, color:'#6B7280', marginTop:4 }}>{item.type || 'Documento'}</Text>
              </View>
              <TouchableOpacity onPress={() => setMenuFor(itemKey)}>
                <Ionicons name='ellipsis-vertical' size={20} color={'#9CA3AF'} />
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize:12, color:'#374151', marginTop:10 }}>{item.number || '—'}</Text>

            <View style={{ flexDirection:'row', flexWrap:'wrap', marginTop:8 }}>
              {item.cardSubtype ? (
                <View style={{ paddingVertical:4, paddingHorizontal:8, borderRadius:9999, backgroundColor:'#EEF2FF', borderWidth:1, borderColor:'#CBD5E1', marginRight:6, marginBottom:6 }}>
                  <Text style={{ fontSize:11, fontWeight:'700', color:'#334155' }}>{item.cardSubtype}</Text>
                </View>
              ) : null}
              {item.cardBrand ? (
                <View style={{ paddingVertical:4, paddingHorizontal:8, borderRadius:9999, backgroundColor:'#F5F3FF', borderWidth:1, borderColor:'#DDD6FE', marginRight:6, marginBottom:6, flexDirection:'row', alignItems:'center' }}>
                  <FontAwesome name={brandIconName(item.cardBrand) as any} size={14} color={'#4B5563'} />
                  <Text style={{ fontSize:11, fontWeight:'700', color:'#4B5563', marginLeft:6 }}>{item.cardBrand}</Text>
                </View>
              ) : null}
              {item.bank ? (
                <View style={{ paddingVertical:4, paddingHorizontal:8, borderRadius:9999, backgroundColor:'#ECFDF5', borderWidth:1, borderColor:'#A7F3D0', marginRight:6, marginBottom:6 }}>
                  <Text style={{ fontSize:11, fontWeight:'700', color:'#065F46' }}>{item.bank}</Text>
                </View>
              ) : null}
              {item.expiryDate ? (
                <View style={{ paddingVertical:4, paddingHorizontal:8, borderRadius:9999, backgroundColor:'#FEF3C7', borderWidth:1, borderColor:'#FDE68A', marginRight:6, marginBottom:6 }}>
                  <Text style={{ fontSize:11, fontWeight:'700', color:'#92400E' }}>Venc.: {item.expiryDate}</Text>
                </View>
              ) : null}
              {(item.issueDate && (item.type === 'RG' || item.type === 'CNH')) ? (
                <View style={{ paddingVertical:4, paddingHorizontal:8, borderRadius:9999, backgroundColor:'#F3F4F6', borderWidth:1, borderColor:'#E5E7EB', marginRight:6, marginBottom:6 }}>
                  <Text style={{ fontSize:11, fontWeight:'700', color:'#374151' }}>Exp.: {item.issueDate}</Text>
                </View>
              ) : null}
              {(item.electorZone || item.electorSection) && item.type === 'Título de Eleitor' ? (
                <View style={{ paddingVertical:4, paddingHorizontal:8, borderRadius:9999, backgroundColor:'#E0F2FE', borderWidth:1, borderColor:'#BAE6FD', marginRight:6, marginBottom:6 }}>
                  <Text style={{ fontSize:11, fontWeight:'700', color:'#0C4A6E' }}>Zona {item.electorZone || '—'} • Seção {item.electorSection || '—'}</Text>
                </View>
              ) : null}
            </View>

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
          </TouchableOpacity>
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
            }
          } catch {}
        })();
        return () => { cancelled = true; };
      }, [userId]);

      const deviceLimitReached = deviceCount !== null && deviceLimit !== null && deviceCount >= deviceLimit;
      const notifMessages: string[] = [];
      if (deviceLimitReached) notifMessages.push(`Limite de dispositivos atingido (${deviceCount}/${deviceLimit}). Faça upgrade para adicionar mais.`);
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
                <Ionicons name='document-text' size={28} color={colors.text} />
              ) : (
                <Image source={require('../../assets/icon.png')} onError={() => setLogoError(true)} style={{ width:70, height:70 }} />
              )}
            </View>
          ),
          headerRight: () => (
            <View style={{ flexDirection:'row', alignItems:'center' }}>
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
                <Text style={{ color:'#374151', fontWeight:'600' }}>{typeFilter ?? 'Tipo'}</Text>
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

          {isTypeMenuOpen && (
      <>
        <Pressable onPress={() => setIsTypeMenuOpen(false)} style={{ position:'absolute', left:0, right:0, top:0, bottom:0, zIndex:30, backgroundColor:'rgba(17,24,39,0.03)' }} />
        <Animated.View style={{ position:'absolute', top: 64, right: 16, opacity: typeMenuOpacity, transform:[{ scale: typeMenuScale }], zIndex:40 }}>
          <View style={{ backgroundColor:'#fff', borderWidth:1, borderColor:'#E5E7EB', borderRadius:12, shadowColor:'#000', shadowOpacity:0.12, shadowRadius:18, elevation:4, overflow:'hidden', minWidth: 180 }}>
            {['Todos','RG','CNH','CPF','Passaporte','Outros'].map((label) => (
              <Pressable key={label} onPress={() => { setIsTypeMenuOpen(false); setTypeFilter(label === 'Todos' ? null : label); }} style={({ pressed }) => ({ paddingVertical:12, paddingHorizontal:14, flexDirection:'row', alignItems:'center', backgroundColor: pressed ? '#F9FAFB' : '#fff' })}>
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
                    <TouchableOpacity onPress={onUpgrade} style={{ alignSelf:'flex-start', borderWidth:1, borderColor: colors.brandPrimary, borderRadius:8, paddingVertical:8, paddingHorizontal:12 }}>
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