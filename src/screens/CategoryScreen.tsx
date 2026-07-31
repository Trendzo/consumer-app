import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Image, Dimensions, FlatList, Platform, StyleSheet } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect, StackActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LottieView from 'lottie-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C, T, SP, BORDER, rf } from '../theme/brutal';
import { BrutalStatusBar, CachedImage, FadeInUp, BrutalIconBtn, ProductCard, OptionSheet } from '../components/Brutal';
import { useZoom } from '../navigation/ZoomTransition';
import { useApp } from '../state/AppState';
import { HERO_IMG, HERO_IMG_2 } from '../data/mockData';
import { ProductGridSkeleton, CatalogEmpty, CatalogError } from '../components/CatalogState';
import type { Product } from '../data/mockData';
import { listProducts, listCategories, isBackendCategoryId } from '../services/catalog';
import { openLocationPicker, usePlace } from '../state/location';
import { placeLabel } from '../services/geo';

const { width: W, height: H } = Dimensions.get('window');
const FILTERS = ['ALL', 'NEW IN', 'TOPS', 'BOTTOMS', 'DRESSES', 'SHOES', 'BAGS'];
const SORTS = ['NEWEST', 'PRICE: LOW TO HIGH', 'PRICE: HIGH TO LOW', 'RATING'] as const;

/** The picker's wording → the API's sort keys. Sorting happens server-side, over the
 *  whole category, not just over the page we happen to have fetched. */
// Hoisted so every ProductCard / FadeInUp prop below is a STABLE reference.
// Inline object literals give React.memo a new prop identity on every render,
// which is why the memo boundary on ProductCard never fired here.
const S = StyleSheet.create({
  gridItem: { marginBottom: SP.m },
  listItem: { marginHorizontal: SP.l, marginBottom: SP.m },
  row: { flexDirection: 'row', backgroundColor: '#FFFFFF', overflow: 'hidden' },
  rowThumb: { width: 130, height: 160 },
});
// Corners are sharp app-wide; frozen so the prop identity never changes.
const CARD_FRAME = Object.freeze({ borderRadius: 0 });

const SORT_PARAM: Record<string, 'newest' | 'price_asc' | 'price_desc' | 'rating'> = {
  NEWEST: 'newest',
  'PRICE: LOW TO HIGH': 'price_asc',
  'PRICE: HIGH TO LOW': 'price_desc',
  RATING: 'rating',
};

export default function CategoryScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const place = usePlace();
  const label = route.params?.label || 'Category';
  const isFlash = route.params?.id === 'flash'; // flash-sale page gets a taller Lottie header
  // Carts take TURNS: left plays fully → right plays fully → repeat. Paused off-screen.
  const leftCart = useRef<any>(null);
  const rightCart = useRef<any>(null);
  const flashFocused = useRef(false);
  useFocusEffect(useCallback(() => {
    if (!isFlash) return;
    flashFocused.current = true;
    leftCart.current?.reset?.();
    leftCart.current?.play?.();
    return () => { flashFocused.current = false; leftCart.current?.pause?.(); rightCart.current?.pause?.(); };
  }, [isFlash]));
  const playRight = () => { if (flashFocused.current) { rightCart.current?.reset?.(); rightCart.current?.play?.(); } };
  const playLeft = () => { if (flashFocused.current) { leftCart.current?.reset?.(); leftCart.current?.play?.(); } };
  const { gender } = useApp();
  const { openZoom } = useZoom();
  const zoomRefs = useRef<Record<string, any>>({});
  const [filter, setFilter] = useState('ALL');
  const [sort, setSort] = useState('NEWEST');
  const [grid, setGrid] = useState<2 | 1>(2);
  const [activeOption, setActiveOption] = useState<string | null>(null);
  const [genderTab, setGenderTab] = useState<'MEN' | 'WOMEN'>('MEN');
  const [sheet, setSheet] = useState<null | 'sort' | 'gender' | 'filter'>(null);
  const insets = useSafeAreaInsets();
  // Live products for this category. The browser passes a real category — by slug for
  // a parent ("tops", which covers every sub-category under it) or a leaf
  // ("tops-tshirts"). Home-rail pseudo ids ('flash'/'trending'/'all') carry neither and
  // fall through to a gender-only browse. Shows a skeleton until loaded, an
  // empty state when the category has no live listings, and a retry on failure.
  const catId = route.params?.id as string | undefined;
  const catSlug = route.params?.slug as string | undefined;
  // Free-text narrowing, still used by Search and older home rails.
  const searchTerm = route.params?.search as string | undefined;

  /**
   * NOTE: the `label` declared above is defaulted to 'Category' for the heading.
   * This is the raw param — using the defaulted one would search for the literal
   * word "Category".
   */
  const rawLabel = route.params?.label as string | undefined;
  /** Pseudo ids that MEAN "everything" — they must stay unfiltered. */
  const UNFILTERED_RAILS = ['flash', 'trending', 'all', 'new'];
  /** What the user was actually shown as the search term, for the empty state. */
  const [usedSearch, setUsedSearch] = useState<string | undefined>(searchTerm);
  const [apiProducts, setApiProducts] = useState<Product[] | null>(null);
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    // Aborts on unmount AND on any parameter change, so a superseded sort no
    // longer downloads and parses 60 products nobody will look at.
    const ac = new AbortController();
    setStatus('loading');

    /**
     * Work out what to narrow by BEFORE asking for products.
     *
     * Several callers arrive with a real LABEL and a made-up id — Discover
     * Brands sends `{ id: 'brand-brd_123', label: 'NORTH.' }`, older rails send
     * `{ id: 'dresses', label: 'Dresses' }`. Neither is a `cat_…`, so the
     * categoryId filter was dropped and the query silently degraded to a plain
     * gender browse: the ENTIRE catalog, under the heading "Dresses". That does
     * not read as an unfiltered page, it reads as a category page that is wrong.
     *
     * So: resolve the label against the real category tree first. That is exact
     * (the backend genuinely has a "Dresses" category) and it beats a name
     * search, which is `name ILIKE` only and misses on plurals — searching
     * "Dresses" returns 0 because the products are called "… Dress".
     * A loose name search stays as the last resort for labels that are not
     * categories at all, so those end on an honest "No results for X".
     */
    (async () => {
      let categoryId = !catSlug && isBackendCategoryId(catId) ? catId : undefined;
      let search = searchTerm;

      const needsResolving =
        !catSlug && !categoryId && !search && !!rawLabel &&
        !UNFILTERED_RAILS.includes(String(catId ?? '').toLowerCase());

      if (needsResolving && rawLabel) {
        try {
          const cats = await listCategories(gender);
          const hit = cats.find((c) => c.label.toLowerCase() === rawLabel.toLowerCase());
          if (hit && isBackendCategoryId(hit.id)) categoryId = hit.id;
        } catch {
          /* offline — fall through to the search below */
        }
        if (!categoryId) search = rawLabel;
      }
      setUsedSearch(search);

      try {
        const rows = await listProducts({
          gender,
          ...(catSlug ? { categorySlug: catSlug } : {}),
          ...(categoryId ? { categoryId } : {}),
          ...(search ? { search } : {}),
          sort: SORT_PARAM[sort] ?? 'newest',
          limit: 60,
          signal: ac.signal,
        });
        setApiProducts(rows);
        setStatus('ready');
      } catch (e: any) {
        // An abort is this effect superseding itself, not a failure worth
        // showing — the replacement request is already in flight.
        if (e?.name === 'AbortError') return;
        setApiProducts([]);
        setStatus('error');
      }
    })();

    return () => ac.abort();
  }, [catId, catSlug, gender, searchTerm, rawLabel, sort, reloadKey]);
  // Open / close the shared OptionSheet (it owns its own slide + fade animation).
  const openSheet = (s: 'sort' | 'gender' | 'filter') => setSheet(s);
  const closeSheet = () => setSheet(null);

  /**
   * Backend rows, decorated only with what can be derived from them.
   *
   * The three fields that used to be invented here are gone. `rating` was
   * nudged by an index-derived amount (so a 4.2 became "4.55"), `reviews` was
   * `42 + (i*13)%800`, and `stock` was `5 + (i*11)%60` — which is where the
   * "Only 7 left" urgency badge came from. None of it was ever fetched. The
   * card projection has no stock figure at all, so the badge is gone with it.
   */
  const data = useMemo(() => (apiProducts ?? []).map((p, i) => ({
    ...p,
    // Index suffix keeps keys unique when the same listing appears twice in a
    // paged result; ProductDetail strips it back off.
    id: p.id + '-' + i,
    discount: p.original > p.price ? Math.round((1 - p.price / p.original) * 100) : 0,
  })), [apiProducts]);

  // The backend sorts — the effect re-queries whenever `sort` changes — so
  // there is nothing left to sort client-side now that the mock source is gone.
  const sorted = data;

  // (Removed: totalValue / avgPrice / newCount / hotCount — one reduce and two
  //  filter passes over up to 60 items on EVERY render, none of whose results
  //  were ever rendered.)
  // Sharp corners app-wide — no rounding on cards/tiles.
  const cardRadius = 0;
  // Header bg + its 0-alpha twin for the Lottie edge-fade gradients (fading to
  // 'transparent' = transparent BLACK causes a dark fringe; fading to the same
  // colour at alpha 0 keeps it clean).
  const HDR = '#FFFFFF';
  const HDR0 = 'rgba(255,255,255,0)';
  // Pink cart for HER — recolour the Lottie's layers via colorFilters (MEN keeps the originals).
  const cartFilters = genderTab === 'WOMEN'
    ? ['Cart 2/BLF3 Outlines', 'Orange/BLF3 Outlines', 'Red/BLF3 Outlines', 'Black/BLF3 Outlines'].map((keypath) => ({ keypath, color: '#FF3D77' }))
    : undefined;

  const zoomParams = useMemo(() => ({ brand: label }), [label]);
  const keyExtractor = useCallback((p: typeof sorted[number]) => p.id, []);
  const renderProduct = useCallback(({ item: p, index: i }: { item: typeof sorted[number]; index: number }) => (
    grid === 2 ? (
      <FadeInUp delay={(i % 6) * 30} style={S.gridItem}>
        {/* Global standard-size card — rank badge when sorted by rating */}
        <ProductCard
          p={p}
          brand={label}
          zoomParams={zoomParams}
          rank={sort === 'RATING' && i < 3 ? i + 1 : undefined}
          frameStyle={CARD_FRAME}
        />

      </FadeInUp>
    ) : (
      /* LIST VIEW — horizontal rows */
      <FadeInUp delay={(i % 6) * 30} style={S.listItem}>
        <Pressable onPress={() => openZoom(zoomRefs.current['l' + p.id], p.img, p, { brand: label })} style={[{ flexDirection: 'row', backgroundColor: C.white, overflow: 'hidden' }, BORDER(1)]}>
          <View ref={(el) => { zoomRefs.current['l' + p.id] = el; }} collapsable={false} style={{ width: 130, height: 160, backgroundColor: C.hairline, borderRightWidth: 1, borderColor: C.hairline }}>
            <CachedImage source={{ uri: p.img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
            {p.tag && (
              <View style={[{ position: 'absolute', top: 0, left: 0, paddingHorizontal: 6, paddingVertical: 3, backgroundColor: C.ink }]}>
                <Text style={[T.caption, { color: C.white }]}>{p.tag}</Text>
              </View>
            )}
          </View>
          <View style={{ flex: 1, padding: SP.m, justifyContent: 'space-between' }}>
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[T.caption, { color: C.ink }]}>{p.brand}</Text>
                {!!p.ratingCount && <Text style={[T.micro]}>{`${p.ratingCount} review${p.ratingCount === 1 ? '' : 's'}`}</Text>}
              </View>
              <Text style={[T.productName, { marginTop: 4 }]} numberOfLines={2}>{p.name}</Text>
              {/* Rating only when the product actually has one — an unrated
                  listing showed "★ 0" once the invented nudge was removed. */}
              {p.rating > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <Ionicons name="star" size={11} color={C.ink} />
                  <Text style={[T.caption, { color: C.ink }]}>{p.rating}</Text>
                </View>
              )}
            </View>
            <View>
              <Text style={[T.price]}>₹{p.price}</Text>
              {p.discount > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                  <Text style={[T.mrp]}>₹{p.original}</Text>
                  <Text style={[T.discount]}>{'-' + p.discount + '%'}</Text>
                </View>
              )}
            </View>
          </View>
        </Pressable>
      </FadeInUp>
    )
  ), [grid, label, sort, cardRadius, openZoom]);

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <BrutalStatusBar />
      {/* ═══ HEADER — exact same as Home: TRENDZO wordmark + location + theme/cart ═══ */}
      <View style={{ paddingTop: 56, paddingHorizontal: SP.l, paddingBottom: SP.m, backgroundColor: C.white }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1 }}>
            <Pressable onPress={() => nav.goBack()} hitSlop={10} style={{ paddingTop: 4 }}>
              <Feather name="arrow-left" size={22} color={C.ink} />
            </Pressable>
            <View>
              <Text style={[T.h1, { textTransform: 'uppercase' }]}>TRENDZO</Text>
              {/* Same real location as the home header — this said "Bandra, Mumbai 400050"
                  to every shopper. Tapping re-pins it on the map. */}
              <Pressable onPress={openLocationPicker} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 }}>
                <Feather name="map-pin" size={11} color={C.ink} />
                <Text style={[T.micro]}>Deliver to</Text>
                <Text style={[T.caption, { color: C.ink }]} numberOfLines={1}>{placeLabel(place)}</Text>
                <Feather name="chevron-down" size={13} color={C.ink} />
              </Pressable>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {/* ONE bag only — pop to the real Tabs first, then switch to the
                Bag tab (direct navigate from over a transparentModal makes iOS
                present a second Tabs as a sheet). */}
            <BrutalIconBtn
              icon="shopping-bag"
              onPress={() => {
                nav.dispatch(StackActions.popToTop());
                setTimeout(() => nav.navigate('Tabs', { screen: 'CartTab' }), 0);
              }}
            />
          </View>
        </View>

        {/* Flash-sale only — Lottie + title give the header extra height */}
        {isFlash && (
          <View style={{ height: 92, marginTop: SP.s, overflow: 'hidden' }}>
            {/* Carts at left & right, taking turns (never both at once) */}
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }} pointerEvents="none">
              <LottieView ref={leftCart} source={require('../../assets/flash-sale.json')} autoPlay={false} loop={false} onAnimationFinish={playRight} colorFilters={cartFilters} style={{ width: 78, height: 78 }} resizeMode="contain" />
              <LottieView ref={rightCart} source={require('../../assets/flash-sale.json')} autoPlay={false} loop={false} onAnimationFinish={playLeft} colorFilters={cartFilters} style={{ width: 78, height: 78 }} resizeMode="contain" />
            </View>
            {/* White fades on all 4 sides (0-alpha header colour → no dark fringe) */}
            <LinearGradient colors={[HDR, HDR0]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 30 }} pointerEvents="none" />
            <LinearGradient colors={[HDR0, HDR]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 30 }} pointerEvents="none" />
            <LinearGradient colors={[HDR, HDR0]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 16 }} pointerEvents="none" />
            <LinearGradient colors={[HDR0, HDR]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 16 }} pointerEvents="none" />
            {/* Centered FLASH SALE text on top (pink for her) */}
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
              <Text style={[T.h1, { textTransform: 'uppercase', textAlign: 'center' }]}>FLASH SALE</Text>
              <Text style={[T.micro, { color: C.ink, marginTop: 4, textAlign: 'center' }]}>Up to 70% off · Ends soon</Text>
            </View>
          </View>
        )}
      </View>
      <View style={{ height: 1, backgroundColor: C.hairline }} />

      {/* Virtualised: the grid used to mount all 60 cards at once, each wrapped in
          a Moti animation. numColumns cannot change on a live FlatList, so `key`
          forces a fresh list when the user flips grid/list mode. */}
      <FlatList
        key={grid === 2 ? 'grid2' : 'list1'}
        data={sorted}
        renderItem={renderProduct}
        keyExtractor={keyExtractor}
        numColumns={grid === 2 ? 2 : 1}
        {...(grid === 2 ? { columnWrapperStyle: { gap: SP.s } } : {})}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={Platform.OS === 'android'}
        windowSize={5}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        updateCellsBatchingPeriod={60}
        contentContainerStyle={{ paddingBottom: 120, ...(grid === 2 ? { paddingHorizontal: SP.l } : {}) }}
        ListHeaderComponent={
      <View>
        {/* ═══ QUICK OPTIONS — Myntra-style tiles (above the banner) ═══ */}
        <View style={{ flexDirection: 'row', paddingHorizontal: SP.l, paddingTop: SP.m, gap: SP.s }}>
          {[
            { key: 'express', icon: 'zap', label: 'Express\nDelivery' },
            { key: 'top', icon: 'award', label: 'Top\nBrands' },
            { key: 'best', icon: 'trending-up', label: 'Best\nSellers' },
          ].map(o => {
            const on = activeOption === o.key;
            return (
              <Pressable key={o.key} onPress={() => setActiveOption(on ? null : o.key)} style={{ flex: 1 }}>
                <View style={[{ paddingVertical: SP.m, alignItems: 'center', gap: 6, backgroundColor: on ? C.ink : C.white }, BORDER(1), { borderRadius: cardRadius }]}>
                  <Feather name={o.icon as any} size={18} color={on ? C.white : C.ink} />
                  <Text style={[T.micro, { color: on ? C.white : C.ink, textAlign: 'center' }]}>{o.label}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* ═══ STORE BANNER CAROUSEL — swipable, auto-rotating (below the tiles) ═══ */}
        <CategoryBanner label={label} cardRadius={cardRadius} />
        <View style={{ height: SP.l }} />
      </View>
        }
        ListEmptyComponent={
          status === 'loading' ? (
            <View style={{ paddingHorizontal: grid === 2 ? 0 : SP.l, paddingTop: SP.m }}>
              <ProductGridSkeleton count={4} />
            </View>
          ) : status === 'error' ? (
            <CatalogError onRetry={() => setReloadKey((k) => k + 1)} />
          ) : (
            <CatalogEmpty
              title="Nothing in stock here"
              sub={usedSearch ? `No results for "${usedSearch}".` : 'This category has no live listings right now.'}
            />
          )
        }
        ListFooterComponent={
        /* ═══ END-OF-FEED CALLOUT — only under an actual feed ═══ */
        sorted.length > 0 ? (
          <View style={{ marginHorizontal: SP.l, marginTop: SP.xl, padding: SP.l, alignItems: 'center' }}>
            <Text style={[T.caption, { color: C.ink }]}>End of feed</Text>
            <Text style={[T.micro, { marginTop: 4, textAlign: 'center' }]}>{'More drops incoming · Check back in 60 min'}</Text>
          </View>
        ) : null
        }
      />


      {/* ═══ STICKY BOTTOM BAR — Sort · Men/Women · Filter (Myntra-style) ═══ */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: C.white, borderTopWidth: 1, borderColor: C.hairline, paddingBottom: insets.bottom }}>
        <Pressable onPress={() => openSheet('sort')} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14 }}>
          <Feather name="sliders" size={15} color={C.ink} />
          <Text style={[T.caption, { color: C.ink }]} numberOfLines={1}>Sort</Text>
        </Pressable>
        <View style={{ width: 1, backgroundColor: C.hairline }} />
        <Pressable onPress={() => openSheet('gender')} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14 }}>
          <Feather name="users" size={15} color={C.ink} />
          <Text style={[T.caption, { color: C.ink }]}>{genderTab}</Text>
        </Pressable>
        <View style={{ width: 1, backgroundColor: C.hairline }} />
        <Pressable onPress={() => openSheet('filter')} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14 }}>
          <Feather name="filter" size={15} color={C.ink} />
          <Text style={[T.caption, { color: C.ink }]} numberOfLines={1}>{filter === 'ALL' ? 'Filter' : filter}</Text>
        </Pressable>
      </View>

      {/* ═══ BOTTOM SHEETS — shared OptionSheet (list mode) for Sort / Gender / Filter ═══ */}
      <OptionSheet
        visible={sheet === 'sort'}
        title="Sort by"
        options={SORTS}
        selected={sort}
        onSelect={(v) => { setSort(v); closeSheet(); }}
        onClose={closeSheet}
      />
      <OptionSheet
        visible={sheet === 'gender'}
        title="Shop for"
        options={['MEN', 'WOMEN']}
        selected={genderTab}
        onSelect={(v) => { setGenderTab(v as 'MEN' | 'WOMEN'); closeSheet(); }}
        onClose={closeSheet}
      />
      <OptionSheet
        visible={sheet === 'filter'}
        title="Filter"
        options={FILTERS}
        selected={filter}
        onSelect={(v) => { setFilter(v); closeSheet(); }}
        onClose={closeSheet}
      />
    </View>
  );
}

// ─── STORE BANNER CAROUSEL — swipable, auto-rotating banners for the category/brand ───
const CAT_BANNER_3 = 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=900&q=80&auto=format&fit=crop';
function CategoryBanner({ label, cardRadius }: { label: string; cardRadius: number }) {
  const slides = [
    { img: HERO_IMG, kicker: 'Trendzo · Store', title: label },
    { img: HERO_IMG_2, kicker: 'Limited offer', title: 'Extra 10% off' },
    { img: CAT_BANNER_3, kicker: '60-min delivery', title: 'Free shipping' },
  ];
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);
  // Auto-rotate only while focused (no GPU waste off-screen).
  useFocusEffect(useCallback(() => {
    const t = setInterval(() => {
      setIndex(prev => {
        const next = (prev + 1) % slides.length;
        listRef.current?.scrollToOffset({ offset: next * W, animated: true });
        return next;
      });
    }, 3500);
    return () => clearInterval(t);
  }, [slides.length]));

  return (
    <View style={{ marginTop: SP.m }}>
      <FlatList
        ref={listRef}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        getItemLayout={(_, i) => ({ length: W, offset: W * i, index: i })}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / W))}
        renderItem={({ item }) => (
          <View style={{ width: W }}>
            <View style={[{ marginHorizontal: SP.l, height: 110, overflow: 'hidden', backgroundColor: C.ink }, BORDER(1), { borderRadius: cardRadius }]}>
              <CachedImage source={{ uri: item.img }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} resizeMode="cover" />
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.42)' }} />
              <View style={{ flex: 1, padding: SP.m, justifyContent: 'flex-end' }}>
                <Text style={[T.caption, { color: C.white, opacity: 0.85 }]}>{item.kicker}</Text>
                <Text style={[T.h1, { color: C.white, letterSpacing: -1, marginTop: 2 }]} numberOfLines={1}>{item.title}</Text>
              </View>
            </View>
          </View>
        )}
      />
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: SP.s }}>
        {slides.map((_, i) => (
          <View key={i} style={{ width: i === index ? 18 : 6, height: 5, backgroundColor: i === index ? C.ink : C.faint }} />
        ))}
      </View>
    </View>
  );
}

// ─── Small helpers for the stats strip inside the hero ────────
function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={[T.h3, { color: C.white }]}>{value}</Text>
      <Text style={[T.micro, { color: C.white, opacity: 0.5, marginTop: 2 }]}>{label}</Text>
    </View>
  );
}
function StatDivider() {
  return <View style={{ width: 1, backgroundColor: C.white, opacity: 0.3, marginVertical: 4 }} />;
}
