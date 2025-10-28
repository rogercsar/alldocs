import React from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, Share, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { deleteDocument } from '../storage/db';
import { syncDocumentDelete } from '../storage/sync';
import type { DocumentItem } from '../types';

const primaryColor = '#4F46E5';
const dangerColor = '#EF4444';
const bgColor = '#F3F4F6';

const DOC_TYPES = ['RG', 'CNH', 'CPF', 'Passaporte', 'Outros'] as const;
type DocType = typeof DOC_TYPES[number];

function getViewTemplate(type: DocType) {
  switch (type) {
    case 'RG':
      return { accentColor: '#10B981', numberLabel: 'Número do RG', frontLabel: 'Frente RG', backLabel: 'Verso RG', layout: 'sideBySide' as const };
    case 'CNH':
      return { accentColor: '#F59E0B', numberLabel: 'Número da CNH', frontLabel: 'Frente CNH', backLabel: 'Verso CNH', layout: 'vertical' as const };
    case 'CPF':
      return { accentColor: '#3B82F6', numberLabel: 'CPF', frontLabel: 'Frente CPF', backLabel: 'Verso CPF', layout: 'vertical' as const };
    case 'Passaporte':
      return { accentColor: '#8B5CF6', numberLabel: 'Número do Passaporte', frontLabel: 'Frente Passaporte', backLabel: 'Verso Passaporte', layout: 'vertical' as const };
    default:
      return { accentColor: '#6B7280', numberLabel: 'Número do Documento', frontLabel: 'Frente', backLabel: 'Verso', layout: 'vertical' as const };
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

export default function ViewDocumentScreen({ document, onEdit, onDeleted, userId }: { document: DocumentItem; onEdit: () => void; onDeleted: () => void; userId: string }) {
  if (!document) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: bgColor }}>
        <Ionicons name='alert-circle' size={48} color='#6B7280' style={{ marginBottom: 12 }} />
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 }}>Documento não encontrado</Text>
        <TouchableOpacity onPress={onDeleted} style={{ backgroundColor: primaryColor, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 12, flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name='arrow-back' size={18} color='#fff' style={{ marginRight: 6 }} />
          <Text style={{ color: '#fff', fontWeight: '700' }}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const type = (document.type || 'Outros') as DocType;
  const template = getViewTemplate(type);
  const numberDisplay = formatNumberByType(type, document.number);

  async function remove() {
    if (!document?.id) return;
    await deleteDocument(document.id);
    try {
      await syncDocumentDelete(document.id, userId);
    } catch {}
    onDeleted();
  }

  async function shareDoc() {
    const title = `${document.name} (${type})`;
    const message = `${title}\nNúmero: ${numberDisplay || '—'}`;
    try {
      if (typeof navigator !== 'undefined' && 'share' in navigator) {
        // @ts-ignore
        await navigator.share({ title, text: message });
      } else {
        await Share.share({ message, title });
      }
    } catch (e) {
      Alert.alert('Não foi possível compartilhar', String((e as any)?.message || e));
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: bgColor }} contentContainerStyle={{ padding: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#111827', marginRight: 8 }}>{document.name}</Text>
          <View style={{ borderWidth: 1, borderColor: template.accentColor, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 9999, flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name={type === 'CNH' ? 'car' : type === 'Passaporte' ? 'airplane' : type === 'Outros' ? 'document-text' : 'person'} size={16} color={template.accentColor} style={{ marginRight: 6 }} />
            <Text style={{ color: template.accentColor, fontWeight: '700' }}>{type}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity onPress={shareDoc} style={{ paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name='share-social' size={18} color={primaryColor} style={{ marginRight: 6 }} />
            <Text style={{ color: primaryColor, fontWeight: '700' }}>Compartilhar</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onEdit?.()} style={{ paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name='pencil' size={18} color={primaryColor} style={{ marginRight: 6 }} />
            <Text style={{ color: primaryColor, fontWeight: '700' }}>Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={remove} style={{ paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: dangerColor, flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name='trash' size={18} color='#fff' style={{ marginRight: 6 }} />
            <Text style={{ color: '#fff', fontWeight: '700' }}>Excluir</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 3, marginBottom: 16 }}>
        <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 8 }}>{template.numberLabel}</Text>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>{numberDisplay}</Text>
      </View>

      {document.frontImageUri && document.backImageUri && template.layout === 'sideBySide' ? (
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
          <View style={{ flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: template.accentColor, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 }}>
            <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 8 }}>{template.frontLabel}</Text>
            <View style={{ borderRadius: 12, overflow: 'hidden', backgroundColor: '#F9FAFB', position:'relative' }}>
              <View style={{ position:'absolute', top:8, left:8, backgroundColor: template.accentColor, paddingVertical:4, paddingHorizontal:8, borderRadius:8, flexDirection:'row', alignItems:'center', zIndex:1 }}>
                <Ionicons name={type === 'CNH' ? 'car' : type === 'Passaporte' ? 'airplane' : type === 'Outros' ? 'document-text' : 'person'} size={14} color='#fff' style={{ marginRight: 6 }} />
                <Text style={{ color:'#fff', fontWeight:'700' }}>{template.frontLabel}</Text>
              </View>
              <Image source={{ uri: document.frontImageUri }} style={{ height: 200 }} resizeMode='contain' />
            </View>
          </View>
          <View style={{ flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: template.accentColor, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 }}>
            <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 8 }}>{template.backLabel}</Text>
            <View style={{ borderRadius: 12, overflow: 'hidden', backgroundColor: '#F9FAFB', position:'relative' }}>
              <View style={{ position:'absolute', top:8, left:8, backgroundColor: template.accentColor, paddingVertical:4, paddingHorizontal:8, borderRadius:8, flexDirection:'row', alignItems:'center', zIndex:1 }}>
                <Ionicons name={type === 'CNH' ? 'car' : type === 'Passaporte' ? 'airplane' : type === 'Outros' ? 'document-text' : 'person'} size={14} color='#fff' style={{ marginRight: 6 }} />
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
                  <Ionicons name={type === 'CNH' ? 'car' : type === 'Passaporte' ? 'airplane' : type === 'Outros' ? 'document-text' : 'person'} size={14} color='#fff' style={{ marginRight: 6 }} />
                  <Text style={{ color:'#fff', fontWeight:'700' }}>{template.frontLabel}</Text>
                </View>
                <Image source={{ uri: document.frontImageUri }} style={{ height: 220 }} resizeMode='contain' />
              </View>
            </View>
          ) : null}
          {document.backImageUri ? (
            <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: template.accentColor, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 }}>
              <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 8 }}>{template.backLabel}</Text>
              <View style={{ borderRadius: 12, overflow: 'hidden', backgroundColor: '#F9FAFB', position:'relative' }}>
                <View style={{ position:'absolute', top:8, left:8, backgroundColor: template.accentColor, paddingVertical:4, paddingHorizontal:8, borderRadius:8, flexDirection:'row', alignItems:'center', zIndex:1 }}>
                  <Ionicons name={type === 'CNH' ? 'car' : type === 'Passaporte' ? 'airplane' : type === 'Outros' ? 'document-text' : 'person'} size={14} color='#fff' style={{ marginRight: 6 }} />
                  <Text style={{ color:'#fff', fontWeight:'700' }}>{template.backLabel}</Text>
                </View>
                <Image source={{ uri: document.backImageUri }} style={{ height: 220 }} resizeMode='contain' />
              </View>
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}