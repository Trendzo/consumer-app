// SEARCH — a full page that slides DOWN from the top when opened (and slides
// back up on close). The old in-place "expand the tapped bar" morph is gone:
// tapping any search bar just opens this page. Opened as a transparent modal
// (animation: none) so this screen drives its own top-to-bottom entrance.
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, StatusBar, StyleSheet, Keyboard, Dimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, interpolate, Easing, runOnJS } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { C, T, SP, BORDER } from '../theme/brutal';
import { Chip, CachedImage, ProductCard } from '../components/Brutal';
import { useZoom } from '../navigation/ZoomTransition';
import { PRODUCTS } from '../data/mockData';
import type { Product } from '../data/mockData';
import { listProducts } from '../services/catalog';
import { useApp } from '../state/AppState';

const { height: H } = Dimensions.get('window');
const RECENT = ['oversized blazer', 'cropped cargo', 'silk dress', 'sneakers'];
const TRENDING = ['Y2K', 'wide leg', 'cargo', 'mesh', 'utility', 'denim', 'satin', 'preppy'];
const OPEN_MS = 340;
const CLOSE_MS = 280;
const BAR_H = 46;

export default function SearchScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [q, setQ] = useState('');
  const { gender } = useApp();
  const { openZoom } = useZoom();
  const zoomRefs = useRef<{ [k: string]: any }>({});
  const inputRef = useRef<TextInput>(null);
  const closing = useRef(false);

  // ── slide-down entrance: 0 = parked above the screen, 1 = in place ──
  const p = useSharedValue(0);
  const focusInput = () => inputRef.current?.focus();
  useEffect(() => {
    p.value = withTiming(1, { duration: OPEN_MS, easing: Easing.out(Easing.cubic) }, (fin) => {
      if (fin) runOnJS(focusInput)();
    });
  }, []);
  const goClose = () => {
    if (closing.current) return;
    closing.current = true;
    Keyboard.dismiss();
    p.value = withTiming(0, { duration: CLOSE_MS, easing: Easing.in(Easing.cubic) }, (fin) => {
      if (fin) runOnJS(nav.goBack)();
    });
  };

  // Whole sheet rides down from above; content fades in on the tail end.
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(p.value, [0, 1], [-H, 0]) }],
  }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.55, 1], [0, 1], 'clamp'),
    transform: [{ translateY: interpolate(p.value, [0.55, 1], [10, 0], 'clamp') }],
  }));

  // Backend search (name ILIKE, gender-scoped), debounced 300ms; mock fallback.
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
          if (!cancelled) setResults(PRODUCTS.filter(p2 =>
            p2.name.toLowerCase().includes(term.toLowerCase()) || p2.brand.toLowerCase().includes(term.toLowerCase())));
        })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, gender]);

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      <StatusBar barStyle="dark-content" />

      {/* The whole search page is ONE white sheet sliding in from the top */}
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#FFFFFF' }, sheetStyle]}>
        {/* ── Header: search bar + cancel, static inside the sheet ── */}
        <View style={{ paddingTop: insets.top + 8, paddingHorizontal: SP.l, paddingBottom: SP.s, flexDirection: 'row', alignItems: 'center', gap: SP.m, backgroundColor: '#FFFFFF' }}>
          <View style={[{ flex: 1, height: BAR_H, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: SP.m, gap: 10 }, BORDER(1)]}>
            <Feather name="search" size={16} color={C.ink} />
            <TextInput
              ref={inputRef}
              value={q}
              onChangeText={setQ}
              placeholder="Search fits, brands, vibes..."
              placeholderTextColor={C.dim}
              style={[T.body, { flex: 1, padding: 0 }]}
            />
            {q.length > 0 && <Pressable onPress={() => setQ('')} hitSlop={8}><Feather name="x" size={14} color={C.ink} /></Pressable>}
          </View>
          <Pressable onPress={goClose} hitSlop={8}>
            <Text style={[T.button, { color: C.ink }]}>Cancel</Text>
          </Pressable>
        </View>
        <View style={{ height: 1, backgroundColor: C.hairline }} />

        {/* ── Content ── */}
        <Animated.View style={[{ flex: 1 }, contentStyle]}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: SP.l, paddingBottom: 60 }}>
            {q.length === 0 ? (
              <>
                <View style={{ paddingHorizontal: SP.l }}>
                  <Text style={[T.h2, { textTransform: 'uppercase', marginBottom: SP.s }]}>Recent</Text>
                  {RECENT.map(r => (
                    <Pressable key={r} onPress={() => setQ(r)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10 }}>
                      <Feather name="clock" size={14} color={C.dim} />
                      <Text style={[T.body, { flex: 1 }]}>{r}</Text>
                      <Feather name="arrow-up-left" size={14} color={C.dim} />
                    </Pressable>
                  ))}
                </View>

                <View style={{ paddingHorizontal: SP.l, marginTop: SP.xl }}>
                  <Text style={[T.h2, { textTransform: 'uppercase', marginBottom: SP.m }]}>Trending</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {TRENDING.map((t) => <Chip key={t} label={`#${t}`} onPress={() => setQ(t)} />)}
                  </View>
                </View>

                <View style={{ paddingHorizontal: SP.l, marginTop: SP.xl }}>
                  <Text style={[T.h2, { textTransform: 'uppercase', marginBottom: SP.s }]}>Popular Drops</Text>
                  {PRODUCTS.slice(0, 4).map((prod) => (
                    <Pressable key={prod.id} onPress={() => openZoom(zoomRefs.current['pd' + prod.id], prod.img, prod)} style={s.row}>
                      <View ref={(el) => { zoomRefs.current['pd' + prod.id] = el; }} collapsable={false} style={[{ width: 50, height: 50, overflow: 'hidden' }, BORDER(1)]}>
                        <CachedImage source={{ uri: prod.img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[T.bodyB]} numberOfLines={1}>{prod.name}</Text>
                        <Text style={[T.caption]}>{prod.brand} · ₹{prod.price}</Text>
                      </View>
                      <Feather name="arrow-up-right" size={14} color={C.ink} />
                    </Pressable>
                  ))}
                </View>
              </>
            ) : (
              <View style={{ paddingHorizontal: SP.l }}>
                <Text style={[T.caption]}>{searching ? `Searching "${q}"…` : `${results.length} results for "${q}"`}</Text>
                {!searching && results.length === 0 && <Text style={[T.body, { color: C.dim, marginTop: SP.l }]}>No results. Try a broader term.</Text>}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.s, marginTop: SP.m }}>
                  {results.map((prod, i) => (
                    <MotiView key={prod.id} from={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 40 }}>
                      <ProductCard p={prod} style={{ marginBottom: SP.s }} />
                    </MotiView>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: SP.l },
});
