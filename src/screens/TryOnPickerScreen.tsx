import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, T, SP, BORDER, HELV, HEADER_TOP } from '../theme/brutal';
import { BrutalStatusBar, BrutalButton, CachedImage, OptionSheet, CARD } from '../components/Brutal';
import { useApp } from '../state/AppState';
import { useCatalogProducts } from '../hooks/useCatalogProducts';
import { listCategoryTree } from '../services/catalog';
import { CatalogSection, CatalogEmpty } from '../components/CatalogState';

/**
 * Chips are built from the LIVE taxonomy, not from this list.
 *
 * They used to be five hardcoded words, and — worse — `cat` was never read by
 * the query, so tapping a chip highlighted it and returned the exact same
 * products. Real top-level categories, filtered server-side by slug.
 */
const ALL = 'All';

/** The picker's wording → the API's sort keys. Sorting happens server-side. */
const SORTS = ['NEWEST', 'PRICE: LOW TO HIGH', 'PRICE: HIGH TO LOW', 'RATING'] as const;
const SORT_PARAM: Record<string, 'newest' | 'price_asc' | 'price_desc' | 'rating'> = {
  NEWEST: 'newest',
  'PRICE: LOW TO HIGH': 'price_asc',
  'PRICE: HIGH TO LOW': 'price_desc',
  RATING: 'rating',
};

/**
 * Pick what to try on FIRST — search / explore products, tap one to try it on.
 *
 * Every item here has to be a REAL listing: try-on resolves the garment by
 * `listingId` server-side, so a bundled demo product can only ever produce the
 * "Try-on works on store products only" refusal. This screen used to list the
 * demo catalogue exclusively, which meant every single tile dead-ended.
 */
export default function TryOnPickerScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { gender, requireAuth, token, authHydrated } = useApp();
  const mode: 'ar' | 'photo' = route.params?.mode || 'ar';
  const [q, setQ] = useState('');
  const [cat, setCat] = useState(ALL);
  const [sort, setSort] = useState<string>('NEWEST');
  const [sheet, setSheet] = useState<null | 'sort' | 'filter'>(null);
  /** Top-level categories that actually have stock, from /catalog/categories. */
  const [cats, setCats] = useState<{ label: string; slug: string }[]>([]);
  useEffect(() => {
    let cancelled = false;
    listCategoryTree(gender)
      .then((roots) => {
        if (cancelled) return;
        setCats(roots.filter((r) => r.listingCount > 0).map((r) => ({ label: r.label, slug: r.slug })));
      })
      .catch(() => { if (!cancelled) setCats([]); });
    return () => { cancelled = true; };
  }, [gender]);
  // A chip chosen on the her rail is meaningless on the him rail.
  useEffect(() => { setCat(ALL); }, [gender]);
  const catSlug = cat === ALL ? undefined : cats.find((c) => c.label === cat)?.slug;

  /**
   * Try-on is auth-gated SERVER-SIDE, so an anonymous browse of this grid can
   * only ever end in a refusal.
   *
   * The gate used to sit on the tile: you could open the whole picker signed
   * out, browse it, tap something and only then be asked to sign in — and the
   * sheet is a <Modal>, which does not reliably present from over the
   * transparentModal this screen is. Asking once, up front, on a plain page
   * that can actually show the sheet, is both honest and reliable.
   */
  const signedIn = !!token;
  const askedRef = React.useRef(false);
  useEffect(() => {
    // Wait for the persisted session to be read, or a returning user is asked
    // to sign in for a fraction of a second before their token loads.
    if (!authHydrated || signedIn || askedRef.current) return;
    askedRef.current = true;
    requireAuth();
  }, [authHydrated, signedIn, requireAuth]);

  // Debounced so a fast typist does not fire a request per keystroke.
  const [term, setTerm] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  /**
   * An explicit search is NOT gender-filtered; an idle browse is.
   *
   * Typing a name is a statement of intent — "Kenneth Cole Shirt" is a HIM
   * listing, so searching it from the HER rail returned nothing at all while the
   * store plainly stocks it. Browsing with no term keeps the shopper's rail so
   * the default grid is relevant rather than the entire catalog.
   *
   * (SearchScreen solves the same problem by searching the rail first and
   * widening only when empty. Here there is no reason to prefer the rail at all:
   * you can feature or try on anything the store sells.)
   */
  const { products: results, status, reload } = useCatalogProducts({
    ...(term ? { search: term } : { gender }),
    // The chip actually narrows the query now.
    ...(catSlug ? { categorySlug: catSlug } : {}),
    sort: SORT_PARAM[sort] ?? 'newest',
    limit: 40,
  });

  const filterOptions = useMemo(() => [ALL, ...cats.map((c) => c.label)], [cats]);

  // Signed out: one clear page with one action, instead of a grid that cannot
  // be used. The sheet is already opening from the effect above; this is what
  // is behind it, and the button re-opens it if it was dismissed.
  if (authHydrated && !signedIn) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <BrutalStatusBar />
        <View style={{ paddingTop: HEADER_TOP, paddingHorizontal: SP.l }}>
          <Pressable onPress={() => nav.goBack()} hitSlop={10}><Feather name="arrow-left" size={22} color={C.ink} /></Pressable>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SP.xl }}>
          <View style={[{ width: 84, height: 84, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F4F4' }, BORDER(1)]}>
            <Feather name="camera" size={34} color={C.ink} />
          </View>
          <Text style={[T.h2, { marginTop: SP.l, textTransform: 'uppercase', textAlign: 'center' }]}>Sign in to try it on</Text>
          <Text style={[T.caption, { color: C.dim, marginTop: 8, textAlign: 'center', maxWidth: 280 }]}>
            Try-on runs on your account so your looks are saved to it. It takes one code by SMS.
          </Text>
          <BrutalButton
            label="Sign in"
            iconRight="arrow-right"
            block
            style={{ marginTop: SP.xl, alignSelf: 'stretch' }}
            onPress={() => requireAuth()}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <BrutalStatusBar />

      {/* HEADER */}
      <View style={{ paddingTop: HEADER_TOP, paddingHorizontal: SP.l, paddingBottom: SP.m, backgroundColor: C.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.m }}>
          <Pressable onPress={() => nav.goBack()} hitSlop={10}><Feather name="arrow-left" size={22} color={C.ink} /></Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[T.h1, { textTransform: 'uppercase' }]}>What to try on?</Text>
            <Text style={[T.caption, { color: C.dim, marginTop: 2 }]}>{mode === 'ar' ? 'AR · Live camera' : 'Photo · Upload'} · pick an item below</Text>
          </View>
        </View>

        {/* SEARCH */}
        <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: SP.m, paddingVertical: 10, marginTop: SP.m }, BORDER(1)]}>
          <Feather name="search" size={16} color={C.dim} />
          <TextInput value={q} onChangeText={setQ} placeholder="Search products to try on..." placeholderTextColor={C.dim} style={[T.body, { flex: 1, padding: 0 }]} />
          {q.length > 0 && <Pressable onPress={() => setQ('')} hitSlop={8}><Feather name="x" size={16} color={C.dim} /></Pressable>}
        </View>

        {/* CATEGORY CHIPS */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SP.s, marginTop: SP.m }}>
          {filterOptions.map((c) => (
            <Pressable key={c} onPress={() => setCat(c)} style={[{ paddingHorizontal: 14, paddingVertical: 7, backgroundColor: cat === c ? C.ink : C.white }, BORDER(1)]}>
              <Text style={[T.caption, { color: cat === c ? C.white : C.ink }]}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <View style={{ height: 1, backgroundColor: C.hairline }} />

      {/* GRID — tap a product to try it on */}
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 100 + insets.bottom }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {status === 'ready' && (
          <Text style={[T.caption, { marginBottom: SP.m }]}>
            {`${results.length} item${results.length === 1 ? '' : 's'}${cat === ALL ? '' : ` in ${cat}`}`}
          </Text>
        )}
        <CatalogSection
          status={status}
          count={results.length}
          onRetry={reload}
          empty={<CatalogEmpty
            icon="search"
            title={term ? 'No matches' : 'Nothing to try on yet'}
            sub={term ? `No live listings match "${term}".` : 'Products appear here as stores go live.'}
          />}
        >
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {results.map((p) => (
              <Pressable key={p.id} onPress={() => requireAuth(() => nav.navigate('TryOn', { mode, product: p }))} style={{ width: CARD.w, marginBottom: SP.m }}>
                <View style={[{ height: CARD.imgH, overflow: 'hidden', backgroundColor: C.hairline }, BORDER(1)]}>
                  <CachedImage source={{ uri: p.img }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  {/* CTA overlay — black is allowed for call-to-action */}
                  <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 7, backgroundColor: C.ink }}>
                    <Feather name="camera" size={12} color={C.white} />
                    <Text style={[T.caption, { color: C.white }]}>Try this on</Text>
                  </View>
                </View>
                <Text style={[T.micro, { fontFamily: HELV, fontWeight: '600', color: C.ink, marginTop: 6 }]} numberOfLines={1}>{(p.brand ?? '').toUpperCase()}</Text>
                <Text style={[T.productName, { marginTop: 2 }]} numberOfLines={2}>{p.name}</Text>
                <Text style={[T.price, { marginTop: 3 }]}>₹{p.price}</Text>
              </Pressable>
            ))}
          </View>
        </CatalogSection>
      </ScrollView>

      {/* ═══ STICKY BOTTOM BAR — Sort · Filter, the same control the category
             and search grids have. This page was a bare grid in fetch order with
             no way to narrow or reorder it, which for forty-odd items is a lot
             of scrolling to find the one thing you wanted to see on yourself.
             No MEN/WOMEN switch: the rail belongs to Home (see CategoryScreen). ═══ */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: C.white, borderTopWidth: 1, borderColor: C.hairline, paddingBottom: insets.bottom }}>
        <Pressable onPress={() => setSheet('sort')} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14 }}>
          <Feather name="sliders" size={15} color={C.ink} />
          <Text style={[T.caption, { color: C.ink }]} numberOfLines={1}>{sort === 'NEWEST' ? 'Sort' : 'Sorted'}</Text>
        </Pressable>
        <View style={{ width: 1, backgroundColor: C.hairline }} />
        <Pressable onPress={() => setSheet('filter')} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14 }}>
          <Feather name="filter" size={15} color={C.ink} />
          <Text style={[T.caption, { color: C.ink }]} numberOfLines={1}>{cat === ALL ? 'Filter' : cat}</Text>
        </Pressable>
      </View>

      <OptionSheet
        visible={sheet === 'sort'}
        title="Sort by"
        options={SORTS}
        selected={sort}
        onSelect={(v) => { setSort(v); setSheet(null); }}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === 'filter'}
        title="Narrow by category"
        options={filterOptions}
        selected={cat}
        onSelect={(v) => { setCat(v); setSheet(null); }}
        onClose={() => setSheet(null)}
      />
    </View>
  );
}
