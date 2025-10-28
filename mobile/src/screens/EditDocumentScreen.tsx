import React, { useState } from 'react';
import { View, Text, TextInput, Image, Alert, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { addDocument, saveImageToLocal } from '../storage/db';
import { supabase } from '../supabase';
import { syncDocumentAddOrUpdate } from '../storage/sync';

const primaryColor = '#4F46E5';
const bgColor = '#F3F4F6';

export default function EditDocumentScreen({ onSaved, userId }: { onSaved: () => void; userId: string }) {
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [frontUri, setFrontUri] = useState<string | undefined>();
  const [backUri, setBackUri] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  async function pick(setter: (uri: string) => void) {
    const res = await ImagePicker.launchImageLibraryAsync({ selectionLimit: 1, mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.9 });
    if (!res.canceled && res.assets?.[0]?.uri) setter(res.assets[0].uri);
  }

  async function capture(setter: (uri: string) => void) {
    const res = await ImagePicker.launchCameraAsync({ quality: 0.9 });
    if (!res.canceled && res.assets?.[0]?.uri) setter(res.assets[0].uri);
  }

  async function save() {
    if (!name || !number) { Alert.alert('Campos obrigatórios', 'Informe nome e número'); return; }
    setSaving(true);
    const f = frontUri ? await saveImageToLocal(frontUri) : '';
    const b = backUri ? await saveImageToLocal(backUri) : '';
    const id = await addDocument({ name, number, frontImageUri: f, backImageUri: b, synced: 0 });
    setSaving(false);
    try {
      await syncDocumentAddOrUpdate({ id, name, number, frontImageUri: f, backImageUri: b }, userId);
    } catch {}
    onSaved();
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex:1, backgroundColor: bgColor }}>
      <ScrollView contentContainerStyle={{ padding:16 }}>
        <Text style={{ fontSize: 22, fontWeight:'800', color:'#111827', marginBottom:12 }}>Adicionar/Editar Documento</Text>

        <View style={{ backgroundColor:'#fff', borderRadius:16, padding:16, borderWidth:1, borderColor:'#E5E7EB', shadowColor:'#000', shadowOpacity:0.06, shadowRadius:12, elevation:3 }}>
          <Text style={{ fontSize: 14, color:'#374151', marginBottom: 6 }}>Nome do Documento</Text>
          <TextInput value={name} onChangeText={setName} placeholder='Ex.: RG, CNH, Passaporte' placeholderTextColor='#9CA3AF' style={{ backgroundColor:'#F9FAFB', borderWidth:1, borderColor:'#E5E7EB', paddingVertical:12, paddingHorizontal:14, borderRadius:12, marginBottom:14 }} />

          <Text style={{ fontSize: 14, color:'#374151', marginBottom: 6 }}>Número do Documento</Text>
          <TextInput value={number} onChangeText={setNumber} placeholder='Ex.: 123456789' placeholderTextColor='#9CA3AF' style={{ backgroundColor:'#F9FAFB', borderWidth:1, borderColor:'#E5E7EB', paddingVertical:12, paddingHorizontal:14, borderRadius:12, marginBottom:16 }} />

          <Text style={{ fontSize: 14, color:'#374151', marginBottom: 6 }}>Foto (Frente)</Text>
          {frontUri ? (
            <View style={{ backgroundColor:'#fff', borderWidth:1, borderColor:'#E5E7EB', borderRadius:12, overflow:'hidden', marginBottom:8 }}>
              <Image source={{ uri: frontUri }} style={{ height:160 }} resizeMode='contain'/>
            </View>
          ) : null}
          <View style={{ flexDirection:'row', gap:8, marginBottom:8 }}>
            <TouchableOpacity onPress={() => pick(setFrontUri)} style={{ flex:1, borderWidth:2, borderColor: primaryColor, paddingVertical:12, borderRadius:12, alignItems:'center', flexDirection:'row', justifyContent:'center' }}>
              <Ionicons name='image' size={18} color={primaryColor} style={{ marginRight:6 }} />
              <Text style={{ color: primaryColor, fontWeight:'700' }}>Galeria</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => capture(setFrontUri)} style={{ flex:1, backgroundColor: primaryColor, paddingVertical:12, borderRadius:12, alignItems:'center', flexDirection:'row', justifyContent:'center' }}>
              <Ionicons name='camera' size={18} color='#fff' style={{ marginRight:6 }} />
              <Text style={{ color:'#fff', fontWeight:'700' }}>Câmera</Text>
            </TouchableOpacity>
          </View>

          <Text style={{ fontSize: 14, color:'#374151', marginBottom: 6 }}>Foto (Verso)</Text>
          {backUri ? (
            <View style={{ backgroundColor:'#fff', borderWidth:1, borderColor:'#E5E7EB', borderRadius:12, overflow:'hidden', marginBottom:8 }}>
              <Image source={{ uri: backUri }} style={{ height:160 }} resizeMode='contain'/>
            </View>
          ) : null}
          <View style={{ flexDirection:'row', gap:8 }}>
            <TouchableOpacity onPress={() => pick(setBackUri)} style={{ flex:1, borderWidth:2, borderColor: primaryColor, paddingVertical:12, borderRadius:12, alignItems:'center', flexDirection:'row', justifyContent:'center' }}>
              <Ionicons name='image' size={18} color={primaryColor} style={{ marginRight:6 }} />
              <Text style={{ color: primaryColor, fontWeight:'700' }}>Galeria</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => capture(setBackUri)} style={{ flex:1, backgroundColor: primaryColor, paddingVertical:12, borderRadius:12, alignItems:'center', flexDirection:'row', justifyContent:'center' }}>
              <Ionicons name='camera' size={18} color='#fff' style={{ marginRight:6 }} />
              <Text style={{ color:'#fff', fontWeight:'700' }}>Câmera</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height:16 }} />
          <TouchableOpacity onPress={save} disabled={saving} style={{ backgroundColor: primaryColor, opacity: saving ? 0.7 : 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', flexDirection:'row', justifyContent:'center' }}>
            <Ionicons name='checkmark' size={20} color='#fff' style={{ marginRight:8 }} />
            <Text style={{ color:'#fff', fontWeight:'700' }}>{saving ? 'Salvando…' : 'Salvar'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}