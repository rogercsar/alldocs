import React, { useEffect, useState, useCallback, useLayoutEffect, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, Share, Alert, Pressable, Animated, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getDocuments, initDb, countDocuments, deleteDocument } from '../storage/db';
import { syncDocumentDelete } from '../storage/sync';
import type { DocumentItem } from '../types';
import { supabase } from '../supabase';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme/colors';

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

export default function DashboardScreen({ onAdd, onOpen, onUpgrade, onLogout, userId }: { onAdd: () => void; onOpen: (doc: DocumentItem) => void; onUpgrade: () => void; onLogout?: () => void; userId: string; }) {
  const navigation = useNavigation<any>();
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [limitReached, setLimitReached] = useState(false);
  const [deviceCount, setDeviceCount] = useState<number | null>(null);
  const [deviceLimit, setDeviceLimit] = useState<number | null>(null);
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [logoError, setLogoError] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const menuScale = useRef(new Animated.Value(0.95)).current;
  const menuOpacity = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    setMenuFor(null);
    initDb();
    const [items, cnt] = await Promise.all([getDocuments(), countDocuments()]);

    const base = process.env.EXPO_PUBLIC_API_BASE || process.env.EXPO_PUBLIC_API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
    let isPremium = false;
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
        const { data: remote, error } = await supabase
          .from('documents')
          .select('app_id,name,number,front_path,back_path,updated_at')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false });

        if (!error && remote && remote.length > 0) {
          const mapped: DocumentItem[] = await Promise.all(
            remote.map(async (d: any) => {
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
                id: d.app_id,
                name: d.name,
                number: d.number,
                frontImageUri: front,
                backImageUri: back,
                synced: 1,
                updatedAt: d.updated_at ? new Date(d.updated_at).getTime() : undefined,
              } as DocumentItem;
            })
          );
          setDocs(mapped);
          setLimitReached(!isPremium && mapped.length >= 4);
          return;
        }
      }
    } catch (e) {
      console.warn('Falha ao carregar documentos remotos', e);
    }

    // Fallback para documentos locais
    setDocs(items);
    setLimitReached(!isPremium && cnt >= 4);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (headerMenuOpen) {
      menuScale.setValue(0.95);
      menuOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(menuScale, { toValue: 1, duration: 140, useNativeDriver: true }),
        Animated.timing(menuOpacity, { toValue: 1, duration: 140, useNativeDriver: true }),
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
    const type = doc.type || 'Documento';
    const title = `${doc.name} (${type})`;
    const message = `${title}\nNúmero: ${doc.number || '—'}`;
    try {
      await Share.share({ title, message });
    } catch (e: any) {
      Alert.alert('Não foi possível compartilhar', e?.message || String(e));
    }
  };

  const onDelete = async (doc: DocumentItem) => {
    Alert.alert('Excluir', `Deseja excluir '${doc.name}'?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => {
        try {
          if (doc.id) {
            await deleteDocument(doc.id);
            try { await syncDocumentDelete(doc.id, userId); } catch {}
            await load();
          }
        } catch (e) {
          Alert.alert('Erro ao excluir', String(e));
        }
      } },
    ]);
  };

  const renderItem = ({ item }: { item: DocumentItem }) => {
    const icon = iconForType(item.type);
    const hasId = typeof item.id === 'number';
    return (
      <TouchableOpacity onPress={() => onOpen(item)} style={{ flex:1, margin:8, padding:14, backgroundColor:'#fff', borderWidth:1, borderColor:'#E5E7EB', borderRadius:12, shadowColor:'#000', shadowOpacity:0.06, shadowRadius:12, elevation: menuFor === item.id ? 12 : 2, zIndex: menuFor === item.id ? 1000 : 0, overflow:'visible' }}>
        <View style={{ flexDirection:'row', alignItems:'center' }}>
          <View style={{ width:36, height:36, borderRadius:8, backgroundColor:'#F9FAFB', alignItems:'center', justifyContent:'center', marginRight:10 }}>
            <Ionicons name={icon.name} size={22} color={icon.color} />
          </View>
          <View style={{ flex:1 }}>
            <Text style={{ fontSize:16, fontWeight:'700', color:'#111827' }}>{item.name}</Text>
            <Text style={{ fontSize:12, color:'#6B7280', marginTop:4 }}>{item.type || 'Documento'}</Text>
          </View>
          {hasId && (
            <TouchableOpacity onPress={() => setMenuFor(item.id!)}>
              <Ionicons name='ellipsis-vertical' size={20} color={'#9CA3AF'} />
            </TouchableOpacity>
          )}
        </View>
        <Text style={{ fontSize:12, color:'#374151', marginTop:10 }}>{item.number || '—'}</Text>

        {menuFor === item.id && (
            <Pressable onStartShouldSetResponder={() => true} style={{ position:'absolute', right:14, top:14, backgroundColor:'#fff', borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, shadowColor:'#000', shadowOpacity:0.08, shadowRadius:14, elevation:12, zIndex: 2000 }}>
              <TouchableOpacity onPress={() => { setMenuFor(null); onEdit(item); }} style={{ paddingVertical:10, paddingHorizontal:14, flexDirection:'row', alignItems:'center' }}>
                <Ionicons name='create-outline' size={18} color={'#111827'} style={{ marginRight:8 }} />
                <Text style={{ fontSize:14, color:'#111827', fontWeight:'600' }}>Editar</Text>
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
  };

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

  return (
    <View style={{ flex:1, backgroundColor: bgColor }}>

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
          data={docs}
          keyExtractor={(item) => String(item.id)}
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
              <Pressable onPress={() => { setHeaderMenuOpen(false); logout(); }} style={({ pressed }) => ({ paddingVertical:12, paddingHorizontal:14, flexDirection:'row', alignItems:'center', backgroundColor: pressed ? '#FEF2F2' : '#fff' })}>
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
    </View>
  );
}