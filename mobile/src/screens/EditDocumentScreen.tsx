import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Image, Alert, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { addDocument, updateDocument, saveImageToLocal } from '../storage/db';
import { supabase } from '../supabase';
import { syncDocumentAddOrUpdate } from '../storage/sync';
import type { DocumentItem } from '../types';
import { colors } from '../theme/colors';

const primaryColor = colors.brandPrimary;
const bgColor = colors.bg;

const DOC_TYPES = ['RG', 'CNH', 'CPF', 'Passaporte', 'Comprovante de endereço', 'Documento do veículo', 'Cartões', 'Certidões', 'Outros'] as const;

function getTemplate(type: typeof DOC_TYPES[number]) {
  switch (type) {
    case 'RG':
      return { numberLabel: 'Número do RG', frontLabel: 'Foto (Frente RG)', backLabel: 'Foto (Verso RG)', imagesLayout: 'sideBySide', hasBack: true, numberPlaceholder: 'Ex.: 12.345.678-9' };
    case 'CNH':
      return { numberLabel: 'Número da CNH', frontLabel: 'Foto (Frente CNH)', backLabel: 'Foto (Verso CNH)', imagesLayout: 'sideBySide', hasBack: true, numberPlaceholder: 'Ex.: 00000000000' };
    case 'CPF':
      return { numberLabel: 'CPF', frontLabel: 'Foto (Frente CPF)', backLabel: 'Foto (Verso CPF)', imagesLayout: 'sideBySide', hasBack: true, numberPlaceholder: 'Ex.: 000.000.000-00' };
    case 'Passaporte':
      return { numberLabel: 'Número do Passaporte', frontLabel: 'Foto (Frente Passaporte)', backLabel: 'Foto (Verso Passaporte)', imagesLayout: 'stack', hasBack: true, numberPlaceholder: 'Ex.: BR123456' };
    case 'Comprovante de endereço':
      return { numberLabel: 'Identificador', frontLabel: 'Foto (Frente Comprovante)', backLabel: '', imagesLayout: 'stack', hasBack: false, numberPlaceholder: 'Ex.: Conta nº / Código cliente' };
    case 'Documento do veículo':
      return { numberLabel: 'Placa/RENAVAM', frontLabel: 'Foto (Frente Doc Veículo)', backLabel: 'Foto (Verso Doc Veículo)', imagesLayout: 'sideBySide', hasBack: true, numberPlaceholder: 'Ex.: ABC1D23 ou 123456789' };
    case 'Cartões':
      return { numberLabel: 'Número do Cartão', frontLabel: 'Foto (Frente Cartão)', backLabel: 'Foto (Verso Cartão)', imagesLayout: 'sideBySide', hasBack: true, numberPlaceholder: 'Ex.: 1234 5678 9012 3456' };
    case 'Certidões':
      return { numberLabel: 'Número do Registro', frontLabel: 'Foto (Frente Certidão)', backLabel: 'Foto (Verso Certidão)', imagesLayout: 'stack', hasBack: true, numberPlaceholder: 'Ex.: Livro/Folha/Termo' };
    default:
      return { numberLabel: 'Número do Documento', frontLabel: 'Foto (Frente)', backLabel: 'Foto (Verso)', imagesLayout: 'stack', hasBack: true, numberPlaceholder: 'Ex.: 123456789' };
  }
}

export default function EditDocumentScreen({ onSaved, userId, document }: { onSaved: () => void; userId: string; document?: DocumentItem }) {
  const [name, setName] = useState(document?.name || '');
  const [number, setNumber] = useState(document?.number || '');
  const [frontUri, setFrontUri] = useState<string | undefined>(document?.frontImageUri || undefined);
  const [backUri, setBackUri] = useState<string | undefined>(document?.backImageUri || undefined);
  const [saving, setSaving] = useState(false);
  const [docType, setDocType] = useState<typeof DOC_TYPES[number]>(document?.type as any || 'RG');
  // Campos RG/CNH
  const [issueDate, setIssueDate] = useState(document?.issueDate || '');
  const [expiryDate, setExpiryDate] = useState(document?.expiryDate || '');
  const [issuingState, setIssuingState] = useState(document?.issuingState || '');
  const [issuingCity, setIssuingCity] = useState(document?.issuingCity || '');
  const [issuingAuthority, setIssuingAuthority] = useState(document?.issuingAuthority || '');

  useEffect(() => {
    setName(document?.name || '');
    setNumber(document?.number || '');
    setFrontUri(document?.frontImageUri || undefined);
    setBackUri(document?.backImageUri || undefined);
    setDocType((document?.type as any) || 'RG');
    setIssueDate(document?.issueDate || '');
    setExpiryDate(document?.expiryDate || '');
    setIssuingState(document?.issuingState || '');
    setIssuingCity(document?.issuingCity || '');
    setIssuingAuthority(document?.issuingAuthority || '');
  }, [document?.id]);

  const template = getTemplate(docType);

  async function pick(setter: (uri: string) => void) {
    const res = await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: false, mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.9 });
    if (!res.canceled && res.assets?.[0]?.uri) setter(res.assets[0].uri);
  }

  async function capture(setter: (uri: string) => void) {
    if (Platform.OS === 'web') {
      // No web, câmera abre seletor de arquivo; usar galeria para consistência
      return pick(setter);
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.9 });
    if (!res.canceled && res.assets?.[0]?.uri) setter(res.assets[0].uri);
  }

  function shouldShowMetadata(t: typeof DOC_TYPES[number]) {
    return t === 'RG' || t === 'CNH';
  }

  async function save() {
    if (!name || !number) { Alert.alert('Campos obrigatórios', 'Informe nome e número'); return; }
    setSaving(true);

    const meta = shouldShowMetadata(docType)
      ? { issueDate: issueDate || '', expiryDate: expiryDate || '', issuingState: issuingState || '', issuingCity: issuingCity || '', issuingAuthority: issuingAuthority || '' }
      : { issueDate: '', expiryDate: '', issuingState: '', issuingCity: '', issuingAuthority: '' };

    if (document?.id) {
      const f = frontUri ? await saveImageToLocal(frontUri) : (document.frontImageUri || '');
      const b = backUri ? await saveImageToLocal(backUri) : (document.backImageUri || '');
      await updateDocument(document.id, { name, number, frontImageUri: f, backImageUri: b, type: docType, synced: 0, ...meta });
      setSaving(false);
      try {
        await syncDocumentAddOrUpdate({ id: document.id, name, number, frontImageUri: f, backImageUri: b }, userId);
      } catch {}
      onSaved();
      return;
    }

    const f = frontUri ? await saveImageToLocal(frontUri) : '';
    const b = backUri ? await saveImageToLocal(backUri) : '';
    const id = await addDocument({ name, number, frontImageUri: f, backImageUri: b, type: docType, synced: 0, ...meta });
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
          <TextInput value={number} onChangeText={setNumber} placeholder={template.numberPlaceholder} placeholderTextColor='#9CA3AF' style={{ backgroundColor:'#F9FAFB', borderWidth:1, borderColor:'#E5E7EB', paddingVertical:12, paddingHorizontal:14, borderRadius:12, marginBottom:16 }} />

          {shouldShowMetadata(docType) && (
            <View style={{ backgroundColor:'#F9FAFB', borderWidth:1, borderColor:'#E5E7EB', padding:12, borderRadius:12, marginBottom:16 }}>
              <Text style={{ fontSize: 14, color:'#374151', marginBottom: 8, fontWeight:'700' }}>Informações do Documento</Text>
              <View style={{ flexDirection:'row', gap:8 }}>
                <View style={{ flex:1 }}>
                  <Text style={{ fontSize: 13, color:'#6B7280', marginBottom: 6 }}>Data de Expedição</Text>
                  <TextInput value={issueDate} onChangeText={setIssueDate} placeholder='DD/MM/AAAA' placeholderTextColor='#9CA3AF' style={{ backgroundColor:'#fff', borderWidth:1, borderColor:'#E5E7EB', paddingVertical:10, paddingHorizontal:12, borderRadius:10, marginBottom:8 }} />
                </View>
                <View style={{ flex:1 }}>
                  <Text style={{ fontSize: 13, color:'#6B7280', marginBottom: 6 }}>Data de Vencimento</Text>
                  <TextInput value={expiryDate} onChangeText={setExpiryDate} placeholder='DD/MM/AAAA' placeholderTextColor='#9CA3AF' style={{ backgroundColor:'#fff', borderWidth:1, borderColor:'#E5E7EB', paddingVertical:10, paddingHorizontal:12, borderRadius:10, marginBottom:8 }} />
                </View>
              </View>
              <View style={{ flexDirection:'row', gap:8 }}>
                <View style={{ flex:1 }}>
                  <Text style={{ fontSize: 13, color:'#6B7280', marginBottom: 6 }}>UF</Text>
                  <TextInput value={issuingState} onChangeText={(v)=> setIssuingState(v.toUpperCase().slice(0,2))} placeholder='UF' placeholderTextColor='#9CA3AF' maxLength={2} style={{ backgroundColor:'#fff', borderWidth:1, borderColor:'#E5E7EB', paddingVertical:10, paddingHorizontal:12, borderRadius:10, marginBottom:8 }} />
                </View>
                <View style={{ flex:2 }}>
                  <Text style={{ fontSize: 13, color:'#6B7280', marginBottom: 6 }}>Cidade</Text>
                  <TextInput value={issuingCity} onChangeText={setIssuingCity} placeholder='Cidade emissora' placeholderTextColor='#9CA3AF' style={{ backgroundColor:'#fff', borderWidth:1, borderColor:'#E5E7EB', paddingVertical:10, paddingHorizontal:12, borderRadius:10, marginBottom:8 }} />
                </View>
              </View>
              <View>
                <Text style={{ fontSize: 13, color:'#6B7280', marginBottom: 6 }}>Órgão Emissor</Text>
                <TextInput value={issuingAuthority} onChangeText={setIssuingAuthority} placeholder='Ex.: SSP' placeholderTextColor='#9CA3AF' style={{ backgroundColor:'#fff', borderWidth:1, borderColor:'#E5E7EB', paddingVertical:10, paddingHorizontal:12, borderRadius:10 }} />
              </View>
            </View>
          )}

          {template.imagesLayout === 'sideBySide' ? (
            <View style={{ flexDirection:'row', gap:8 }}>
              {/* Frente */}
              <View style={{ flex:1 }}>
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
              </View>

              {/* Verso */}
              {template.hasBack && (
                <View style={{ flex:1 }}>
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
                </View>
              )}
            </View>
          ) : (
            <>
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

              {template.hasBack && (
                <>
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
                </>
              )}
            </>
          )}

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