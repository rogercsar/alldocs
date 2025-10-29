import React, { useState } from 'react';
import { View, Text, TextInput, Alert, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabase';
import { colors } from '../theme/colors';

export default function SignupScreen({ onDone, navigation }: { onDone: () => void; navigation?: any }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const primary = colors.brandPrimary;
  const textColor = colors.text;
  const mutedText = colors.mutedText;
  const border = colors.border;
  const cardBg = colors.cardBg;
  const mutedIcon = colors.mutedIcon;
  const bg = colors.bg;

  const signUp = async () => {
    if (!email || !password) return Alert.alert('Preencha e-mail e senha');
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      Alert.alert('Quase lá', 'Enviamos um e-mail para confirmar sua conta.');
      onDone();
    } catch (e: any) {
      Alert.alert('Falha no cadastro', e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={{ flex:1, backgroundColor: bg }}>
      <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:16 }}>
        <View style={{ width:'100%', maxWidth: 420, backgroundColor: cardBg, borderWidth:1, borderColor: border, borderRadius:16, padding:16 }}>
          <Text style={{ color: textColor, fontSize:20, fontWeight:'800', marginBottom:10 }}>Criar conta</Text>

          <Text style={{ color: mutedText, marginBottom:6 }}>E-mail</Text>
          <TextInput autoCapitalize='none' keyboardType='email-address' placeholder='voce@email.com' value={email} onChangeText={setEmail}
            style={{ borderWidth:1, borderColor: border, borderRadius:10, padding:10, color: textColor }} />

          <View style={{ height:12 }} />
          <Text style={{ color: mutedText, marginBottom:6 }}>Senha</Text>
          <View style={{ flexDirection:'row', alignItems:'center', borderWidth:1, borderColor: border, borderRadius:10 }}>
            <TextInput secureTextEntry={!showPassword} placeholder='Crie uma senha forte' value={password} onChangeText={setPassword}
              style={{ flex:1, padding:10, color: textColor }} />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ paddingHorizontal:12 }}>
              <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={mutedIcon} />
            </TouchableOpacity>
          </View>

          <View style={{ height:16 }} />

          <TouchableOpacity onPress={signUp} disabled={loading} style={{ backgroundColor: primary, opacity: loading ? 0.7 : 1, paddingVertical:12, borderRadius:10, alignItems:'center', flexDirection:'row', justifyContent:'center' }}>
            <Ionicons name='person-add' size={18} color={'#fff'} style={{ marginRight:8 }} />
            <Text style={{ color:'#fff', fontWeight:'800' }}>{loading ? 'Carregando...' : 'Criar conta'}</Text>
          </TouchableOpacity>

          <View style={{ height:12 }} />

          <TouchableOpacity onPress={() => navigation?.replace?.('Login') || navigation?.navigate?.('Login')} style={{ borderWidth:2, borderColor: primary, paddingVertical:12, borderRadius:10, alignItems:'center', flexDirection:'row', justifyContent:'center' }}>
            <Ionicons name='log-in' size={18} color={primary} style={{ marginRight:8 }} />
            <Text style={{ color: primary, fontWeight:'800' }}>Já tenho conta</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}