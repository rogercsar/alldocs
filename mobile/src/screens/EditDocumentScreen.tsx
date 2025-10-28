import React, { useState } from 'react';
import { View, Text, TextInput, Button, Image, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { addDocument, saveImageToLocal } from '../storage/db';
import { supabase } from '../supabase';
import { syncDocumentAddOrUpdate } from '../storage/sync';

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
    <View style={{ flex:1, padding: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>Adicionar/Editar Documento</Text>
      <Text>Nome do Documento</Text>
      <TextInput value={name} onChangeText={setName} style={{ borderWidth:1, padding:8, marginBottom:12 }} />
      <Text>Número do Documento</Text>
      <TextInput value={number} onChangeText={setNumber} style={{ borderWidth:1, padding:8, marginBottom:12 }} />

      <Text>Foto (Frente)</Text>
      {frontUri ? <Image source={{ uri: frontUri }} style={{ height:140, marginVertical:6 }} resizeMode='contain'/> : null}
      <View style={{ flexDirection:'row', gap:8 }}>
        <Button title="Galeria" onPress={() => pick(setFrontUri)} />
        <Button title="Câmera" onPress={() => capture(setFrontUri)} />
      </View>

      <View style={{ height:8 }} />
      <Text>Foto (Verso)</Text>
      {backUri ? <Image source={{ uri: backUri }} style={{ height:140, marginVertical:6 }} resizeMode='contain'/> : null}
      <View style={{ flexDirection:'row', gap:8 }}>
        <Button title="Galeria" onPress={() => pick(setBackUri)} />
        <Button title="Câmera" onPress={() => capture(setBackUri)} />
      </View>

      <View style={{ height:16 }} />
      <Button title={saving ? 'Salvando…' : 'Salvar'} onPress={save} disabled={saving} />
    </View>
  );
}