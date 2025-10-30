import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

export default function PlansScreen({ navigation }: any) {
  const primary = colors.brandPrimary;
  const accent = colors.brandAccent;
  const text = colors.text;
  const mutedText = colors.mutedText;
  const cardBg = colors.cardBg;
  const border = colors.border;
  const bg = colors.bg;

  const Feature = ({ label }: { label: string }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
      <Ionicons name='checkmark-circle' color={primary} size={18} style={{ marginRight: 8 }} />
      <Text style={{ color: text }}>{label}</Text>
    </View>
  );

  return (
    <ScrollView style={{ flex:1, backgroundColor: bg }} contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: '800', color: text, textAlign: 'center', marginBottom: 12 }}>Escolha o plano ideal</Text>
      <Text style={{ color: mutedText, textAlign: 'center', marginBottom: 16 }}>Comece grátis com o Freemium e desbloqueie recursos avançados no Premium.</Text>

      <View style={{ flexDirection:'row', flexWrap:'wrap', justifyContent:'center' }}>
        {/* Freemium */}
        <View style={{ width: 340, backgroundColor: cardBg, borderWidth:1, borderColor:border, borderRadius: 16, padding: 16, margin: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: text }}>Freemium</Text>
          <Text style={{ color: mutedText, marginBottom: 8 }}>R$ 0/mês</Text>
          <Feature label='Até 4 documentos' />
          <Feature label='Sincronização básica' />
          <Feature label='Captura de documento' />
          <View style={{ height: 10 }} />
          <TouchableOpacity onPress={() => navigation.navigate('Signup')} style={{ borderWidth:2, borderColor: primary, borderRadius: 10, paddingVertical: 10, alignItems:'center' }}>
            <Text style={{ color: primary, fontWeight:'800' }}>Começar grátis</Text>
          </TouchableOpacity>
        </View>

        {/* Premium */}
        <View style={{ width: 340, backgroundColor: cardBg, borderWidth:2, borderColor: accent, borderRadius: 16, padding: 16, margin: 8 }}>
          <View style={{ alignSelf:'flex-start', backgroundColor: accent, paddingHorizontal:8, paddingVertical:4, borderRadius: 6, marginBottom: 6 }}>
            <Text style={{ color:'#0B1020', fontWeight:'800' }}>Mais popular</Text>
          </View>
          <Text style={{ fontSize: 16, fontWeight: '800', color: text }}>Premium</Text>
          <Text style={{ color: mutedText, marginBottom: 8 }}>R$ 14,90/mês</Text>
          <Feature label='Documentos ilimitados' />
          <Feature label='Sincronização avançada' />
          <Feature label='Acesso prioritário a novidades' />
          <Feature label='Suporte prioritário' />
          <View style={{ height: 10 }} />
          <TouchableOpacity onPress={() => navigation.navigate('Signup', { redirectToUpgrade: true })} style={{ backgroundColor: primary, borderRadius: 10, paddingVertical: 12, alignItems:'center' }}>
            <Text style={{ color: '#fff', fontWeight:'800' }}>Assinar Premium</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Observação */}
      <View style={{ alignItems:'center', marginTop: 12 }}>
        <Text style={{ color: mutedText, textAlign:'center', maxWidth: 720 }}>Os valores e funcionalidades estão sujeitas a alterações. Você pode cancelar quando quiser diretamente no app.</Text>
      </View>
    </ScrollView>
  );
}