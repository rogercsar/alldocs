import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Linking, Platform, Share, ActivityIndicator, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import type { DocumentItem } from '../types';
import { colors } from '../theme/colors';

const primaryColor = colors.brandPrimary;
const bgColor = colors.bg;
const border = '#E5E7EB';
const textColor = '#111827';
const mutedText = '#6B7280';

export default function ShareSheet({ visible, onClose, document, userId, apiBase }: { visible: boolean; onClose: () => void; document: DocumentItem; userId: string; apiBase?: string; }) {
  const [loading, setLoading] = useState(false);
  const [frontUrl, setFrontUrl] = useState<string | null>(null);
  const [backUrl, setBackUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ttlSeconds, setTtlSeconds] = useState<number>(3600);
  const [pin, setPin] = useState<string>('');

  const title = `${document.name} (${document.type || 'Documento'})`;
  const baseMessage = `${title}\nNúmero: ${document.number || '—'}`;

  const signedLinksText = useMemo(() => {
    const parts: string[] = [];
    if (frontUrl) parts.push(`Frente: ${frontUrl}`);
    if (backUrl) parts.push(`Verso: ${backUrl}`);
    return parts.length ? parts.join('\n') : '';
  }, [frontUrl, backUrl]);

  useEffect(() => {
    let ignore = false;
    async function fetchSigned() {
      setError(null);
      setLoading(true);
      try {
        const base = apiBase || process.env.EXPO_PUBLIC_API_BASE_URL || process.env.EXPO_PUBLIC_API_BASE || '';
        const idParam = String(document.appId || document.id || '');
        if (!base || !userId || !idParam) {
          setFrontUrl(null); setBackUrl(null);
          setLoading(false);
          return;
        }
        const r = await fetch(`${base}/.netlify/functions/signed-urls?userId=${encodeURIComponent(userId)}&appId=${encodeURIComponent(idParam)}&ttl=${ttlSeconds}`);
        if (!ignore) {
          if (r.ok) {
            const j = await r.json();
            setFrontUrl(j.frontSignedUrl || null);
            setBackUrl(j.backSignedUrl || null);
          } else {
            setError('Não foi possível obter links assinados');
          }
        }
      } catch (e: any) {
        if (!ignore) setError(e?.message || String(e));
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    if (visible) fetchSigned();
    return () => { ignore = true; };
  }, [visible, document.appId, document.id, userId, apiBase, ttlSeconds]);

  async function copyLinks() {
    const pinLine = pin.trim() ? `PIN: ${pin.trim()}` : '';
    const text = [baseMessage, signedLinksText, pinLine].filter(Boolean).join('\n');
    try {
      await Clipboard.setStringAsync(text);
    } catch {}
  }

  async function shareSystem() {
    const pinLine = pin.trim() ? `PIN: ${pin.trim()}` : '';
    const text = [baseMessage, signedLinksText, pinLine].filter(Boolean).join('\n');
    try {
      if (typeof navigator !== 'undefined' && 'share' in navigator) {
        // @ts-ignore
        await navigator.share({ title, text });
      } else {
        await Share.share({ title, message: text });
      }
    } catch {}
  }

  function shareWhatsApp() {
    const pinLine = pin.trim() ? `PIN: ${pin.trim()}` : '';
    const text = encodeURIComponent([baseMessage, signedLinksText, pinLine].filter(Boolean).join('\n'));
    const url = `https://wa.me/?text=${text}`;
    Linking.openURL(url).catch(() => {});
  }

  function shareEmail() {
    const subject = encodeURIComponent(title);
    const pinLine = pin.trim() ? `PIN: ${pin.trim()}` : '';
    const body = encodeURIComponent([baseMessage, signedLinksText, pinLine].filter(Boolean).join('\n'));
    const url = `mailto:?subject=${subject}&body=${body}`;
    Linking.openURL(url).catch(() => {});
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={{ flex:1, backgroundColor:'rgba(0,0,0,0.35)', justifyContent:'flex-end' }}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}} style={{ backgroundColor:'#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 }}>
          <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
            <Text style={{ fontSize:16, fontWeight:'800', color: textColor }}>Compartilhar documento</Text>
            <TouchableOpacity onPress={onClose} style={{ padding:8 }}>
              <Ionicons name='close' size={20} color={mutedText} />
            </TouchableOpacity>
          </View>

          <View style={{ marginTop: 12 }}>
            <Text style={{ color: mutedText }}>{baseMessage}</Text>
          </View>

          <View style={{ marginTop: 12 }}>
            <Text style={{ fontSize: 13, color: mutedText, marginBottom: 6 }}>Validade do link</Text>
            <View style={{ flexDirection:'row', flexWrap:'wrap', marginHorizontal: -6 }}>
              {[{ label: '10 min', val: 600 }, { label: '1 hora', val: 3600 }, { label: '1 dia', val: 86400 }, { label: '7 dias', val: 604800 }].map(opt => (
                <TouchableOpacity key={opt.val} onPress={() => setTtlSeconds(opt.val)} style={{ margin:6, paddingVertical:6, paddingHorizontal:10, borderRadius:8, borderWidth:1, borderColor: border, backgroundColor: ttlSeconds === opt.val ? '#EEF2FF' : '#fff' }}>
                  <Text style={{ color: ttlSeconds === opt.val ? primaryColor : textColor }}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={{ marginTop: 12 }}>
            <Text style={{ fontSize: 13, color: mutedText, marginBottom: 6 }}>PIN opcional para abrir</Text>
            <TextInput value={pin} onChangeText={setPin} placeholder="Ex.: 1234" keyboardType="number-pad" maxLength={6} style={{ borderWidth:1, borderColor: border, borderRadius:8, paddingVertical:8, paddingHorizontal:10, color: textColor }} />
            <Text style={{ fontSize: 12, color: mutedText, marginTop: 4 }}>Incluído no texto compartilhado.</Text>
          </View>
          {loading ? (
            <View style={{ flexDirection:'row', alignItems:'center', marginTop: 12 }}>
              <ActivityIndicator color={primaryColor} />
              <Text style={{ marginLeft:8, color: mutedText }}>Gerando links seguros…</Text>
            </View>
          ) : (
            <View style={{ marginTop: 8 }}>
              {signedLinksText ? (
                <View style={{ backgroundColor:'#F9FAFB', borderWidth:1, borderColor: border, borderRadius: 12, padding: 10 }}>
                  <Text style={{ color: '#111827' }}>{signedLinksText}</Text>
                </View>
              ) : (
                <Text style={{ color: mutedText }}>Links seguros serão exibidos quando disponíveis.</Text>
              )}
              {error ? <Text style={{ color: colors.danger, marginTop: 6 }}>{error}</Text> : null}
            </View>
          )}

          <View style={{ height: 12 }} />

          <View style={{ flexDirection:'row', flexWrap:'wrap', marginHorizontal: -6 }}>
            <Action icon='share-social' label='Compartilhar' onPress={shareSystem} />
            <Action icon='logo-whatsapp' label='WhatsApp' onPress={shareWhatsApp} />
            <Action icon='mail' label='Email' onPress={shareEmail} />
            <Action icon='copy' label='Copiar links' onPress={copyLinks} />
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function Action({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ flexDirection:'row', alignItems:'center', borderWidth:1, borderColor: border, backgroundColor:'#fff', paddingVertical:10, paddingHorizontal:12, borderRadius: 12, marginHorizontal:6, marginBottom:12 }}>
      <Ionicons name={icon} size={18} color={primaryColor} style={{ marginRight: 6 }} />
      <Text style={{ color: primaryColor, fontWeight:'700' }}>{label}</Text>
    </TouchableOpacity>
  );
}