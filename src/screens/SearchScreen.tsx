import React, { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, StatusBar, StyleSheet, Image, Keyboard } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { MotiView } from 'moti';
import { C, T, SP, BORDER, rf } from '../theme/brutal';
import { AsciiDivider, Chip, CachedImage, ProductCard } from '../components/Brutal';
import { useZoom } from '../navigation/ZoomTransition';
import { PRODUCTS } from '../data/mockData';
import type { Product } from '../data/mockData';
import { listProducts } from '../services/catalog';
import { useApp } from '../state/AppState';

const RECENT = ['oversized blazer', 'cropped cargo', 'silk dress', 'sneakers'];
const TRENDING = ['Y2K', 'wide leg', 'cargo', 'mesh', 'utility', 'denim', 'satin', 'preppy'];


export default function SearchScreen() {
  const nav = useNavigation<any>();
  const [q, setQ] = useState('');
  const { night, theme, gender } = useApp();
  const { openZoom } = useZoom();
  const zoomRefs = useRef<{ [k: string]: any }>({});

  // Backend search (name ILIKE, gender-scoped), debounced 300ms. Falls back to a
  // local mock filter if the request fails.
  const [results, setResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    const term = q.trim();
    if (!term) { setResults([]); setSearching(false); return; }
    setSearching(true);
    let cancelled = false;
    const t = setTimeout(() => {
      listProducts({ search: term, gender, limit: 30 })
        .then((r) => { if (!cancelled) setResults(r); })
        .catch(() => {
          if (!cancelled) setResults(PRODUCTS.filter(p =>
            p.name.toLowerCase().includes(term.toLowerCase()) || p.brand.toLowerCase().includes(term.toLowerCase())));
        })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, gender]);

  return (
    <View key={night ? 'D' : 'L'} style={{ flex: 1, backgroundColor: night ? '#000000' : '#FFFFFF' }}>
      <StatusBar barStyle={night ? 'light-content' : 'dark-content'} />
      {/* HEADER */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SP.l, paddingTop: 56, paddingBottom: SP.m, gap: 10 }}>
        <View style={[{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: SP.m, paddingVertical: 12, gap: 10 }, BORDER(1)]}>
          <Feather name="search" size={16} color={C.ink} />
          <TextInput
            value={q}
            onChangeText={setQ}
            autoFocus
            placeholder="SEARCH FITS, BRANDS, VIBES..."
            placeholderTextColor={C.dim}
            style={{ flex: 1, fontFamily: 'SpaceMono_700Bold', fontSize: 11, color: C.ink, padding: 0, letterSpacing: 0.5 }}
          />
          {q.length > 0 && <Pressable onPress={() => setQ('')}><Feather name="x" size={14} color={C.ink} /></Pressable>}
        </View>
        <Pressable onPress={() => { Keyboard.dismiss(); nav.goBack(); }}>
          <Text style={[T.monoB, { fontSize: 11 }]}>{'[CANCEL]'}</Text>
        </Pressable>
      </View>
      <View style={{ height: 1, backgroundColor: C.ink }} />

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 60 }}>
        {q.length === 0 ? (
          <>
            <View style={{ paddingHorizontal: SP.l, paddingTop: SP.l }}>
              <Text style={[T.label]}>{'RECENT'}</Text>
              <AsciiDivider faint style={{ marginTop: 4 }} />
              {RECENT.map(r => (
                <Pressable key={r} onPress={() => setQ(r)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10 }}>
                  <Feather name="clock" size={14} color={C.dim} />
                  <Text style={[T.body, { flex: 1 }]}>{r}</Text>
                  <Feather name="arrow-up-left" size={14} color={C.dim} />
                </Pressable>
              ))}
            </View>

            <View style={{ paddingHorizontal: SP.l, marginTop: SP.l }}>
              <Text style={[T.label]}>{'TRENDING'}</Text>
              <AsciiDivider faint style={{ marginTop: 4 }} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {TRENDING.map((t, i) => <Chip key={t} label={`#${t}`} onPress={() => setQ(t)} />)}
              </View>
            </View>

            <View style={{ paddingHorizontal: SP.l, marginTop: SP.xl }}>
              <Text style={[T.label]}>{'POPULAR DROPS'}</Text>
              <AsciiDivider faint style={{ marginTop: 4 }} />
              {PRODUCTS.slice(0, 4).map((p, i) => (
                <MotiView key={p.id} from={{ opacity: 0, translateX: -10 }} animate={{ opacity: 1, translateX: 0 }} transition={{ delay: i * 60 }}>
                  <Pressable onPress={() => openZoom(zoomRefs.current['pd' + p.id], p.img, p)} style={s.row}>
                    <View ref={(el) => { zoomRefs.current['pd' + p.id] = el; }} collapsable={false} style={[{ width: 50, height: 50, overflow: 'hidden' }, BORDER(1)]}>
                      <CachedImage source={{ uri: p.img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[T.bodyB]} numberOfLines={1}>{p.name}</Text>
                      <Text style={[T.mono, { color: C.dim }]}>{p.brand} · ₹{p.price}</Text>
                    </View>
                    <Feather name="arrow-up-right" size={14} color={C.ink} />
                  </Pressable>
                </MotiView>
              ))}
            </View>
          </>
        ) : (
          <View style={{ paddingHorizontal: SP.l, paddingTop: SP.l }}>
            <Text style={[T.mono, { color: C.dim }]}>{searching ? `SEARCHING "${q.toUpperCase()}"…` : `${results.length} RESULTS FOR "${q.toUpperCase()}"`}</Text>
            <AsciiDivider style={{ marginTop: 6 }} />
            {!searching && results.length === 0 && <Text style={[T.body, { color: C.dim, marginTop: SP.l }]}>No results. Try a broader term.</Text>}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.s, marginTop: SP.m }}>
              {results.map((p, i) => (
                <MotiView key={p.id} from={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 50 }}>
                  <ProductCard p={p} style={{ marginBottom: SP.s }} />
                </MotiView>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
});
