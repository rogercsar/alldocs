import React, { useEffect, useState } from 'react';
import { View, Text, Button, ActivityIndicator, Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { colors } from '../theme/colors';

export default function LockScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const [checking, setChecking] = useState(true);
  const [failed, setFailed] = useState(false);
  const bgColor = colors.bg;
  const textColor = colors.text;
  const mutedText = colors.mutedText;
  const primaryColor = colors.brandPrimary;

  async function authenticate() {
    setChecking(true);
    setFailed(false);
    if (Platform.OS === 'web') {
      // No biometrics on web; desbloqueia diretamente
      setChecking(false);
      onUnlocked();
      return;
    }
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!compatible || !enrolled) {
      // Fallback to device PIN
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Autentique-se para abrir o EVDocs',
        fallbackLabel: 'Usar PIN/Senha do dispositivo',
      });
      setChecking(false);
      if (res.success) onUnlocked(); else setFailed(true);
      return;
    }
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Autentique-se para abrir o EVDocs',
    });
    setChecking(false);
    if (res.success) onUnlocked(); else setFailed(true);
  }

  useEffect(() => {
    authenticate();
  }, []);

  if (checking) {
    return (
      <View style={{ flex:1, alignItems:'center', justifyContent:'center', backgroundColor: bgColor }}>
        <ActivityIndicator size="large" color={primaryColor} />
        <Text style={{ marginTop: 12, color: mutedText }}>Verificando autenticação…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding: 24, backgroundColor: bgColor }}>
      <Text style={{ fontSize: 18, textAlign: 'center', marginBottom: 16, color: textColor }}>
        Autenticação falhou. Tente novamente.
      </Text>
      <Button title="Tentar novamente" onPress={authenticate} />
    </View>
  );
}