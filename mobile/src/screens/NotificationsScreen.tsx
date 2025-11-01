import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Switch, TouchableOpacity, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { useToast } from '../components/Toast';
import { ensureNotificationPermission, scheduleExpiryNotifications } from '../utils/notifications';
import { getDocuments } from '../storage/db';
import * as SecureStore from 'expo-secure-store';

export default function NotificationsScreen() {
  const navigation = useNavigation();
  const { showToast } = useToast();
  const [enabled, setEnabled] = useState(false);
  const primaryColor = colors.brandPrimary;

  useEffect(() => {
    navigation.setOptions({ headerTitle: 'Notificações' });
  }, [navigation]);

  // Carregar preferência persistida e validar permissão
  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync('notificationsEnabled');
        if (stored === 'true') {
          const ok = await ensureNotificationPermission();
          setEnabled(!!ok);
          if (!ok) await SecureStore.setItemAsync('notificationsEnabled', 'false');
        } else {
          setEnabled(false);
        }
      } catch {
        const ok = await ensureNotificationPermission();
        setEnabled(!!ok);
      }
    })();
  }, []);

  const toggleEnabled = useCallback(async () => {
    if (!enabled) {
      const ok = await ensureNotificationPermission();
      setEnabled(!!ok);
      if (ok) {
        await SecureStore.setItemAsync('notificationsEnabled', 'true');
        showToast('Notificações ativadas', { type: 'success' });
      } else {
        await SecureStore.setItemAsync('notificationsEnabled', 'false');
        showToast('Permissão de notificação não concedida', { type: 'error' });
      }
    } else {
      setEnabled(false);
      await SecureStore.setItemAsync('notificationsEnabled', 'false');
      showToast('Notificações desativadas', { type: 'info' });
    }
  }, [enabled, showToast]);

  const handleSchedule = useCallback(async () => {
    try {
      const docs = await getDocuments();
      await scheduleExpiryNotifications(docs);
      showToast('Alertas de vencimento agendados', { type: 'success' });
    } catch (e) {
      showToast('Falha ao agendar alertas', { type: 'error' });
    }
  }, [showToast]);

  return (
    <View style={{ flex:1, backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal:16, paddingTop:16 }}>
        <View style={{ backgroundColor:'#fff', borderWidth:1, borderColor:'#E5E7EB', borderRadius:12, padding:16 }}>
          <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
            <View style={{ flex:1, paddingRight:12 }}>
              <Text style={{ color:'#111827', fontSize:16, fontWeight:'700' }}>Alertas de vencimento</Text>
              <Text style={{ color:'#6B7280', marginTop:4 }}>
                Receber notificações quando documentos estiverem vencidos ou próximos do vencimento.
              </Text>
            </View>
            <Switch value={enabled} onValueChange={toggleEnabled} />
          </View>
          <TouchableOpacity onPress={handleSchedule} style={{ marginTop:12, alignSelf:'flex-start', borderWidth:1, borderColor: primaryColor, borderRadius:8, paddingVertical:10, paddingHorizontal:12, opacity: Platform.OS === 'web' ? 0.7 : 1 }}>
            <Text style={{ color: primaryColor, fontWeight:'700' }}>Agendar alertas</Text>
          </TouchableOpacity>
          {Platform.OS === 'web' ? (
            <Text style={{ color:'#9CA3AF', marginTop:8 }}>
              No Web, notificações push não são suportadas. Use os alertas no Dashboard.
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}