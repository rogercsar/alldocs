import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getDocuments, initDb, countDocuments } from '../storage/db';
import type { DocumentItem } from '../types';

const primaryColor = '#4F46E5';
const bgColor = '#F3F4F6';

export default function DashboardScreen({ onAdd, onOpen, onUpgrade, userId }: { onAdd: () => void; onOpen: (doc: DocumentItem) => void; onUpgrade: () => void; userId: string; }) {
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [limitReached, setLimitReached] = useState(false);

  const load = useCallback(async () => {
    initDb();
    const [items, cnt] = await Promise.all([getDocuments(), countDocuments()]);
    setDocs(items);
    try {
      const base = process.env.EXPO_PUBLIC_API_BASE || process.env.EXPO_PUBLIC_API_BASE_URL || '';
      let isPremium = false;
      if (base) {
        const res = await fetch(`${base}/.netlify/functions/get-user-status?userId=${userId}`);
        if (res.ok) {
          const json = await res.json();
          isPremium = !!json?.is_premium;
        }
      }
      setLimitReached(!isPremium && cnt >= 4);
    } catch {
      setLimitReached(cnt >= 4);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const renderItem = ({ item }: { item: DocumentItem }) => (
    <TouchableOpacity onPress={() => onOpen(item)} style={{ flex:1, margin:8, padding:14, backgroundColor:'#fff', borderWidth:1, borderColor:'#E5E7EB', borderRadius:12, shadowColor:'#000', shadowOpacity:0.06, shadowRadius:12, elevation:2 }}>
      <Text style={{ fontWeight: '800', color:'#111827' }}>{item.name}</Text>
      <Text style={{ color:'#6B7280', marginTop:4 }}>{item.number}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex:1, backgroundColor: bgColor }}>
      <View style={{ paddingHorizontal:16, paddingTop:16, paddingBottom:8, flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color:'#111827' }}>Meus Documentos</Text>
        <TouchableOpacity onPress={load} style={{ borderWidth:2, borderColor: primaryColor, paddingVertical:8, paddingHorizontal:12, borderRadius:12, flexDirection:'row', alignItems:'center' }}>
          <Ionicons name='refresh' size={18} color={primaryColor} style={{ marginRight:6 }} />
          <Text style={{ color: primaryColor, fontWeight:'700' }}>Atualizar</Text>
        </TouchableOpacity>
      </View>

      {limitReached && (
        <TouchableOpacity onPress={onUpgrade} style={{ marginHorizontal:16, marginBottom:8, padding:12, backgroundColor:'#FEF3C7', borderRadius:10, borderWidth:1, borderColor:'#F59E0B' }}>
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

      <TouchableOpacity onPress={onAdd} style={{ position:'absolute', bottom:20, right:20, backgroundColor: primaryColor, paddingVertical:16, paddingHorizontal:18, borderRadius:30, shadowColor:'#000', shadowOpacity:0.15, shadowRadius:10, elevation:4, flexDirection:'row', alignItems:'center' }}>
        <Ionicons name='add' size={20} color='#fff' style={{ marginRight:6 }} />
        <Text style={{ color:'#fff', fontWeight:'800', fontSize:16 }}>Novo</Text>
      </TouchableOpacity>
    </View>
  );
}