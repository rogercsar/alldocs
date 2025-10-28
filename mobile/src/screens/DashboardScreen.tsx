import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Button } from 'react-native';
import { getDocuments, initDb, countDocuments } from '../storage/db';
import type { DocumentItem } from '../types';

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
    <TouchableOpacity onPress={() => onOpen(item)} style={{ flex:1, margin:8, padding:12, borderWidth:1, borderRadius:8 }}>
      <Text style={{ fontWeight: 'bold' }}>{item.name}</Text>
      <Text style={{ color:'#555' }}>{item.number}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex:1, padding: 8 }}>
      <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom: 8 }}>
        <Text style={{ fontSize: 20, fontWeight: 'bold' }}>Meus Documentos</Text>
        <Button title="Atualizar" onPress={load} />
      </View>

      {limitReached && (
        <TouchableOpacity onPress={onUpgrade} style={{ padding:10, backgroundColor:'#ffe9c6', borderRadius:6, marginBottom:8 }}>
          <Text>Limite gratuito de 4 documentos atingido. Desbloqueie Premium.</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={docs}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={{ justifyContent:'space-between' }}
        contentContainerStyle={{ paddingBottom: 80 }}
      />

      <TouchableOpacity onPress={onAdd} style={{ position:'absolute', bottom:20, right:20, backgroundColor:'#007aff', paddingVertical:14, paddingHorizontal:18, borderRadius:30 }}>
        <Text style={{ color:'#fff', fontWeight:'bold' }}>+ Novo</Text>
      </TouchableOpacity>
    </View>
  );
}