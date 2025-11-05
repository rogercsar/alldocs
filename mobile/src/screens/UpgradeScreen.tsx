import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Button, ActivityIndicator, Alert, TouchableOpacity, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { supabase } from '../supabase';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || process.env.EXPO_PUBLIC_API_BASE_URL || (typeof window !== 'undefined' ? (window as any).location.origin : '');

export default function UpgradeScreen({ onClose, initialTab }: { onClose: () => void; initialTab?: 'premium' | 'buy-storage' }) {
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const userIdRef = useRef<string>('');
  const [statusText, setStatusText] = useState<string>('');

  type Addon = { label: string; bytes: number; price: number };
  const addons: Addon[] = [
    { label: '+1 GB', bytes: 1 * 1024 * 1024 * 1024, price: 4.9 },
    { label: '+5 GB', bytes: 5 * 1024 * 1024 * 1024, price: 9.9 },
    { label: '+20 GB', bytes: 20 * 1024 * 1024 * 1024, price: 29.9 },
  ];
  const [selectedTab, setSelectedTab] = useState<'premium' | 'buy-storage'>(initialTab === 'buy-storage' ? 'buy-storage' : 'premium');
  // Seleciona automaticamente a aba de compra para usuários Premium
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data?.user;
        if (!user?.id) return;
        const res = await fetch(`${API_BASE}/.netlify/functions/get-user-status?userId=${encodeURIComponent(user.id)}`);
        if (res.ok) {
          const j = await res.json();
          if (j?.is_premium && !cancelled) {
            setSelectedTab('buy-storage');
          }
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  async function startAddonPayment(a: Addon) {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user?.id) {
        Alert.alert('É necessário estar logado', 'Entre na sua conta para prosseguir com o pagamento.');
        return;
      }
      userIdRef.current = user.id;
      const planId = a.label.includes('1') ? '3' : a.label.includes('5') ? '4' : '5';
      const res = await fetch(`${API_BASE}/.netlify/functions/mercadopago-create-preference`, {
        method:'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ planId })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `Falha ${res.status}`);
      }
      const json = await res.json();
      if (json.init_point) {
        if (Platform.OS === 'web') {
          try { (window as any).open(json.init_point, '_blank', 'noopener,noreferrer'); } catch {}
          setCheckoutUrl(json.init_point);
        } else {
          setCheckoutUrl(json.init_point);
        }
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

  async function startPayment() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user?.id) {
        Alert.alert('É necessário estar logado', 'Entre na sua conta para prosseguir com o pagamento.');
        return;
      }
      userIdRef.current = user.id;
      const res = await fetch(`${API_BASE}/.netlify/functions/mercadopago-create-preference`, {
        method:'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ planId: '2' })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `Falha ${res.status}`);
      }
      const json = await res.json();
      if (json.init_point) {
        if (Platform.OS === 'web') {
          try {
            (window as any).open(json.init_point, '_blank', 'noopener,noreferrer');
          } catch {}
          setCheckoutUrl(json.init_point);
        } else {
          setCheckoutUrl(json.init_point);
        }
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
          {/* Tabs */}
          <View style={{ flexDirection:'row', marginBottom:12 }}>
            <TouchableOpacity onPress={() => setSelectedTab('premium')} style={{ borderWidth:1, borderColor: selectedTab==='premium' ? '#111827' : '#D1D5DB', backgroundColor: selectedTab==='premium' ? '#111827' : '#fff', paddingVertical:8, paddingHorizontal:12, borderRadius:8, marginRight:8 }}>
              <Text style={{ color: selectedTab==='premium' ? '#fff' : '#111827', fontWeight:'700' }}>Premium</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSelectedTab('buy-storage')} style={{ borderWidth:1, borderColor: selectedTab==='buy-storage' ? '#111827' : '#D1D5DB', backgroundColor: selectedTab==='buy-storage' ? '#111827' : '#fff', paddingVertical:8, paddingHorizontal:12, borderRadius:8 }}>
              <Text style={{ color: selectedTab==='buy-storage' ? '#fff' : '#111827', fontWeight:'700' }}>Armazenamento adicional</Text>
            </TouchableOpacity>
          </View>

          {selectedTab === 'premium' ? (
            <View>
              <Text style={{ fontSize: 20, fontWeight:'bold', marginBottom:8 }}>Upgrade Premium</Text>
              <Text style={{ marginBottom:12 }}>Adicione documentos ilimitados para você e sua família. Pagamento ÚNICO de R$ 19,90.</Text>
              <Button title={loading ? 'Carregando…' : 'Desbloquear Premium Agora'} onPress={startPayment} disabled={loading} />
            </View>
          ) : (
            <View>
              <Text style={{ fontSize: 20, fontWeight:'bold', marginBottom:8 }}>Armazenamento adicional</Text>
              <Text style={{ marginBottom:12 }}>Aumente sua cota comprando armazenamento adicional. Escolha uma opção:</Text>
              {addons.map((a) => (
                <TouchableOpacity key={a.label} onPress={() => startAddonPayment(a)} style={{ borderWidth:1, borderColor:'#D1D5DB', borderRadius:10, paddingVertical:10, paddingHorizontal:12, marginBottom:8, flexDirection:'row', justifyContent:'space-between' }}>
                  <Text style={{ fontWeight:'700' }}>{a.label}</Text>
                  <Text>R$ {a.price.toFixed(2)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={{ height:12 }} />
          <Button title="Fechar" onPress={onClose} />
        </View>
      ) : (
        <View style={{ flex:1 }}>
          {Platform.OS === 'web' ? (
            <View style={{ flex:1, padding:16 }}>
              <Text style={{ marginBottom:8 }}>O checkout abriu em uma nova aba.</Text>
              <TouchableOpacity onPress={() => { try { (window as any).open(checkoutUrl!, '_blank', 'noopener,noreferrer'); } catch {} }} style={{ borderWidth:1, borderColor:'#6B7280', borderRadius:8, paddingHorizontal:12, paddingVertical:10, marginBottom:12 }}>
                <Text>Abrir checkout novamente</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <WebView source={{ uri: checkoutUrl! }} onNavigationStateChange={onNav} startInLoadingState renderLoading={() => (
              <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
                <ActivityIndicator />
                <Text style={{ marginTop:8 }}>{statusText || 'Carregando…'}</Text>
              </View>
            )} />
          )}
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