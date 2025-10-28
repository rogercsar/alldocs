import React, { useState } from 'react';
import { View, Text, TextInput, Alert, Image, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabase';

type Props = { onDone: () => void };

export default function OnboardingScreen({ onDone }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const primaryColor = '#4F46E5';
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  function validateEmail(value: string) {
    if (!value) return 'Informe seu e-mail';
    const ok = /\S+@\S+\.\S+/.test(value);
    return ok ? undefined : 'E-mail inválido';
  }

  function validatePassword(value: string) {
    if (!value) return 'Informe sua senha';
    if (value.length < 6) return 'A senha deve ter pelo menos 6 caracteres';
    return undefined;
  }

  async function signUp() {
    const emailErr = validateEmail(email);
    const passErr = validatePassword(password);
    setErrors({ email: emailErr, password: passErr });
    if (emailErr || passErr) return;
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) Alert.alert('Erro', error.message);
    else {
      Alert.alert('Conta criada', 'Verifique seu e-mail, se necessário.');
      onDone();
    }
  }

  async function signIn() {
    const emailErr = validateEmail(email);
    const passErr = validatePassword(password);
    setErrors({ email: emailErr, password: passErr });
    if (emailErr || passErr) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        const msg = String(error.message || '');
        // Fallback: se login por senha estiver desativado, usa OTP (magic link)
        if (msg.toLowerCase().includes('disabled')) {
          const redirectTo = process.env.EXPO_PUBLIC_LOGIN_REDIRECT || process.env.EXPO_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : undefined);
          const { error: otpError } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: redirectTo } });
          if (otpError) {
            Alert.alert('Erro', otpError.message);
          } else {
            Alert.alert('Verifique seu e-mail', 'Enviamos um link de login para seu e-mail.');
          }
        } else {
          Alert.alert('Erro', error.message);
        }
      } else {
        onDone();
      }
    } finally {
      setLoading(false);
    }
  }

  async function forgotPassword() {
    if (!email) { Alert.alert('Informe seu e-mail', 'Preencha o campo e-mail para enviar o link de recuperação.'); return; }
    setLoading(true);
    const redirectToReset = process.env.EXPO_PUBLIC_RESET_REDIRECT || process.env.EXPO_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : undefined);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectToReset });
    setLoading(false);
    if (error) Alert.alert('Erro', error.message);
    else Alert.alert('Verifique seu e-mail', 'Enviamos um link para redefinir sua senha.');
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: '#F3F4F6' }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }}>
        <Image source={require('../../assets/icon.png')} style={{ width: 72, height: 72, borderRadius: 16, marginBottom: 12 }} />
        <Text style={{ fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 4 }}>EVDocs</Text>
        <Text style={{ color: '#6B7280', marginBottom: 16, textAlign: 'center' }}>Entre para sincronizar e proteger seus documentos em todos os dispositivos.</Text>

        <View style={{ width: '100%', maxWidth: 420, backgroundColor: '#ffffff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 }}>
          <Text style={{ fontSize: 14, color: '#374151', marginBottom: 6 }}>Email</Text>
          <View style={{ backgroundColor:'#F9FAFB', borderWidth:1, borderColor:'#E5E7EB', borderRadius:12, marginBottom:4, flexDirection:'row', alignItems:'center' }}>
            <Ionicons name='mail' size={18} color='#6B7280' style={{ marginLeft:12, marginRight:8 }} />
            <TextInput
              value={email}
              onChangeText={setEmail}
              onBlur={() => setErrors((prev) => ({ ...prev, email: validateEmail(email) }))}
              autoCapitalize='none'
              keyboardType='email-address'
              placeholder='seuemail@exemplo.com'
              placeholderTextColor='#9CA3AF'
              style={{ flex:1, paddingVertical:12, paddingHorizontal:12 }}
            />
          </View>
          {errors.email ? <Text style={{ color:'#EF4444', fontSize:12, marginBottom:14 }}>{errors.email}</Text> : <View style={{ height:14 }} />}

          <Text style={{ fontSize: 14, color: '#374151', marginBottom: 6 }}>Senha</Text>
          <View style={{ backgroundColor:'#F9FAFB', borderWidth:1, borderColor:'#E5E7EB', borderRadius:12, marginBottom:4, flexDirection:'row', alignItems:'center' }}>
            <Ionicons name='lock-closed' size={18} color='#6B7280' style={{ marginLeft:12, marginRight:8 }} />
            <TextInput
              value={password}
              onChangeText={setPassword}
              onBlur={() => setErrors((prev) => ({ ...prev, password: validatePassword(password) }))}
              secureTextEntry={!showPassword}
              placeholder='••••••••'
              placeholderTextColor='#9CA3AF'
              style={{ flex:1, paddingVertical:12, paddingHorizontal:12 }}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ paddingHorizontal:12 }}>
              <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color='#6B7280' />
            </TouchableOpacity>
          </View>
          {errors.password ? <Text style={{ color:'#EF4444', fontSize:12, marginBottom:16 }}>{errors.password}</Text> : <View style={{ height:16 }} />}

          <TouchableOpacity onPress={forgotPassword} style={{ alignSelf:'flex-end', marginBottom:16, flexDirection:'row', alignItems:'center' }}>
            <Ionicons name='key' size={18} color={primaryColor} style={{ marginRight:6 }} />
            <Text style={{ color: primaryColor, fontWeight:'600' }}>Esqueci minha senha</Text>
          </TouchableOpacity>

          {/* Entrar primeiro */}
          <TouchableOpacity onPress={signIn} disabled={loading} style={{ backgroundColor: primaryColor, opacity: loading ? 0.7 : 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', flexDirection:'row', justifyContent:'center' }}>
            <Ionicons name='log-in' size={18} color='#fff' style={{ marginRight:8 }} />
            <Text style={{ color: '#fff', fontWeight: '700' }}>{loading ? 'Carregando...' : 'Entrar'}</Text>
          </TouchableOpacity>

          <View style={{ height: 10 }} />

          {/* Criar Conta depois */}
          <TouchableOpacity onPress={signUp} disabled={loading} style={{ borderWidth: 2, borderColor: primaryColor, paddingVertical: 12, borderRadius: 12, alignItems: 'center', flexDirection:'row', justifyContent:'center' }}>
            <Ionicons name='person-add' size={18} color={primaryColor} style={{ marginRight:8 }} />
            <Text style={{ color: primaryColor, fontWeight: '700' }}>{loading ? 'Carregando...' : 'Criar Conta'}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 24 }} />
        <Text style={{ color: '#9CA3AF', fontSize: 12 }}>Ao continuar, você concorda com os Termos e a Política de Privacidade.</Text>
      </View>
    </KeyboardAvoidingView>
  );
}