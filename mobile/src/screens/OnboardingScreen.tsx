import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, Alert, Image, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabase';
import { colors } from '../theme/colors';

type Props = { onDone: () => void; route?: any };

export default function OnboardingScreen({ onDone, route }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const primaryColor = colors.brandPrimary;
  const bgColor = colors.bg;
  const textColor = colors.text;
  const mutedText = colors.mutedText;
  const borderColor = colors.border;
  const cardBg = colors.cardBg;
  const surfaceColor = colors.surface;
  const mutedIcon = colors.mutedIcon;
  const dangerColor = colors.danger;
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const initialMode: 'login' | 'signup' = (route?.params?.mode === 'signup' ? 'signup' : 'login');
  const isLoginPrimary = useMemo(() => initialMode === 'login', [initialMode]);

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

  const filledBtn = { backgroundColor: primaryColor, paddingVertical: 14, borderRadius: 12, alignItems: 'center', flexDirection:'row', justifyContent:'center' } as const;
  const outlineBtn = { borderWidth: 2, borderColor: primaryColor, paddingVertical: 12, borderRadius: 12, alignItems: 'center', flexDirection:'row', justifyContent:'center' } as const;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: bgColor }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }}>
        <Image source={require('../../assets/icon.png')} style={{ width: 198, height: 198, borderRadius: 16, marginBottom: 6 }} />
        <Text style={{ fontSize: 24, fontWeight: '800', color: textColor, marginBottom: 4, fontFamily: 'Inter' }}>EVDocs</Text>
        <Text style={{ color: mutedText, marginBottom: 16, textAlign: 'center' }}>Sincronize e proteja seus documentos em todos dispositivos.</Text>

        <View style={{ width: '100%', maxWidth: 420, backgroundColor: cardBg, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 }}>
          <Text style={{ fontSize: 14, color: mutedText, marginBottom: 6 }}>Email</Text>
          <View style={{ backgroundColor: surfaceColor, borderWidth:1, borderColor: borderColor, borderRadius:12, marginBottom:4, flexDirection:'row', alignItems:'center' }}>
            <Ionicons name='mail' size={18} color={mutedIcon} style={{ marginLeft:12, marginRight:8 }} />
            <TextInput
              value={email}
              onChangeText={setEmail}
              onBlur={() => setErrors((prev) => ({ ...prev, email: validateEmail(email) }))}
              autoCapitalize='none'
              keyboardType='email-address'
              placeholder='seuemail@exemplo.com'
              placeholderTextColor={mutedIcon}
              style={{ flex:1, paddingVertical:12, paddingHorizontal:12 }}
            />
          </View>
          {errors.email ? <Text style={{ color: dangerColor, fontSize:12, marginBottom:14 }}>{errors.email}</Text> : <View style={{ height:14 }} />}

          <Text style={{ fontSize: 14, color: mutedText, marginBottom: 6 }}>Senha</Text>
          <View style={{ backgroundColor: surfaceColor, borderWidth:1, borderColor: borderColor, borderRadius:12, marginBottom:4, flexDirection:'row', alignItems:'center' }}>
            <Ionicons name='lock-closed' size={18} color={mutedIcon} style={{ marginLeft:12, marginRight:8 }} />
            <TextInput
              value={password}
              onChangeText={setPassword}
              onBlur={() => setErrors((prev) => ({ ...prev, password: validatePassword(password) }))}
              secureTextEntry={!showPassword}
              placeholder='••••••••'
              placeholderTextColor={mutedIcon}
              style={{ flex:1, paddingVertical:12, paddingHorizontal:12 }}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ paddingHorizontal:12 }}>
              <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={mutedIcon} />
            </TouchableOpacity>
          </View>
          {errors.password ? <Text style={{ color: dangerColor, fontSize:12, marginBottom:16 }}>{errors.password}</Text> : <View style={{ height:16 }} />}

          <TouchableOpacity onPress={forgotPassword} style={{ alignSelf:'flex-end', marginBottom:16, flexDirection:'row', alignItems:'center' }}>
            <Ionicons name='key' size={18} color={primaryColor} style={{ marginRight:6 }} />
            <Text style={{ color: primaryColor, fontWeight:'600' }}>Esqueci minha senha</Text>
          </TouchableOpacity>

          {/* Botões conforme modo */}
          {/* Login */}
          <TouchableOpacity onPress={signIn} disabled={loading} style={isLoginPrimary ? [filledBtn, { opacity: loading ? 0.7 : 1 }] : outlineBtn}>
            <Ionicons name='log-in' size={18} color={isLoginPrimary ? '#fff' : primaryColor} style={{ marginRight:8 }} />
            <Text style={{ color: isLoginPrimary ? '#fff' : primaryColor, fontWeight: '700' }}>{loading ? 'Carregando...' : 'Entrar'}</Text>
          </TouchableOpacity>

          <View style={{ height: 10 }} />

          {/* Signup */}
          <TouchableOpacity onPress={signUp} disabled={loading} style={!isLoginPrimary ? [filledBtn, { opacity: loading ? 0.7 : 1 }] : outlineBtn}>
            <Ionicons name='person-add' size={18} color={!isLoginPrimary ? '#fff' : primaryColor} style={{ marginRight:8 }} />
            <Text style={{ color: !isLoginPrimary ? '#fff' : primaryColor, fontWeight: '700' }}>{loading ? 'Carregando...' : 'Criar Conta'}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 24 }} />
        <Text style={{ color: mutedIcon, fontSize: 12 }}>Ao continuar, você concorda com os Termos e a Política de Privacidade.</Text>
      </View>
    </KeyboardAvoidingView>
  );
}