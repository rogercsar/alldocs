import React, { useState } from 'react';
- import { View, Text, TextInput, Button, Alert } from 'react-native';
+ import { View, Text, TextInput, Alert, Image, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
 import { supabase } from '../supabase';
 
 export default function OnboardingScreen({ onDone }: { onDone: () => void }) {
   const [email, setEmail] = useState('');
   const [password, setPassword] = useState('');
   const [loading, setLoading] = useState(false);
+  const primaryColor = '#4F46E5';
 
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
 
-  return (
-    <View style={{ flex:1, padding: 16 }}>
-      <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>Crie sua conta</Text>
-      <Text style={{ marginBottom: 12 }}>Permite sincronização e recuperação ao trocar de dispositivo.</Text>
-      <Text>Email</Text>
-      <TextInput value={email} onChangeText={setEmail} autoCapitalize='none' keyboardType='email-address' style={{ borderWidth:1, padding:8, marginBottom:12 }} />
-      <Text>Senha</Text>
-      <TextInput value={password} onChangeText={setPassword} secureTextEntry style={{ borderWidth:1, padding:8, marginBottom:12 }} />
-      <Button title={loading ? 'Carregando...' : 'Criar Conta'} onPress={signUp} disabled={loading} />
-      <View style={{ height:12 }} />
-      <Button title={loading ? 'Carregando...' : 'Entrar'} onPress={signIn} disabled={loading} />
-    </View>
-  );
+  return (
+    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex:1, backgroundColor: '#F3F4F6' }}>
+      <View style={{ flex:1, alignItems:'center', justifyContent:'center', paddingHorizontal: 16 }}>
+        <Image source={require('../../assets/icon.png')} style={{ width:72, height:72, borderRadius:16, marginBottom: 12 }} />
+        <Text style={{ fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 4 }}>EVDocs</Text>
+        <Text style={{ color:'#6B7280', marginBottom: 16, textAlign:'center' }}>Entre para sincronizar e proteger seus documentos em todos os dispositivos.</Text>
+
+        <View style={{ width:'100%', maxWidth: 420, backgroundColor:'#ffffff', borderRadius:16, padding:16, shadowColor:'#000', shadowOpacity:0.06, shadowRadius:12, elevation:3 }}>
+          <Text style={{ fontSize: 14, color:'#374151', marginBottom: 6 }}>Email</Text>
+          <TextInput
+            value={email}
+            onChangeText={setEmail}
+            autoCapitalize='none'
+            keyboardType='email-address'
+            placeholder='seuemail@exemplo.com'
+            placeholderTextColor='#9CA3AF'
+            style={{ backgroundColor:'#F9FAFB', borderWidth:1, borderColor:'#E5E7EB', paddingVertical:12, paddingHorizontal:14, borderRadius:12, marginBottom:14 }}
+          />
+
+          <Text style={{ fontSize: 14, color:'#374151', marginBottom: 6 }}>Senha</Text>
+          <TextInput
+            value={password}
+            onChangeText={setPassword}
+            secureTextEntry
+            placeholder='••••••••'
+            placeholderTextColor='#9CA3AF'
+            style={{ backgroundColor:'#F9FAFB', borderWidth:1, borderColor:'#E5E7EB', paddingVertical:12, paddingHorizontal:14, borderRadius:12, marginBottom:16 }}
+          />
+
+          <TouchableOpacity onPress={signUp} disabled={loading} style={{ backgroundColor: primaryColor, opacity: loading ? 0.7 : 1, paddingVertical: 14, borderRadius: 12, alignItems:'center' }}>
+            <Text style={{ color:'#fff', fontWeight:'700' }}>{loading ? 'Carregando...' : 'Criar Conta'}</Text>
+          </TouchableOpacity>
+
+          <View style={{ height:10 }} />
+
+          <TouchableOpacity onPress={signIn} disabled={loading} style={{ borderWidth:2, borderColor: primaryColor, paddingVertical: 12, borderRadius: 12, alignItems:'center' }}>
+            <Text style={{ color: primaryColor, fontWeight:'700' }}>{loading ? 'Carregando...' : 'Entrar'}</Text>
+          </TouchableOpacity>
+        </View>
+
+        <View style={{ height: 24 }} />
+        <Text style={{ color:'#9CA3AF', fontSize: 12 }}>Ao continuar, você concorda com os Termos e a Política de Privacidade.</Text>
+      </View>
+    </KeyboardAvoidingView>
+  );
 }
}