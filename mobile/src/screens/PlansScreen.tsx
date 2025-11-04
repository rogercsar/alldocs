import React from 'react';
import { View, Text, ScrollView } from 'react-native';

export default function PlansScreen() {
  const plans = [
    {
      name: 'Grátis',
      price: 'R$ 0',
      features: [
        'Crie e edite documentos localmente',
        'Sincronize até 50 MB',
        'Compartilhamento básico',
      ],
    },
    {
      name: 'Premium Vitalício',
      price: 'R$ 199,90 (único)',
      features: [
        'Sincronização ilimitada de documentos',
        'Criptografia ponta-a-ponta',
        'Prioridade no suporte',
      ],
    },
  ];

  return (
    <ScrollView style={{ flex:1, backgroundColor:'#fff' }} contentContainerStyle={{ padding:16 }}>
      <Text style={{ fontSize:28, fontWeight:'700', color:'#111827' }}>Planos</Text>
      <Text style={{ marginTop:6, color:'#6B7280' }}>Compare recursos e preços.</Text>

      {plans.map((p, idx) => (
        <View key={idx} style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:12, padding:16, marginTop:12 }}>
          <Text style={{ fontSize:20, fontWeight:'700', color:'#111827' }}>{p.name}</Text>
          <Text style={{ marginTop:4, color:'#111827' }}>{p.price}</Text>
          <View style={{ marginTop:8 }}>
            {p.features.map((f, i) => (
              <Text key={i} style={{ color:'#374151', marginBottom:4 }}>• {f}</Text>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}