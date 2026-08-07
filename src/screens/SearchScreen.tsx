// SEARCH — a full page that slides DOWN from the top when opened (and slides
// back up on close). The old in-place "expand the tapped bar" morph is gone:
// tapping any search bar just opens this page. Opened as a transparent modal
// (animation: none) so this screen drives its own top-to-bottom entrance.
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, FlatList, Pressable, TextInput, StatusBar, StyleSheet, Keyboard, Dimensions, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, interpolate, Easing, runOnJS } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { C, T, SP, BORDER } from '../theme/brutal';
import { Chip, CachedImage, ProductCard, CARD_STYLES} from '../components/Brutal';
import { useZoom } from '../navigation/ZoomTransition';
import { CatalogError } from '../components/CatalogState';
import { useCatalogProducts } from '../hooks/useCatalogProducts';
import type { Product } from '../data/mockData';
import { listProducts } from '../services/catalog';
import { useApp } from '../state/AppState';
import {
  getRecentSearches, addRecentSearch, removeRecentSearch, clearRecentSearches,
} from '../services/recentSearches';

const { height: H } = Dimensions.get('window');
// TRENDING stays a curated constant: there is no popular-search endpoint, and an
// editorial row is honest about being editorial. RECENT is not — it is the
// shopper's own history, so it comes from services/recentSearches.
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

  // Real recents, read once on mount and kept in sync as the shopper searches.
  const [recents, setRecents] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    getRecentSearches().then((r) => { if (!cancelled) setRecents(r); });
    return () => { cancelled = true; };
  }, []);

  /**
   * Record a term as searched.
   *
   * Called when the shopper SUBMITS, not on every keystroke — the results list
   * updates as you type, but "kenneth cole shirt" typed one letter at a time must
   * not leave twenty half-words in the history.
   */
  const commitSearch = useCallback((term: string) => {
    const clean = term.trim();
    if (!clean) return;
    addRecentSearch(clean).then(setRecents).catch(() => {});
  }, []);

  // ── slide-down entrance: 0 = parked above the screen, 1 = in place ──
  const p = useSharedValue(0);
  useEffect(() => {
    // Focus IMMEDIATELY — the input used to wait for the slide-in to finish
    // before asking for focus, so the keyboard didn't even start animating
    // until ~320ms in and search read as "slow to appear". The sheet slides
    // on the UI thread; the keyboard rises in parallel, like Instagram's.
    inputRef.current?.focus();
    p.value = withTiming(1, { duration: OPEN_MS, easing: Easing.out(Easing.cubic) });
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

  // Backend search (name ILIKE), debounced 300ms. No local fallback — a search
  // that cannot reach the catalog says so.
  const [results, setResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  /** True when the current results only exist outside the shopper's rail. */
  const [widened, setWidened] = useState(false);
  /** The last request failed (offline / server error), as opposed to matching nothing. */
  const [failed, setFailed] = useState(false);
  /** Bumped by the error state's Retry — the query text has not changed, so
   *  nothing else in the effect's deps would fire it again. */
  const [retryKey, setRetryKey] = useState(0);
  useEffect(() => {
    const term = q.trim();
    if (!term) { setResults([]); setSearching(false); setWidened(false); setFailed(false); return; }
    setSearching(true);
    setFailed(false);
    // Typing fast used to leave one un-abortable request per keystroke past the
    // debounce in flight; now each supersedes the last.
    const ac = new AbortController();
    let cancelled = false;
    const t = setTimeout(() => {
      /**
       * Search the shopper's rail first, then widen if it found nothing.
       *
       * Browsing is gendered; an explicit query is an explicit intent. Someone on
       * the HER rail typing "kenneth" was told "No results. Try a broader term."
       * while the shop stocked exactly that shirt under HIM — a broader term
       * would never have helped, because the term was not the problem.
       *
       * The rail still wins whenever it can answer, so a normal search is
       * unchanged; widening only rescues a query that would otherwise dead-end,
       * and says so on screen rather than quietly mixing the rails.
       */
      listProducts({ search: term, gender, limit: 30, signal: ac.signal })
        .then(async (r) => {
          if (cancelled) return;
          if (r.length > 0) { setResults(r); setWidened(false); return; }
          const all = await listProducts({ search: term, limit: 30, signal: ac.signal });
          if (cancelled) return;
          setResults(all);
          setWidened(all.length > 0);
        })
        .catch((e) => {
          if (cancelled || e?.code === 'aborted') return;
          // A failed search used to fall back to filtering the bundled demo
          // catalogue, so being offline produced eight confident "results" for
          // products the store does not sell. Say the search failed instead.
          setWidened(false);
          setResults([]);
          setFailed(true);
        })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, 300);
    return () => { cancelled = true; clearTimeout(t); ac.abort(); };
  }, [q, gender, retryKey]);

  // Suggestions-view rail: newest live listings on this rail, four of them.
  const { products: popularAll, status: popularStatus } = useCatalogProducts({ gender, sort: 'newest', limit: 4 });
  const popular = popularAll.slice(0, 4);

  const keyExtractor = useCallback((p: Product) => p.id, []);
  // Stagger only the first row's worth. Under virtualisation a per-index delay
  // makes rows scrolled into view fade in late, which reads as lag.
  const renderResult = useCallback(({ item, index }: { item: Product; index: number }) => (
    <MotiView
      from={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index < 6 ? index * 40 : 0 }}
    >
      <ProductCard p={item} style={CARD_STYLES.mb_s} />
    </MotiView>
  ), []);

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
              onSubmitEditing={() => commitSearch(q)}
              returnKeyType="search"
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
          {/* Results are their own VIRTUALISED list rather than a .map() inside the
              suggestions ScrollView. The two modes are mutually exclusive, so this
              costs no layout change and stops 30 cards (each previously wrapped in
              its own staggered Moti animation) mounting at once. */}
          {q.length > 0 ? (
            <FlatList
              data={results}
              keyExtractor={keyExtractor}
              renderItem={renderResult}
              numColumns={2}
              columnWrapperStyle={{ gap: SP.s }}
              keyboardShouldPersistTaps="handled"
              removeClippedSubviews={Platform.OS === 'android'}
              windowSize={5}
              initialNumToRender={6}
              maxToRenderPerBatch={6}
              contentContainerStyle={{ paddingTop: SP.l, paddingBottom: 60, paddingHorizontal: SP.l }}
              ListHeaderComponent={
                <View style={{ marginBottom: SP.m }}>
                  <Text style={[T.caption]}>{searching ? `Searching "${q}"…` : `${results.length} results for "${q}"`}</Text>
                  {/* Say so when the rail had nothing and we looked wider — the
                      shopper should know why they are seeing the other rail. */}
                  {!searching && widened && results.length > 0 && (
                    <Text style={[T.micro, { color: C.dim, marginTop: 4 }]}>
                      {`Nothing in ${gender === 'him' ? 'HIM' : 'HER'} — showing everything`}
                    </Text>
                  )}
                  {!searching && results.length === 0 && (
                    failed
                      ? <CatalogError onRetry={() => setRetryKey((k) => k + 1)} />
                      : <Text style={[T.body, { color: C.dim, marginTop: SP.l }]}>No results. Try a broader term.</Text>
                  )}
                </View>
              }
            />
          ) : (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: SP.l, paddingBottom: 60 }}>
            {(
              <>
                {/* Recent — hidden entirely when there is no history, rather than
                    padding the screen with someone else's searches. */}
                {recents.length > 0 && (
                  <View style={{ paddingHorizontal: SP.l }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SP.s }}>
                      <Text style={[T.h2, { textTransform: 'uppercase' }]}>Recent</Text>
                      <Pressable
                        onPress={() => { clearRecentSearches().then(() => setRecents([])).catch(() => {}); }}
                        hitSlop={8}
                      >
                        <Text style={[T.caption, { color: C.dim }]}>Clear</Text>
                      </Pressable>
                    </View>
                    {recents.map((r) => (
                      <Pressable
                        key={r}
                        onPress={() => { setQ(r); commitSearch(r); }}
                        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10 }}
                      >
                        <Feather name="clock" size={14} color={C.dim} />
                        <Text style={[T.body, { flex: 1 }]} numberOfLines={1}>{r}</Text>
                        <Pressable
                          onPress={() => { removeRecentSearch(r).then(setRecents).catch(() => {}); }}
                          hitSlop={12}
                        >
                          <Feather name="x" size={14} color={C.dim} />
                        </Pressable>
                      </Pressable>
                    ))}
                  </View>
                )}

                <View style={{ paddingHorizontal: SP.l, marginTop: SP.xl }}>
                  <Text style={[T.h2, { textTransform: 'uppercase', marginBottom: SP.m }]}>Trending</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {TRENDING.map((t) => (
                      <Chip key={t} label={`#${t}`} onPress={() => { setQ(t); commitSearch(t); }} />
                    ))}
                  </View>
                </View>

                {/* POPULAR DROPS — the newest live listings on the shopper's
                    rail. Was the first four bundled demo products, so every
                    shopper saw the same four items that were not for sale. */}
                {(popularStatus === 'loading' || popular.length > 0) && (
                <View style={{ paddingHorizontal: SP.l, marginTop: SP.xl }}>
                  <Text style={[T.h2, { textTransform: 'uppercase', marginBottom: SP.s }]}>Popular Drops</Text>
                  {popularStatus === 'loading' && (
                    <View style={{ gap: SP.s }}>
                      {[0, 1, 2, 3].map((i) => (
                        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
                          <View style={[{ width: 50, height: 50, backgroundColor: C.hairline }, BORDER(1)]} />
                          <View style={{ flex: 1, height: 12, backgroundColor: C.hairline }} />
                        </View>
                      ))}
                    </View>
                  )}
                  {popular.map((prod) => (
                    <Pressable key={prod.id} onPress={() => openZoom(zoomRefs.current['pd' + prod.id], prod.img, prod)} style={s.row}>
                      <View ref={(el) => { zoomRefs.current['pd' + prod.id] = el; }} collapsable={false} style={[{ width: 50, height: 50, overflow: 'hidden' }, BORDER(1)]}>
                        <CachedImage source={{ uri: prod.img }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[T.bodyB]} numberOfLines={1}>{prod.name}</Text>
                        <Text style={[T.caption]}>{prod.brand} · ₹{prod.price}</Text>
                      </View>
                      <Feather name="arrow-up-right" size={14} color={C.ink} />
                    </Pressable>
                  ))}
                </View>
                )}
              </>
            )}
          </ScrollView>
          )}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: SP.l },
});
