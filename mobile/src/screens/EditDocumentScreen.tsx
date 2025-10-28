import React, { useState } from 'react';
import { View, Text, TextInput, Image, Alert, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { addDocument, updateDocument, saveImageToLocal } from '../storage/db';
import { supabase } from '../supabase';
import { syncDocumentAddOrUpdate } from '../storage/sync';

const primaryColor = '#4F46E5';
const bgColor = '#F3F4F6';

const DOC_TYPES = ['RG', 'CNH', 'CPF', 'Passaporte', 'Outros'] as const;

function getTemplate(type: typeof DOC_TYPES[number]) {
  switch (type) {
    case 'RG':
      return { numberLabel: 'Número do RG', frontLabel: 'Foto (Frente RG)', backLabel: 'Foto (Verso RG)' };
    case 'CNH':
      return { numberLabel: 'Número da CNH', frontLabel: 'Foto (Frente CNH)', backLabel: 'Foto (Verso CNH)' };
    case 'CPF':
      return { numberLabel: 'CPF', frontLabel: 'Foto (Frente CPF)', backLabel: 'Foto (Verso CPF)' };
    case 'Passaporte':
      return { numberLabel: 'Número do Passaporte', frontLabel: 'Foto (Frente Passaporte)', backLabel: 'Foto (Verso Passaporte)' };
    default:
      return { numberLabel: 'Número do Documento', frontLabel: 'Foto (Frente)', backLabel: 'Foto (Verso)' };
  }
}

export default function EditDocumentScreen({ onSaved, userId, document }: { onSaved: () => void; userId: string; document?: DocumentItem }) {
  const [name, setName] = useState(document?.name || '');
  const [number, setNumber] = useState(document?.number || '');
  const [frontUri, setFrontUri] = useState<string | undefined>(document?.frontImageUri || undefined);
  const [backUri, setBackUri] = useState<string | undefined>(document?.backImageUri || undefined);
  const [saving, setSaving] = useState(false);
  const [docType, setDocType] = useState<typeof DOC_TYPES[number]>(document?.type as any || 'RG');

  useEffect(() => {
    setName(document?.name || '');
    setNumber(document?.number || '');
    setFrontUri(document?.frontImageUri || undefined);
    setBackUri(document?.backImageUri || undefined);
    setDocType((document?.type as any) || 'RG');
  }, [document?.id]);

  const template = getTemplate(docType);

  async function pick(setter: (uri: string) => void) {
    const res = await ImagePicker.launchImageLibraryAsync({ selectionLimit: 1, mediaTypes: [ImagePicker.MediaType.Image], quality: 0.9 });
    if (!res.canceled && res.assets?.[0]?.uri) setter(res.assets[0].uri);
  }

  async function capture(setter: (uri: string) => void) {
    const res = await ImagePicker.launchCameraAsync({ quality: 0.9 });
    if (!res.canceled && res.assets?.[0]?.uri) setter(res.assets[0].uri);
  }

  async function save() {
    if (!name || !number) { Alert.alert('Campos obrigatórios', 'Informe nome e número'); return; }
    setSaving(true);

    if (document?.id) {
      const f = frontUri ? await saveImageToLocal(frontUri) : (document.frontImageUri || '');
      const b = backUri ? await saveImageToLocal(backUri) : (document.backImageUri || '');
      await updateDocument(document.id, { name, number, frontImageUri: f, backImageUri: b, type: docType, synced: 0 });
      setSaving(false);
      try {
        await syncDocumentAddOrUpdate({ id: document.id, name, number, frontImageUri: f, backImageUri: b }, userId);
      } catch {}
      onSaved();
      return;
    }

    const f = frontUri ? await saveImageToLocal(frontUri) : '';
    const b = backUri ? await saveImageToLocal(backUri) : '';
    const id = await addDocument({ name, number, frontImageUri: f, backImageUri: b, type: docType, synced: 0 });
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

        {/* Tipo de Documento */}
        <View style={{ backgroundColor:'#fff', borderRadius:16, padding:12, borderWidth:1, borderColor:'#E5E7EB', shadowColor:'#000', shadowOpacity:0.06, shadowRadius:12, elevation:3, marginBottom:12 }}>
          <Text style={{ fontSize: 14, color:'#374151', marginBottom: 8 }}>Tipo de Documento</Text>
          <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8 }}>
            {DOC_TYPES.map((t) => (
              <TouchableOpacity key={t} onPress={() => setDocType(t)} style={{ paddingVertical:8, paddingHorizontal:12, borderRadius:9999, borderWidth:1, borderColor: docType === t ? primaryColor : '#E5E7EB', backgroundColor: docType === t ? '#EEF2FF' : '#fff', marginRight:8, marginBottom:8 }}>
                <Text style={{ color: docType === t ? primaryColor : '#374151', fontWeight:'600' }}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ backgroundColor:'#fff', borderRadius:16, padding:16, borderWidth:1, borderColor:'#E5E7EB', shadowColor:'#000', shadowOpacity:0.06, shadowRadius:12, elevation:3 }}>
          <Text style={{ fontSize: 14, color:'#374151', marginBottom: 6 }}>Nome do Documento</Text>
          <TextInput value={name} onChangeText={setName} placeholder={`Ex.: ${docType}`} placeholderTextColor='#9CA3AF' style={{ backgroundColor:'#F9FAFB', borderWidth:1, borderColor:'#E5E7EB', paddingVertical:12, paddingHorizontal:14, borderRadius:12, marginBottom:14 }} />

          <Text style={{ fontSize: 14, color:'#374151', marginBottom: 6 }}>{template.numberLabel}</Text>
          <TextInput value={number} onChangeText={setNumber} placeholder='Ex.: 123456789' placeholderTextColor='#9CA3AF' style={{ backgroundColor:'#F9FAFB', borderWidth:1, borderColor:'#E5E7EB', paddingVertical:12, paddingHorizontal:14, borderRadius:12, marginBottom:16 }} />

          <Text style={{ fontSize: 14, color:'#374151', marginBottom: 6 }}>{template.frontLabel}</Text>
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

          <Text style={{ fontSize: 14, color:'#374151', marginBottom: 6 }}>{template.backLabel}</Text>
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