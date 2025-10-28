import React from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { deleteDocument } from '../storage/db';
import { syncDocumentDelete } from '../storage/sync';

const primaryColor = '#4F46E5';
const dangerColor = '#EF4444';
const bgColor = '#F3F4F6';

export default function ViewDocumentScreen({ document, onEdit, onDeleted, userId }: { document: any; onEdit: () => void; onDeleted: () => void; userId: string }) {
  async function remove() {
    await deleteDocument(document.id);
    try { await syncDocumentDelete(document.id, userId); } catch {}
    onDeleted();
  }

  return (
    <ScrollView style={{ flex:1, backgroundColor: bgColor }} contentContainerStyle={{ padding:16 }}>
      <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
        <Text style={{ fontSize:22, fontWeight:'800', color:'#111827' }}>{document.name}</Text>
        <View style={{ flexDirection:'row', gap:8 }}>
          <TouchableOpacity onPress={onEdit} style={{ paddingVertical:10, paddingHorizontal:12, borderRadius:12, backgroundColor:'#fff', borderWidth:1, borderColor:'#E5E7EB', flexDirection:'row', alignItems:'center' }}>
            <Ionicons name='pencil' size={18} color={primaryColor} style={{ marginRight:6 }} />
            <Text style={{ color: primaryColor, fontWeight:'700' }}>Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={remove} style={{ paddingVertical:10, paddingHorizontal:12, borderRadius:12, backgroundColor: dangerColor, flexDirection:'row', alignItems:'center' }}>
            <Ionicons name='trash' size={18} color='#fff' style={{ marginRight:6 }} />
            <Text style={{ color:'#fff', fontWeight:'700' }}>Excluir</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ backgroundColor:'#fff', borderRadius:16, padding:16, borderWidth:1, borderColor:'#E5E7EB', shadowColor:'#000', shadowOpacity:0.06, shadowRadius:12, elevation:3, marginBottom:16 }}>
        <Text style={{ fontSize:14, color:'#6B7280', marginBottom:8 }}>Número</Text>
        <Text style={{ fontSize:18, fontWeight:'700', color:'#111827' }}>{document.number}</Text>
      </View>

      {document.frontImageUri ? (
        <View style={{ backgroundColor:'#fff', borderRadius:16, padding:12, borderWidth:1, borderColor:'#E5E7EB', shadowColor:'#000', shadowOpacity:0.06, shadowRadius:12, elevation:3, marginBottom:16 }}>
          <Text style={{ fontSize:14, color:'#6B7280', marginBottom:8 }}>Frente</Text>
          <View style={{ borderRadius:12, overflow:'hidden', backgroundColor:'#F9FAFB' }}>
            <Image source={{ uri: document.frontImageUri }} style={{ height:220 }} resizeMode='contain' />
          </View>
        </View>
      ) : null}

      {document.backImageUri ? (
        <View style={{ backgroundColor:'#fff', borderRadius:16, padding:12, borderWidth:1, borderColor:'#E5E7EB', shadowColor:'#000', shadowOpacity:0.06, shadowRadius:12, elevation:3 }}>
          <Text style={{ fontSize:14, color:'#6B7280', marginBottom:8 }}>Verso</Text>
          <View style={{ borderRadius:12, overflow:'hidden', backgroundColor:'#F9FAFB' }}>
            <Image source={{ uri: document.backImageUri }} style={{ height:220 }} resizeMode='contain' />
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}