import React, { useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, Share, Alert, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { deleteDocument } from '../storage/db';
import { syncDocumentDelete } from '../storage/sync';
import type { DocumentItem } from '../types';
import { Platform } from 'react-native';
import { colors } from '../theme/colors';
import ShareSheet from '../components/ShareSheet';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { useToast } from '../components/Toast';
import { FontAwesome } from '@expo/vector-icons';
import { supabase } from '../supabase';

const primaryColor = colors.brandPrimary;
const dangerColor = colors.danger;
const bgColor = colors.bg;

const DOC_TYPES = ['RG', 'CNH', 'CPF', 'Passaporte', 'Comprovante de endereço', 'Documento do veículo', 'Cartões', 'Certidões', 'Título de Eleitor', 'Outros'] as const;
type DocType = typeof DOC_TYPES[number];

function normalizeDocType(raw?: string): DocType {
  const t = (raw || '').toLowerCase().trim();
  if (!t) return 'Outros';
  if (t.includes('rg')) return 'RG';
  if (t.includes('cnh')) return 'CNH';
  if (t.includes('cpf')) return 'CPF';
  if (t.includes('passaport') || t.includes('passaporte')) return 'Passaporte';
  if (t.includes('comprovante')) return 'Comprovante de endereço';
  if (t.includes('veículo') || t.includes('veiculo') || t.includes('documento do veículo')) return 'Documento do veículo';
  if (t.includes('eleitor') || t.includes('título')) return 'Título de Eleitor';
  if (t.includes('cart') || t.includes('cartão') || t.includes('cartao')) return 'Cartões';
  if (t.includes('certid')) return 'Certidões';
  return 'Outros';
}

function getViewTemplate(type: DocType) {
  switch (type) {
    case 'RG':
      return { accentColor: '#10B981', icon: 'person', numberLabel: 'Número do RG', frontLabel: 'Frente RG', backLabel: 'Verso RG', layout: 'sideBySide' as const, hasBack: true };
    case 'CNH':
      return { accentColor: '#F59E0B', icon: 'car', numberLabel: 'Número da CNH', frontLabel: 'Frente CNH', backLabel: 'Verso CNH', layout: 'sideBySide' as const, hasBack: true };
    case 'CPF':
      return { accentColor: '#3B82F6', icon: 'person', numberLabel: 'CPF', frontLabel: 'Frente CPF', backLabel: 'Verso CPF', layout: 'sideBySide' as const, hasBack: true };
    case 'Passaporte':
      return { accentColor: '#8B5CF6', icon: 'airplane', numberLabel: 'Número do Passaporte', frontLabel: 'Frente Passaporte', backLabel: 'Verso Passaporte', layout: 'vertical' as const, hasBack: true };
    case 'Comprovante de endereço':
      return { accentColor: '#0EA5E9', icon: 'home', numberLabel: 'Identificador', frontLabel: 'Frente Comprovante', backLabel: 'Verso Comprovante', layout: 'vertical' as const, hasBack: false };
    case 'Documento do veículo':
      return { accentColor: '#22C55E', icon: 'car', numberLabel: 'Placa/RENAVAM', frontLabel: 'Frente Doc Veículo', backLabel: 'Verso Doc Veículo', layout: 'sideBySide' as const, hasBack: true };
    case 'Título de Eleitor':
      return { accentColor: '#2563EB', icon: 'card', numberLabel: 'Número do Título de Eleitor', frontLabel: 'Frente Título', backLabel: 'Verso Título', layout: 'sideBySide' as const, hasBack: true };
    case 'Cartões':
      return { accentColor: '#EF4444', icon: 'wallet', numberLabel: 'Número do Cartão', frontLabel: 'Frente Cartão', backLabel: 'Verso Cartão', layout: 'sideBySide' as const, hasBack: true };
    case 'Certidões':
      return { accentColor: '#A855F7', icon: 'ribbon', numberLabel: 'Número do Registro', frontLabel: 'Frente Certidão', backLabel: 'Verso Certidão', layout: 'vertical' as const, hasBack: true };
    case 'Outros':
      return { accentColor: '#9CA3AF', icon: 'document-text', numberLabel: 'Número do Documento', frontLabel: 'Frente', backLabel: 'Verso', layout: 'vertical' as const, hasBack: true };
    default:
      return { accentColor: '#6B7280', icon: 'document-text', numberLabel: 'Número do Documento', frontLabel: 'Frente', backLabel: 'Verso', layout: 'vertical' as const, hasBack: true };
  }
}

function maskCPF(value?: string) {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '').slice(0, 11);
  const parts = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 9), digits.slice(9, 11)];
  return parts[3] ? `${parts[0]}.${parts[1]}.${parts[2]}-${parts[3]}` : digits;
}

function formatNumberByType(type: DocType, value?: string) {
  if (!value) return '';
  if (type === 'CPF') return maskCPF(value);
  return value;
}

export default function ViewDocumentScreen({ document, onDeleted, onEdit, userId }: { document: DocumentItem; onDeleted: () => void; onEdit?: () => void; userId: string; }) {
  const { showToast } = useToast();
  if (!document) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, backgroundColor: bgColor }}>
        <Ionicons name='alert-circle' size={48} color='#6B7280' style={{ marginBottom: spacing.sm }} />
        <Text style={{ fontSize: typography.sizes.subtitle, fontWeight: '700', color: '#111827', marginBottom: spacing.xs }}>Documento não encontrado</Text>
        <Pressable onPress={onDeleted} style={({ pressed }) => ({ backgroundColor: pressed ? colors.brandPrimaryDark : primaryColor, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: 12, flexDirection: 'row', alignItems: 'center', shadowColor:'#000', shadowOpacity: pressed ? 0.06 : 0, shadowRadius: pressed ? 8 : 0 })}>
          <Ionicons name='arrow-back' size={18} color='#fff' style={{ marginRight: 6 }} />
          <Text style={{ color: '#fff', fontWeight: '800' }}>Voltar</Text>
        </Pressable>
      </View>
    );
  }

  const type = normalizeDocType(document.type);
  const template = getViewTemplate(type);
  const numberDisplay = formatNumberByType(type, document.number);
  const [meta, setMeta] = useState<{ issueDate: string; expiryDate: string; issuingState: string; issuingCity: string; issuingAuthority: string }>({
    issueDate: document.issueDate || '',
    expiryDate: document.expiryDate || '',
    issuingState: document.issuingState || '',
    issuingCity: document.issuingCity || '',
    issuingAuthority: document.issuingAuthority || '',
  });
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const isCNH = type === 'CNH';
        const isRG = type === 'RG';
        const needsMeta = !meta.issueDate || !meta.expiryDate || !meta.issuingState || !meta.issuingCity || !meta.issuingAuthority;
        const hasRemoteId = !!(document as any).appId;
        if (isCNH && needsMeta && hasRemoteId && userId) {
          const { data: rows } = await supabase
            .from('doc_cnh')
            .select('issue_date,expiry_date,issuing_state,issuing_city,issuing_authority')
            .eq('user_id', userId)
            .eq('app_id', (document as any).appId)
            .limit(1);
          const r = rows && rows[0];
          if (!cancelled && r) {
            setMeta((prev) => ({
              issueDate: prev.issueDate || (r.issue_date as any) || '',
              expiryDate: prev.expiryDate || (r.expiry_date as any) || '',
              issuingState: prev.issuingState || (r.issuing_state as any) || '',
              issuingCity: prev.issuingCity || (r.issuing_city as any) || '',
              issuingAuthority: prev.issuingAuthority || (r.issuing_authority as any) || '',
            }));
          }
        }
        if (isRG && needsMeta && hasRemoteId && userId) {
          const { data: rows } = await supabase
            .from('doc_rg')
            .select('issue_date,issuing_state,issuing_city,issuing_authority')
            .eq('user_id', userId)
            .eq('app_id', (document as any).appId)
            .limit(1);
          const r = rows && rows[0];
          if (!cancelled && r) {
            setMeta((prev) => ({
              issueDate: prev.issueDate || (r.issue_date as any) || '',
              // RG não possui expiry_date na sub-tabela; mantém o valor atual
              expiryDate: prev.expiryDate || '',
              issuingState: prev.issuingState || (r.issuing_state as any) || '',
              issuingCity: prev.issuingCity || (r.issuing_city as any) || '',
              issuingAuthority: prev.issuingAuthority || (r.issuing_authority as any) || '',
            }));
          }
        }
      } catch (e) {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [type, userId, (document as any).appId]);

  async function remove() {
    if (!document?.id) return;
    await deleteDocument(document.id);
    try {
      const remoteKey = (document as any).appId ?? document.id;
      await syncDocumentDelete(remoteKey, userId);
    } catch {}
    showToast('Documento excluído', { type: 'success' });
    onDeleted();
  }

  const [shareOpen, setShareOpen] = useState(false);
  async function shareDoc() {
    setShareOpen(true);
  }

  return (
    <>
    <ScrollView style={{ flex: 1, backgroundColor: bgColor }} contentContainerStyle={{ padding: spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} ellipsizeMode='tail' style={{ fontSize: typography.sizes.subtitle, fontWeight: '800', color: '#111827', marginRight: 8, flexShrink: 1 }}>{document.name}</Text>
        </View>
        {Platform.OS === 'web' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable onPress={shareDoc} style={({ pressed }) => ({ paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: 12, backgroundColor: pressed ? '#F9FAFB' : '#fff', borderWidth: 1, borderColor: '#E5E7EB', flexDirection: 'row', alignItems: 'center', shadowColor:'#000', shadowOpacity: pressed ? 0.06 : 0, shadowRadius: pressed ? 8 : 0 })}>
              <Ionicons name='share-social' size={18} color={primaryColor} style={{ marginRight: 6 }} />
              <Text style={{ color: primaryColor, fontWeight: '700' }}></Text>
            </Pressable>
            <View style={{ width: 8 }} />
            <Pressable onPress={() => onEdit?.()} style={({ pressed }) => ({ paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: 12, backgroundColor: pressed ? '#F9FAFB' : '#fff', borderWidth: 1, borderColor: '#E5E7EB', flexDirection: 'row', alignItems: 'center', shadowColor:'#000', shadowOpacity: pressed ? 0.06 : 0, shadowRadius: pressed ? 8 : 0 })}>
              <Ionicons name='pencil' size={18} color={primaryColor} style={{ marginRight: 6 }} />
              <Text style={{ color: primaryColor, fontWeight: '700' }}></Text>
            </Pressable>
            <View style={{ width: 8 }} />
            <Pressable onPress={() => exportAsPDF(document.name, document.frontImageUri, document.backImageUri)} style={({ pressed }) => ({ paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: 12, backgroundColor: pressed ? '#F9FAFB' : '#fff', borderWidth: 1, borderColor: '#E5E7EB', flexDirection: 'row', alignItems: 'center', shadowColor:'#000', shadowOpacity: pressed ? 0.06 : 0, shadowRadius: pressed ? 8 : 0 })}>
              <Ionicons name='download' size={18} color={primaryColor} style={{ marginRight: 6 }} />
              <Text style={{ color: primaryColor, fontWeight: '700' }}></Text>
            </Pressable>
            <View style={{ width: 8 }} />
            <Pressable onPress={remove} style={({ pressed }) => ({ paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: 12, backgroundColor: pressed ? '#ef3d3d' : dangerColor, flexDirection: 'row', alignItems: 'center', shadowColor:'#000', shadowOpacity: pressed ? 0.06 : 0, shadowRadius: pressed ? 8 : 0 })}>
              <Ionicons name='trash' size={18} color='#fff' style={{ marginRight: 6 }} />
              <Text style={{ color: '#fff', fontWeight: '700' }}></Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable onPress={() => onEdit?.()} style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', shadowColor:'#000', shadowOpacity: pressed ? 0.06 : 0, shadowRadius: pressed ? 8 : 0 })}>
              <Ionicons name='pencil' size={18} color={primaryColor} />
            </Pressable>
            <View style={{ width: 8 }} />
            <Pressable onPress={() => exportAsPDF(document.name, document.frontImageUri, document.backImageUri)} style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', shadowColor:'#000', shadowOpacity: pressed ? 0.06 : 0, shadowRadius: pressed ? 8 : 0 })}>
              <Ionicons name='download' size={18} color={primaryColor} />
            </Pressable>
            <View style={{ width: 8 }} />
            <Pressable onPress={remove} style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 10, backgroundColor: dangerColor, alignItems: 'center', justifyContent: 'center', shadowColor:'#000', shadowOpacity: pressed ? 0.06 : 0, shadowRadius: pressed ? 8 : 0 })}>
              <Ionicons name='trash' size={18} color='#fff' />
            </Pressable>
          </View>
        )}
        </View>

      <View style={{ backgroundColor: type === 'Outros' ? '#F9FAFB' : '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: type === 'Outros' ? '#CBD5E1' : '#E5E7EB', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 3, marginBottom: 16 }}>
        <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 8 }}>{template.numberLabel}</Text>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>{numberDisplay}</Text>
            {type === 'Outros' ? (
              <View style={{ flexDirection: 'row', marginTop: 8 }}>
                <View style={{ paddingVertical: 4, paddingHorizontal: 8, borderRadius: 9999, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#D1D5DB' }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#374151' }}>Outros</Text>
                </View>
              </View>
            ) : null}
        {type === 'Cartões' && !!document.cardBrand && (
          <View style={{ flexDirection:'row', alignItems:'center', marginTop:8 }}>
            <FontAwesome name={brandIconName(document.cardBrand) as any} size={18} color={'#374151'} />
            <Text style={{ marginLeft:8, color:'#374151' }}>Bandeira: <Text style={{ fontWeight:'700', color:'#111827' }}>{document.cardBrand}</Text></Text>
          </View>
        )}
        {type === 'Cartões' && (document.cardSubtype || document.bank || document.expiryDate) ? (
          <View style={{ marginTop:8 }}>
            {document.cardSubtype ? (
              <Text style={{ color:'#374151' }}>Tipo: <Text style={{ fontWeight:'700', color:'#111827' }}>{document.cardSubtype}</Text></Text>
            ) : null}
            {document.bank ? (
              <Text style={{ color:'#374151', marginTop:4 }}>Banco: <Text style={{ fontWeight:'700', color:'#111827' }}>{document.bank}</Text></Text>
            ) : null}
            {document.expiryDate ? (
              <Text style={{ color:'#374151', marginTop:4 }}>Validade: <Text style={{ fontWeight:'700', color:'#111827' }}>{document.expiryDate}</Text></Text>
            ) : null}
          </View>
        ) : null}
        {type === 'Título de Eleitor' && (document.electorZone || document.electorSection) ? (
          <View style={{ marginTop: 8 }}>
            <Text style={{ fontSize: 13, color:'#6B7280' }}>Zona • Seção</Text>
            <Text style={{ fontSize: 16, fontWeight:'700', color:'#111827' }}>
              {document.electorZone || '—'} • {document.electorSection || '—'}
            </Text>
          </View>
        ) : null}
      </View>

      {(type === 'RG' || type === 'CNH' || type === 'Documento do veículo') && (
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 3, marginBottom: 16 }}>
          <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 8, fontWeight: '700' }}>Informações do Documento</Text>
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, color: '#6B7280' }}>Data de Expedição</Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>{meta.issueDate || '—'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, color: '#6B7280' }}>Data de Vencimento</Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>{meta.expiryDate || '—'}</Text>
            </View>
          </View>
          {(type === 'RG' || type === 'CNH') && (
            <>
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, color: '#6B7280' }}>UF</Text>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>{meta.issuingState || '—'}</Text>
                </View>
                <View style={{ flex: 2 }}>
                  <Text style={{ fontSize: 13, color: '#6B7280' }}>Cidade</Text>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>{meta.issuingCity || '—'}</Text>
                </View>
              </View>
              <View>
                <Text style={{ fontSize: 13, color: '#6B7280' }}>Órgão Emissor</Text>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>{meta.issuingAuthority || '—'}</Text>
              </View>
            </>
          )}
        </View>
      )}

      {document.frontImageUri && document.backImageUri && template.layout === 'sideBySide' ? (
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
          <View style={{ flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: template.accentColor, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 }}>
            <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 8 }}>{template.frontLabel}</Text>
            <View style={{ borderRadius: 12, overflow: 'hidden', backgroundColor: '#F9FAFB', position:'relative' }}>
              <View style={{ position:'absolute', top:8, left:8, backgroundColor: template.accentColor, paddingVertical:4, paddingHorizontal:8, borderRadius:8, flexDirection:'row', alignItems:'center', zIndex:1 }}>
                <Ionicons name={template.icon as any} size={14} color='#fff' style={{ marginRight: 6 }} />
                <Text style={{ color:'#fff', fontWeight:'700' }}>{template.frontLabel}</Text>
              </View>
              <Image source={{ uri: document.frontImageUri }} style={{ height: 200 }} resizeMode='contain' />
            </View>
          </View>
          <View style={{ flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: template.accentColor, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 }}>
            <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 8 }}>{template.backLabel}</Text>
            <View style={{ borderRadius: 12, overflow: 'hidden', backgroundColor: '#F9FAFB', position:'relative' }}>
              <View style={{ position:'absolute', top:8, left:8, backgroundColor: template.accentColor, paddingVertical:4, paddingHorizontal:8, borderRadius:8, flexDirection:'row', alignItems:'center', zIndex:1 }}>
                <Ionicons name={template.icon as any} size={14} color='#fff' style={{ marginRight: 6 }} />
                <Text style={{ color:'#fff', fontWeight:'700' }}>{template.backLabel}</Text>
              </View>
              <Image source={{ uri: document.backImageUri }} style={{ height: 200 }} resizeMode='contain' />
            </View>
          </View>
        </View>
      ) : (
        <>
          {document.frontImageUri ? (
            <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: template.accentColor, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 3, marginBottom: 16 }}>
              <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 8 }}>{template.frontLabel}</Text>
              <View style={{ borderRadius: 12, overflow: 'hidden', backgroundColor: '#F9FAFB', position:'relative' }}>
                <View style={{ position:'absolute', top:8, left:8, backgroundColor: template.accentColor, paddingVertical:4, paddingHorizontal:8, borderRadius:8, flexDirection:'row', alignItems:'center', zIndex:1 }}>
                  <Ionicons name={template.icon as any} size={14} color='#fff' style={{ marginRight: 6 }} />
                  <Text style={{ color:'#fff', fontWeight:'700' }}>{template.frontLabel}</Text>
                </View>
                <Image source={{ uri: document.frontImageUri }} style={{ height: 220 }} resizeMode='contain' />
              </View>
            </View>
          ) : null}
          {template.hasBack && document.backImageUri ? (
            <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: template.accentColor, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 }}>
              <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 8 }}>{template.backLabel}</Text>
              <View style={{ borderRadius: 12, overflow: 'hidden', backgroundColor: '#F9FAFB', position:'relative' }}>
                <View style={{ position:'absolute', top:8, left:8, backgroundColor: template.accentColor, paddingVertical:4, paddingHorizontal:8, borderRadius:8, flexDirection:'row', alignItems:'center', zIndex:1 }}>
                  <Ionicons name={template.icon as any} size={14} color='#fff' style={{ marginRight: 6 }} />
                  <Text style={{ color:'#fff', fontWeight:'700' }}>{template.backLabel}</Text>
                </View>
                <Image source={{ uri: document.backImageUri }} style={{ height: 220 }} resizeMode='contain' />
              </View>
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
    <ShareSheet visible={shareOpen} onClose={() => setShareOpen(false)} document={document} userId={userId} />
    </>
  );
}

// Botões de exportação para PDF (web)
async function exportAsPDF(title: string, frontUri?: string, backUri?: string) {
  if (Platform.OS !== 'web') {
    Alert.alert('Disponível apenas na Web', 'Para salvar PDF, acesse pelo navegador.');
    return;
  }
  const jsPDF = require('jspdf').default;
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text(title || 'Documento', 10, 20);
  let y = 30;
  if (frontUri) {
    try {
      const img = await fetch(frontUri).then(r => r.blob());
      const reader = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result as string);
        fr.onerror = reject;
        fr.readAsDataURL(img);
      });
      doc.addImage(reader, 'JPEG', 10, y, 180, 0);
      y += 100;
    } catch {}
  }
  if (backUri) {
    try {
      const img = await fetch(backUri).then(r => r.blob());
      const reader = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result as string);
        fr.onerror = reject;
        fr.readAsDataURL(img);
      });
      doc.addImage(reader, 'JPEG', 10, y, 180, 0);
    } catch {}
  }

  // Marca d'água
  try {
    const pageWidth = (doc as any).internal.pageSize.getWidth();
    const pageHeight = (doc as any).internal.pageSize.getHeight();
    doc.setFontSize(28);
    doc.setTextColor(180, 180, 180);
    doc.text('EVDocs - Uso exclusivo do titular', pageWidth / 2, pageHeight / 2, { angle: -30, align: 'center' } as any);
  } catch {}

  doc.save(`${title || 'documento'}.pdf`);
}

function brandIconName(brand?: string) {
  switch ((brand || '').toLowerCase()) {
    case 'visa': return 'cc-visa';
    case 'mastercard': return 'cc-mastercard';
    case 'american express': return 'cc-amex';
    case 'discover': return 'cc-discover';
    case 'diners club': return 'cc-diners-club';
    case 'jcb': return 'cc-jcb';
    case 'elo': return 'credit-card';
    case 'hipercard': return 'credit-card';
    default: return 'credit-card';
  }
}