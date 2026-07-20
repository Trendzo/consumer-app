import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Image, Dimensions, Modal, FlatList, Platform } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import LottieView from 'lottie-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C, T, SP, BORDER, rf } from '../theme/brutal';
import { ScreenHeader, AsciiDivider, BrutalStatusBar, CachedImage, FadeInUp, BrutalIconBtn, ProductCard } from '../components/Brutal';
import { useZoom } from '../navigation/ZoomTransition';
import { useApp } from '../state/AppState';
import { PRODUCTS, HERO_IMG, HERO_IMG_2 } from '../data/mockData';
import type { Product } from '../data/mockData';
import { listProducts, isBackendCategoryId } from '../services/catalog';

const { width: W, height: H } = Dimensions.get('window');
const FILTERS = ['ALL', 'NEW IN', 'TOPS', 'BOTTOMS', 'DRESSES', 'SHOES', 'BAGS'];
const SORTS = ['NEWEST', 'PRICE ↑', 'PRICE ↓', 'RATING'];

export default function CategoryScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
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
  const { night, toggleNight, gender } = useApp();
  const { openZoom } = useZoom();
  const zoomRefs = useRef<Record<string, any>>({});
  const [filter, setFilter] = useState('ALL');
  const [sort, setSort] = useState('NEWEST');
  const [grid, setGrid] = useState<2 | 1>(2);
  const [activeOption, setActiveOption] = useState<string | null>(null);
  const [genderTab, setGenderTab] = useState<'MEN' | 'WOMEN'>('MEN');
  const [sheet, setSheet] = useState<null | 'sort' | 'gender' | 'filter'>(null);
  const [shown, setShown] = useState(false); // drives the slide up / down
  const insets = useSafeAreaInsets();
  // Live products for this category from the backend. A real category tile passes
  // a `cat_…` id → filter by it; home-rail pseudo ids ('flash'/'trending'/'all')
  // → gender-only browse. Falls back to mock until loaded / on failure.
  const catId = route.params?.id as string | undefined;
  // Optional narrowing term — the category browser passes it for subcategory
  // ("T-Shirts") and colour ("Black") tiles; backend filters name ILIKE.
  const searchTerm = route.params?.search as string | undefined;
  const [apiProducts, setApiProducts] = useState<Product[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    listProducts({ gender, categoryId: isBackendCategoryId(catId) ? catId : undefined, search: searchTerm, limit: 60 })
      .then((list) => { if (!cancelled) setApiProducts(list); })
      .catch(() => { /* keep mock fallback */ });
    return () => { cancelled = true; };
  }, [catId, gender, searchTerm]);
  // Remember the last-opened sheet so the CLOSING fade keeps showing the same content
  // (otherwise `sheet` becomes null and the ternaries flash the FILTER sheet mid-close).
  const lastSheet = useRef<'sort' | 'gender' | 'filter'>('sort');
  if (sheet) lastSheet.current = sheet;
  const activeSheet = lastSheet.current;
  // Open = mount modal + slide up. Close = slide down, then unmount after the slide.
  const openSheet = (s: 'sort' | 'gender' | 'filter') => { setSheet(s); setShown(true); };
  const closeSheet = () => { setShown(false); setTimeout(() => setSheet(null), 280); };

  // Inflate catalog & generate deterministic "random-ish" extras. Uses the live
  // backend products for this category when available, else the mock catalog.
  const data = useMemo(() => {
    const source = (apiProducts && apiProducts.length)
      ? apiProducts
      : [...PRODUCTS, ...PRODUCTS, ...PRODUCTS];
    return source.map((p, i) => ({
      ...p,
      id: p.id + '-' + i,
      rating: Number(((p.rating || 4.2) + ((i * 7) % 10) / 20).toFixed(1)),
      reviews: 42 + ((i * 13) % 800),
      discount: Math.round((1 - p.price / p.original) * 100),
      stock: 5 + ((i * 11) % 60),
    }));
  }, [apiProducts]);

  // Sort based on selected SORT
  const sorted = useMemo(() => {
    const arr = [...data];
    if (sort === 'PRICE ↑') arr.sort((a, b) => a.price - b.price);
    else if (sort === 'PRICE ↓') arr.sort((a, b) => b.price - a.price);
    else if (sort === 'RATING') arr.sort((a, b) => b.rating - a.rating);
    return arr;
  }, [sort, data]);

  const totalValue = data.reduce((s, p) => s + p.price, 0);
  const avgPrice = Math.round(totalValue / data.length);
  const newCount = data.filter(p => p.tag === 'NEW').length;
  const hotCount = data.filter(p => p.tag === 'HOT').length;
  // WOMEN mode rounds the cards/tiles (the app's soft "her" look); MEN stays sharp.
  const cardRadius = genderTab === 'WOMEN' ? 14 : 0;
  // Header bg + its 0-alpha twin for gradients (fading to 'transparent' = transparent BLACK
  // causes a dark fringe; fading to the same colour at alpha 0 keeps it clean).
  const HDR = night ? '#1a1a1a' : '#FFFFFF';
  const HDR0 = night ? 'rgba(26,26,26,0)' : 'rgba(255,255,255,0)';
  // Pink cart for HER — recolour the Lottie's layers via colorFilters (MEN keeps the originals).
  const cartFilters = genderTab === 'WOMEN'
    ? ['Cart 2/BLF3 Outlines', 'Orange/BLF3 Outlines', 'Red/BLF3 Outlines', 'Black/BLF3 Outlines'].map((keypath) => ({ keypath, color: '#FF3D77' }))
    : undefined;

  return (
    <View key={night ? 'D' : 'L'} style={{ flex: 1, backgroundColor: night ? '#0a0a0a' : '#FFFFFF' }}>
      <BrutalStatusBar />
      {/* ═══ HEADER — exact same as Home: TRENDZO wordmark + location + theme/cart ═══ */}
      <View style={{ paddingTop: 56, paddingHorizontal: SP.l, paddingBottom: SP.m, backgroundColor: C.white }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1 }}>
            <Pressable onPress={() => nav.goBack()} hitSlop={10} style={{ paddingTop: 4 }}>
              <Feather name="arrow-left" size={22} color={C.ink} />
            </Pressable>
            <View>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(26), color: C.ink, letterSpacing: -1 }}>TRENDZO</Text>
              <Pressable onPress={() => nav.navigate('SavedAddresses')} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 }}>
                <Feather name="map-pin" size={11} color={C.ink} />
                <Text style={[T.mono, { color: C.dim, fontSize: 10 }]}>Deliver to</Text>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: C.ink, letterSpacing: -0.2 }} numberOfLines={1}>Bandra, Mumbai 400050</Text>
                <Feather name="chevron-down" size={13} color={C.ink} />
              </Pressable>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <BrutalIconBtn icon="shopping-bag" onPress={() => nav.navigate('Cart')} />
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
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(30), color: C.ink, letterSpacing: -1.5, lineHeight: rf(30), textAlign: 'center' }}>FLASH SALE</Text>
              <Text style={[T.monoB, { color: C.ink, fontSize: 10, marginTop: 4, textAlign: 'center' }]}>UP TO 70% OFF · ENDS SOON</Text>
            </View>
          </View>
        )}
      </View>
      <View style={{ height: 1, backgroundColor: C.ink }} />

      <ScrollView showsVerticalScrollIndicator={false} removeClippedSubviews={Platform.OS === 'android'} contentContainerStyle={{ paddingBottom: 120 }}>
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
                  <Text style={{ fontFamily: 'Inter_900Black', fontSize: 9, color: on ? C.white : C.ink, textAlign: 'center', letterSpacing: 0.5, lineHeight: 12 }}>{o.label}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* ═══ STORE BANNER CAROUSEL — swipable, auto-rotating (below the tiles) ═══ */}
        <CategoryBanner label={label} cardRadius={cardRadius} />

        {/* ═══ PRODUCT GRID — uniform card heights ═══ */}
        <View style={{ paddingHorizontal: SP.l, gap: SP.m, marginTop: SP.l }}>
          {grid === 2 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.s }}>
              {sorted.map((p, i) => {
                return (
                  <FadeInUp key={p.id} delay={(i % 6) * 30}>
                    {/* Global standard-size card — rank badge when sorted by rating */}
                    <ProductCard
                      p={p}
                      brand={label}
                      zoomParams={{ brand: label }}
                      rank={sort === 'RATING' && i < 3 ? i + 1 : undefined}
                      frameStyle={{ borderRadius: cardRadius }}
                    >
                      {/* Low stock */}
                      {p.stock < 15 && (
                        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 6, paddingVertical: 3 }}>
                          <Text style={[T.monoB, { color: '#FFFFFF', fontSize: 8 }]}>{`◆ ONLY ${p.stock} LEFT`}</Text>
                        </View>
                      )}
                    </ProductCard>
                  </FadeInUp>
                );
              })}
            </View>
          ) : (
            /* LIST VIEW — horizontal rows */
            <View style={{ gap: SP.m }}>
              {sorted.map((p, i) => (
                <FadeInUp key={p.id} delay={(i % 6) * 30}>
                  <Pressable onPress={() => openZoom(zoomRefs.current['l' + p.id], p.img, p, { brand: label })} style={[{ flexDirection: 'row', backgroundColor: C.white, overflow: 'hidden' }, BORDER(1)]}>
                    <View ref={(el) => { zoomRefs.current['l' + p.id] = el; }} collapsable={false} style={{ width: 130, height: 160, backgroundColor: C.hairline, borderRightWidth: 1, borderColor: C.ink }}>
                      <CachedImage source={{ uri: p.img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                      {p.tag && (
                        <View style={[{ position: 'absolute', top: 0, left: 0, paddingHorizontal: 6, paddingVertical: 3, backgroundColor: C.ink }]}>
                          <Text style={{ fontFamily: 'Inter_900Black', fontSize: 8, color: C.white }}>{p.tag}</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ flex: 1, padding: SP.m, justifyContent: 'space-between' }}>
                      <View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={[T.monoB, { fontSize: 10, color: C.ink }]}>{p.brand}</Text>
                          <Text style={[T.mono, { fontSize: 9, color: C.dim }]}>{`${p.reviews} REVIEWS`}</Text>
                        </View>
                        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 14, color: C.ink, marginTop: 4 }} numberOfLines={2}>{p.name}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                          <Ionicons name="star" size={11} color={C.ink} />
                          <Text style={[T.monoB, { fontSize: 11, color: C.ink }]}>{p.rating}</Text>
                          <Text style={[T.mono, { fontSize: 9, color: C.dim }]}>· {p.stock} LEFT</Text>
                        </View>
                      </View>
                      <View>
                        <Text style={{ fontFamily: 'Inter_900Black', fontSize: 18, color: C.ink }}>₹{p.price}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                          <Text style={{ fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: C.dim, textDecorationLine: 'line-through' }}>₹{p.original}</Text>
                          <Text style={[T.monoB, { fontSize: 9, color: C.ink }]}>{'-' + p.discount + '%'}</Text>
                        </View>
                      </View>
                    </View>
                  </Pressable>
                </FadeInUp>
              ))}
            </View>
          )}
        </View>

        {/* ═══ END-OF-FEED CALLOUT ═══ */}
        <View style={{ marginHorizontal: SP.l, marginTop: SP.xl, padding: SP.l, alignItems: 'center' }}>
          <AsciiDivider />
          <Text style={[T.monoB, { color: C.dim, marginTop: 8 }]}>{'◆ END OF FEED ◆'}</Text>
          <Text style={[T.mono, { color: C.dim, fontSize: 9, marginTop: 4, textAlign: 'center' }]}>{'MORE DROPS INCOMING · CHECK BACK IN 60 MIN'}</Text>
          <AsciiDivider faint style={{ marginTop: 8 }} />
        </View>
      </ScrollView>

      {/* ═══ STICKY BOTTOM BAR — Sort · Men/Women · Filter (Myntra-style) ═══ */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: C.white, borderTopWidth: 1, borderColor: C.ink, paddingBottom: insets.bottom }}>
        <Pressable onPress={() => openSheet('sort')} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14 }}>
          <Feather name="sliders" size={15} color={C.ink} />
          <Text style={[T.monoB, { fontSize: 11, color: C.ink }]} numberOfLines={1}>SORT</Text>
        </Pressable>
        <View style={{ width: 1, backgroundColor: C.ink }} />
        <Pressable onPress={() => openSheet('gender')} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14 }}>
          <Feather name="users" size={15} color={C.ink} />
          <Text style={[T.monoB, { fontSize: 11, color: C.ink }]}>{genderTab}</Text>
        </Pressable>
        <View style={{ width: 1, backgroundColor: C.ink }} />
        <Pressable onPress={() => openSheet('filter')} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14 }}>
          <Feather name="filter" size={15} color={C.ink} />
          <Text style={[T.monoB, { fontSize: 11, color: C.ink }]} numberOfLines={1}>{filter === 'ALL' ? 'FILTER' : filter}</Text>
        </Pressable>
      </View>

      {/* ═══ BOTTOM SHEET — half-screen modal for Sort / Gender / Filter ═══ */}
      <Modal visible={sheet !== null} transparent animationType="none" onRequestClose={closeSheet}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          {/* Backdrop — fades in on open, out on close, in sync with the sheet slide. */}
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: shown ? 1 : 0 }}
            transition={{ type: 'timing', duration: 260 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' }}
          >
            <Pressable style={{ flex: 1 }} onPress={closeSheet} />
          </MotiView>
          <MotiView
            from={{ translateY: H }}
            animate={{ translateY: shown ? 0 : H }}
            transition={{ type: 'timing', duration: 260 }}
            style={{ backgroundColor: C.white, borderTopWidth: 1, borderColor: C.ink, paddingBottom: insets.bottom + SP.m, maxHeight: '55%' }}
          >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SP.l, paddingVertical: SP.m, borderBottomWidth: 1, borderColor: C.ink }}>
            <Text style={{ fontFamily: 'Inter_900Black', fontSize: 15, color: C.ink, letterSpacing: 1 }}>
              {activeSheet === 'sort' ? 'SORT BY' : activeSheet === 'gender' ? 'SHOP FOR' : 'FILTER'}
            </Text>
            <Pressable onPress={closeSheet} hitSlop={10}><Feather name="x" size={20} color={C.ink} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: SP.l, gap: SP.s }}>
            {(activeSheet === 'sort' ? SORTS : activeSheet === 'gender' ? ['MEN', 'WOMEN'] : FILTERS).map(opt => {
              const selected = activeSheet === 'sort' ? sort === opt : activeSheet === 'gender' ? genderTab === opt : filter === opt;
              return (
                <Pressable
                  key={opt}
                  onPress={() => {
                    if (activeSheet === 'sort') setSort(opt);
                    else if (activeSheet === 'gender') setGenderTab(opt as 'MEN' | 'WOMEN');
                    else setFilter(opt);
                    closeSheet();
                  }}
                  style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SP.m, paddingVertical: 14, backgroundColor: selected ? C.ink : C.white }, BORDER(1)]}
                >
                  <Text style={{ fontFamily: 'Inter_900Black', fontSize: 13, letterSpacing: 0.5, color: selected ? C.white : C.ink }}>{opt}</Text>
                  {selected && <Feather name="check" size={16} color={C.white} />}
                </Pressable>
              );
            })}
          </ScrollView>
          </MotiView>
        </View>
      </Modal>
    </View>
  );
}

// ─── STORE BANNER CAROUSEL — swipable, auto-rotating banners for the category/brand ───
const CAT_BANNER_3 = 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=900&q=80&auto=format&fit=crop';
function CategoryBanner({ label, cardRadius }: { label: string; cardRadius: number }) {
  const slides = [
    { img: HERO_IMG, kicker: 'TRENDZO · STORE', title: label.toUpperCase() },
    { img: HERO_IMG_2, kicker: 'LIMITED OFFER', title: 'EXTRA 10% OFF' },
    { img: CAT_BANNER_3, kicker: '60-MIN DELIVERY', title: 'FREE SHIPPING' },
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
                <Text style={[T.monoB, { color: C.white, fontSize: 9, opacity: 0.85 }]}>{item.kicker}</Text>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(26), color: C.white, letterSpacing: -1, marginTop: 2 }} numberOfLines={1}>{item.title}</Text>
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
      <Text style={{ fontFamily: 'Inter_900Black', fontSize: 16, color: C.white }}>{value}</Text>
      <Text style={{ fontFamily: 'SpaceMono_700Bold', fontSize: 8, color: C.white, opacity: 0.5, marginTop: 2, letterSpacing: 1 }}>{label}</Text>
    </View>
  );
}
function StatDivider() {
  return <View style={{ width: 1, backgroundColor: C.white, opacity: 0.3, marginVertical: 4 }} />;
}
