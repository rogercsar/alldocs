import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Image, Alert, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { addDocument, updateDocument, saveImageToLocal } from '../storage/db';
import { supabase } from '../supabase';
import { syncDocumentAddOrUpdate } from '../storage/sync';
import type { DocumentItem } from '../types';
import { colors } from '../theme/colors';
import DateTimePicker from '@react-native-community/datetimepicker'
import { ToastProvider, useToast } from '../components/Toast';

const primaryColor = colors.brandPrimary;
const bgColor = colors.bg;
const DOC_TYPES = ['RG', 'CNH', 'CPF', 'Passaporte', 'Comprovante de endereço', 'Documento do veículo', 'Cartões', 'Certidões', 'Título de Eleitor', 'Outros'] as const;



function getTemplate(type: typeof DOC_TYPES[number]) {
  switch (type) {
    case 'RG':
      return { numberLabel: 'Número do RG', frontLabel: 'Foto (Frente RG)', backLabel: 'Foto (Verso RG)', imagesLayout: 'sideBySide', hasBack: true, numberPlaceholder: 'Ex.: 12.345.678-9' };
    case 'CNH':
      return { numberLabel: 'Número da CNH', frontLabel: 'Foto (Frente CNH)', backLabel: 'Foto (Verso CNH)', imagesLayout: 'sideBySide', hasBack: true, numberPlaceholder: 'Ex.: 00000000000' };
    case 'CPF':
      return { numberLabel: 'CPF', frontLabel: 'Foto (Frente CPF)', backLabel: 'Foto (Verso CPF)', imagesLayout: 'sideBySide', hasBack: true, numberPlaceholder: 'Ex.: 000.000.000-00' };
    case 'Passaporte':
      return { numberLabel: 'Número do Passaporte', frontLabel: 'Foto (Frente Passaporte)', backLabel: 'Foto (Verso Passaporte)', imagesLayout: 'stack', hasBack: true, numberPlaceholder: 'Ex.: BR123456' };
    case 'Comprovante de endereço':
      return { numberLabel: 'Identificador', frontLabel: 'Foto (Frente Comprovante)', backLabel: '', imagesLayout: 'stack', hasBack: false, numberPlaceholder: 'Ex.: Conta nº / Código cliente' };
    case 'Documento do veículo':
      return { numberLabel: 'Placa/RENAVAM', frontLabel: 'Foto (Frente Doc Veículo)', backLabel: 'Foto (Verso Doc Veículo)', imagesLayout: 'sideBySide', hasBack: true, numberPlaceholder: 'Ex.: ABC1D23 ou 123456789' };
    case 'Título de Eleitor':
      return { numberLabel: 'Número do Título de Eleitor', frontLabel: 'Foto (Frente Título)', backLabel: 'Foto (Verso Título)', imagesLayout: 'sideBySide', hasBack: true, numberPlaceholder: 'Ex.: 0000 0000 0000' };
    case 'Cartões':
      return { numberLabel: 'Número do Cartão', frontLabel: 'Foto (Frente Cartão)', backLabel: 'Foto (Verso Cartão)', imagesLayout: 'sideBySide', hasBack: true, numberPlaceholder: 'Ex.: 1234 5678 9012 3456' };
    case 'Certidões':
      return { numberLabel: 'Número do Registro', frontLabel: 'Foto (Frente Certidão)', backLabel: 'Foto (Verso Certidão)', imagesLayout: 'stack', hasBack: true, numberPlaceholder: 'Ex.: Livro/Folha/Termo' };
    default:
      return { numberLabel: 'Número do Documento', frontLabel: 'Foto (Frente)', backLabel: 'Foto (Verso)', imagesLayout: 'stack', hasBack: true, numberPlaceholder: 'Ex.: 123456789' };
  }
}

export default function EditDocumentScreen({ onSaved, userId, document }: { onSaved: () => void; userId: string; document?: DocumentItem }) {
  const { showToast } = useToast();
  const [name, setName] = useState(document?.name || '');
  const [number, setNumber] = useState(document?.number || '');
  const [frontUri, setFrontUri] = useState<string | undefined>(document?.frontImageUri || undefined);
  const [backUri, setBackUri] = useState<string | undefined>(document?.backImageUri || undefined);
  const [saving, setSaving] = useState(false);
  const [docType, setDocType] = useState<typeof DOC_TYPES[number]>(document?.type as any || 'RG');
  // Campos RG/CNH
  const [issueDate, setIssueDate] = useState(document?.issueDate || '');
  const [expiryDate, setExpiryDate] = useState(document?.expiryDate || '');
  const [issuingState, setIssuingState] = useState(document?.issuingState || '');
  const [issuingCity, setIssuingCity] = useState(document?.issuingCity || '');
  const [issuingAuthority, setIssuingAuthority] = useState(document?.issuingAuthority || '');
  // Campos Título de Eleitor
  const [electorZone, setElectorZone] = useState(document?.electorZone || '');
  const [electorSection, setElectorSection] = useState(document?.electorSection || '');
  // Opções dinâmicas
  const [cityOptions, setCityOptions] = useState<Option[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [authorityOptions, setAuthorityOptions] = useState<Option[]>([]);

  useEffect(() => {
    setName(document?.name || '');
    setNumber(document?.number || '');
    setFrontUri(document?.frontImageUri || undefined);
    setBackUri(document?.backImageUri || undefined);
    setDocType((document?.type as any) || 'RG');
    setIssueDate(document?.issueDate || '');
    setExpiryDate(document?.expiryDate || '');
    setIssuingState(document?.issuingState || '');
    setIssuingCity(document?.issuingCity || '');
    setIssuingAuthority(document?.issuingAuthority || '');
    setElectorZone(document?.electorZone || '');
    setElectorSection(document?.electorSection || '');
  }, [document?.id]);

  // Carregar cidades ao mudar UF
  useEffect(() => {
    setIssuingCity('');
    setIssuingAuthority('');
    setCityOptions([]);
    if (!issuingState) return;
    let cancelled = false;
    (async () => {
      try {
        setLoadingCities(true);
        let url = `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${issuingState}/municipios`;
        let res = await fetch(url);
        if (!res.ok) {
          const s = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados?sigla=${issuingState}`);
          const states = await s.json();
          if (states && states[0]?.id) {
            res = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${states[0].id}/municipios`);
          }
        }
        const data = await res.json();
        if (!cancelled && Array.isArray(data)) {
          const opts = data.map((c: any) => ({ value: c.nome, label: c.nome })).sort((a: Option, b: Option) => a.label.localeCompare(b.label, 'pt-BR'));
          setCityOptions(opts);
        }
      } catch (e) {
        if (!cancelled) setCityOptions([]);
      } finally {
        if (!cancelled) setLoadingCities(false);
      }
    })();
    return () => { cancelled = true; };
  }, [issuingState]);

  // Atualizar opções de órgão emissor conforme UF/Cidade/Tipo
  useEffect(() => {
    const opts = computeAuthorities(docType, issuingState, issuingCity);
    setAuthorityOptions(opts);
    if (!opts.find((o) => o.value === issuingAuthority)) setIssuingAuthority('');
  }, [docType, issuingState, issuingCity]);

  const template = getTemplate(docType);

  async function pick(setter: (uri: string) => void) {
    const res = await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: false, mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.9 });
    if (!res.canceled && res.assets?.[0]?.uri) setter(res.assets[0].uri);
  }

  async function capture(setter: (uri: string) => void) {
    if (Platform.OS === 'web') {
      // No web, câmera abre seletor de arquivo; usar galeria para consistência
      return pick(setter);
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.9 });
    if (!res.canceled && res.assets?.[0]?.uri) setter(res.assets[0].uri);
  }

  function shouldShowMetadata(t: typeof DOC_TYPES[number]) {
    return t === 'RG' || t === 'CNH';
  }

  async function save() {
    if (!name || !number) { Alert.alert('Campos obrigatórios', 'Informe nome e número'); return; }
    setSaving(true);

    const baseMeta = shouldShowMetadata(docType)
      ? { issueDate: issueDate || '', expiryDate: expiryDate || '', issuingState: issuingState || '', issuingCity: issuingCity || '', issuingAuthority: issuingAuthority || '' }
      : { issueDate: '', expiryDate: '', issuingState: '', issuingCity: '', issuingAuthority: '' };

    const meta = docType === 'Título de Eleitor'
      ? { ...baseMeta, electorZone: electorZone || '', electorSection: electorSection || '' }
      : { ...baseMeta, electorZone: '', electorSection: '' };

    if (document?.id) {
      const f = frontUri ? await saveImageToLocal(frontUri) : (document.frontImageUri || '');
      const b = backUri ? await saveImageToLocal(backUri) : (document.backImageUri || '');
      await updateDocument({ id: document.id, appId: document.appId, name, number, frontImageUri: f, backImageUri: b, type: docType, synced: 0, ...meta });
      setSaving(false);
      try {
        await syncDocumentAddOrUpdate({ id: document.id, appId: document.appId, name, number, frontImageUri: f, backImageUri: b }, userId);
      } catch {}
      showToast('Alterações salvas', { type: 'success' });
      onSaved();
      return;
    }

    const f = frontUri ? await saveImageToLocal(frontUri) : '';
    const b = backUri ? await saveImageToLocal(backUri) : '';
    const id = await addDocument({ name, number, frontImageUri: f, backImageUri: b, type: docType, synced: 0, ...meta });
    setSaving(false);
    try {
      await syncDocumentAddOrUpdate({ id, appId: document?.appId, name, number, frontImageUri: f, backImageUri: b }, userId);
    } catch {}
    showToast('Documento criado', { type: 'success' });
    onSaved();
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex:1, backgroundColor: bgColor }}>
      <ScrollView contentContainerStyle={{ padding:16 }}>
        <Text style={{ fontSize: 22, fontWeight:'800', color:'#111827', marginBottom:12 }}>Adicionar/Editar Documento</Text>

        {/* Tipo de Documento */}
        <View style={{ backgroundColor:'#fff', borderRadius:16, padding:12, borderWidth:1, borderColor:'#E5E7EB', shadowColor:'#000', shadowOpacity:0.06, shadowRadius:12, elevation:3, marginBottom:12 }}>
          <Text style={{ fontSize: 14, color:'#374151', marginBottom: 8 }}>Tipo de Documento</Text>
          <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8 }}>
            {DOC_TYPES.map((t) => (
              <TouchableOpacity key={t} onPress={() => setDocType(t)} style={{ paddingVertical:8, paddingHorizontal:12, borderRadius:9999, borderWidth:1, borderColor: docType === t ? primaryColor : '#E5E7EB', backgroundColor: docType === t ? '#EEF2FF' : '#fff', marginRight:8, marginBottom:8 }}>
                <Text style={{ color: docType === t ? primaryColor : '#374151', fontWeight:'600' }}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ backgroundColor:'#fff', borderRadius:16, padding:16, borderWidth:1, borderColor:'#E5E7EB', shadowColor:'#000', shadowOpacity:0.06, shadowRadius:12, elevation:3 }}>
          <Text style={{ fontSize: 14, color:'#374151', marginBottom: 6 }}>Nome do Documento</Text>
          <TextInput value={name} onChangeText={setName} placeholder={`Ex.: ${docType}`} placeholderTextColor='#9CA3AF' style={{ backgroundColor:'#F9FAFB', borderWidth:1, borderColor:'#E5E7EB', paddingVertical:12, paddingHorizontal:14, borderRadius:12, marginBottom:14 }} />

          <Text style={{ fontSize: 14, color:'#374151', marginBottom: 6 }}>{template.numberLabel}</Text>
          <TextInput value={number} onChangeText={setNumber} placeholder={template.numberPlaceholder} placeholderTextColor='#9CA3AF' style={{ backgroundColor:'#F9FAFB', borderWidth:1, borderColor:'#E5E7EB', paddingVertical:12, paddingHorizontal:14, borderRadius:12, marginBottom:16 }} />

          {docType === 'Título de Eleitor' && (
            <View style={{ backgroundColor:'#F9FAFB', borderWidth:1, borderColor:'#E5E7EB', padding:12, borderRadius:12, marginBottom:16 }}>
              <Text style={{ fontSize: 14, color:'#374151', marginBottom: 8, fontWeight:'700' }}>Informações do Título de Eleitor</Text>
              <View style={{ flexDirection:'row', gap:8 }}>
                <View style={{ flex:1 }}>
                  <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 6 }}>Zona</Text>
                  <TextInput value={electorZone} onChangeText={setElectorZone} keyboardType='numeric' placeholder='Ex.: 001' placeholderTextColor='#9CA3AF' style={{ backgroundColor:'#fff', borderWidth:1, borderColor:'#E5E7EB', paddingVertical:10, paddingHorizontal:12, borderRadius:10 }} />
                </View>
                <View style={{ flex:1 }}>
                  <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 6 }}>Seção</Text>
                  <TextInput value={electorSection} onChangeText={setElectorSection} keyboardType='numeric' placeholder='Ex.: 0123' placeholderTextColor='#9CA3AF' style={{ backgroundColor:'#fff', borderWidth:1, borderColor:'#E5E7EB', paddingVertical:10, paddingHorizontal:12, borderRadius:10 }} />
                </View>
              </View>
            </View>
          )}

          {shouldShowMetadata(docType) && (
            <View style={{ backgroundColor:'#F9FAFB', borderWidth:1, borderColor:'#E5E7EB', padding:12, borderRadius:12, marginBottom:16 }}>
              <Text style={{ fontSize: 14, color:'#374151', marginBottom: 8, fontWeight:'700' }}>Informações do Documento</Text>
              <View style={{ flexDirection:'row', gap:8 }}>
                <AdaptiveDateField label="Data de Expedição" value={issueDate} onChange={setIssueDate} />
                <AdaptiveDateField label="Data de Vencimento" value={expiryDate} onChange={setExpiryDate} />
              </View>
              <View style={{ flexDirection:'row', gap:8, marginTop: 8 }}>
                <View style={{ flex:1 }}>
                  <SelectField label="UF" value={issuingState} placeholder="Selecione a UF" options={UF_OPTIONS} onChange={(v) => setIssuingState(v)} />
                </View>
                <View style={{ flex:2 }}>
                  <SelectField label="Cidade" value={issuingCity} placeholder={issuingState ? 'Selecione a cidade' : 'Selecione a UF primeiro'} options={cityOptions} onChange={setIssuingCity} disabled={!issuingState} loading={loadingCities} />
                </View>
              </View>
              <View style={{ marginTop: 8 }}>
                <SelectField label="Órgão Emissor" value={issuingAuthority} placeholder={issuingCity ? 'Selecione o órgão' : 'Selecione a cidade primeiro'} options={authorityOptions} onChange={setIssuingAuthority} disabled={!issuingCity} />
              </View>
            </View>
          )}

          {template.imagesLayout === 'sideBySide' ? (
            <View style={{ flexDirection:'row', gap:8 }}>
              {/* Frente */}
              <View style={{ flex:1 }}>
                <Text style={{ fontSize: 14, color:'#374151', marginBottom: 6 }}>{template.frontLabel}</Text>
                {frontUri ? (
                  <View style={{ backgroundColor:'#fff', borderWidth:1, borderColor:'#E5E7EB', borderRadius:12, overflow:'hidden', marginBottom:8 }}>
                    <Image source={{ uri: frontUri }} style={{ height:160 }} resizeMode='contain'/>
                  </View>
                ) : null}
                <View style={{ flexDirection:'row', gap:8, marginBottom:8 }}>
                  <TouchableOpacity onPress={() => pick(setFrontUri)} style={{ flex:1, borderWidth:2, borderColor: primaryColor, paddingVertical:12, borderRadius:12, alignItems:'center', flexDirection:'row', justifyContent:'center' }}>
                    <Ionicons name='image' size={18} color={primaryColor} style={{ marginRight:6 }} />
                    <Text style={{ color: primaryColor, fontWeight:'700' }}>Galeria</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => capture(setFrontUri)} style={{ flex:1, backgroundColor: primaryColor, paddingVertical:12, borderRadius:12, alignItems:'center', flexDirection:'row', justifyContent:'center' }}>
                    <Ionicons name='camera' size={18} color='#fff' style={{ marginRight:6 }} />
                    <Text style={{ color:'#fff', fontWeight:'700' }}>Câmera</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Verso */}
              {template.hasBack && (
                <View style={{ flex:1 }}>
                  <Text style={{ fontSize: 14, color:'#374151', marginBottom: 6 }}>{template.backLabel}</Text>
                  {backUri ? (
                    <View style={{ backgroundColor:'#fff', borderWidth:1, borderColor:'#E5E7EB', borderRadius:12, overflow:'hidden', marginBottom:8 }}>
                      <Image source={{ uri: backUri }} style={{ height:160 }} resizeMode='contain'/>
                    </View>
                  ) : null}
                  <View style={{ flexDirection:'row', gap:8 }}>
                    <TouchableOpacity onPress={() => pick(setBackUri)} style={{ flex:1, borderWidth:2, borderColor: primaryColor, paddingVertical:12, borderRadius:12, alignItems:'center', flexDirection:'row', justifyContent:'center' }}>
                      <Ionicons name='image' size={18} color={primaryColor} style={{ marginRight:6 }} />
                      <Text style={{ color: primaryColor, fontWeight:'700' }}>Galeria</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => capture(setBackUri)} style={{ flex:1, backgroundColor: primaryColor, paddingVertical:12, borderRadius:12, alignItems:'center', flexDirection:'row', justifyContent:'center' }}>
                      <Ionicons name='camera' size={18} color='#fff' style={{ marginRight:6 }} />
                      <Text style={{ color:'#fff', fontWeight:'700' }}>Câmera</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          ) : (
            <>
              <Text style={{ fontSize: 14, color:'#374151', marginBottom: 6 }}>{template.frontLabel}</Text>
              {frontUri ? (
                <View style={{ backgroundColor:'#fff', borderWidth:1, borderColor:'#E5E7EB', borderRadius:12, overflow:'hidden', marginBottom:8 }}>
                  <Image source={{ uri: frontUri }} style={{ height:160 }} resizeMode='contain'/>
                </View>
              ) : null}
              <View style={{ flexDirection:'row', gap:8, marginBottom:8 }}>
                <TouchableOpacity onPress={() => pick(setFrontUri)} style={{ flex:1, borderWidth:2, borderColor: primaryColor, paddingVertical:12, borderRadius:12, alignItems:'center', flexDirection:'row', justifyContent:'center' }}>
                  <Ionicons name='image' size={18} color={primaryColor} style={{ marginRight:6 }} />
                  <Text style={{ color: primaryColor, fontWeight:'700' }}>Galeria</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => capture(setFrontUri)} style={{ flex:1, backgroundColor: primaryColor, paddingVertical:12, borderRadius:12, alignItems:'center', flexDirection:'row', justifyContent:'center' }}>
                  <Ionicons name='camera' size={18} color='#fff' style={{ marginRight:6 }} />
                  <Text style={{ color:'#fff', fontWeight:'700' }}>Câmera</Text>
                </TouchableOpacity>
              </View>

              {template.hasBack && (
                <>
                  <Text style={{ fontSize: 14, color:'#374151', marginBottom: 6 }}>{template.backLabel}</Text>
                  {backUri ? (
                    <View style={{ backgroundColor:'#fff', borderWidth:1, borderColor:'#E5E7EB', borderRadius:12, overflow:'hidden', marginBottom:8 }}>
                      <Image source={{ uri: backUri }} style={{ height:160 }} resizeMode='contain'/>
                    </View>
                  ) : null}
                  <View style={{ flexDirection:'row', gap:8 }}>
                    <TouchableOpacity onPress={() => pick(setBackUri)} style={{ flex:1, borderWidth:2, borderColor: primaryColor, paddingVertical:12, borderRadius:12, alignItems:'center', flexDirection:'row', justifyContent:'center' }}>
                      <Ionicons name='image' size={18} color={primaryColor} style={{ marginRight:6 }} />
                      <Text style={{ color: primaryColor, fontWeight:'700' }}>Galeria</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => capture(setBackUri)} style={{ flex:1, backgroundColor: primaryColor, paddingVertical:12, borderRadius:12, alignItems:'center', flexDirection:'row', justifyContent:'center' }}>
                      <Ionicons name='camera' size={18} color='#fff' style={{ marginRight:6 }} />
                      <Text style={{ color:'#fff', fontWeight:'700' }}>Câmera</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </>
          )}

          <View style={{ height:16 }} />
          <TouchableOpacity onPress={save} disabled={saving} style={{ backgroundColor: primaryColor, opacity: saving ? 0.7 : 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', flexDirection:'row', justifyContent:'center' }}>
            <Ionicons name='checkmark' size={20} color='#fff' style={{ marginRight:8 }} />
            <Text style={{ color:'#fff', fontWeight:'700' }}>{saving ? 'Salvando…' : 'Salvar'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// --- Tipos e utilitários para dropdowns / datas ---
type Option = { label: string; value: string };

const UF_OPTIONS: Option[] = [
  { value: 'AC', label: 'AC - Acre' },
  { value: 'AL', label: 'AL - Alagoas' },
  { value: 'AP', label: 'AP - Amapá' },
  { value: 'AM', label: 'AM - Amazonas' },
  { value: 'BA', label: 'BA - Bahia' },
  { value: 'CE', label: 'CE - Ceará' },
  { value: 'DF', label: 'DF - Distrito Federal' },
  { value: 'ES', label: 'ES - Espírito Santo' },
  { value: 'GO', label: 'GO - Goiás' },
  { value: 'MA', label: 'MA - Maranhão' },
  { value: 'MT', label: 'MT - Mato Grosso' },
  { value: 'MS', label: 'MS - Mato Grosso do Sul' },
  { value: 'MG', label: 'MG - Minas Gerais' },
  { value: 'PA', label: 'PA - Pará' },
  { value: 'PB', label: 'PB - Paraíba' },
  { value: 'PR', label: 'PR - Paraná' },
  { value: 'PE', label: 'PE - Pernambuco' },
  { value: 'PI', label: 'PI - Piauí' },
  { value: 'RJ', label: 'RJ - Rio de Janeiro' },
  { value: 'RN', label: 'RN - Rio Grande do Norte' },
  { value: 'RS', label: 'RS - Rio Grande do Sul' },
  { value: 'RO', label: 'RO - Rondônia' },
  { value: 'RR', label: 'RR - Roraima' },
  { value: 'SC', label: 'SC - Santa Catarina' },
  { value: 'SP', label: 'SP - São Paulo' },
  { value: 'SE', label: 'SE - Sergipe' },
  { value: 'TO', label: 'TO - Tocantins' },
];

function pad2(n: number | string) {
  const s = String(n);
  return s.length === 1 ? `0${s}` : s;
}

function parseDateParts(str: string | undefined) {
  const m = (str || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? { dd: m[1], mm: m[2], yyyy: m[3] } : { dd: '', mm: '', yyyy: '' };
}

function SelectField({ label, value, placeholder, options, onChange, disabled, loading }: { label: string; value?: string; placeholder?: string; options: Option[]; onChange: (v: string) => void; disabled?: boolean; loading?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  useEffect(() => { if (!open) setQuery(''); }, [open]);
  const selected = options.find((o) => o.value === value);
  const filtered = options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()));
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 6 }}>{label}</Text>
      <TouchableOpacity disabled={disabled} onPress={() => setOpen(true)} style={{ backgroundColor: disabled ? '#F3F4F6' : '#fff', borderWidth: 1, borderColor: '#E5E7EB', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, minHeight: 44, justifyContent: 'center' }}>
      {loading ? (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <ActivityIndicator size="small" color={colors.brandPrimary} />
          <Text style={{ marginLeft: 8, color: '#6B7280' }}>Carregando…</Text>
        </View>
      ) : (
        <Text style={{ color: value ? '#111827' : '#9CA3AF', fontWeight: value ? '700' : '400' }}>
          {selected?.label || value || placeholder || 'Selecionar'}
        </Text>
      )}
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'center', padding: 16 }}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={{ backgroundColor: '#fff', borderRadius: 12, maxHeight: '70%', padding: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#111827' }}>{label}</Text>
              <TouchableOpacity onPress={() => { onChange(''); setOpen(false); }}>
                <Text style={{ color: colors.brandPrimary, fontWeight: '700' }}>Limpar</Text>
              </TouchableOpacity>
            </View>
            <View style={{ marginBottom: 8 }}>
              <TextInput value={query} onChangeText={setQuery} placeholder="Digite para filtrar…" placeholderTextColor="#9CA3AF" style={{ backgroundColor:'#F9FAFB', borderWidth:1, borderColor:'#E5E7EB', paddingVertical:10, paddingHorizontal:12, borderRadius:10 }} />
            </View>
            <ScrollView>
              {filtered.map((o) => (
                <TouchableOpacity key={o.value} onPress={() => { onChange(o.value); setOpen(false); }} style={{ paddingVertical: 12, paddingHorizontal: 8, borderRadius: 8 }}>
                  <Text style={{ color: '#111827', fontSize: 15 }}>{o.label}</Text>
                </TouchableOpacity>
              ))}
              {filtered.length === 0 && (
                <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                  <Text style={{ color: '#6B7280' }}>Nenhum resultado</Text>
                </View>
              )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// Novo campo de data único com modal de 3 colunas
function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const { dd, mm, yyyy } = parseDateParts(value);
  const [selDay, setSelDay] = useState<string>(dd);
  const [selMonth, setSelMonth] = useState<string>(mm);
  const [selYear, setSelYear] = useState<string>(yyyy);

  useEffect(() => {
    const parts = parseDateParts(value);
    setSelDay(parts.dd); setSelMonth(parts.mm); setSelYear(parts.yyyy);
  }, [value]);

  function daysInMonth(monthStr: string, yearStr: string) {
    const m = parseInt(monthStr || '0', 10);
    const y = parseInt(yearStr || '0', 10);
    if (!m || !y) return 31;
    return new Date(y, m, 0).getDate();
  }

  const dayOptions: Option[] = Array.from({ length: daysInMonth(selMonth, selYear) }, (_, i) => {
    const v = pad2(i + 1);
    return { value: v, label: v };
  });
  const monthOptions: Option[] = Array.from({ length: 12 }, (_, i) => {
    const v = pad2(i + 1);
    return { value: v, label: v };
  });
  const currentYear = new Date().getFullYear();
  const yearOptions: Option[] = Array.from({ length: (currentYear + 10) - 1930 + 1 }, (_, idx) => {
    const y = String((currentYear + 10) - idx);
    return { value: y, label: y };
  });

  function confirm() {
    if (selDay && selMonth && selYear) onChange(`${selDay}/${selMonth}/${selYear}`);
    setOpen(false);
  }
  function clear() {
    setSelDay(''); setSelMonth(''); setSelYear(''); onChange('');
    setOpen(false);
  }
  function setToday() {
    const t = new Date();
    const d = pad2(t.getDate());
    const m = pad2(t.getMonth() + 1);
    const y = String(t.getFullYear());
    setSelDay(d); setSelMonth(m); setSelYear(y);
    onChange(`${d}/${m}/${y}`);
    setOpen(false);
  }

  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 6 }}>{label}</Text>
      <TouchableOpacity onPress={() => setOpen(true)} style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, minHeight: 44, justifyContent: 'center' }}>
        <Text style={{ color: value ? '#111827' : '#9CA3AF', fontWeight: value ? '700' : '400' }}>
          {value || 'Selecionar data'}
        </Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'center', padding: 16 }}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={{ backgroundColor: '#fff', borderRadius: 12, maxHeight: '80%', padding: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#111827' }}>{label}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <TouchableOpacity onPress={clear}>
                  <Text style={{ color: colors.brandPrimary, fontWeight: '700' }}>Limpar</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={setToday}>
                  <Text style={{ color: colors.brandPrimary, fontWeight: '700' }}>Hoje</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={confirm} style={{ backgroundColor: colors.brandPrimary, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 }}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>OK</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>Dia</Text>
                <ScrollView>
                  {dayOptions.map((o) => (
                    <TouchableOpacity key={o.value} onPress={() => setSelDay(o.value)} style={{ paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8, backgroundColor: selDay === o.value ? '#EEF2FF' : 'transparent' }}>
                      <Text style={{ color: selDay === o.value ? colors.brandPrimary : '#111827', fontWeight: selDay === o.value ? '700' : '400' }}>{o.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>Mês</Text>
                <ScrollView>
                  {monthOptions.map((o) => (
                    <TouchableOpacity key={o.value} onPress={() => setSelMonth(o.value)} style={{ paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8, backgroundColor: selMonth === o.value ? '#EEF2FF' : 'transparent' }}>
                      <Text style={{ color: selMonth === o.value ? colors.brandPrimary : '#111827', fontWeight: selMonth === o.value ? '700' : '400' }}>{o.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>Ano</Text>
                <ScrollView>
                  {yearOptions.map((o) => (
                    <TouchableOpacity key={o.value} onPress={() => setSelYear(o.value)} style={{ paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8, backgroundColor: selYear === o.value ? '#EEF2FF' : 'transparent' }}>
                      <Text style={{ color: selYear === o.value ? colors.brandPrimary : '#111827', fontWeight: selYear === o.value ? '700' : '400' }}>{o.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function DateSelect({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const { dd, mm, yyyy } = parseDateParts(value);

  const dayOptions: Option[] = Array.from({ length: 31 }, (_, i) => {
    const v = pad2(i + 1);
    return { value: v, label: v };
  });
  const monthOptions: Option[] = Array.from({ length: 12 }, (_, i) => {
    const v = pad2(i + 1);
    return { value: v, label: v };
  });
  const currentYear = new Date().getFullYear();
  const yearOptions: Option[] = Array.from({ length: (currentYear + 10) - 1930 + 1 }, (_, idx) => {
    const y = String((currentYear + 10) - idx);
    return { value: y, label: y };
  });

  function update(part: 'dd' | 'mm' | 'yyyy', newVal: string) {
    const base = parseDateParts(value);
    const next = { ...base, [part]: newVal } as { dd: string; mm: string; yyyy: string };
    if (next.dd && next.mm && next.yyyy) onChange(`${next.dd}/${next.mm}/${next.yyyy}`);
    else onChange('');
  }

  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 6 }}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <SelectField label="Dia" value={dd} placeholder="DD" options={dayOptions} onChange={(v) => update('dd', v)} />
        <SelectField label="Mês" value={mm} placeholder="MM" options={monthOptions} onChange={(v) => update('mm', v)} />
        <SelectField label="Ano" value={yyyy} placeholder="AAAA" options={yearOptions} onChange={(v) => update('yyyy', v)} />
      </View>
    </View>
  );
}

function computeAuthorities(docType: typeof DOC_TYPES[number], uf: string, city: string): Option[] {
  if (!uf) return [];
  const opts: Option[] = [];
  if (docType === 'CNH') {
    opts.push({ value: `DETRAN-${uf}`, label: `DETRAN-${uf}` });
    if (city) opts.push({ value: `CIRETRAN-${uf}-${city}`, label: `CIRETRAN ${city}/${uf}` });
  } else if (docType === 'RG') {
    opts.push({ value: `SSP-${uf}`, label: `SSP-${uf}` });
    opts.push({ value: `PC-${uf}`, label: `Polícia Civil - PC-${uf}` });
    opts.push({ value: `IFP-${uf}`, label: `IFP-${uf}` });
    opts.push({ value: `IGP-${uf}`, label: `IGP-${uf}` });
    if (city) opts.push({ value: `SSP-${uf}-${city}`, label: `SSP ${city}/${uf}` });
  }
  return opts;
}

function AdaptiveDateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  if (Platform.OS === 'web') {
    return <DateField label={label} value={value} onChange={onChange} />;
  }
  const { dd, mm, yyyy } = parseDateParts(value);
  const [show, setShow] = useState(false);
  const currentYear = new Date().getFullYear();
  const selectedDate = dd && mm && yyyy ? new Date(parseInt(yyyy, 10), parseInt(mm, 10) - 1, parseInt(dd, 10)) : new Date();
  function onPick(_: any, date?: Date) {
    // Android fecha automaticamente, iOS pode ser inline
    if (Platform.OS !== 'ios') setShow(false);
    if (date) {
      const d = pad2(date.getDate());
      const m = pad2(date.getMonth() + 1);
      const y = String(date.getFullYear());
      onChange(`${d}/${m}/${y}`);
    }
  }
  function clear() { onChange(''); if (Platform.OS !== 'ios') setShow(false); }
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 6 }}>{label}</Text>
      <TouchableOpacity onPress={() => setShow(true)} style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, minHeight: 44, justifyContent: 'center' }}>
        <Text style={{ color: value ? '#111827' : '#9CA3AF', fontWeight: value ? '700' : '400' }}>{value || 'Selecionar data'}</Text>
      </TouchableOpacity>
      {show && (
        <View style={{ marginTop: 8 }}>
          <DateTimePicker
            value={selectedDate}
            mode="date"
            onChange={onPick}
            minimumDate={new Date(1930, 0, 1)}
            maximumDate={new Date(currentYear + 10, 11, 31)}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
            <TouchableOpacity onPress={clear}>
              <Text style={{ color: colors.brandPrimary, fontWeight: '700' }}>Limpar</Text>
            </TouchableOpacity>
            {Platform.OS !== 'ios' && (
              <TouchableOpacity onPress={() => setShow(false)} style={{ backgroundColor: colors.brandPrimary, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>OK</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
}