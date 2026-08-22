import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Image, Dimensions, FlatList, Platform, StyleSheet } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect, StackActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LottieView from 'lottie-react-native';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { C, T, SP, BORDER, rf, HEADER_TOP } from '../theme/brutal';
import { BrutalStatusBar, CachedImage, FadeInUp, BrutalIconBtn, BagButton, ProductCard, OptionSheet } from '../components/Brutal';
import { TrendzoLogo } from '../components/TrendzoLogo';
import { useZoom } from '../navigation/ZoomTransition';
import { useApp } from '../state/AppState';
import { ProductGridSkeleton, CatalogEmpty, CatalogError } from '../components/CatalogState';
import type { Product } from '../data/mockData';
import { listProducts, listCategories, isBackendCategoryId, getFacets, listCategoryTree, type CategoryNode } from '../services/catalog';
import { resolveAsset } from '../content/media';
import { openLocationPicker, usePlace } from '../state/location';
import { placeLabel } from '../services/geo';

const { width: W, height: H } = Dimensions.get('window');
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

/**
 * The listing's real colourways, for the list row's swatches.
 *
 * `cardToProduct` pads: one colour becomes `[hex, hex]`, none becomes the
 * neutral grey pair. Both would render as "two colourways" if taken at face
 * value, so duplicates are collapsed and the neutral placeholder is dropped.
 */
const NEUTRAL_SWATCHES = new Set(['#f3f3f3', '#e5e5e5', '#eeeeee']);
const swatchesOf = (colors: unknown): string[] => {
  if (!Array.isArray(colors)) return [];
  const seen = Array.from(new Set(colors.filter((c): c is string => typeof c === 'string').map((c) => c.toLowerCase())));
  const real = seen.filter((c) => !NEUTRAL_SWATCHES.has(c));
  return real.slice(0, 4);
};

// Same text shadow the Home hero uses for white copy over photos.
const HERO_SHADOW = { textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 } as const;

/**
 * Category label → the bundled banner art shipped under category-banners/.
 * Keyword match, not slugs: labels arrive as free text ("Tank Tops", "Mini
 * Skirts", "Sneakers") from a dozen call sites. Null = no art for this label →
 * the hero falls back to the ink editorial band, which still matches the app.
 */
const bannerFor = (label: string, gender: 'her' | 'him'): number | null => {
  const l = label.toLowerCase();
  const pick = (name: string) =>
    resolveAsset(`category-banners/${gender}/${name}`) ?? resolveAsset(`category-banners/${gender === 'her' ? 'him' : 'her'}/${name}`);
  if (/dress/.test(l)) return pick('dresses');
  if (/shoe|sneaker|heel|boot|footwear/.test(l)) return pick('shoes');
  if (/bag|tote|clutch/.test(l)) return pick('bags');
  if (/jean|denim|cargo|trouser|pant|bottom|skirt|short/.test(l)) return pick('denim') ?? pick('bottoms');
  if (/jacket|coat|overshirt|outerwear|hoodie|blazer/.test(l)) return pick('outerwear');
  if (/jewel|necklace|ring|earring/.test(l)) return pick('jewelry');
  if (/active|gym|sport|athleisure/.test(l)) return pick('active');
  if (/swim/.test(l)) return pick('swim');
  if (/lounge|sleep|night/.test(l)) return pick('lounge');
  if (/accessor|belt|cap|watch|shade|scarf/.test(l)) return pick('accessories');
  if (/beauty|makeup|skin/.test(l)) return pick('beauty');
  if (/ethnic|kurta|traditional/.test(l)) return pick('ethnic');
  if (/formal|suit/.test(l)) return pick('formal');
  if (/co-?ord|matching|set/.test(l)) return pick('coords');
  if (/top|shirt|tee|tank|blouse|polo|sweater|knit/.test(l)) return pick('tops');
  return pick('tops');
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
  /**
   * The active sub-category filter, by LABEL ('ALL' = no narrowing).
   *
   * This used to be picked from a hardcoded list — ALL / NEW IN / TOPS /
   * BOTTOMS / DRESSES / SHOES / BAGS — that had nothing to do with the
   * category being browsed (you were offered DRESSES inside Outerwear), and
   * NOTHING read the value: `sorted` was just `data`, so picking a filter
   * changed the button label and not one product. The options now come from
   * /catalog/facets for this exact query, and selecting one re-queries the
   * server by that category's slug.
   */
  const [filter, setFilter] = useState('ALL');
  /** Real sub-categories for the current view, with counts, from the facets API. */
  const [facetCats, setFacetCats] = useState<{ label: string; slug: string; count: number }[]>([]);
  const [sort, setSort] = useState('NEWEST');
  const [grid, setGrid] = useState<2 | 1>(2);
  /**
   * No MEN/WOMEN switch here.
   *
   * The rail is chosen once, on Home, and carried in AppState as `gender`. This
   * screen had its OWN `genderTab` state that started at MEN regardless of the
   * shopper's rail, was never passed to the product query, and only recoloured
   * the flash-sale Lottie — so the button said "MEN" while a WOMEN's category
   * was on screen, and switching it changed nothing but its own label.
   */
  const [sheet, setSheet] = useState<null | 'sort' | 'filter'>(null);
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
  // TRUE result count from /catalog/facets, not `rows.length`. The grid fetches
  // `limit: 60`, so a 300-style category used to announce "60 styles". null =
  // not known yet (or the facet call failed), which falls back to saying nothing
  // rather than a wrong number.
  const [total, setTotal] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  /**
   * What the sheet offers: the real sub-categories present in THIS view.
   *
   * Falls back to just 'ALL' rather than the old invented list — offering a
   * filter that cannot work is worse than offering none.
   */
  const filterOptions = useMemo(
    () => ['ALL', ...facetCats.map((c) => c.label)],
    [facetCats],
  );
  /** Slug for the active filter, or undefined for 'ALL'. Drives the query. */
  const filterSlug = useMemo(
    () => (filter === 'ALL' ? undefined : facetCats.find((c) => c.label === filter)?.slug),
    [filter, facetCats],
  );
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
          // A chosen sub-category REPLACES the parent slug — it is a descendant,
          // so narrowing to it is exactly what the shopper asked for.
          ...(filterSlug ? { categorySlug: filterSlug } : catSlug ? { categorySlug: catSlug } : {}),
          ...(!filterSlug && categoryId ? { categoryId } : {}),
          ...(search ? { search } : {}),
          sort: SORT_PARAM[sort] ?? 'newest',
          limit: 60,
          signal: ac.signal,
        });
        setApiProducts(rows);
        setStatus('ready');
        // Counts run AFTER the grid and never block it — getFacets swallows its
        // own errors, so a missing count can't take the products down.
        getFacets({
          gender,
          ...(catSlug ? { categorySlug: catSlug } : {}),
          ...(categoryId ? { categoryId } : {}),
          ...(search ? { search } : {}),
          signal: ac.signal,
        }).then((f) => setTotal(f.total > 0 ? f.total : null)).catch(() => {});
      } catch (e: any) {
        // An abort is this effect superseding itself, not a failure worth
        // showing — the replacement request is already in flight.
        if (e?.name === 'AbortError') return;
        setApiProducts([]);
        setStatus('error');
      }
    })();

    return () => ac.abort();
  }, [catId, catSlug, gender, searchTerm, rawLabel, sort, reloadKey, filterSlug]);

  /**
   * The filter options: the real CHILDREN of the category being browsed.
   *
   * NOT from /catalog/facets. Facets deliberately exclude their own dimension
   * (docs §4.9), so asking for facets while a categorySlug is applied returns
   * the catalogue-wide category list — which is how you end up offering
   * "Bikinis" inside "Tops". The taxonomy tree is the only source that knows
   * what is actually a descendant of this category.
   */
  useEffect(() => {
    const key = catSlug ?? catId;
    if (!key) { setFacetCats([]); return; }
    let cancelled = false;
    listCategoryTree(gender)
      .then((roots) => {
        if (cancelled) return;
        const find = (nodes: CategoryNode[]): CategoryNode | null => {
          for (const n of nodes) {
            if (n.slug === catSlug || n.id === catId) return n;
            const hit = find(n.children);
            if (hit) return hit;
          }
          return null;
        };
        const node = find(roots);
        // A leaf has nothing to narrow by — offer no filter rather than a fake one.
        setFacetCats(
          (node?.children ?? [])
            .filter((c) => c.listingCount > 0)
            .map((c) => ({ label: c.label, slug: c.slug, count: c.listingCount })),
        );
      })
      .catch(() => { if (!cancelled) setFacetCats([]); });
    return () => { cancelled = true; };
  }, [catId, catSlug, gender]);

  // A filter belongs to the category it was chosen in. Carrying it across to a
  // different category would narrow by a slug that is not a descendant here and
  // quietly return an empty grid.
  useEffect(() => { setFilter('ALL'); setFacetCats([]); }, [catId, catSlug, searchTerm, gender]);
  // Open / close the shared OptionSheet (it owns its own slide + fade animation).
  const openSheet = (s: 'sort' | 'filter') => setSheet(s);
  const closeSheet = () => setSheet(null);

  /**
   * The chips under the hero are the SUB-CATEGORIES of the category you opened.
   *
   * They used to be `listCategories(gender)` — every top-level category in the
   * store. So opening Footwear showed chips for Dresses, Tops, Ethnic Wear and
   * everything else, and tapping one navigated away from the page you had just
   * opened. Inside Footwear the useful choices are Sneakers, Heels, Boots; those
   * are `facetCats`, the real children of this node (same source the Filter
   * sheet uses), and tapping one narrows the grid in place instead of leaving.
   */
  const chips = facetCats;

  /** How many styles the CURRENT view holds: the chosen sub-category's own count
   *  when one is active, otherwise the category total. */
  const activeCount = useMemo(
    () => (filter === 'ALL' ? total : facetCats.find((c) => c.label === filter)?.count ?? null),
    [filter, facetCats, total],
  );

  // Per-category hero art (bundled webp) — ink band when nothing matches.
  const bannerArt = isFlash ? null : bannerFor(label, gender);
  const goBag = () => {
    nav.dispatch(StackActions.popToTop());
    setTimeout(() => nav.navigate('Tabs', { screen: 'CartTab' }), 0);
  };

  // Collapsing header: the hero scrolls AWAY with the list; once it is mostly
  // gone a compact white bar (logo row + search) slides in and stays pinned.
  // Slimmer now that the hero carries only the title (search moved to the
  // pinned bar, kicker dropped in favor of the logo row).
  const HERO_H = Math.round(H * 0.21) + insets.top;
  const [compact, setCompact] = useState(false);
  const compactRef = useRef(false);
  const onListScroll = useCallback((e: any) => {
    // Fires only once the hero — its own search bar included — has FULLY
    // scrolled off-screen, so two search bars are never visible at once.
    const on = e.nativeEvent.contentOffset.y > HERO_H;
    if (on !== compactRef.current) { compactRef.current = on; setCompact(on); }
  }, [HERO_H]);

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
  const cartFilters = gender === 'her'
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
      /* ═══ LIST VIEW — a wide row has room for more than a name and a price,
             and it looked broken without it: a 160px-tall card with four short
             lines pinned to the top and a third of the row left blank. It now
             carries what the card projection genuinely knows — the category, the
             colourways, the saving, and the delivery promise — plus the discount
             flag on the image. Nothing here is invented; a field the listing
             does not have simply does not render. ═══ */
      <FadeInUp delay={(i % 6) * 30} style={S.listItem}>
        <Pressable onPress={() => openZoom(zoomRefs.current['l' + p.id], p.img, p, { brand: label })} style={[{ flexDirection: 'row', backgroundColor: C.white, overflow: 'hidden' }, BORDER(1)]}>
          <View ref={(el) => { zoomRefs.current['l' + p.id] = el; }} collapsable={false} style={{ width: 130, height: 172, backgroundColor: C.white, borderRightWidth: 1, borderColor: C.hairline }}>
            <CachedImage source={{ uri: p.img }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            {p.discount > 0 && (
              <View style={{ position: 'absolute', top: 0, left: 0, backgroundColor: C.ink, paddingHorizontal: 7, paddingVertical: 3 }}>
                <Text style={[T.micro, { color: C.white }]}>{`-${p.discount}%`}</Text>
              </View>
            )}
          </View>
          <View style={{ flex: 1, padding: SP.m, justifyContent: 'space-between' }}>
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[T.micro, { color: C.dim, letterSpacing: 1 }]} numberOfLines={1}>{(p.brand ?? '').toUpperCase()}</Text>
                {/* Rating only when the product actually has one — an unrated
                    listing showed "★ 0" once the invented nudge was removed. */}
                {p.rating > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <Ionicons name="star" size={11} color={C.ink} />
                    <Text style={[T.caption, { color: C.ink }]}>{p.rating}</Text>
                    {!!p.ratingCount && <Text style={[T.micro, { color: C.dim }]}>{`(${p.ratingCount})`}</Text>}
                  </View>
                )}
              </View>
              <Text style={[T.productName, { marginTop: 4 }]} numberOfLines={2}>{p.name}</Text>
              {/* The listing's own category and occasion tag, side by side —
                  the two things that tell you what this actually is. */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 7 }}>
                {!!p.category && (
                  <View style={[{ paddingHorizontal: 7, paddingVertical: 3, backgroundColor: '#F4F4F4' }, BORDER(1)]}>
                    <Text style={[T.micro, { color: C.ink }]} numberOfLines={1}>{p.category}</Text>
                  </View>
                )}
                {!!p.tag && p.discount === 0 && (
                  <View style={[{ paddingHorizontal: 7, paddingVertical: 3, backgroundColor: '#F4F4F4' }, BORDER(1)]}>
                    <Text style={[T.micro, { color: C.ink }]} numberOfLines={1}>{p.tag}</Text>
                  </View>
                )}
              </View>
              {/* Colourways, DEDUPED and unlabelled. The card projection pads a
                  single-colour listing to `[hex, hex]` and a colourless one to a
                  neutral pair, so counting this array would announce "2 colours"
                  for a product that comes in one. Swatches only, and none at all
                  when there is no real colour to show. */}
              {(() => {
                const swatches = swatchesOf(p.colors);
                return swatches.length ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 }}>
                    {swatches.map((c, ci) => (
                      <View key={ci} style={[{ width: 13, height: 13, backgroundColor: c }, BORDER(1)]} />
                    ))}
                  </View>
                ) : null;
              })()}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: SP.s }}>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                  <Text style={[T.price]}>₹{p.price}</Text>
                  {p.discount > 0 && <Text style={[T.mrp]}>₹{p.original}</Text>}
                </View>
                {p.discount > 0 && (
                  <Text style={[T.micro, { color: C.green, marginTop: 2 }]}>{`You save ₹${p.original - p.price}`}</Text>
                )}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Feather name="zap" size={11} color={C.dim} />
                <Text style={[T.micro, { color: C.dim }]}>60 min</Text>
              </View>
            </View>
          </View>
        </Pressable>
      </FadeInUp>
    )
  ), [grid, label, sort, cardRadius, openZoom]);

  // ═══ HERO — home's visual language: the category's own art, dark scrims,
  // white type, frosted search. Rendered INSIDE the list so it scrolls away;
  // the compact pinned bar below takes over. Flash sale keeps its Lottie header.
  const heroBlock = !isFlash && (
        <View style={{ height: HERO_H, backgroundColor: C.ink, overflow: 'hidden' }}>
          {bannerArt !== null && (
            <CachedImage source={bannerArt} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" />
          )}
          <LinearGradient colors={['rgba(0,0,0,0.75)', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0)']} locations={[0, 0.65, 1]} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top + 90 }} pointerEvents="none" />
          <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.82)']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 150 }} pointerEvents="none" />

          {/* Top row — back · logo · grid/list toggle · bag, white over the scrim */}
          <View style={{ position: 'absolute', top: insets.top + SP.s, left: SP.l, right: SP.l, flexDirection: 'row', alignItems: 'center' }}>
            <Pressable onPress={() => nav.goBack()} hitSlop={12}>
              <Feather name="arrow-left" size={22} color="#fff" />
            </Pressable>
            <TrendzoLogo height={15} style={{ marginLeft: SP.m }} />
            <View style={{ flex: 1 }} />
            <Pressable onPress={() => setGrid(grid === 2 ? 1 : 2)} hitSlop={10} style={{ marginRight: SP.l }}>
              <Feather name={grid === 2 ? 'list' : 'grid'} size={20} color="#fff" />
            </Pressable>
            {/* Carries the live bag count — it was a bare glyph, so adding
                something from a product page changed nothing visible here. */}
            <BagButton bare light size={22} onPress={goBag} />
          </View>

          {/* Title block, bottom-anchored like the home hero. No kicker (the
              logo already brands the top row) and no in-hero search — search
              lives in the compact pinned bar that arrives on scroll. */}
          <View style={{ position: 'absolute', left: SP.l, right: SP.l, bottom: SP.m }}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={[T.display, { color: '#fff', textTransform: 'uppercase', ...HERO_SHADOW }]}>
              {label}
            </Text>
            <Text style={[T.micro, { color: 'rgba(255,255,255,0.85)', marginTop: 3, ...HERO_SHADOW }]}>
              {/* Prefer the facet total over the fetched length. Facet counts can
                  read a hair high (they don't drop fully sold-out listings — see
                  §4.9), so this is an "about this many", which is still far more
                  honest than announcing the page size as the catalogue size. */}
              {/* `total` is the facet count for the WHOLE category — getFacets is
                  deliberately called without the sub-category filter. So while a
                  chip is active it would announce the parent's size next to a
                  narrowed grid. Count the chip when one is chosen. */}
              {status === 'ready' && (activeCount ?? sorted.length) > 0
                ? `${activeCount ?? sorted.length} styles · 60-min delivery`
                : '60-min delivery · door to door'}
            </Text>
          </View>
        </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <BrutalStatusBar />

      {/* ═══ COMPACT PINNED BAR — slides in once the hero has scrolled away:
          just the logo row and the search, white surface like the app's bars. ═══ */}
      {!isFlash && (
        <MotiView
          pointerEvents={compact ? 'auto' : 'none'}
          from={{ translateY: -160, opacity: 0 }}
          animate={{ translateY: compact ? 0 : -160, opacity: compact ? 1 : 0 }}
          transition={{ type: 'timing', duration: 200 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30, backgroundColor: C.white, paddingTop: insets.top + 6, paddingBottom: SP.s, paddingHorizontal: SP.l, borderBottomWidth: 1, borderColor: C.hairline }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable onPress={() => nav.goBack()} hitSlop={12}>
              <Feather name="arrow-left" size={22} color={C.ink} />
            </Pressable>
            <TrendzoLogo height={15} tint={C.ink} style={{ marginLeft: SP.m }} />
            <View style={{ flex: 1 }} />
            <Pressable onPress={() => setGrid(grid === 2 ? 1 : 2)} hitSlop={10} style={{ marginRight: SP.l }}>
              <Feather name={grid === 2 ? 'list' : 'grid'} size={20} color={C.ink} />
            </Pressable>
            <BagButton bare size={22} onPress={goBag} />
          </View>
          <Pressable
            onPress={() => nav.navigate('Search')}
            style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: SP.s, paddingHorizontal: SP.m, paddingVertical: 10, backgroundColor: '#F4F4F4' }, BORDER(1)]}
          >
            <Feather name="search" size={16} color={C.ink} />
            <Text style={[T.body, { flex: 1, color: C.dim }]} numberOfLines={1}>{`Search in ${label}...`}</Text>
          </Pressable>
        </MotiView>
      )}

      {/* ═══ FLASH-SALE HEADER — unchanged: white bar, logo, location, Lottie carts ═══ */}
      {isFlash && (
      <View style={{ paddingTop: HEADER_TOP, paddingHorizontal: SP.l, paddingBottom: SP.m, backgroundColor: C.white }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1 }}>
            <Pressable onPress={() => nav.goBack()} hitSlop={10} style={{ paddingTop: 4 }}>
              <Feather name="arrow-left" size={22} color={C.ink} />
            </Pressable>
            <View>
              <TrendzoLogo height={16} tint={C.ink} style={{ marginTop: 4 }} />
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
            <BagButton onPress={goBag} />
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
      )}
      {isFlash && <View style={{ height: 1, backgroundColor: C.hairline }} />}

      {/* Virtualised: the grid used to mount all 60 cards at once, each wrapped in
          a Moti animation. numColumns cannot change on a live FlatList, so `key`
          forces a fresh list when the user flips grid/list mode. */}
      <FlatList
        key={grid === 2 ? 'grid2' : 'list1'}
        data={sorted}
        renderItem={renderProduct}
        keyExtractor={keyExtractor}
        numColumns={grid === 2 ? 2 : 1}
        {...(grid === 2 ? { columnWrapperStyle: { gap: SP.s, paddingHorizontal: SP.l } } : {})}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={Platform.OS === 'android'}
        windowSize={5}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        updateCellsBatchingPeriod={60}
        onScroll={onListScroll}
        scrollEventThrottle={32}
        contentContainerStyle={{ paddingBottom: 120 }}
        ListHeaderComponent={
      <View>
        {/* Full-bleed hero scrolls away with the list; the pinned bar takes over. */}
        {heroBlock}
        {/* ═══ SUB-CATEGORY CHIPS — what is actually inside this category.
               Tapping one narrows the grid below without leaving the page. ═══ */}
        {chips.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: SP.l, paddingTop: SP.m, gap: SP.s }}
          >
            {[{ label: 'ALL', slug: '', count: total ?? 0 }, ...chips].map((c) => {
              const on = filter === c.label;
              return (
                <Pressable
                  key={c.slug || 'ALL'}
                  onPress={() => setFilter(c.label)}
                  style={[{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: on ? C.ink : C.white }, BORDER(1)]}
                >
                  <Text style={[T.caption, { color: on ? C.white : C.ink }]}>{c.label}</Text>
                  {c.count > 0 && (
                    <Text style={[T.micro, { color: on ? 'rgba(255,255,255,0.6)' : C.dim }]}>{c.count}</Text>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        )}
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
        visible={sheet === 'filter'}
        title={facetCats.length ? 'Narrow by category' : 'Filter'}
        options={filterOptions}
        selected={filter}
        onSelect={(v) => { setFilter(v); closeSheet(); }}
        onClose={closeSheet}
      />
    </View>
  );
}

function StatDivider() {
  return <View style={{ width: 1, backgroundColor: C.white, opacity: 0.3, marginVertical: 4 }} />;
}
