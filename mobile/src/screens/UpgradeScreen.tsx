import React, { useState } from 'react';
import { View, Text, Button, ActivityIndicator, Alert } from 'react-native';
import { WebView } from 'react-native-webview';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || '';

export default function UpgradeScreen({ onClose }: { onClose: () => void }) {
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function startPayment() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/.netlify/functions/mercadopago-create-preference`, { method:'POST' });
      const json = await res.json();
      if (json.init_point) setCheckoutUrl(json.init_point);
      else throw new Error('Preferência não criada');
    } catch (e: any) {
      Alert.alert('Erro ao iniciar pagamento', e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex:1 }}>
      {!checkoutUrl ? (
        <View style={{ flex:1, padding:16 }}>
          <Text style={{ fontSize: 20, fontWeight:'bold', marginBottom:8 }}>Upgrade Premium</Text>
          <Text style={{ marginBottom:12 }}>Adicione documentos ilimitados para você e sua família. Pagamento ÚNICO de R$ 19,90.</Text>
          <Button title={loading ? 'Carregando…' : 'Desbloquear Premium Agora'} onPress={startPayment} disabled={loading} />
          <View style={{ height:12 }} />
          <Button title="Fechar" onPress={onClose} />
        </View>
      ) : (
        <WebView source={{ uri: checkoutUrl }} />
      )}
    </View>
  );
}