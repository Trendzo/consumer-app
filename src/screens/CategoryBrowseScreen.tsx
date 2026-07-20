// Category browser — SHEIN-style two-pane "Menu" page.
//
// Left: vertical rail of ALL categories — backend categories (listCategories,
// gender-scoped) merged with a standard fashion taxonomy so the rail is always
// full (Tops, Dresses, Bottoms, Denim, Co-ords, Accessories, …).
// Right: the selected category's page — hero ("Shop All"), FEATURED tiles,
// SHOP BY STYLE (real subcategories for that category — T-Shirts, Blouses &
// Shirts, Tank Tops… under Tops, etc.), SHOP BY COLOR, the app's own
// occasion collections, and a product grid from the backend.
//
// Per-category products are cached in a ref map so flipping between rail
// entries is instant after the first load — no refetch, no spinner churn.
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, Dimensions, Platform, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { C, T, SP, rf } from '../theme/brutal';
import { BrutalStatusBar, CachedImage } from '../components/Brutal';
import { useZoom } from '../navigation/ZoomTransition';
import { useApp } from '../state/AppState';
import { PRODUCTS, CATEGORIES } from '../data/mockData';
import type { Product, Category, Occasion } from '../data/mockData';
import { listCategories, listProducts, listOccasions, isBackendCategoryId } from '../services/catalog';

const { width: W } = Dimensions.get('window');
const RAIL_W = 118;
const PANE_W = W - RAIL_W;
const TILE_W = (PANE_W - SP.m * 2 - SP.s) / 2;
const TILE_H = 200;

// ── Standard fashion taxonomy (SHEIN-style) ───────────────────────────────────
// Each entry: how to recognise a backend category (match), the subcategories
// shown under SHOP BY STYLE, and per-sub search keywords used both to pick a
// tile image from the loaded products and as the search term when tapped.
type Sub = { label: string; q: string[] };
type Taxo = { key: string; label: string; himLabel?: string; match: RegExp; herOnly?: boolean; subs: Sub[]; himSubs?: Sub[] };

const TAXONOMY: Taxo[] = [
  {
    key: 'tops', label: 'Tops', match: /top|tee|shirt|blouse/i,
    subs: [
      { label: 'T-Shirts', q: ['t-shirt', 'tshirt', 'tee'] },
      { label: 'Blouses & Shirts', q: ['blouse', 'shirt'] },
      { label: 'Tank Tops & Camis', q: ['tank', 'cami'] },
      { label: 'Crop Tops', q: ['crop'] },
      { label: 'Bodysuits', q: ['bodysuit'] },
      { label: 'Sweatshirts & Hoodies', q: ['sweatshirt', 'hoodie'] },
      { label: 'Sweaters & Cardigans', q: ['sweater', 'cardigan', 'knit'] },
    ],
    himSubs: [
      { label: 'T-Shirts', q: ['t-shirt', 'tshirt', 'tee'] },
      { label: 'Polos', q: ['polo'] },
      { label: 'Shirts', q: ['shirt'] },
      { label: 'Sweatshirts & Hoodies', q: ['sweatshirt', 'hoodie'] },
      { label: 'Sweaters', q: ['sweater', 'knit'] },
      { label: 'Vests & Tanks', q: ['vest', 'tank'] },
    ],
  },
  {
    key: 'dresses', label: 'Dresses', match: /dress/i, herOnly: true,
    subs: [
      { label: 'Mini Dresses', q: ['mini'] },
      { label: 'Midi Dresses', q: ['midi'] },
      { label: 'Maxi Dresses', q: ['maxi', 'long'] },
      { label: 'Bodycon Dresses', q: ['bodycon'] },
      { label: 'Party Dresses', q: ['party', 'evening'] },
      { label: 'Casual Dresses', q: ['casual', 'day'] },
    ],
  },
  {
    key: 'coords', label: 'Co-ords', match: /co-?ord|matching|two.?piece|set/i,
    subs: [
      { label: 'Two-Piece Sets', q: ['set', 'co-ord'] },
      { label: 'Matching Sets', q: ['matching'] },
      { label: 'Skirt Sets', q: ['skirt set'] },
      { label: 'Pant Sets', q: ['pant set', 'trouser set'] },
    ],
  },
  {
    key: 'bottoms', label: 'Bottoms', match: /bottom|pant|trouser|skirt|legging/i,
    subs: [
      { label: 'Pants & Trousers', q: ['pant', 'trouser'] },
      { label: 'Skirts', q: ['skirt'] },
      { label: 'Shorts', q: ['short'] },
      { label: 'Leggings', q: ['legging'] },
      { label: 'Wide-Leg', q: ['wide'] },
      { label: 'Cargo Pants', q: ['cargo'] },
    ],
    himSubs: [
      { label: 'Jeans', q: ['jean', 'denim'] },
      { label: 'Cargo Pants', q: ['cargo'] },
      { label: 'Joggers', q: ['jogger', 'track'] },
      { label: 'Shorts', q: ['short'] },
      { label: 'Trousers', q: ['trouser', 'pant'] },
      { label: 'Chinos', q: ['chino'] },
    ],
  },
  {
    key: 'denim', label: 'Denim', match: /denim|jean/i,
    subs: [
      { label: 'Jeans', q: ['jean'] },
      { label: 'Skinny Jeans', q: ['skinny'] },
      { label: 'Wide-Leg Jeans', q: ['wide'] },
      { label: 'Baggy Jeans', q: ['baggy', 'loose'] },
      { label: 'Denim Jackets', q: ['denim jacket', 'jacket'] },
      { label: 'Denim Shorts', q: ['denim short', 'short'] },
    ],
  },
  {
    key: 'lounge', label: 'Loungewear & Lingerie', himLabel: 'Innerwear & Lounge', match: /lounge|lingerie|sleep|pajama|inner/i,
    subs: [
      { label: 'Pajama Sets', q: ['pajama', 'sleep'] },
      { label: 'Robes', q: ['robe'] },
      { label: 'Bras & Bralettes', q: ['bra'] },
      { label: 'Shapewear', q: ['shape'] },
      { label: 'Loungewear Sets', q: ['lounge'] },
    ],
    himSubs: [
      { label: 'Pajama Sets', q: ['pajama', 'sleep'] },
      { label: 'Vests', q: ['vest'] },
      { label: 'Boxers & Briefs', q: ['boxer', 'brief'] },
      { label: 'Lounge Pants', q: ['lounge', 'pajama'] },
    ],
  },
  {
    key: 'active', label: 'Activewear', match: /active|sport|gym|athle/i,
    subs: [
      { label: 'Sports Bras', q: ['sports bra', 'bra'] },
      { label: 'Gym Leggings', q: ['legging'] },
      { label: 'Track Pants', q: ['track', 'jogger'] },
      { label: 'Workout Tops', q: ['gym', 'workout', 'tank'] },
      { label: 'Windbreakers', q: ['windbreaker', 'jacket'] },
    ],
    himSubs: [
      { label: 'Gym T-Shirts', q: ['gym', 'tee', 't-shirt'] },
      { label: 'Track Pants', q: ['track', 'jogger'] },
      { label: 'Shorts', q: ['short'] },
      { label: 'Tank Tops', q: ['tank', 'vest'] },
      { label: 'Windbreakers', q: ['windbreaker', 'jacket'] },
    ],
  },
  {
    key: 'swim', label: 'Swimwear', himLabel: 'Swim & Beach', match: /swim|beach/i,
    subs: [
      { label: 'Bikinis', q: ['bikini'] },
      { label: 'One-Pieces', q: ['one-piece', 'one piece'] },
      { label: 'Cover-Ups', q: ['cover'] },
      { label: 'Beach Dresses', q: ['beach'] },
    ],
    himSubs: [
      { label: 'Swim Shorts', q: ['swim', 'short'] },
      { label: 'Beach Shirts', q: ['beach', 'shirt'] },
    ],
  },
  {
    key: 'outerwear', label: 'Jackets & Coats', match: /jacket|coat|outer|blazer|puffer/i,
    subs: [
      { label: 'Jackets', q: ['jacket'] },
      { label: 'Blazers', q: ['blazer'] },
      { label: 'Coats', q: ['coat'] },
      { label: 'Puffers', q: ['puffer', 'padded'] },
      { label: 'Trench Coats', q: ['trench'] },
      { label: 'Bombers', q: ['bomber'] },
    ],
  },
  {
    key: 'shoes', label: 'Shoes', match: /shoe|sneaker|heel|boot|footwear|sandal/i,
    subs: [
      { label: 'Sneakers', q: ['sneaker'] },
      { label: 'Heels', q: ['heel'] },
      { label: 'Boots', q: ['boot'] },
      { label: 'Flats', q: ['flat'] },
      { label: 'Sandals', q: ['sandal'] },
      { label: 'Loafers', q: ['loafer'] },
    ],
    himSubs: [
      { label: 'Sneakers', q: ['sneaker'] },
      { label: 'Boots', q: ['boot'] },
      { label: 'Loafers', q: ['loafer'] },
      { label: 'Sandals & Sliders', q: ['sandal', 'slider'] },
      { label: 'Formal Shoes', q: ['formal', 'oxford'] },
    ],
  },
  {
    key: 'bags', label: 'Bags', match: /bag/i,
    subs: [
      { label: 'Tote Bags', q: ['tote'] },
      { label: 'Crossbody Bags', q: ['crossbody', 'sling'] },
      { label: 'Shoulder Bags', q: ['shoulder'] },
      { label: 'Clutches', q: ['clutch'] },
      { label: 'Backpacks', q: ['backpack'] },
      { label: 'Mini Bags', q: ['mini'] },
    ],
    himSubs: [
      { label: 'Backpacks', q: ['backpack'] },
      { label: 'Sling Bags', q: ['sling', 'crossbody'] },
      { label: 'Duffles', q: ['duffle', 'gym bag'] },
      { label: 'Wallets', q: ['wallet'] },
    ],
  },
  {
    key: 'accessories', label: 'Accessories', match: /accessor/i,
    subs: [
      { label: 'Belts', q: ['belt'] },
      { label: 'Hats & Caps', q: ['hat', 'cap'] },
      { label: 'Sunglasses', q: ['sunglass'] },
      { label: 'Scarves', q: ['scarf', 'scarves'] },
      { label: 'Hair Accessories', q: ['hair', 'clip', 'scrunchie'] },
      { label: 'Socks & Tights', q: ['sock', 'tight'] },
    ],
  },
  {
    key: 'jewelry', label: 'Jewelry', match: /jewel/i,
    subs: [
      { label: 'Earrings', q: ['earring'] },
      { label: 'Necklaces', q: ['necklace', 'chain'] },
      { label: 'Rings', q: ['ring'] },
      { label: 'Bracelets', q: ['bracelet'] },
      { label: 'Anklets', q: ['anklet'] },
    ],
    himSubs: [
      { label: 'Chains', q: ['chain', 'necklace'] },
      { label: 'Bracelets', q: ['bracelet'] },
      { label: 'Rings', q: ['ring'] },
      { label: 'Watches', q: ['watch'] },
    ],
  },
  {
    key: 'beauty', label: 'Beauty', himLabel: 'Grooming', match: /beauty|makeup|skincare|groom/i,
    subs: [
      { label: 'Makeup', q: ['makeup', 'lip'] },
      { label: 'Skincare', q: ['skin', 'serum'] },
      { label: 'Nails', q: ['nail'] },
      { label: 'Fragrance', q: ['perfume', 'fragrance'] },
    ],
    himSubs: [
      { label: 'Skincare', q: ['skin', 'face'] },
      { label: 'Beard Care', q: ['beard'] },
      { label: 'Fragrance', q: ['perfume', 'fragrance'] },
      { label: 'Hair Styling', q: ['hair', 'wax'] },
    ],
  },
];

// Generic subs when a backend category matches nothing in the taxonomy.
const DEFAULT_SUBS: Sub[] = [
  { label: 'New In', q: ['new'] },
  { label: 'Best Sellers', q: [] },
  { label: 'Trending', q: [] },
  { label: 'Under ₹999', q: [] },
];

// SHOP BY COLOR — standard storefront colour swatches.
const COLORS: { label: string; hex: string; border?: boolean }[] = [
  { label: 'Black', hex: '#151515' },
  { label: 'White', hex: '#FFFFFF', border: true },
  { label: 'Beige', hex: '#E8DCC8' },
  { label: 'Pink', hex: '#F4B8C8' },
  { label: 'Red', hex: '#D23C3C' },
  { label: 'Blue', hex: '#4A6FA5' },
  { label: 'Green', hex: '#4E7D54' },
  { label: 'Brown', hex: '#8B5E3C' },
  { label: 'Grey', hex: '#9A9A9A' },
  { label: 'Purple', hex: '#9B7FC0' },
  { label: 'Yellow', hex: '#E8C84A' },
  { label: 'Orange', hex: '#E08A3C' },
];

const findTaxo = (label: string): Taxo | undefined => TAXONOMY.find((t) => t.match.test(label));

// Grey product tile with a soft bottom scrim + white label — the screenshot look.
const StyleTile = React.memo(function StyleTile({
  img, label, onPress, tileRef, w = TILE_W, h = TILE_H, big = false,
}: {
  img: string; label: string; onPress: () => void;
  tileRef?: (el: any) => void; w?: number; h?: number; big?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={{ width: w }}>
      <View ref={tileRef} collapsable={false} style={{ width: w, height: h, backgroundColor: '#ebebeb', overflow: 'hidden' }}>
        <LinearGradient colors={['#f1f1f1', '#dcdcdc']} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        {!!img && <CachedImage transition={0} source={{ uri: img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />}
        {/* bottom scrim so the white label always reads */}
        <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.35)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 70 }} />
        <Text
          numberOfLines={1}
          style={{ position: 'absolute', left: 12, bottom: 10, right: 12, fontFamily: 'Inter_700Bold', fontSize: big ? 17 : 14, color: '#FFFFFF' }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
});

// Section heading — letter-spaced caps like the reference design.
function SectionLabel({ children, night }: { children: string; night: boolean }) {
  return (
    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, letterSpacing: 3, color: night ? '#cfcfcf' : '#333333', marginTop: SP.l, marginBottom: SP.s }}>
      {children}
    </Text>
  );
}

export default function CategoryBrowseScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { night, gender } = useApp();
  const { openZoom } = useZoom();
  const zoomRefs = useRef<Record<string, any>>({});
  const him = gender === 'him';

  // ── Rail = backend categories merged with the taxonomy (always a full rail) ──
  const [apiCats, setApiCats] = useState<Category[] | null>(null);
  const cats = useMemo<Category[]>(() => {
    const base = apiCats && apiCats.length ? apiCats : CATEGORIES;
    const covered = new Set(base.map((c) => findTaxo(c.label)?.key).filter(Boolean));
    const extras: Category[] = TAXONOMY
      .filter((t) => !covered.has(t.key) && !(him && t.herOnly))
      .map((t) => ({ id: 'tx-' + t.key, label: him && t.himLabel ? t.himLabel : t.label, icon: 'grid-outline', tint: '#eeeeee', img: '' }));
    return [...base, ...extras];
  }, [apiCats, him]);

  const [selected, setSelected] = useState<Category>(
    () => cats.find((c) => c.id === route.params?.id || c.label === route.params?.label) ?? cats[0],
  );
  useEffect(() => {
    let cancelled = false;
    listCategories(gender)
      .then((list) => {
        if (cancelled || !list.length) return;
        setApiCats(list);
        setSelected((cur) =>
          list.find((c) => c.id === route.params?.id || c.label === route.params?.label)
          ?? list.find((c) => c.id === cur.id)
          ?? cur);
      })
      .catch(() => { /* keep merged mock rail */ });
    return () => { cancelled = true; };
  }, [gender]);

  // ── Products for the selected category — cached per category id ──
  const cache = useRef<Record<string, Product[]>>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const key = selected.id;
    if (cache.current[key]) { setProducts(cache.current[key]); return; }
    let cancelled = false;
    setLoading(true);
    const taxo = findTaxo(selected.label);
    listProducts({
      gender,
      categoryId: isBackendCategoryId(key) ? key : undefined,
      // taxonomy-only rail entries have no backend id — search by their name instead
      search: isBackendCategoryId(key) ? undefined : (taxo?.label ?? selected.label),
      limit: 24,
    })
      .then((list) => {
        if (cancelled) return;
        const mock = PRODUCTS.filter((p) => p.category === selected.label);
        const final = list.length ? list : (mock.length ? mock : PRODUCTS);
        cache.current[key] = final;
        setProducts(final);
      })
      .catch(() => {
        if (cancelled) return;
        const mock = PRODUCTS.filter((p) => p.category === selected.label);
        setProducts(mock.length ? mock : PRODUCTS);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selected.id, gender]);

  // ── Occasions — the app's own collections, fetched once ──
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  useEffect(() => {
    let cancelled = false;
    listOccasions(gender).then((o) => { if (!cancelled) setOccasions(o); }).catch(() => {});
    return () => { cancelled = true; };
  }, [gender]);

  // Full listing page for this category (optionally narrowed by a search term).
  const openListing = useCallback((label: string, search?: string) => {
    nav.navigate('Category', {
      id: isBackendCategoryId(selected.id) ? selected.id : undefined,
      label,
      search,
    });
  }, [nav, selected.id]);
  const shopAll = useCallback(() => openListing(selected.label), [openListing, selected.label]);

  // Resolve the taxonomy for the selected category → its subcategory tiles.
  const taxo = findTaxo(selected.label);
  const subs: Sub[] = (him && taxo?.himSubs) ? taxo.himSubs : (taxo?.subs ?? DEFAULT_SUBS);

  // Pick a tile image for a subcategory: first product whose name matches its
  // keywords, else rotate through whatever this category has loaded.
  const subImg = useCallback((sub: Sub, i: number): string => {
    const hit = products.find((p) => sub.q.some((q) => p.name.toLowerCase().includes(q)));
    return hit?.img ?? products[i % Math.max(products.length, 1)]?.img ?? '';
  }, [products]);

  const heroImg = selected.img || products[0]?.img || '';
  const newIn = products.find((p) => p.tag === 'NEW') ?? products[0];
  const best = [...products].sort((a, b) => (b.rating || 0) - (a.rating || 0))[0];

  return (
    <View key={night ? 'D' : 'L'} style={{ flex: 1, backgroundColor: night ? '#000000' : '#FFFFFF' }}>
      <BrutalStatusBar />

      {/* ═══ SEARCH BAR — rounded pill, camera + search button ═══ */}
      <View style={{ paddingTop: 56, paddingHorizontal: SP.m, paddingBottom: SP.s, backgroundColor: night ? '#000000' : '#FFFFFF' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', height: 50, borderWidth: 2, borderColor: C.ink, borderRadius: 25, paddingLeft: 18, paddingRight: 4, backgroundColor: night ? '#0a0a0a' : '#FFFFFF' }}>
          <Pressable onPress={() => nav.navigate('Search')} style={{ flex: 1, height: '100%', justifyContent: 'center' }}>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 15, color: C.dim }} numberOfLines={1}>Oversized t-shirt</Text>
          </Pressable>
          <Pressable onPress={() => nav.navigate('ImageSearch')} hitSlop={8} style={{ paddingHorizontal: 10 }}>
            <Feather name="camera" size={20} color={C.ink} />
          </Pressable>
          <Pressable onPress={() => nav.navigate('Search')} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="search" size={19} color={night ? '#000000' : '#FFFFFF'} />
          </Pressable>
        </View>
      </View>

      <View style={{ flex: 1, flexDirection: 'row' }}>
        {/* ═══ LEFT RAIL — full category list ═══ */}
        <ScrollView
          style={{ width: RAIL_W, flexGrow: 0, backgroundColor: night ? '#0d0d0d' : '#f5f5f5' }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {cats.map((c) => {
            const active = c.id === selected.id;
            return (
              <Pressable
                key={c.id}
                onPress={() => setSelected(c)}
                style={{
                  paddingVertical: 22,
                  paddingHorizontal: 8,
                  alignItems: 'center',
                  backgroundColor: active ? (night ? '#000000' : '#FFFFFF') : 'transparent',
                }}
              >
                {active && <View style={{ position: 'absolute', left: 0, top: 10, bottom: 10, width: 4, backgroundColor: C.ink }} />}
                <Text
                  style={{
                    fontFamily: active ? 'Inter_900Black' : 'Inter_700Bold',
                    fontSize: 11.5,
                    letterSpacing: 0.5,
                    color: active ? C.ink : (night ? '#9a9a9a' : '#555555'),
                    textAlign: 'center',
                    lineHeight: 16,
                  }}
                >
                  {c.label.toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ═══ RIGHT PANE — selected category page ═══ */}
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={Platform.OS === 'android'}
          contentContainerStyle={{ padding: SP.m, paddingBottom: 140 }}
        >
          {/* HERO — category name + Shop All over a grey banner */}
          <Pressable onPress={shopAll}>
            <View style={{ height: 150, backgroundColor: '#e2e2e2', overflow: 'hidden' }}>
              <LinearGradient colors={['#d6d6d6', '#efefef']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
              {!!heroImg && (
                <CachedImage transition={0} source={{ uri: heroImg }} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '58%' }} resizeMode="cover" />
              )}
              <LinearGradient colors={['rgba(90,90,90,0.55)', 'rgba(90,90,90,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 0.8, y: 0.5 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
              <View style={{ flex: 1, justifyContent: 'center', paddingLeft: 16 }}>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(24), color: '#FFFFFF', letterSpacing: -0.5 }} numberOfLines={1}>{selected.label}</Text>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: '#FFFFFF', marginTop: 4 }}>Shop All →</Text>
              </View>
            </View>
          </Pressable>

          {/* FEATURED — New In / Best Sellers */}
          <SectionLabel night={night}>FEATURED</SectionLabel>
          <View style={{ flexDirection: 'row', gap: SP.s }}>
            {newIn && <StyleTile img={newIn.img} label="New In" big onPress={() => openListing(`${selected.label} · New In`)} />}
            {best && <StyleTile img={best.img} label="Best Sellers" big onPress={() => openListing(`${selected.label} · Best Sellers`)} />}
          </View>

          {/* SHOP BY STYLE — real subcategories for this category */}
          <SectionLabel night={night}>SHOP BY STYLE</SectionLabel>
          {loading && !products.length ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator color={C.ink} />
            </View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.s }}>
              {subs.map((sub, i) => (
                <StyleTile
                  key={sub.label}
                  img={subImg(sub, i)}
                  label={sub.label}
                  onPress={() => openListing(sub.label, sub.q[0] ?? sub.label)}
                />
              ))}
            </View>
          )}

          {/* SHOP BY COLOR — swatch grid */}
          <SectionLabel night={night}>SHOP BY COLOR</SectionLabel>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.m }}>
            {COLORS.map((col) => (
              <Pressable key={col.label} onPress={() => openListing(`${col.label} ${selected.label}`, col.label)} style={{ width: (PANE_W - SP.m * 2 - SP.m * 3) / 4, alignItems: 'center', marginBottom: 2 }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: col.hex, borderWidth: col.border ? 1 : 0, borderColor: '#d0d0d0' }} />
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: night ? '#cfcfcf' : '#444444', marginTop: 5 }}>{col.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* SHOP BY OCCASION — the app's own collections */}
          {occasions.length > 0 && (
            <>
              <SectionLabel night={night}>SHOP BY OCCASION</SectionLabel>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SP.s }}>
                {occasions.map((o) => (
                  <StyleTile key={o.id} img={o.img} label={o.label} w={130} h={150} onPress={() => nav.navigate('OccasionShopping')} />
                ))}
              </ScrollView>
            </>
          )}

          {/* THE PRODUCTS — everything under this category */}
          <SectionLabel night={night}>{`ALL ${selected.label.toUpperCase()}`}</SectionLabel>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.s }}>
            {products.slice(0, 16).map((p) => (
              <StyleTile
                key={p.id}
                img={p.img}
                label={p.name}
                tileRef={(el) => { zoomRefs.current[p.id] = el; }}
                onPress={() => openZoom(zoomRefs.current[p.id], p.img, p, { brand: selected.label })}
              />
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}
