import React, { useEffect, useState } from 'react';
import { View, Text, Button, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { DocumentItem } from '../types';
import { deleteDocument } from '../storage/db';
import { syncDocumentDelete } from '../storage/sync';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { PinchGestureHandler } from 'react-native-gesture-handler';
import { Image } from 'react-native';

function ZoomableImage({ uri }: { uri?: string }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  if (!uri) return null;
  return (
    <PinchGestureHandler
      onGestureEvent={(e) => {
        const s = Math.min(Math.max(e.nativeEvent.scale, 1), 4);
        scale.value = s;
      }}
      onEnded={() => { scale.value = 1; }}
    >
      <Animated.View style={[{ width: '100%', height: 240, overflow: 'hidden' }, animatedStyle]}>
        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode='contain' />
      </Animated.View>
    </PinchGestureHandler>
  );
}

export default function ViewDocumentScreen({ doc, onBack, onDeleted, userId }: { doc: DocumentItem; onBack: () => void; onDeleted: () => void; userId: string; }) {
  const [frontUri, setFrontUri] = useState<string | undefined>(doc.frontImageUri);
  const [backUri, setBackUri] = useState<string | undefined>(doc.backImageUri);

  useEffect(() => {
    const base = process.env.EXPO_PUBLIC_API_BASE;
    if (!base || !doc.id) return;
    (async () => {
      try {
        const res = await fetch(`${base}/.netlify/functions/signed-urls?userId=${userId}&appId=${doc.id}`);
        if (!res.ok) return;
        const json = await res.json();
        if (json?.frontSignedUrl) setFrontUri(json.frontSignedUrl);
        if (json?.backSignedUrl) setBackUri(json.backSignedUrl);
      } catch {}
    })();
  }, [userId, doc.id]);

  async function copyNumber() {
    await Clipboard.setStringAsync(doc.number);
    Alert.alert('Copiado', 'Número copiado para a área de transferência.');
  }

  async function share() {
    const message = `${doc.name} - ${doc.number}`;
    await (await import('react-native')).Share.share({ message });
  }

  async function remove() {
    Alert.alert('Excluir', 'Confirma excluir este documento?', [
      { text:'Cancelar', style:'cancel' },
      { text:'Excluir', style:'destructive', onPress: async () => { await deleteDocument(doc.id!); try { await syncDocumentDelete(doc.id!, userId); } catch {} onDeleted(); } }
    ]);
  }

  return (
    <View style={{ flex:1, padding: 12 }}>
      <Button title="Voltar" onPress={onBack} />
      <Text style={{ fontSize:18, fontWeight:'bold', marginTop:8 }}>{doc.name}</Text>
      <Text style={{ color:'#555', marginBottom:8 }}>{doc.number}</Text>
      <View style={{ flexDirection:'row', gap:8, marginBottom:12 }}>
        <Button title="Copiar Número" onPress={copyNumber} />
        <Button title="Compartilhar" onPress={share} />
        <Button title="Excluir" color="#ff3b30" onPress={remove} />
      </View>

      <ZoomableImage uri={frontUri} />
      <View style={{ height: 8 }} />
      <ZoomableImage uri={backUri} />
    </View>
  );
}