// SEARCH — the tapped search bar (hero or floating) EXPANDS in place into the
// full search view. Opened as a transparent modal with a measured `_frame`:
// a white sheet fades Home out, the search bar flies/grows from that frame to
// the top, and the content (recent · trending · popular / results) fades up.
// Back reverses it. If no frame is passed it just appears normally.
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, StatusBar, StyleSheet, Keyboard, Dimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, interpolate, Easing, runOnJS } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { C, T, SP, BORDER } from '../theme/brutal';
import { Chip, CachedImage, ProductCard } from '../components/Brutal';
import { useZoom } from '../navigation/ZoomTransition';
import { PRODUCTS } from '../data/mockData';
import type { Product } from '../data/mockData';
import { listProducts } from '../services/catalog';
import { useApp } from '../state/AppState';

const { width: W } = Dimensions.get('window');
const RECENT = ['oversized blazer', 'cropped cargo', 'silk dress', 'sneakers'];
const TRENDING = ['Y2K', 'wide leg', 'cargo', 'mesh', 'utility', 'denim', 'satin', 'preppy'];
const MS = 300;

export default function SearchScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const frame = route.params?._frame as { x: number; y: number; w: number; h: number } | undefined;
  const hasFrame = !!frame;

  const [q, setQ] = useState('');
  const { gender } = useApp();
  const { openZoom } = useZoom();
  const zoomRefs = useRef<{ [k: string]: any }>({});
  const inputRef = useRef<TextInput>(null);
  const closing = useRef(false);

  // ── morph geometry ──
  const BAR_H = 46;
  const CANCEL_W = 68;
  const FINAL_TOP = insets.top + 8;
  const FINAL_LEFT = SP.l;
  const FINAL_W = W - SP.l - CANCEL_W - SP.l;
  const f = frame ?? { x: FINAL_LEFT, y: FINAL_TOP, w: FINAL_W, h: BAR_H };

  const p = useSharedValue(hasFrame ? 0 : 1);
  // On CLOSE, force the white sheet + results to fade out fast (independent of
  // the bar's shrink) so Home is revealed immediately — no lingering white
  // flash over the hero. 0 = normal, 1 = force-hidden.
  const sheetOut = useSharedValue(0);
  const focusInput = () => inputRef.current?.focus();
  useEffect(() => {
    if (hasFrame) {
      p.value = withTiming(1, { duration: MS, easing: Easing.out(Easing.cubic) }, (fin) => { if (fin) runOnJS(focusInput)(); });
    } else {
      focusInput();
    }
  }, []);
  const goClose = () => {
    if (closing.current) return;
    closing.current = true;
    Keyboard.dismiss();
    if (!hasFrame) return nav.goBack();
    // Reveal Home fast: the white sheet + results clear in ~150ms while the
    // search bar keeps morphing back down to its original spot.
    sheetOut.value = withTiming(1, { duration: 150, easing: Easing.out(Easing.cubic) });
    p.value = withTiming(0, { duration: MS - 60, easing: Easing.in(Easing.cubic) }, (fin) => { if (fin) runOnJS(nav.goBack)(); });
  };

  const sheetStyle = useAnimatedStyle(() => ({ opacity: interpolate(p.value, [0, 0.5], [0, 1], 'clamp') * (1 - sheetOut.value) }));
  const barStyle = useAnimatedStyle(() => ({
    top: interpolate(p.value, [0, 1], [f.y, FINAL_TOP]),
    left: interpolate(p.value, [0, 1], [f.x, FINAL_LEFT]),
    width: interpolate(p.value, [0, 1], [f.w, FINAL_W]),
    height: interpolate(p.value, [0, 1], [f.h, BAR_H]),
  }));
  const cancelStyle = useAnimatedStyle(() => ({ opacity: interpolate(p.value, [0.6, 1], [0, 1], 'clamp') }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.45, 1], [0, 1], 'clamp') * (1 - sheetOut.value),
    transform: [{ translateY: interpolate(p.value, [0.45, 1], [16, 0], 'clamp') }],
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

      {/* white sheet fades Home out */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#FFFFFF' }, sheetStyle]} />

      {/* content — behind the floating bar */}
      <Animated.View style={[{ flex: 1 }, contentStyle]}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: FINAL_TOP + BAR_H + 14, paddingBottom: 60 }}>
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

      {/* Cancel — fades in on the back half */}
      <Animated.View style={[{ position: 'absolute', top: FINAL_TOP, right: SP.l, height: BAR_H, justifyContent: 'center' }, cancelStyle]}>
        <Pressable onPress={goClose} hitSlop={8}><Text style={[T.button, { color: C.ink }]}>Cancel</Text></Pressable>
      </Animated.View>

      {/* the morphing search bar — flies/grows from the tapped frame */}
      <Animated.View style={[{ position: 'absolute', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: SP.m, gap: 10 }, BORDER(1), barStyle]}>
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
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: SP.l },
});
