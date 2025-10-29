import React, { useEffect, useState, useCallback, useLayoutEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, Share, Alert, Pressable } from 'react-native';
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
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [logoError, setLogoError] = useState(false);

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
            <Image source={require('../../assets/icon.png')} onError={() => setLogoError(true)} style={{ width:116, height:116 }} />
          )}
        </View>
      ),
      headerRight: () => (
        <View style={{ flexDirection:'row', alignItems:'center' }}>
          <TouchableOpacity onPress={load} style={{ borderWidth:2, borderColor: primaryColor, paddingVertical:6, paddingHorizontal:10, borderRadius:10, flexDirection:'row', alignItems:'center' }}>
            <Ionicons name='refresh' size={18} color={primaryColor} style={{ marginRight:6 }} />
            <Text style={{ color: primaryColor, fontWeight:'700' }}>Atualizar</Text>
          </TouchableOpacity>
          <View style={{ width:8 }} />
          <TouchableOpacity onPress={logout} style={{ borderWidth:2, borderColor: dangerColor, paddingVertical:6, paddingHorizontal:10, borderRadius:10, marginRight:26, flexDirection:'row', alignItems:'center' }}>
            <Ionicons name='log-out' size={18} color={dangerColor} style={{ marginRight:6 }} />
            <Text style={{ color: dangerColor, fontWeight:'700' }}>Sair</Text>
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
      <TouchableOpacity onPress={() => onOpen(item)} style={{ flex:1, margin:8, padding:14, backgroundColor:'#fff', borderWidth:1, borderColor:'#E5E7EB', borderRadius:12, shadowColor:'#000', shadowOpacity:0.06, shadowRadius:12, elevation:2 }}>
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
            <View style={{ position:'absolute', right:14, top:14, backgroundColor:'#fff', borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, shadowColor:'#000', shadowOpacity:0.08, shadowRadius:14, elevation:3, zIndex:20 }}>
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
            </View>
          )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex:1, backgroundColor: bgColor }}>

      {limitReached && (
        <TouchableOpacity onPress={onUpgrade} style={{ marginHorizontal:16, marginBottom:8, padding:12, backgroundColor: colors.warningBg, borderRadius:10, borderWidth:1, borderColor: colors.warning }}>
          <Text style={{ color:'#92400E', fontWeight:'600' }}>Limite gratuito de 4 documentos atingido. Desbloqueie Premium.</Text>
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
      <TouchableOpacity onPress={onAdd} style={{ position:'absolute', bottom:20, right:20, backgroundColor: primaryColor, paddingVertical:16, paddingHorizontal:18, borderRadius:30, shadowColor:'#000', shadowOpacity:0.15, shadowRadius:10, elevation:4, flexDirection:'row', alignItems:'center' }}>
        <Ionicons name='add' size={20} color='#fff' style={{ marginRight:6 }} />
        <Text style={{ color:'#fff', fontWeight:'800', fontSize:16 }}>Novo</Text>
      </TouchableOpacity>
    </View>
  );
}