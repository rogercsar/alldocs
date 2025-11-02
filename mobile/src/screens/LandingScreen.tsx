import React, { useEffect, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, Linking, useWindowDimensions, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import TestimonialsCarousel from '../components/TestimonialsCarousel';

type Props = {
  onLogin: (mode: 'login' | 'signup') => void;
  onViewPlans: () => void;
};

export default function LandingScreen({ onLogin, onViewPlans }: Props) {
  const primary = colors.brandPrimary;
  const primaryDark = colors.brandPrimaryDark;
  const accent = colors.brandAccent;
  const bg = colors.bg;
  const cardBg = colors.cardBg;
  const text = colors.text;
  const mutedText = colors.mutedText;
  const border = colors.border;
  const mutedIcon = colors.mutedIcon;
  const surface = colors.surface;
  const titulo = "#172D5C";

  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const isXwide = width >= 1024;
  const logoSize = isXwide ? 240 : isWide ? 210 : 180;
  const containerPad = isWide ? 24 : 16;
  const maxW = 980;

  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.96)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 450, useNativeDriver: Platform.OS !== 'web' }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: Platform.OS !== 'web' })
    ]).start();
  }, [fade, scale]);

  const Feature = ({ icon, title, desc }: { icon: keyof typeof Ionicons.glyphMap; title: string; desc: string }) => (
    <Animated.View style={{ flex:1, minWidth: isWide ? '48%' : '100%', backgroundColor: cardBg, borderWidth:1, borderColor: border, borderRadius:16, padding:14, margin:6, shadowColor:'#000', shadowOpacity:0.05, shadowRadius:10, elevation:2 }}>
      <View style={{ width:40, height:40, borderRadius:10, backgroundColor: surface, alignItems:'center', justifyContent:'center', marginBottom:8 }}>
        <Ionicons name={icon} size={22} color={primary} />
      </View>
      <Text style={{ fontSize:16, fontWeight:'700', color: text, marginBottom:4 }}>{title}</Text>
      <Text style={{ color: mutedText }}>{desc}</Text>
    </Animated.View>
  );

  const openUrl = (url: string) => {
    try { Linking.openURL(url); } catch {}
  };

  return (
    <ScrollView style={{ flex:1, backgroundColor: bg }} contentContainerStyle={{ alignItems:'center', padding: containerPad }}>
      {/* decor blobs */}
      <View style={{ position:'absolute', top: -20, right: -20, width: 140, height: 140, borderRadius: 80, backgroundColor: accent, opacity: 0.12 }} pointerEvents='none' />
      <View style={{ position:'absolute', top: 120, left: -30, width: 100, height: 100, borderRadius: 60, backgroundColor: primary, opacity: 0.08 }} pointerEvents='none' />

      <View style={{ width: '100%', maxWidth: maxW }}>
        {/* Hero */}
        <Animated.View style={{ opacity: fade, transform: [{ scale }], alignItems:'center', marginTop: isWide ? 18 : 12, marginBottom: isWide ? 22 : 18 }}>
          <Image source={require('../../assets/icon.png')} style={{ width: logoSize, height: logoSize, borderRadius: 26, marginBottom: 10 }} />
          <Text style={{ fontSize: isXwide ? 34 : isWide ? 30 : 28, fontWeight:'800', color: titulo }}>EVDocs</Text>
          <Text style={{ color: mutedText, marginTop:6, textAlign:'center', maxWidth:560 }}>
            Armazene e acesse seus documentos com segurança. Pagamento único, sem mensalidade.
          </Text>

          {/* Hero sample image 
          <View style={{ marginTop: 14, backgroundColor: cardBg, borderRadius: 16, borderWidth: 1, borderColor: border, overflow:'hidden' }}>
            <View style={{ width: isWide ? 520 : 320, height: isWide ? 260 : 160 }} />
          </View>*/}

          <View style={{ height: 16 }} />
          <View style={{ flexDirection:'row', flexWrap:'wrap', justifyContent:'center' }}>
            <TouchableOpacity onPress={() => onLogin('login')} style={{ backgroundColor: primary, paddingVertical:12, paddingHorizontal:18, borderRadius:12, flexDirection:'row', alignItems:'center', marginRight: 10, marginBottom:8 }}>
              <Ionicons name='log-in' size={18} color='#fff' style={{ marginRight:8 }} />
              <Text style={{ color:'#fff', fontWeight:'800' }}>Entrar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onLogin('signup')} style={{ borderWidth:2, borderColor: primary, paddingVertical:12, paddingHorizontal:18, borderRadius:12, flexDirection:'row', alignItems:'center', marginRight: 10, marginBottom:8 }}>
              <Ionicons name='person-add' size={18} color={primary} style={{ marginRight:8 }} />
              <Text style={{ color: primary, fontWeight:'800' }}>Criar conta</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onViewPlans} style={{ backgroundColor: surface, borderWidth:1, borderColor: border, paddingVertical:12, paddingHorizontal:18, borderRadius:12, flexDirection:'row', alignItems:'center', marginBottom:8 }}>
              <Ionicons name='pricetags' size={18} color={primaryDark} style={{ marginRight:8 }} />
              <Text style={{ color: primaryDark, fontWeight:'800' }}>Ver planos</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Features grid */}
        <View style={{ flexDirection:'row', flexWrap:'wrap', marginHorizontal:-6 }}>
          <Feature icon='cloud-upload' title='Sincronização segura' desc='Seus documentos disponíveis em qualquer lugar, com backup automático.' />
          <Feature icon='lock-closed' title='Segurança reforçada' desc='Criptografia e autenticação biométrica do dispositivo para mais proteção.' />
          <Feature icon='phone-portrait' title='Modo offline' desc='Acesse documentos já baixados mesmo sem internet.' />
          <Feature icon='share-social' title='Compartilhamento protegido' desc='Compartilhe apenas quando quiser, com controle e segurança.' />
          <Feature icon='camera' title='Captura rápida' desc='Digitalize com a câmera e organize em poucos toques.' />
          <Feature icon='alert-circle' title='Alertas de vencimento' desc='Receba avisos antes de seus documentos vencerem.' />
          <Feature icon='albums' title='Suporte a vários tipos' desc='Inclui RG, CNH, CPF, Título de Eleitor, cartões, certidões e veículos.' />
        </View>

        {/* Info section */}
        <View style={{ marginTop: 16, backgroundColor: cardBg, borderRadius: 16, borderWidth:1, borderColor: border, padding:16 }}>
          <Text style={{ fontSize:18, fontWeight:'800', color: text, marginBottom:8 }}>Como funciona</Text>
          <Text style={{ color: mutedText, marginBottom:10 }}>
            Cadastre-se, adicione seus documentos com fotos da frente e verso, e mantenha tudo organizado por tipo. Sincronize com a nuvem para ter seus arquivos em todos os dispositivos.
          </Text>
          <Text style={{ color: mutedText }}>
            No plano gratuito você gerencia até 4 documentos. Desbloqueie o Premium com pagamento único para armazenar ilimitado e obter recursos como alertas de vencimento.
          </Text>
        </View>

        {/* Testimonials */}
        <View style={{ marginTop: 16 }}>
          <Text style={{ fontSize:18, fontWeight:'800', color: text, marginBottom:8, textAlign:'center' }}>O que dizem nossos usuários</Text>
          <TestimonialsCarousel />
        </View>

      </View>
      {/* Footer full-width */}
      <View style={{ width:'100%', backgroundColor: primaryDark, paddingVertical: 18, marginTop: 16, marginLeft: -containerPad, marginRight: -containerPad }}>
        <View style={{ width:'100%', maxWidth: maxW, alignSelf:'center', alignItems:'center' }}>
          <Text style={{ color: '#fff', fontWeight:'700' }}>Pronto para começar?</Text>
          <View style={{ height:8 }} />
          <View style={{ flexDirection:'row' }}>
            <TouchableOpacity onPress={() => onLogin('signup')} style={{ backgroundColor: '#fff', paddingVertical:10, paddingHorizontal:16, borderRadius:10, marginRight:8 }}>
              <Text style={{ color: primaryDark, fontWeight:'800' }}>Experimente grátis</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onViewPlans} style={{ borderWidth:2, borderColor:'#fff', paddingVertical:10, paddingHorizontal:16, borderRadius:10 }}>
              <Text style={{ color:'#fff', fontWeight:'800' }}>Ver planos</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 12 }} />
          <View style={{ alignItems:'center' }}>
            <Text style={{ color: '#DCE7F3' }}>© {new Date().getFullYear()} EVDocs. Todos os direitos reservados.</Text>
            <View style={{ flexDirection:'row', marginTop:6 }}>
              <TouchableOpacity onPress={() => openUrl(process.env.EXPO_PUBLIC_TERMS_URL || '#')} style={{ padding:6 }}>
                <Text style={{ color: '#DCE7F3' }}>Termos</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openUrl(process.env.EXPO_PUBLIC_PRIVACY_URL || '#')} style={{ padding:6 }}>
                <Text style={{ color: '#DCE7F3' }}>Privacidade</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}