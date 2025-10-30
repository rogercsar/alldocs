import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Button, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import { supabase } from '../supabase';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || process.env.EXPO_PUBLIC_API_BASE_URL || (typeof window !== 'undefined' ? (window as any).location.origin : '');

export default function UpgradeScreen({ onClose }: { onClose: () => void }) {
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const userIdRef = useRef<string>('');
  const [statusText, setStatusText] = useState<string>('');

  async function startPayment() {
    setLoading(true);
    try {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (!user?.id) {
        Alert.alert('É necessário estar logado', 'Entre na sua conta para prosseguir com o pagamento.');
        return;
      }
      userIdRef.current = user.id;
      const email = user.email || undefined;
      const res = await fetch(`${API_BASE}/.netlify/functions/mercadopago-create-preference`, {
        method:'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, email, itemTitle: 'EVDocs Premium - Pagamento Único', price: 19.9 })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `Falha ${res.status}`);
      }
      const json = await res.json();
      if (json.init_point) {
        setCheckoutUrl(json.init_point);
        setStatusText('Aguardando confirmação do pagamento…');
        setPolling(true);
      } else {
        throw new Error('Preferência não criada');
      }
    } catch (e: any) {
      Alert.alert('Erro ao iniciar pagamento', e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!polling || !userIdRef.current) return;
    let t: any;
    let cancelled = false;
    const loop = async () => {
      try {
        const res = await fetch(`${API_BASE}/.netlify/functions/get-user-status?userId=${encodeURIComponent(userIdRef.current)}`);
        if (res.ok) {
          const j = await res.json();
          if (j?.is_premium) {
            setStatusText('Pagamento aprovado! Ativando Premium…');
            setPolling(false);
            if (!cancelled) {
              Alert.alert('Sucesso', 'Seu plano Premium foi ativado.');
              onClose();
            }
            return;
          }
        }
      } catch {}
      t = setTimeout(loop, 3000);
    };
    t = setTimeout(loop, 3000);
    return () => { cancelled = true; if (t) clearTimeout(t); };
  }, [polling, onClose]);

  function onNav(navState: any) {
    try {
      const url: string = navState?.url || '';
      if (/approved|success/i.test(url)) {
        setStatusText('Pagamento aprovado! Checando status…');
        setPolling(true);
      }
      if (/failure|rejected/i.test(url)) {
        setStatusText('Pagamento não aprovado. Tente novamente.');
        setPolling(false);
      }
    } catch {}
  }

  async function checkNow() {
    if (!userIdRef.current) return;
    try {
      const res = await fetch(`${API_BASE}/.netlify/functions/get-user-status?userId=${encodeURIComponent(userIdRef.current)}`);
      const j = await res.json();
      if (j?.is_premium) {
        Alert.alert('Sucesso', 'Seu plano Premium foi ativado.');
        onClose();
        return;
      }
      Alert.alert('Ainda não confirmado', 'Não encontramos a confirmação ainda. Aguarde alguns instantes e tente novamente.');
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Falha ao verificar status');
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
        <View style={{ flex:1 }}>
          <WebView source={{ uri: checkoutUrl }} onNavigationStateChange={onNav} startInLoadingState renderLoading={() => (
            <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
              <ActivityIndicator />
              <Text style={{ marginTop:8 }}>{statusText || 'Carregando…'}</Text>
            </View>
          )} />
          <View style={{ padding:12, borderTopWidth:1, borderTopColor:'#E5E7EB' }}>
            <Text style={{ marginBottom:8 }}>{statusText || 'Aguardando confirmação do pagamento…'}</Text>
            <View style={{ flexDirection:'row' }}>
              <TouchableOpacity onPress={checkNow} style={{ borderWidth:1, borderColor:'#6B7280', borderRadius:8, paddingHorizontal:12, paddingVertical:10, marginRight:8 }}>
                <Text>Já paguei, verificar agora</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={{ borderWidth:1, borderColor:'#6B7280', borderRadius:8, paddingHorizontal:12, paddingVertical:10 }}>
                <Text>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}