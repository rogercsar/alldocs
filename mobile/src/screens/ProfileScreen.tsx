import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabase';
import { colors } from '../theme/colors';
import { getOrCreateDeviceId } from '../utils/device';

export default function ProfileScreen({ navigation }: any) {
  const [email, setEmail] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [plan, setPlan] = useState<'premium' | 'freemium'>('freemium');
  const [devices, setDevices] = useState<number>(1);
  const [devicesList, setDevicesList] = useState<Array<{ device_id: string; platform?: string; label?: string; last_seen?: string }>>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const primary = colors.brandPrimary;
  const accent = colors.brandAccent;
  const text = colors.text;
  const mutedText = colors.mutedText;
  const cardBg = colors.cardBg;
  const border = colors.border;
  const bg = colors.bg;

  function formatDateTime(ts?: string) {
    if (!ts) return '—';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '—';
    try {
      return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' } as any);
    } catch {
      return d.toISOString();
    }
  }

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.auth.getUser();
      const u = data?.user;
      if (u) {
        setEmail(u.email || '');
        setUserId(u.id);
      }
      let isPremium = false;
      try {
        const base = process.env.EXPO_PUBLIC_API_BASE || process.env.EXPO_PUBLIC_API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
        if (base && u?.id) {
          const res = await fetch(`${base}/.netlify/functions/get-user-status?userId=${u.id}`);
          if (res.ok) {
            const json = await res.json();
            isPremium = !!json?.is_premium;
          }
        }
      } catch {}
      setPlan(isPremium ? 'premium' : 'freemium');

      // Busca a contagem real de dispositivos
      try {
        const base = process.env.EXPO_PUBLIC_API_BASE || process.env.EXPO_PUBLIC_API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
        if (base && u?.id) {
          const [resCount, resList] = await Promise.all([
            fetch(`${base}/.netlify/functions/devices?userId=${u.id}`),
            fetch(`${base}/.netlify/functions/devices?userId=${u.id}&mode=list`),
          ]);
          if (resCount.ok) {
            const json = await resCount.json();
            if (typeof json?.count === 'number') setDevices(json.count);
          }
          if (resList.ok) {
            const j2 = await resList.json();
            if (Array.isArray(j2?.devices)) setDevicesList(j2.devices);
          }
        }
      } catch (e: any) {
        console.warn('Falha ao obter contagem/lista de dispositivos', e?.message || e);
      }

      try {
        const id = await getOrCreateDeviceId();
        setCurrentDeviceId(id);
      } catch {}
    } finally {
      setLoading(false);
    }
  }, []);

  async function onRevoke(deviceId: string) {
    if (!userId) return;
    Alert.alert(
      'Revogar acesso',
      'Tem certeza que deseja revogar o acesso deste dispositivo? Você poderá reconectar depois fazendo login novamente.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Revogar',
          style: 'destructive',
          onPress: async () => {
            try {
              const base = process.env.EXPO_PUBLIC_API_BASE || process.env.EXPO_PUBLIC_API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
              if (!base) return;
              const res = await fetch(`${base}/.netlify/functions/devices`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, deviceId }),
              });
              if (!res.ok) {
                const j = await res.json().catch(() => null);
                Alert.alert('Erro', j?.error || 'Falha ao revogar acesso.');
                return;
              }
              await refresh();
            } catch (e: any) {
              Alert.alert('Erro', e?.message || 'Falha ao revogar acesso.');
            }
          },
        },
      ]
    );
  }

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <View style={{ flex:1, backgroundColor: bg, padding:16 }}>
      <View style={{ width:'100%', maxWidth:720, alignSelf:'center' }}>
        <Text style={{ fontSize:22, fontWeight:'800', color: text, marginBottom:12 }}>Seu perfil</Text>

        <View style={{ backgroundColor: cardBg, borderWidth:1, borderColor: border, borderRadius:16, padding:16 }}>
          {loading ? (
            <View style={{ alignItems:'center', justifyContent:'center', paddingVertical:20 }}>
              <ActivityIndicator color={primary} />
            </View>
          ) : (
            <>
              <View style={{ flexDirection:'row', alignItems:'center', marginBottom:12 }}>
                <Ionicons name='person-circle' size={28} color={accent} style={{ marginRight:8 }} />
                <View style={{ flex:1 }}>
                  <Text style={{ color: text, fontWeight:'800' }}>{email || '—'}</Text>
                  <Text style={{ color: mutedText, fontSize:12 }}>{userId || '—'}</Text>
                </View>
              </View>

              <View style={{ height:1, backgroundColor: border, marginVertical:8 }} />

              <View style={{ flexDirection:'row', alignItems:'center', marginBottom:10 }}>
                <Ionicons name='star' size={18} color={plan === 'premium' ? accent : '#9CA3AF'} style={{ marginRight:8 }} />
                <Text style={{ color: text, fontWeight:'700' }}>Plano atual:</Text>
                <Text style={{ color: plan === 'premium' ? accent : text, marginLeft:6, fontWeight:'700' }}>{plan === 'premium' ? 'Premium' : 'Freemium'}</Text>
              </View>

              <View style={{ flexDirection:'row', alignItems:'center' }}>
                <Ionicons name='hardware-chip' size={18} color={'#9CA3AF'} style={{ marginRight:8 }} />
                <Text style={{ color: text, fontWeight:'700' }}>Dispositivos conectados:</Text>
                <Text style={{ color: text, marginLeft:6 }}>{devices}</Text>
              </View>

              <View style={{ height:12 }} />

              <View style={{ flexDirection:'row', flexWrap:'wrap' }}>
                <TouchableOpacity onPress={refresh} style={{ borderWidth:2, borderColor: primary, paddingVertical:10, paddingHorizontal:14, borderRadius:10, marginRight:8, marginBottom:8, flexDirection:'row', alignItems:'center' }}>
                  <Ionicons name='refresh' size={18} color={primary} style={{ marginRight:6 }} />
                  <Text style={{ color: primary, fontWeight:'800' }}>Atualizar</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => navigation.navigate('Plans')} style={{ backgroundColor: primary, paddingVertical:10, paddingHorizontal:14, borderRadius:10, marginRight:8, marginBottom:8, flexDirection:'row', alignItems:'center' }}>
                  <Ionicons name='pricetags' size={18} color={'#fff'} style={{ marginRight:6 }} />
                  <Text style={{ color:'#fff', fontWeight:'800' }}>{plan === 'premium' ? 'Gerenciar plano' : 'Ver planos'}</Text>
                </TouchableOpacity>
              </View>

              <View style={{ height:1, backgroundColor: border, marginVertical:12 }} />

              <Text style={{ color: text, fontWeight:'800', marginBottom:8 }}>Seus dispositivos</Text>
              {devicesList.length === 0 ? (
                <Text style={{ color: mutedText }}>Nenhum dispositivo registrado.</Text>
              ) : (
                <View>
                  {devicesList.map((d) => (
                    <View key={d.device_id} style={{ borderWidth:1, borderColor: border, backgroundColor: colors.surface, borderRadius:12, padding:12, marginBottom:10 }}>
                      <View style={{ flexDirection:'row', alignItems:'center' }}>
                        <Ionicons name='phone-portrait' size={18} color={colors.mutedIcon} style={{ marginRight:8 }} />
                        <View style={{ flex:1 }}>
                          <Text style={{ color: text, fontWeight:'700' }}>{d.label || d.platform || 'dispositivo'}</Text>
                          <Text style={{ color: mutedText, fontSize:12 }}>{d.device_id}{d.device_id === currentDeviceId ? '  •  este dispositivo' : ''}</Text>
                          <Text style={{ color: mutedText, fontSize:12 }}>Último acesso: {formatDateTime(d.last_seen)}</Text>
                        </View>
                        <TouchableOpacity onPress={() => onRevoke(d.device_id)} style={{ paddingVertical:8, paddingHorizontal:12, borderRadius:8, backgroundColor: '#FFF1F2', borderWidth:1, borderColor: '#FCA5A5' }}>
                          <Text style={{ color: '#B91C1C', fontWeight:'800' }}>Revogar acesso</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              <Text style={{ color: mutedText, fontSize:12, marginTop:6 }}>A contagem considera cada dispositivo autenticado nas últimas sessões.</Text>
            </>
          )}
        </View>
      </View>
    </View>
  );
}