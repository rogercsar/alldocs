import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ActivityIndicator, Alert, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabase';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';

export default function DevicesScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>('');
  const [count, setCount] = useState<number>(0);
  const [limit, setLimit] = useState<number | null>(null);
  const [isPremium, setIsPremium] = useState<boolean>(false);
  const [devicesList, setDevicesList] = useState<Array<{ device_id: string; platform?: string; label?: string; last_seen?: string }>>([]);

  const primary = colors.brandPrimary;
  const accent = colors.brandAccent;
  const text = colors.text;
  const mutedText = colors.mutedText;
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
      if (!u) return;
      setUserId(u.id);
      const base = process.env.EXPO_PUBLIC_API_BASE || process.env.EXPO_PUBLIC_API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
      if (!base) return;
      const [resCount, resList] = await Promise.all([
        fetch(`${base}/.netlify/functions/devices?userId=${u.id}`),
        fetch(`${base}/.netlify/functions/devices?userId=${u.id}&mode=list`),
      ]);
      if (resCount.ok) {
        const json = await resCount.json();
        if (typeof json?.count === 'number') setCount(json.count);
        if ('limit' in json) setLimit(json.limit ?? null);
        if ('is_premium' in json) setIsPremium(!!json.is_premium);
      }
      if (resList.ok) {
        const j2 = await resList.json();
        if (Array.isArray(j2?.devices)) setDevicesList(j2.devices);
      }
    } catch (e: any) {
      console.warn('Falha ao obter dispositivos', e?.message || e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

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

  return (
    <View style={{ flex:1, backgroundColor: bg, padding: spacing.lg }}>
      <View style={{ width:'100%', maxWidth:720, alignSelf:'center' }}>
        <Text style={{ fontSize: typography.sizes.subtitle, fontWeight: '800', color: text, marginBottom: spacing.sm }}>Gerenciar dispositivos</Text>

        <View style={{ backgroundColor: colors.cardBg, borderWidth:1, borderColor: border, borderRadius:16, padding: spacing.lg }}>
          {loading ? (
            <View style={{ alignItems:'center', justifyContent:'center', paddingVertical: spacing.md }}>
              <ActivityIndicator color={primary} />
            </View>
          ) : (
            <>
              <View style={{ flexDirection:'row', alignItems:'center', marginBottom: spacing.xs }}>
                <Ionicons name='star' size={18} color={isPremium ? accent : '#9CA3AF'} style={{ marginRight:8 }} />
                <Text style={{ color: text, fontWeight: '700' }}>Plano atual:</Text>
                <Text style={{ color: isPremium ? accent : text, marginLeft:6, fontWeight: '700' }}>{isPremium ? 'Premium' : 'Freemium'}</Text>
              </View>

              <View style={{ flexDirection:'row', alignItems:'center' }}>
                <Ionicons name='hardware-chip' size={18} color={'#9CA3AF'} style={{ marginRight:8 }} />
                <Text style={{ color: text, fontWeight: '700' }}>Dispositivos conectados:</Text>
                <Text style={{ color: text, marginLeft:6 }}>{count}{limit !== null ? ` / ${limit}` : ''}</Text>
              </View>
              <View style={{ flexDirection:'row', alignItems:'center', marginTop: spacing.xs }}>
                <Ionicons name='information-circle' size={16} color={colors.mutedIcon} style={{ marginRight:6 }} />
                <Text style={{ color: mutedText, fontSize: typography.sizes.caption }}>
                  {limit === null
                    ? 'Premium: limite de dispositivos ilimitado.'
                    : (isPremium
                        ? `Premium: limite de ${limit} dispositivos.`
                        : `Gratuito: limite de ${limit} dispositivos.`)}
                </Text>
              </View>

              <View style={{ height: spacing.md }} />

              {devicesList.length === 0 ? (
                <Text style={{ color: mutedText }}>Nenhum dispositivo registrado.</Text>
              ) : (
                <View>
                  {devicesList.map((d) => (
                    <View key={d.device_id} style={{ borderWidth:1, borderColor: border, backgroundColor: colors.surface, borderRadius:12, padding: spacing.md, marginBottom: spacing.xs }}>
                      <View style={{ flexDirection:'row', alignItems:'center' }}>
                        <Ionicons name='phone-portrait' size={18} color={colors.mutedIcon} style={{ marginRight:8 }} />
                        <View style={{ flex:1 }}>
                          <Text style={{ color: text, fontWeight: '700' }}>{d.label || d.platform || 'dispositivo'}</Text>
                          <Text style={{ color: mutedText, fontSize: typography.sizes.caption }}>{d.device_id}</Text>
                          <Text style={{ color: mutedText, fontSize: typography.sizes.caption }}>Último acesso: {formatDateTime(d.last_seen)}</Text>
                        </View>
                        <Pressable onPress={() => onRevoke(d.device_id)} style={({ pressed }) => ({ paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius:8, backgroundColor: pressed ? '#FFE4E6' : '#FFF1F2', borderWidth:1, borderColor: '#FCA5A5', opacity: pressed ? 0.95 : 1 })}>
                          <Text style={{ color: '#B91C1C', fontWeight: '800' }}>Revogar acesso</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              <Text style={{ color: mutedText, fontSize: typography.sizes.caption, marginTop: spacing.xs }}>A contagem considera cada dispositivo autenticado nas últimas sessões.</Text>
            </>
          )}
        </View>
      </View>
    </View>
  );
}