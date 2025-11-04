import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

function humanBytes(bytes: number) {
  if (!bytes && bytes !== 0) return '?';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let i = -1;
  let v = bytes;
  do {
    v = v / 1024;
    i++;
  } while (v >= 1024 && i < units.length - 1);
  return `${(v).toFixed(2)} ${units[i]}`;
}

export default function StorageUsageCard({ userId, apiBase, onOpenUpgrade, variant }: { userId: string; apiBase?: string; onOpenUpgrade?: (mode: 'upgrade' | 'buy-storage') => void; variant?: 'default' | 'header' }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [used, setUsed] = useState<number | null>(null);
  const [quota, setQuota] = useState<number | null>(null);

  async function load() {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const base = apiBase || process.env.EXPO_PUBLIC_API_BASE || process.env.EXPO_PUBLIC_API_BASE_URL || (typeof window !== 'undefined' ? (window as any).location.origin : '');
      const res = await fetch(`${base}/.netlify/functions/usage?user_id=${encodeURIComponent(userId)}`);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const j = await res.json();
      setUsed(typeof j.used_bytes === 'number' ? j.used_bytes : null);
      setQuota(typeof j.effective_quota_bytes === 'number' ? j.effective_quota_bytes : null);
    } catch (e: any) {
      console.warn('[StorageUsageCard] load error', e);
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [userId]);

  const pctUsed = (used !== null && quota) ? Math.min(100, Math.round((used / Math.max(1, quota)) * 100)) : null;
  const remaining = (used !== null && quota !== null) ? Math.max(0, quota - used) : null;
  const pctRemaining = (remaining !== null && quota !== null) ? Math.max(0, Math.min(100, Math.round((remaining / Math.max(1, quota)) * 100))) : null;
  const dangerThreshold = 1 * 1024 * 1024 * 1024; // 1GB
  const color = (() => {
    if (remaining === null || quota === null) return '#9CA3AF';
    if (remaining <= dangerThreshold) return '#DC2626'; // vermelho
    if (remaining < quota / 2) return '#D97706'; // amarelo
    return '#22C55E'; // verde
  })();

  if (variant === 'header') {
    return (
      <View style={{ flexDirection:'row', alignItems:'center' }}>
        {loading ? (
          <Text style={{ color:'#6B7280' }}>Carregando…</Text>
        ) : error ? (
          <Text style={{ color:'#DC2626' }}>{error}</Text>
        ) : (
          <View style={{ flexDirection:'row', alignItems:'center' }}>
            <View style={{ width:80, height:8, backgroundColor:'#E5E7EB', borderRadius:9999, overflow:'hidden', marginRight:8 }}>
              <View style={{ width: pctRemaining !== null ? `${pctRemaining}%` : '0%', height:8, backgroundColor: color }} />
            </View>
            <Text style={{ color:'#374151' }}>{remaining !== null ? `${humanBytes(remaining)}` : '—'}</Text>
          </View>
        )}
        <TouchableOpacity onPress={() => onOpenUpgrade && onOpenUpgrade(remaining !== null && remaining <= dangerThreshold ? 'buy-storage' : 'upgrade')} style={{ marginLeft:8, paddingHorizontal:10, paddingVertical:6, borderRadius:8, borderWidth:1, borderColor:'#D1D5DB', backgroundColor:'#fff' }}>
          <Text style={{ color:'#111827', fontWeight:'700' }}>Upgrade</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ padding:12, backgroundColor:'#fff', borderRadius:10, borderWidth:1, borderColor:'#E5E7EB', marginHorizontal:16, marginTop:12 }}>
      <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
        <View>
          <Text style={{ fontSize:14, fontWeight:'700' }}>Armazenamento</Text>
          {loading ? (
            <Text style={{ marginTop:4, color:'#6B7280' }}>Carregando…</Text>
          ) : error ? (
            <Text style={{ marginTop:4, color:'#DC2626' }}>{error}</Text>
          ) : (
            <Text style={{ marginTop:4, color:'#6B7280' }}>{remaining !== null && quota !== null ? `Restante: ${humanBytes(remaining)} de ${humanBytes(quota)}` : '—'}</Text>
          )}
        </View>
        <View style={{ alignItems:'flex-end' }}>
          <TouchableOpacity onPress={() => onOpenUpgrade && onOpenUpgrade(remaining !== null && remaining <= dangerThreshold ? 'buy-storage' : 'upgrade')} style={{ backgroundColor:'#111827', paddingHorizontal:12, paddingVertical:8, borderRadius:8 }}>
            <Text style={{ color:'#fff', fontWeight:'700' }}>Upgrade</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ height:10, marginTop:12, backgroundColor:'#F3F4F6', borderRadius:6, overflow:'hidden' }}>
        <View style={{ height:10, width: pctRemaining !== null ? `${pctRemaining}%` : '0%', backgroundColor: color }} />
      </View>

      <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop:8 }}>
        <Text style={{ color:'#6B7280' }}>{pctRemaining !== null ? `${pctRemaining}% restante` : ''}</Text>
        <View style={{ flexDirection:'row' }}>
          <TouchableOpacity onPress={() => onOpenUpgrade && onOpenUpgrade('buy-storage')} style={{ borderWidth:1, borderColor:'#D1D5DB', paddingHorizontal:10, paddingVertical:6, borderRadius:8, marginRight:8 }}>
            <Text>Comprar armazenamento</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={load} style={{ borderWidth:1, borderColor:'#D1D5DB', paddingHorizontal:10, paddingVertical:6, borderRadius:8 }}>
            <Text>Atualizar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}