import React, { useState } from 'react';
import { View, Text, TextInput, Button, Alert } from 'react-native';
import { supabase } from '../supabase';

export default function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function signUp() {
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) Alert.alert('Erro', error.message);
    else {
      Alert.alert('Conta criada', 'Verifique seu e-mail, se necessário.');
      onDone();
    }
  }

  async function signIn() {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) Alert.alert('Erro', error.message);
    else onDone();
  }

  return (
    <View style={{ flex:1, padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>Crie sua conta</Text>
      <Text style={{ marginBottom: 12 }}>Permite sincronização e recuperação ao trocar de dispositivo.</Text>
      <Text>Email</Text>
      <TextInput value={email} onChangeText={setEmail} autoCapitalize='none' keyboardType='email-address' style={{ borderWidth:1, padding:8, marginBottom:12 }} />
      <Text>Senha</Text>
      <TextInput value={password} onChangeText={setPassword} secureTextEntry style={{ borderWidth:1, padding:8, marginBottom:12 }} />
      <Button title={loading ? 'Carregando...' : 'Criar Conta'} onPress={signUp} disabled={loading} />
      <View style={{ height:12 }} />
      <Button title={loading ? 'Carregando...' : 'Entrar'} onPress={signIn} disabled={loading} />
    </View>
  );
}