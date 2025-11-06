import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Switch, Platform, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabase';
import { colors } from '../theme/colors';
import { getOrCreateDeviceId, getDeviceLockEnabled, setDeviceLockEnabled } from '../utils/device';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import StorageUsageCard from '../components/StorageUsageCard';

export default function ProfileScreen({ navigation }: any) {
  const [email, setEmail] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [plan, setPlan] = useState<'premium' | 'freemium'>('freemium');
  const [devices, setDevices] = useState<number>(1);
  const [deviceLimit, setDeviceLimit] = useState<number | null>(null);
  const [isPremiumDevices, setIsPremiumDevices] = useState<boolean>(false);
  const [devicesList, setDevicesList] = useState<Array<{ device_id: string; platform?: string; label?: string; last_seen?: string }>>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [lockEnabled, setLockEnabledState] = useState<boolean | null>(null);

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
            if (json && 'limit' in json) setDeviceLimit(json.limit ?? null);
            if (json && 'is_premium' in json) setIsPremiumDevices(!!json.is_premium);
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

  // Inicializa preferência do bloqueio por dispositivo
  useEffect(() => {
    (async () => {
      try {
        const enabled = await getDeviceLockEnabled();
        setLockEnabledState(enabled);
      } catch {}
    })();
  }, []);

  async function onToggleLock(val: boolean) {
    try {
      if (Platform.OS === 'web') {
        Alert.alert('Indisponível no navegador', 'A autenticação pelo dispositivo não se aplica no web.');
      }
      await setDeviceLockEnabled(val);
      setLockEnabledState(val);
      if (val) {
        Alert.alert('Bloqueio ativado', 'Na próxima abertura, o app pedirá autenticação do dispositivo.');
      } else {
        Alert.alert('Bloqueio desativado', 'O app não solicitará autenticação do dispositivo.');
      }
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Falha ao atualizar preferência');
    }
  }

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <View style={{ flex:1, backgroundColor: bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
       <View style={{ width:'100%', maxWidth:720, alignSelf:'center' }}>
        <Text style={{ fontSize: typography.sizes.subtitle, fontWeight: '800', color: text, marginBottom: spacing.sm }}>Seu perfil</Text>

        <View style={{ backgroundColor: cardBg, borderWidth:1, borderColor: border, borderRadius:16, padding: spacing.lg }}>
          {loading ? (
            <View style={{ alignItems:'center', justifyContent:'center', paddingVertical: spacing.md }}>
              <ActivityIndicator color={primary} />
            </View>
          ) : (
            <View>
              <View style={{ flexDirection:'row', alignItems:'center', marginBottom: spacing.sm }}>
                <Ionicons name='person-circle' size={28} color={accent} style={{ marginRight:8 }} />
                <View style={{ flex:1 }}>
                  <Text style={{ color: text, fontWeight: '800' }}>{email || '—'}</Text>
                  <Text style={{ color: mutedText, fontSize: typography.sizes.caption }}>{userId || '—'}</Text>
                </View>
              </View>

              <View style={{ height:1, backgroundColor: border, marginVertical: spacing.xs }} />

              <View style={{ flexDirection:'row', alignItems:'center', marginBottom: spacing.xs }}>
                <Ionicons name='star' size={18} color={plan === 'premium' ? accent : '#9CA3AF'} style={{ marginRight:8 }} />
                <Text style={{ color: text, fontWeight: '700' }}>Plano atual:</Text>
                <Text style={{ color: plan === 'premium' ? accent : text, marginLeft:6, fontWeight: '700' }}>{plan === 'premium' ? 'Premium' : 'Freemium'}</Text>
              </View>

              <View style={{ flexDirection:'row', alignItems:'center' }}>
                <Ionicons name='hardware-chip' size={18} color={'#9CA3AF'} style={{ marginRight:8 }} />
                <Text style={{ color: text, fontWeight: '700' }}>Dispositivos conectados:</Text>
                <Text style={{ color: text, marginLeft:6 }}>{devices}{deviceLimit !== null ? ` / ${deviceLimit}` : ''}</Text>
              </View>
              <View style={{ flexDirection:'row', alignItems:'center', marginTop: spacing.xs }}>
                <Ionicons name='information-circle' size={16} color={colors.mutedIcon} style={{ marginRight:6 }} />
                <Text style={{ color: mutedText, fontSize: typography.sizes.caption }}>
                  {deviceLimit === null
                    ? 'Premium: limite de 5 dispositivos.'
                    : (isPremiumDevices
                        ? `Premium: limite de ${deviceLimit} dispositivos.`
                        : `Gratuito: limite de ${deviceLimit} dispositivos.`)}
                </Text>
              </View>
              <View style={{ height: spacing.md }} />

              <View style={{ flexDirection:'row', flexWrap:'wrap' }}>
                <Pressable onPress={refresh} style={({ pressed }) => ({ borderWidth:2, borderColor: primary, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius:10, marginRight: spacing.xs, marginBottom: spacing.xs, flexDirection:'row', alignItems:'center', shadowColor:'#000', shadowOpacity: pressed ? 0.06 : 0, shadowRadius: pressed ? 8 : 0 })}>
                  <Ionicons name='refresh' size={18} color={primary} style={{ marginRight:6 }} />
                  <Text style={{ color: primary, fontWeight: '800' }}>Atualizar</Text>
                </Pressable>
                <Pressable onPress={() => navigation.navigate('Upgrade', { initialTab: plan === 'premium' ? 'buy-storage' : 'premium' })} style={({ pressed }) => ({ backgroundColor: pressed ? colors.brandPrimaryDark : primary, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius:10, marginRight: spacing.xs, marginBottom: spacing.xs, flexDirection:'row', alignItems:'center', shadowColor:'#000', shadowOpacity: pressed ? 0.1 : 0.06, shadowRadius: pressed ? 10 : 8 })}>
                  <Ionicons name='pricetags' size={18} color={'#fff'} style={{ marginRight:6 }} />
                  <Text style={{ color:'#fff', fontWeight: '800' }}>{plan === 'premium' ? 'Gerenciar plano' : 'Ver planos'}</Text>
                </Pressable>
                <Pressable onPress={() => navigation.navigate('Devices')} style={({ pressed }) => ({ borderWidth:2, borderColor: border, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius:10, marginRight: spacing.xs, marginBottom: spacing.xs, flexDirection:'row', alignItems:'center', backgroundColor: pressed ? colors.surface : '#fff' })}>
                  <Ionicons name='hardware-chip' size={18} color={primary} style={{ marginRight:6 }} />
                  <Text style={{ color: text, fontWeight: '800' }}>Gerenciar dispositivos</Text>
                </Pressable>
              </View>

              <View style={{ height:1, backgroundColor: border, marginVertical: spacing.md }} />

              <StorageUsageCard userId={userId} onOpenUpgrade={(mode) => navigation.navigate('Upgrade', { initialTab: mode === 'buy-storage' ? 'buy-storage' : 'premium' })} />

              <View style={{ height:1, backgroundColor: border, marginVertical: spacing.md }} />

              <View style={{ borderWidth:1, borderColor: border, backgroundColor: colors.surface, borderRadius:12, padding: spacing.md, marginBottom: spacing.sm }}>
                <View style={{ flexDirection:'row', alignItems:'center' }}>
                  <Ionicons name='lock-closed' size={18} color={colors.mutedIcon} style={{ marginRight:8 }} />
                  <Text style={{ color: text, fontWeight: '700', flex:1 }}>Usar PIN/Biometria do dispositivo</Text>
                  {lockEnabled === null ? (
                    <ActivityIndicator />
                  ) : (
                    <Switch value={!!lockEnabled} onValueChange={onToggleLock} />
                  )}
                </View>
                <Text style={{ color: mutedText, fontSize: typography.sizes.caption, marginTop: spacing.xs }}>
                  Quando ativo, você precisará se autenticar com o PIN/biometria do dispositivo para abrir o app.
                </Text>
              </View>

              <Text style={{ color: text, fontWeight: '800', marginBottom: spacing.xs }}>Seus dispositivos</Text>
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
                          <Text style={{ color: mutedText, fontSize: typography.sizes.caption }}>{d.device_id}{d.device_id === currentDeviceId ? '  •  este dispositivo' : ''}</Text>
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

              <Text style={styles.mutedText}>A contagem considera cada dispositivo autenticado nas últimas sessões.</Text>
            </View>
          )}
        </View>

        <View style={{ marginTop: spacing.lg }}>
          <Pressable onPress={() => supabase.auth.signOut()} style={({ pressed }) => [styles.logoutButton, pressed && styles.logoutButtonPressed]}>
            <Ionicons name='log-out-outline' size={22} color={'#B91C1C'} style={{ marginRight:8 }} />
            <Text style={styles.logoutButtonText}>Sair da conta</Text>
          </Pressable>
        </View>
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  contentContainer: {
    padding: spacing.lg,
  },
  profileCard: {
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.lg,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  profileHeaderText: {
    color: colors.text,
    fontWeight: '800',
  },
  profileSubText: {
    color: colors.mutedText,
    fontSize: typography.sizes.caption,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  infoText: {
    color: colors.text,
    fontWeight: '700',
  },
  planText: {
    marginLeft: 6,
    fontWeight: '700',
  },
  mutedText: {
    color: colors.mutedText,
    fontSize: typography.sizes.caption,
    marginTop: spacing.xs,
  },
  logoutButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButtonPressed: {
    backgroundColor: '#F8F8F8',
    borderColor: '#E0E0E0',
  },
  logoutButtonText: {
    color: '#B91C1C',
    fontWeight: '800',
    fontSize: typography.sizes.body,
  },
});