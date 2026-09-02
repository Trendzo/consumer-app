// Dedicated pages for the Home sections — each one a UNIQUE layout built in the
// modern Trendzo language (full-bleed art, soft gradients, hairline white cards,
// editorial headings). No two share a layout, and none of them is the generic
// Category browse page. All are gender-aware via useApp().gender.
//
//   • StealsScreen        — price-banded deals (bento hero + band filter + grid)
//   • TopStoriesScreen    — editorial magazine feed, every poster its own story
//   • ShopByOccasionScreen— occasion selector + themed hero + curated grid
//   • FlashFitScreen      — live countdown + a shoppable "fit" + more flash deals
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, T, SP, BORDER, rf, HELV} from '../theme/brutal';
import { CachedImage, ProductCard, FadeInUp, CARD, CARD_STYLES} from '../components/Brutal';
import { useApp } from '../state/AppState';
import type { Product } from '../data/mockData';
import { useCatalogProducts } from '../hooks/useCatalogProducts';
import { CatalogSection, CatalogEmpty, ProductRailSkeleton, Shimmer } from '../components/CatalogState';
import {
  getCollection as fetchCollection,
  listCollectionProducts,
  type CollectionDetail,
} from '../services/catalog';
// ── Home CMS ──────────────────────────────────────────────────────────────────
// The hero art, price bands, story copy, occasion notes and both campaign Edit pages below
// used to be eight hardcoded arrays in this file. They are CMS sections now (`page.*`), with
// the identical content shipped in content/home.content.json as the offline fallback. Layouts
// and components are untouched.
import { useCmsSection, useCmsSections } from '../hooks/useCmsContent';
import type { CmsItem, CmsSection } from '../content/types';
import { resolveMedia, resolveConfigMedia, withSource, str, num, color, type MediaSource } from '../content/media';
import { openLink } from '../content/links';
import { getCollection } from '../content/collections';
import { IMG } from '../services/images';

const { width: W } = Dimensions.get('window');

// ─── SHARED HEADER — modern, minimal: back arrow · centered wordmark · slot ───
function SectionHeader({ title, onBack, right }: { title: string; onBack: () => void; right?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: C.white }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SP.l, paddingTop: insets.top + 8, paddingBottom: SP.m }}>
        <Pressable onPress={onBack} hitSlop={12} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
          <Feather name="arrow-left" size={22} color={C.ink} />
        </Pressable>
        <Text style={[T.h3, { textTransform: 'uppercase', letterSpacing: 1 }]} numberOfLines={1}>{title}</Text>
        <View style={{ width: 40, alignItems: 'flex-end' }}>{right}</View>
      </View>
      <View style={{ height: 1, backgroundColor: C.hairline }} />
    </View>
  );
}

/**
 * Every grid on these four pages used to come from `buildPool`.
 *
 * It concatenated the bundled demo arrays, cloned them up to a target size
 * with ids like `pool-7-p3`, and — for the deal pages — MULTIPLIED each price
 * by one of five factors so the results would spread nicely across the price
 * bands. So "Under ₹499" was a real filter over invented prices for products
 * that do not exist, and every tile opened a buyable product page with no
 * listing behind it.
 *
 * These pages now read the live catalog. Where a page needs a price band it
 * asks the backend for cheapest-first and filters on the real price; where a
 * band has nothing in it, it says so.
 */
const SECTION_PAGE_SIZE = 40;

// ════════════════════════════════════════════════════════════════════════════
// STEALS — price-banded deals. Editorial hero, a band selector, a small bento of
// hero deals, then a savings-first product grid that filters by the active band.
// ════════════════════════════════════════════════════════════════════════════
// Hero art, deal tiles and price bands are the `page.steals_hero`, `page.steals_bento` and
// `page.steals_bands` sections. A band's ceiling is authored in PAISE (the unit every money
// value in this codebase uses) and converted where the filter runs, so admin never has to
// think about the app's internal rupee-float representation.
const STEAL_GAP = SP.s;
const STEAL_COL = (W - SP.l * 2 - STEAL_GAP) / 2;
const STEAL_SMALL_H = Math.round(STEAL_COL * 0.95);
const STEAL_BIG_H = STEAL_SMALL_H * 2 + STEAL_GAP;

function DealTile({ label, priceLine, img, w, h, onPress }: { label: string; priceLine: string; img: MediaSource; w: number; h: number; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[{ width: w, height: h, overflow: 'hidden', backgroundColor: C.white }, BORDER(1)]}>
      <CachedImage source={img} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" />
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.72)']} start={{ x: 0, y: 0.5 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFillObject as any} />
      <View style={{ position: 'absolute', left: SP.s, right: SP.s, bottom: SP.s }}>
        <Text style={[T.body, { color: '#fff' }]}>{label}</Text>
        <Text style={[T.micro, { color: 'rgba(255,255,255,0.85)', marginTop: 4 }]}>Starting at</Text>
        <Text style={[T.h1, { color: '#fff', marginTop: -1 }]}>{priceLine}</Text>
      </View>
    </Pressable>
  );
}

export function StealsScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { gender } = useApp();
  const [band, setBand] = useState(0);
  // A tapped deal tile hands its own ceiling through in paise. Without it every
  // tile — "Under ₹999", "Under ₹1499", "Under ₹2499" — landed on band 0
  // ("All deals"), so the price on the card was decoration.
  const wantMaxPaise: number | null =
    typeof route.params?.maxPaise === 'number' && route.params.maxPaise > 0
      ? route.params.maxPaise
      : null;
  const { sections: cms, status: cmsStatus } = useCmsSections(
    ['page.steals_hero', 'page.steals_bento', 'page.steals_bands'],
    gender,
  );
  // Reaching this screen normally means Home already resolved the payload, so this is 'ready';
  // 'loading' happens on a cold start straight into it.
  const cmsLoading = cmsStatus === 'loading';
  const heroSection = cms['page.steals_hero']!;
  const bentoSection = cms['page.steals_bento']!;
  const bandsSection = cms['page.steals_bands']!;

  const heroImg = resolveMedia(heroSection.items[0], IMG.hero);
  const bento = useMemo(
    () =>
      bentoSection.items
        .map((item) => ({ item, source: resolveMedia(item, IMG.card), label: str(item.content, 'label') }))
        .filter(withSource)
        .slice(0, 3),
    [bentoSection.items],
  );
  // `maxPaise` absent means no ceiling — that is the "All deals" band. Product prices are in
  // rupees on the client, so the paise ceiling is divided here rather than authored twice.
  const bands = useMemo(() => {
    const authored = bandsSection.items.map((item) => ({
      key: item.key,
      label: str(item.content, 'label'),
      max: item.content.maxPaise === undefined ? Infinity : num(item.content, 'maxPaise', 0) / 100,
    }));
    if (wantMaxPaise == null) return authored;
    const already = authored.some((b) => Number.isFinite(b.max) && Math.round(b.max * 100) === wantMaxPaise);
    if (already) return authored;
    // The tile named a ceiling nobody authored a chip for — "Under ₹2499" has no
    // band. Rather than silently dropping the shopper on "All deals" (the exact
    // bug), synthesise the chip so the filter they asked for actually exists.
    return [
      ...authored,
      { key: `band-${wantMaxPaise}`, label: `Under ₹${Math.round(wantMaxPaise / 100)}`, max: wantMaxPaise / 100 },
    ];
  }, [bandsSection.items, wantMaxPaise]);

  // Preselect ONCE, after the bands arrive from the CMS. Guarded by a ref so a
  // later re-render cannot yank the selection back from under a shopper who has
  // since tapped a different chip.
  const bandPreselected = useRef(false);
  useEffect(() => {
    if (bandPreselected.current || wantMaxPaise == null || bands.length === 0) return;
    const i = bands.findIndex((b) => Number.isFinite(b.max) && Math.round(b.max * 100) === wantMaxPaise);
    if (i >= 0) {
      setBand(i);
      bandPreselected.current = true;
    }
  }, [bands, wantMaxPaise]);

  const activeBand = bands[band] ?? bands[0];
  const activeMax = activeBand?.max ?? Infinity;
  const activeLabel = activeBand?.label ?? 'All deals';

  /**
   * The tile's category, carried through from the CMS item.
   *
   * Without it this screen queried the whole catalog cheapest-first, so a tile reading
   * "T-shirts under ₹1499" returned face serum and beard oil — the cheapest things in
   * the catalog, whatever they were — and every tile showed the same grid because the
   * price was the only thing that varied.
   */
  const categorySlug: string | undefined =
    typeof route.params?.categorySlug === 'string' && route.params.categorySlug
      ? route.params.categorySlug
      : undefined;

  // Cheapest first, so a "Under ₹499" band is filled from the actual bottom of
  // the catalog rather than from whatever the first page happened to contain.
  const { products, status, reload } = useCatalogProducts({
    gender,
    sort: 'price_asc',
    limit: SECTION_PAGE_SIZE,
    ...(categorySlug ? { categorySlug } : {}),
    ...(Number.isFinite(activeMax) ? { maxPricePaise: Math.round(activeMax * 100) } : {}),
  });

  // Also filtered here. Not a fallback that invents data — the ceiling is applied
  // server-side too, and re-applying a numeric bound is idempotent. It keeps the band
  // honest against a backend that predates `maxPricePaise` and silently drops it,
  // rather than showing a ₹4,000 jacket under "Under ₹2499".
  const deals = useMemo(() => products.filter((p) => p.price <= activeMax), [products, activeMax]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SectionHeader title="Steals" onBack={() => nav.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>
        {/* ── HERO — full-bleed steal photo with a bold savings headline ── */}
        {cmsLoading ? (
          <Shimmer h={Math.round(W * 0.62)} />
        ) : (
        <View style={{ height: Math.round(W * 0.62), overflow: 'hidden' }}>
          {heroImg ? <CachedImage source={heroImg} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" /> : null}
          <LinearGradient colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.78)']} style={StyleSheet.absoluteFillObject as any} />
          <View style={{ flex: 1, justifyContent: 'flex-end', padding: SP.l }}>
            {heroSection.kicker ? (
              <View style={{ alignSelf: 'flex-start', backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 4, marginBottom: 10 }}>
                <Text style={[T.micro, { color: C.ink, fontFamily: HELV, fontWeight: '700', letterSpacing: 1 }]}>{heroSection.kicker}</Text>
              </View>
            ) : null}
            <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(46), lineHeight: rf(46), color: '#fff', letterSpacing: -1.5 }}>{heroSection.title ?? ''}</Text>
            <Text style={[T.caption, { color: 'rgba(255,255,255,0.9)', marginTop: 10 }]}>{heroSection.subtitle ?? ''}</Text>
          </View>
        </View>
        )}

        {/* ── PRICE-BAND SELECTOR ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SP.l, gap: SP.s, paddingVertical: SP.l }}>
          {bands.map((b, i) => (
            <Pressable key={b.key} onPress={() => setBand(i)} style={[{ paddingHorizontal: 16, paddingVertical: 9, backgroundColor: band === i ? C.ink : C.white }, BORDER(1)]}>
              <Text style={[T.caption, { color: band === i ? C.white : C.ink }]}>{b.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* No bento here — those three deal tiles are the exact same trio the
            shopper just saw (and tapped through) on Home's Steals section.
            The page goes straight from the bands to the live deal grid. */}

        {/* ── DEAL GRID — filtered by the active band ── */}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: SP.l, marginTop: SP.xl }}>
          <Text style={[T.h2, { textTransform: 'uppercase' }]}>{activeLabel}</Text>
          <Text style={[T.micro]}>{deals.length} steals</Text>
        </View>
        <View style={{ paddingHorizontal: SP.l, marginTop: SP.m }}>
          <CatalogSection
            status={status}
            count={deals.length}
            onRetry={reload}
            empty={<CatalogEmpty
              title="Nothing in this band"
              sub={`No live listings ${activeLabel.toLowerCase()} right now. Try a wider band.`}
            />}
          >
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: STEAL_GAP }}>
              {deals.map((p, i) => {
                // Real discount, or no badge. It used to be
                // `Math.max(20, …)` — a floor that stamped "20% OFF" on
                // full-price items.
                const off = p.original > p.price ? Math.round((1 - p.price / p.original) * 100) : 0;
                return (
                  <FadeInUp key={p.id} delay={(i % 6) * 30}>
                    {/* No % OFF chip over the photo — the discount already shows
                        in the card's own price row. */}
                    <ProductCard p={p} style={CARD_STYLES.mb_s} />
                  </FadeInUp>
                );
              })}
            </View>
          </CatalogSection>
        </View>

        {deals.length > 0 && (
          <View style={{ alignItems: 'center', marginTop: SP.xl }}>
            <Text style={[T.micro]}>That's the lot for now · new steals in 60 min</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TOP STORIES OF THE WEEK — an editorial magazine. A featured lead story, then a
// vertical feed where EVERY poster carries its own headline, chapter number,
// blurb, tags and a shoppable product rail. No two stories read the same.
// ════════════════════════════════════════════════════════════════════════════
type Story = {
  id: string;
  img: MediaSource;
  link: CmsItem['link'];
  tag: string;
  title: string;
  blurb: string;
  read: string;
  tags: string[];
};

// The nine stories are the `page.top_stories` CMS section — one item per story, carrying its
// poster plus tag / title / blurb / read time / tags.
const STORY_LEAD_H = Math.round(W * 1.12);
const STORY_POSTER_H = Math.round(W * 0.92);

// PRODUCTS ONLY. The trailing "Shop all" tile used to sit at the end of every
// rail and pushed straight into the generic catalog — the exact redirect this
// page is meant not to do. The rail is now purely shoppable cards: the only
// tappable things on Top Stories are the products themselves.
function StoryRail({ products }: { products: (Product & { id: string })[] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SP.m, paddingRight: SP.l }}>
      {products.map((p) => (
        <ProductCard key={p.id} p={p} style={CARD_STYLES.railCell} />
      ))}
    </ScrollView>
  );
}

export function TopStoriesScreen() {
  const nav = useNavigation<any>();
  const storiesRoute = useRoute<any>();
  const { gender } = useApp();
  const { section } = useCmsSection('page.top_stories', gender);
  // Which story the shopper tapped on Home. Index, not key: home.top_stories and
  // page.top_stories use different key spaces (`her-story-1` vs `hs1`), so
  // position is the only reliable join between the two sections.
  const wantStoryIndex: number | null =
    typeof storiesRoute.params?.storyIndex === 'number' && storiesRoute.params.storyIndex >= 0
      ? storiesRoute.params.storyIndex
      : null;
  const storyScrollRef = useRef<ScrollView>(null);
  /** Content-relative y of each story block, filled in by onLayout. */
  const storyYRef = useRef<Record<number, number>>({});
  const scrolledToStory = useRef(false);

  /**
   * Jump to the tapped story once its block has been laid out.
   *
   * Retries on each layout rather than firing once on mount: the posters are
   * remote images and a block's y is not known until it has measured, so an
   * immediate scrollTo would land at 0. Guarded by a ref so it happens exactly
   * once and never fights the shopper's own scrolling afterwards.
   */
  const maybeScrollToStory = useCallback(() => {
    if (scrolledToStory.current || wantStoryIndex == null) return;
    const y = storyYRef.current[wantStoryIndex];
    if (y == null) return;
    scrolledToStory.current = true;
    // Slightly above the block so its chapter marker stays visible.
    storyScrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
  }, [wantStoryIndex]);
  const stories = useMemo<Story[]>(
    () =>
      section.items
        .map((item) => ({ item, source: resolveMedia(item, IMG.hero) }))
        .filter(withSource)
        .map(({ item, source }) => ({
          id: item.key,
          img: source,
          link: item.link,
          tag: str(item.content, 'tag'),
          title: str(item.content, 'title'),
          blurb: str(item.content, 'blurb'),
          read: str(item.content, 'read'),
          tags: Array.isArray(item.content.tags)
            ? (item.content.tags as unknown[]).filter((t): t is string => typeof t === 'string')
            : [],
        })),
    [section.items],
  );
  const { products, status } = useCatalogProducts({ gender, limit: SECTION_PAGE_SIZE });
  const lead = stories[0];
  const rest = stories.slice(1);
  // Each story gets a DIFFERENT slice of the catalog so its rail is unique.
  // Wraps around rather than running dry when the catalog is smaller than the
  // number of stories — but only over products that genuinely exist.
  const railFor = (i: number) => {
    if (products.length === 0) return [];
    const start = (i * 5) % products.length;
    return products.slice(start, start + 5);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SectionHeader title="Top Stories" onBack={() => nav.goBack()} />
      <ScrollView ref={storyScrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>
        {/* ── SECTION INTRO ── */}
        <View style={{ alignItems: 'center', paddingTop: SP.l, paddingHorizontal: SP.l }}>
          <Text style={[T.micro, { letterSpacing: 2, color: C.dim }]}>{section.kicker ?? ''}</Text>
          <Text style={[T.h1, { textAlign: 'center', textTransform: 'uppercase', marginTop: 6 }]}>{section.title ?? 'Top Stories'}</Text>
        </View>

        {/* ── FEATURED LEAD — tall full-bleed cover ── */}
        {lead ? (
        // NOT pressable. The cover used to open the generic catalog; the story
        // is now read in place and shopped from the rail directly beneath it.
        <View
          onLayout={(e) => { storyYRef.current[0] = e.nativeEvent.layout.y; maybeScrollToStory(); }}
          style={{ marginHorizontal: SP.l, marginTop: SP.l }}
        >
          <View style={[{ height: STORY_LEAD_H, overflow: 'hidden', backgroundColor: C.hairline }, BORDER(1)]}>
            <CachedImage source={lead.img} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" />
            <LinearGradient colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.85)']} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFillObject as any} />
            <View style={{ position: 'absolute', top: SP.m, left: SP.m, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={[T.micro, { color: C.ink, fontFamily: HELV, fontWeight: '700', letterSpacing: 1 }]}>COVER STORY</Text>
              </View>
              {lead.read ? (
                <View style={{ backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={[T.micro, { color: '#fff' }]}>{lead.read} read</Text>
                </View>
              ) : null}
            </View>
            <View style={{ position: 'absolute', left: SP.l, right: SP.l, bottom: SP.l }}>
              <Text style={[T.caption, { color: 'rgba(255,255,255,0.85)' }]}>{lead.tag}</Text>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(38), lineHeight: rf(40), color: '#fff', letterSpacing: -1, marginTop: 4 }}>{lead.title}</Text>
              <Text style={[T.body, { color: 'rgba(255,255,255,0.9)', marginTop: 8 }]} numberOfLines={2}>{lead.blurb}</Text>
              {/* The "Shop the story →" affordance is gone with the tap target —
                  it promised a navigation the cover no longer performs. */}
            </View>
          </View>
        </View>
        ) : null}

        {/* Cover story's own shoppable rail — every card on this page now has
            products under it, the lead included (it previously had none). */}
        {lead ? (
          status === 'loading' ? (
            <View style={{ marginTop: SP.l }}><ProductRailSkeleton count={3} /></View>
          ) : railFor(0).length > 0 ? (
            <View style={{ marginTop: SP.l, paddingLeft: SP.l }}>
              <StoryRail products={railFor(0)} />
            </View>
          ) : null
        ) : null}

        {/* ── STORY FEED — every entry is its own poster + copy + product rail ── */}
        {rest.map((s, i) => (
          <View
            key={s.id}
            onLayout={(e) => { storyYRef.current[i + 1] = e.nativeEvent.layout.y; maybeScrollToStory(); }}
            style={{ marginTop: SP.xxl }}
          >
            {/* chapter marker */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.s, paddingHorizontal: SP.l }}>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(18), color: C.ink }}>{`0${i + 2}`}</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: C.hairline }} />
              <Text style={[T.micro, { letterSpacing: 1.5, color: C.dim }]}>{s.tag.toUpperCase()}</Text>
            </View>

            {/* NOT pressable — see the cover above. Products below are the only
                tap targets on this page. */}
            <View style={{ marginHorizontal: SP.l, marginTop: SP.m }}>
              <View style={[{ height: STORY_POSTER_H, overflow: 'hidden', backgroundColor: C.hairline }, BORDER(1)]}>
                <CachedImage source={s.img} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" />
                <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)']} start={{ x: 0, y: 0.45 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFillObject as any} />
                <View style={{ position: 'absolute', left: SP.l, right: SP.l, bottom: SP.l }}>
                  <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(30), lineHeight: rf(32), color: '#fff', letterSpacing: -0.8 }}>{s.title}</Text>
                </View>
              </View>
            </View>

            {/* copy + tags */}
            <View style={{ paddingHorizontal: SP.l, marginTop: SP.m }}>
              <Text style={[T.body, { color: C.inkSoft }]}>{s.blurb}</Text>
              <View style={{ flexDirection: 'row', gap: SP.s, marginTop: SP.m }}>
                {s.tags.map((t) => (
                  <View key={t} style={[{ paddingHorizontal: 10, paddingVertical: 5, backgroundColor: C.white }, BORDER(1)]}>
                    <Text style={[T.micro, { color: C.ink }]}>{t}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* shoppable rail — omitted entirely when the catalog is empty,
                rather than filled with bundled art the store cannot sell */}
            {status === 'loading' ? (
              <View style={{ marginTop: SP.l }}><ProductRailSkeleton count={3} /></View>
            ) : railFor(i + 1).length > 0 ? (
              // i + 1: slice 0 now belongs to the cover story's rail above, so
              // the feed starts at 1 and every story still gets a distinct set.
              <View style={{ marginTop: SP.l, paddingLeft: SP.l }}>
                <StoryRail products={railFor(i + 1)} />
              </View>
            ) : null}
          </View>
        ))}

        <View style={{ alignItems: 'center', marginTop: SP.xxl }}>
          <Text style={[T.micro]}>{section.subtitle ?? ''}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SHOP BY OCCASION — pick the moment, get the look. A pill selector switches the
// themed hero (pastel gradient + product cutout + styling note) and a curated
// grid beneath it. Every occasion has its own tint so the page feels re-dressed.
// ════════════════════════════════════════════════════════════════════════════
// The occasions are the `page.occasion` CMS section. `id` is the item key, and it doubles as
// the collection slug the grid resolves against — which is why the key matters here and is not
// just a React key: `listCollectionProducts(occ.id)` looks it up in the catalog.
type Occ = {
  id: string;
  label: string;
  img: MediaSource;
  note: string;
  tint: readonly [string, string];
  accent: string;
};

export function ShopByOccasionScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { gender } = useApp();
  const { section, status: cmsStatus } = useCmsSection('page.occasion', gender);
  const occasions = useMemo<Occ[]>(
    () =>
      section.items
        .map((item) => ({ item, source: resolveMedia(item, IMG.card) }))
        .filter(withSource)
        .map(({ item, source }) => ({
          id: item.key,
          label: str(item.content, 'label'),
          img: source,
          note: str(item.content, 'note'),
          tint: [
            color(item.content, 'tintFrom', '#EEF2F6'),
            color(item.content, 'tintTo', '#D9E2EC'),
          ] as const,
          accent: color(item.content, 'accent', '#4F6C8A'),
        })),
    [section.items],
  );
  // Home passes an occasion slug (e.g. "streetwear"); match by id / prefix / label.
  const param = String(route.params?.occasion ?? '').toLowerCase();
  const found = param
    ? occasions.findIndex((o) => param === o.id || param.startsWith(o.id) || param === o.label.toLowerCase())
    : -1;
  const [active, setActive] = useState(found === -1 ? 0 : found);
  const occ = occasions[Math.min(active, Math.max(0, occasions.length - 1))];
  /**
   * The grid is the occasion's collection. Nothing else.
   *
   * `GET /catalog/collections/:slug?gender=` resolves an occasion straight from the live
   * catalog — the slug is the occasion tag itself, and gender narrows to that rail plus
   * unisex. There is deliberately NO fallback to a generic browse: this page previously
   * rendered one whenever the lookup came back empty, which meant every occasion showed
   * an identical grid under a heading promising Brunch or Gym. An empty occasion now
   * says it is empty, and a failed request says it failed.
   */
  const occId = occ?.id ?? '';
  const [occState, setOccState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [occProducts, setOccProducts] = useState<Product[]>([]);
  // Bumped by Retry; in the effect's deps so pressing it actually refetches.
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setOccState('loading');
    setOccProducts([]);
    // No occasions at all (section disabled, or every one out of window) — nothing to resolve.
    if (!occId) { setOccState('missing'); return; }
    listCollectionProducts(occId, { gender, limit: SECTION_PAGE_SIZE })
      .then((res) => {
        if (cancelled) return;
        if (res.status === 'ok') { setOccProducts(res.products); setOccState('ready'); }
        else setOccState(res.status);
      })
      .catch(() => { if (!cancelled) setOccState('error'); });
    return () => { cancelled = true; };
  }, [occId, gender, reloadKey]);
  const grid = occProducts.slice(0, 8);
  const gridStatus = occState === 'loading' ? 'loading' : occState === 'ready' ? 'ready' : 'error';

  // Every hook above runs unconditionally; only the render short-circuits.
  //
  // "Nothing to show" and "not loaded yet" are different answers and must not look the same —
  // claiming there are no occasions while the request is still in flight is the exact mistake
  // CatalogState.tsx was written to stop.
  if (!occ) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <SectionHeader title="Occasions" onBack={() => nav.goBack()} />
        {cmsStatus === 'loading' ? (
          <View style={{ padding: SP.l, gap: SP.s }}>
            <Shimmer w={'40%'} h={10} />
            <Shimmer w={'70%'} h={26} />
            <Shimmer h={Math.round(W * 0.7)} style={{ marginTop: SP.m }} />
          </View>
        ) : (
          <CatalogEmpty title="No occasions right now" sub="Check back shortly — this page is being refreshed." />
        )}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SectionHeader title="Occasions" onBack={() => nav.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>
        {/* ── INTRO ── */}
        <View style={{ paddingHorizontal: SP.l, paddingTop: SP.l }}>
          <Text style={[T.micro, { letterSpacing: 2, color: C.dim }]}>{section.kicker ?? 'DRESS FOR THE MOMENT'}</Text>
          <Text style={[T.h1, { textTransform: 'uppercase', marginTop: 6 }]}>{section.title ?? 'Shop by Occasion'}</Text>
        </View>

        {/* ── OCCASION PILL SELECTOR ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SP.l, gap: SP.s, paddingVertical: SP.l }}>
          {occasions.map((o, i) => (
            <Pressable key={o.id} onPress={() => setActive(i)} style={[{ paddingHorizontal: 18, paddingVertical: 10, backgroundColor: active === i ? C.ink : C.white }, BORDER(1)]}>
              <Text style={[T.caption, { color: active === i ? C.white : C.ink }]}>{o.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* ── THEMED HERO — re-tints per occasion ── */}
        <View style={{ paddingHorizontal: SP.l }}>
          <View style={[{ height: Math.round(W * 0.7), overflow: 'hidden' }, BORDER(1)]}>
            <LinearGradient colors={occ.tint} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
            {/* giant faded occasion word */}
            <Text numberOfLines={1} style={{ position: 'absolute', top: 6, left: -6, right: -6, fontFamily: 'Inter_900Black', fontSize: rf(74), letterSpacing: -2, color: 'rgba(0,0,0,0.06)', textTransform: 'uppercase' }}>{occ.label}</Text>
            <View style={{ flex: 1, flexDirection: 'row' }}>
              <View style={{ flex: 1.05, padding: SP.l, justifyContent: 'center' }}>
                <View style={{ alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, backgroundColor: occ.accent }}>
                  <Text style={[T.micro, { color: '#fff', fontFamily: HELV, fontWeight: '700', letterSpacing: 0.5 }]}>{occ.label.toUpperCase()}</Text>
                </View>
                <Text style={[T.h2, { marginTop: 10, textTransform: 'uppercase' }]}>The {occ.label}{'\n'}Edit</Text>
                <Text style={[T.caption, { color: C.inkSoft, marginTop: 8 }]}>{occ.note}</Text>
              </View>
              <View style={{ flex: 0.95, alignItems: 'center', justifyContent: 'flex-end' }}>
                <CachedImage source={occ.img} style={{ width: '100%', height: '92%' }} resizeMode="contain" />
              </View>
            </View>
          </View>
        </View>

        {/* The card carousel that used to sit here was a SECOND occasion selector,
            duplicating the pill row above it — same occasions, same setActive, two
            controls competing to show which one is active. Removed; the pills are the
            selector and the hero is the answer. */}

        {/* ── CURATED GRID ── */}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: SP.l, marginTop: SP.xl }}>
          {/* The heading always names the occasion, because the grid always IS the
              occasion — there is no longer a generic-browse case to rename around. */}
          <Text style={[T.h2, { textTransform: 'uppercase' }]}>{`Wear it to ${occ.label}`}</Text>
        </View>
        <View style={{ paddingHorizontal: SP.l, marginTop: SP.m }}>
          <CatalogSection
            status={gridStatus}
            count={grid.length}
            onRetry={() => setReloadKey((n) => n + 1)}
            empty={
              <CatalogEmpty
                title={occState === 'missing' ? 'Not stocked yet' : 'Nothing here yet'}
                sub={
                  occState === 'missing'
                    ? `No products are tagged for ${occ.label} right now.`
                    : 'No live listings for this moment right now.'
                }
              />
            }
          >
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.s }}>
              {grid.map((p, i) => (
                <FadeInUp key={p.id} delay={(i % 6) * 30}>
                  <ProductCard p={p} style={CARD_STYLES.mb_s} />
                </FadeInUp>
              ))}
            </View>
          </CatalogSection>
        </View>
      </ScrollView>
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// FLASH FIT OF THE DAY — a live countdown, one fully shoppable "fit" (top +
// bottom + shoes) with a buy-the-whole-look CTA, then a grid of more flash deals.
// ════════════════════════════════════════════════════════════════════════════
/**
 * One piece of today's fit — a REAL listing, wearing its own category as the
 * slot label.
 *
 * HER_FIT / HIM_FIT used to live here: three hardcoded garments per gender with
 * invented prices and bundled art ("Ribbed Knit Top · ₹799, was ₹1499"). The
 * page summed those numbers into a "you save ₹2,900" headline and an "Add the
 * fit" button that only fired a toast — nothing was ever added, and none of the
 * three existed. The fit is now assembled from the live catalog.
 */
type FitPiece = { slot: string; label: string; price: number; original: number; img: any; product: Product };

/**
 * Categories you cannot wear.
 *
 * The fit is assembled cheapest-first, and the cheapest live listings are
 * routinely beauty — which produced "Today's Complete Fit: Fragrance + Makeup +
 * Nails". Every one of those was a real, in-stock product, so nothing was
 * fabricated, but three cosmetics are not an outfit and the heading says outfit.
 * Excluding them is a smaller lie than renaming the section.
 */
const NON_APPAREL = [
  'beauty', 'makeup', 'nails', 'skincare', 'fragrance', 'perfume',
  'hair accessories', 'grooming',
];

/**
 * One curated drop member as a tile.
 *
 * This replaced `assembleFit`, which built the "look" on the client by taking the
 * cheapest catalog page, discarding anything whose category name substring-matched a
 * hardcoded NON_APPAREL list, and keeping the first three distinct categories. That
 * produced three unrelated cheap items — not an outfit — and it silently changed
 * whenever prices moved. Curation belongs to whoever builds the drop.
 */
function toFitPiece(p: Product): FitPiece {
  return {
    slot: p.category || 'Piece',
    label: p.name,
    price: p.price,
    original: p.original,
    img: p.img,
    product: p,
  };
}

/**
 * Time left until `endsAt`, or null when the drop has no end date.
 *
 * This used to start at a hardcoded {h:5, m:32, s:8}, count down per mount, and wrap
 * back to 23 hours on reaching zero — so every shopper saw a different "remaining"
 * time, reopening the screen reset it, and nothing ever actually expired. The Home
 * screen ran a second copy starting at 2:47:19, so the two disagreed with each other.
 *
 * Now it counts to a real timestamp. Null end date means no countdown at all rather
 * than an invented one.
 */
function useFlashCountdown(endsAt: string | null | undefined) {
  const endMs = endsAt ? new Date(endsAt).getTime() : null;
  const remaining = useCallback(() => {
    if (endMs == null || !Number.isFinite(endMs)) return null;
    const ms = endMs - Date.now();
    if (ms <= 0) return { h: 0, m: 0, s: 0, done: true };
    return {
      h: Math.floor(ms / 3_600_000),
      m: Math.floor((ms % 3_600_000) / 60_000),
      s: Math.floor((ms % 60_000) / 1000),
      done: false,
    };
  }, [endMs]);

  const [t, setT] = useState(remaining);
  useFocusEffect(useCallback(() => {
    setT(remaining());
    if (endMs == null) return;
    const id = setInterval(() => setT(remaining()), 1000);
    return () => clearInterval(id);
  }, [remaining, endMs]));
  return t;
}

function CountdownCell({ n }: { n: string }) {
  return (
    <View style={{ backgroundColor: C.ink, paddingHorizontal: 9, paddingVertical: 7, minWidth: 34, alignItems: 'center' }}>
      <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(18), color: '#fff' }}>{n}</Text>
    </View>
  );
}

/**
 * The ticking clock, isolated.
 *
 * `useFlashCountdown()` used to be called at FlashFitScreen scope, so every
 * one-second tick re-rendered the entire screen — re-running a filter, rebuilding
 * a 24-item pool's inline props, and re-rendering ~24 product cards, once per
 * second, forever, while the screen was open. Home already solved this the right
 * way by isolating its own countdown in a leaf component; this screen never got
 * the same treatment. Only these three digits re-render now.
 */
/**
 * Renders nothing when the drop has no end date — the clock is hidden, not faked.
 * The component stays in the tree so a drop that later gets an end date shows it
 * without any layout change.
 */
function FlashCountdown({ endsAt }: { endsAt: string | null | undefined }) {
  const time = useFlashCountdown(endsAt);
  if (!time) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <CountdownCell n={String(time.h).padStart(2, '0')} />
      <Text style={{ fontFamily: 'Inter_900Black', color: C.ink }}>:</Text>
      <CountdownCell n={String(time.m).padStart(2, '0')} />
      <Text style={{ fontFamily: 'Inter_900Black', color: C.ink }}>:</Text>
      <CountdownCell n={String(time.s).padStart(2, '0')} />
    </View>
  );
}

const FIT_BIG_H = Math.round(W * 0.62);
const FIT_SMALL_H = (FIT_BIG_H - SP.s) / 2;

export function FlashFitScreen() {
  const nav = useNavigation<any>();
  const { gender, showToast, addToCart, cart } = useApp();
  const { section, status: cmsStatus } = useCmsSection('page.flash_fit', gender);
  // The featured drop is chosen by admin on `home.flash_fit`; this page reads the same
  // slug so both surfaces show one drop rather than two independently-improvised ones.
  const { section: homeFlash } = useCmsSection('home.flash_fit', gender);
  const dropSlug = str(homeFlash.config, 'collectionSlug');

  /**
   * The fit IS the drop. It used to be assembled on the client by taking the cheapest
   * page of the catalog, skipping anything whose category name matched a hardcoded
   * NON_APPAREL list, and keeping the first three distinct categories — so the "look"
   * was three unrelated cheap items that changed whenever prices moved, and no one
   * could curate it. Now an admin curates a drop and this renders its members.
   */
  const [drop, setDrop] = useState<{ status: 'loading' | 'ready' | 'missing' | 'error'; data: CollectionDetail | null }>(
    { status: 'loading', data: null },
  );
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setDrop({ status: 'loading', data: null });
    if (!dropSlug) { setDrop({ status: 'missing', data: null }); return; }
    fetchCollection(dropSlug, { gender })
      .then((res) => {
        if (cancelled) return;
        if (res.status === 'ok') setDrop({ status: 'ready', data: res.collection });
        else setDrop({ status: res.status, data: null });
      })
      .catch(() => { if (!cancelled) setDrop({ status: 'error', data: null }); });
    return () => { cancelled = true; };
  }, [dropSlug, gender, reloadKey]);

  const members = drop.data?.products ?? [];
  const fit = useMemo(() => members.slice(0, 3).map(toFitPiece), [members]);
  const total = fit.reduce((s, p) => s + p.price, 0);
  const totalOriginal = fit.reduce((s, p) => s + p.original, 0);
  const saved = totalOriginal - total;
  // The rest of the drop, not a hardcoded "under ₹999" over an unrelated catalog page.
  const flashDeals = members.slice(3);
  const status = drop.status === 'ready' ? 'ready' : drop.status === 'loading' ? 'loading' : 'error';
  const reload = () => setReloadKey((n) => n + 1);
  const cellW = (W - SP.l * 2 - SP.s) / 2;

  /**
   * Adds the pieces — with their REAL variant, not a made-up size.
   *
   * This was a toast and nothing else, so the shopper checked out with an empty
   * cart. Then it became `addToCart(p.product, 'M')`: a line with the literal
   * size "M" and no `variantId`, which the Bag cannot price (`allPriceable` is
   * false without one) and checkout refuses outright — so the fit landed in the
   * bag and jammed it. The card projection carries `defaultVariantId`, which is
   * the cheapest in-stock variant, so that is what goes in; a piece without one
   * is not shoppable and is reported rather than silently dropped.
   */
  const buyTheFit = () => {
    const addable = fit.filter((p) => !!p.product.variantId);
    // No size string: the card projection does not carry the variant's attribute
    // label, and inventing one ("M") is how the Bag came to mislabel lines. The
    // Bag reads the real label off the quote instead.
    addable.forEach((p) => addToCart(p.product, '', 'express', p.product.variantId));
    if (addable.length === 0) {
      showToast('Not available', 'This drop is out of stock right now', 'x');
      return;
    }
    if (addable.length < fit.length) {
      showToast(
        'Part of the fit added',
        `${fit.length - addable.length} piece${fit.length - addable.length === 1 ? ' is' : 's are'} out of stock`,
        'alert-circle',
      );
      return;
    }
    showToast('Fit added', `${addable.length} piece${addable.length === 1 ? '' : 's'} in your bag`, 'shopping-bag');
  };
  /**
   * Whether every piece of today's fit is already in the bag.
   *
   * The button said "Add the fit" whatever the bag held, so tapping it a second
   * time silently doubled the quantities and the shopper had no way of telling
   * from this page that the look was already in there. When it is, the control
   * becomes a confirmation that takes you to the bag instead.
   *
   * Matched on the VARIANT the button adds, falling back to the listing id: two
   * pieces of one drop can be the same listing in different colourways.
   */
  const pieceInBag = (p: FitPiece) => cart.some((c) =>
    p.product.variantId ? c.variantId === p.product.variantId : c.id === p.product.id);
  const fitInBag = fit.length > 0 && fit.every(pieceInBag);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SectionHeader title="Flash Fit" onBack={() => nav.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>
        {/* ── COUNTDOWN BAR ── */}
        <View style={{ paddingHorizontal: SP.l, paddingTop: SP.l }}>
          <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SP.m, backgroundColor: C.white }, BORDER(1)]}>
            <View>
              {cmsStatus === 'loading' ? (
                <>
                  <Shimmer w={120} h={9} />
                  <Shimmer w={70} h={15} style={{ marginTop: 5 }} />
                </>
              ) : (
                <>
                  <Text style={[T.micro, { letterSpacing: 1.5, color: C.dim }]}>{section.kicker ?? 'FLASH FIT OF THE DAY'}</Text>
                  <Text style={[T.h3, { marginTop: 3 }]}>{section.title ?? 'Ends in'}</Text>
                </>
              )}
            </View>
            <FlashCountdown endsAt={drop.data?.endsAt} />
          </View>
        </View>

        {/* ── THE FIT — head-to-toe, laid out as a bento (top big, two stacked).
            GATED on all three pieces existing. `fit` is assembled from live
            listings in three DIFFERENT categories, so a thin catalog yields one
            or two — and this bento indexes fit[0..2] directly, which crashed
            with "Cannot read property 'slot' of undefined". Half a bento is not
            a layout worth rescuing, so the whole block stands down and the page
            leads with More Flash Deals instead. ── */}
        {fit.length === 3 && (<>
        <View style={{ paddingHorizontal: SP.l, marginTop: SP.l }}>
          <Text style={[T.h2, { textTransform: 'uppercase' }]}>Today's Complete Fit</Text>
          <Text style={[T.caption, { color: C.dim, marginTop: 6 }]}>One look, {fit.length} pieces — shop them together or one at a time.</Text>
        </View>
        <View style={{ paddingHorizontal: SP.l, marginTop: SP.m, flexDirection: 'row', gap: SP.s }}>
          {/* big piece (top) — opens the real product, not a category guess */}
          <FitTile piece={fit[0]!} w={cellW} h={FIT_BIG_H} inBag={pieceInBag(fit[0]!)} onPress={() => nav.navigate('ProductDetail', { product: fit[0]!.product })} />
          {/* stacked pair (bottom + shoes) */}
          <View style={{ gap: SP.s }}>
            <FitTile piece={fit[1]!} w={cellW} h={FIT_SMALL_H} compact inBag={pieceInBag(fit[1]!)} onPress={() => nav.navigate('ProductDetail', { product: fit[1]!.product })} />
            <FitTile piece={fit[2]!} w={cellW} h={FIT_SMALL_H} compact inBag={pieceInBag(fit[2]!)} onPress={() => nav.navigate('ProductDetail', { product: fit[2]!.product })} />
          </View>
        </View>

        {/* ── BUY THE WHOLE FIT ── */}
        <View style={{ paddingHorizontal: SP.l, marginTop: SP.m }}>
          <View style={[{ backgroundColor: C.ink, padding: SP.l }, BORDER(1)]}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={[T.micro, { color: 'rgba(255,255,255,0.7)', letterSpacing: 1 }]}>BUY THE FULL LOOK</Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
                  <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(28), color: '#fff' }}>₹{total}</Text>
                  {/* Only when the pieces are genuinely marked down. At MRP this
                      rendered "₹1197  ₹1197" with the second struck through, and
                      "You save ₹0" underneath. */}
                  {saved > 0 && (
                    <Text style={[T.caption, { color: 'rgba(255,255,255,0.55)', textDecorationLine: 'line-through' }]}>₹{totalOriginal}</Text>
                  )}
                </View>
                {saved > 0 && (
                  <Text style={[T.caption, { color: '#5FD08C', marginTop: 4 }]}>You save ₹{saved}</Text>
                )}
              </View>
              <Pressable
                onPress={fitInBag ? () => nav.navigate('Tabs', { screen: 'CartTab' }) : buyTheFit}
                style={{ backgroundColor: '#fff', paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}
              >
                <Feather name={fitInBag ? 'check' : 'plus'} size={16} color={C.ink} />
                <Text style={[T.button, { color: C.ink, fontSize: rf(14) }]}>{fitInBag ? 'In your bag' : 'Add the fit'}</Text>
                {!fitInBag && <Feather name="arrow-right" size={16} color={C.ink} />}
              </Pressable>
            </View>
          </View>
        </View>
        </>)}

        {/* ── MORE FLASH DEALS ── */}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: SP.l, marginTop: SP.xxl }}>
          <Text style={[T.h2, { textTransform: 'uppercase' }]}>More Flash Deals</Text>
          <Text style={[T.micro]}>Under ₹999</Text>
        </View>
        <View style={{ paddingHorizontal: SP.l, marginTop: SP.m }}>
          <CatalogSection
            status={status}
            count={flashDeals.length}
            onRetry={reload}
            empty={<CatalogEmpty title="No flash deals right now" sub="Nothing under 999 is live at the moment. Check back soon." />}
          >
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.s }}>
              {flashDeals.map((p, i) => (
                <FadeInUp key={p.id} delay={(i % 6) * 30}>
                  {/* No FLASH badge — the section heading already says it; the
                      badge just covered the top of every product photo. */}
                  <ProductCard p={p} style={CARD_STYLES.mb_s} />
                </FadeInUp>
              ))}
            </View>
          </CatalogSection>
        </View>
      </ScrollView>
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// FOR HER / FOR HIM — the campaign edit pages the hero banner opens. Full-bleed
// campaign cover with an overlapping intro card, numbered cutout category
// tiles, alternating editorial split bands, a trending grid and a story poster.
// Same modern language as the rest of Home — ink, hairline, highlighter yellow.
// ════════════════════════════════════════════════════════════════════════════

/**
 * The Her/His Edit page, assembled from four CMS sections rather than one hardcoded object:
 * `page.edit_<g>` (cover art + all the copy), `_chips`, `_cats` and `_features`.
 *
 * It stays an object with this exact shape because `GenderEditScreen` and `EditFeature` below
 * are unchanged — the page is built from CMS content, then rendered by the same code that
 * always rendered it.
 */
type EditContent = {
  kicker: string;
  headline: string;
  sub: string;
  cover: MediaSource | null;
  chips: string[];
  cats: { key: string; label: string; img: MediaSource; link: CmsItem['link'] }[];
  features: { key: string; img: MediaSource; tag: string; title: string; copy: string; link: CmsItem['link'] }[];
  gridTitle: string;
  poster: MediaSource | null;
  cta: string;
};

/** Build one Edit page's content from its four sections, plus whether it is confirmed yet. */
function useEditContent(which: 'her' | 'him'): { content: EditContent; loading: boolean } {
  const keys = [
    `page.edit_${which}`,
    `page.edit_${which}_chips`,
    `page.edit_${which}_cats`,
    `page.edit_${which}_features`,
  ];
  // These pages are gender-specific by ROUTE, not by the app's active rail — "For Her" shows
  // the women's campaign even when the shopper is browsing HIM — so the items are authored as
  // `all` and the gender passed here only picks which payload is cached.
  const { sections: cms, status } = useCmsSections(keys, which);
  const main = cms[keys[0]!]!;
  const chips = cms[keys[1]!]!;
  const cats = cms[keys[2]!]!;
  const features = cms[keys[3]!]!;

  const content = useMemo(
    () => ({
      kicker: main.kicker ?? '',
      headline: main.title ?? '',
      sub: main.subtitle ?? '',
      cover: resolveMedia(main.items[0], IMG.hero),
      chips: chips.items.map((i) => str(i.content, 'label')).filter(Boolean),
      cats: cats.items
        .map((item) => ({ item, source: resolveMedia(item, IMG.thumb) }))
        .filter(withSource)
        .map(({ item, source }) => ({
          key: item.key,
          label: str(item.content, 'label'),
          img: source,
          link: item.link,
        })),
      features: features.items
        .map((item) => ({ item, source: resolveMedia(item, IMG.card) }))
        .filter(withSource)
        .map(({ item, source }) => ({
          key: item.key,
          img: source,
          tag: str(item.content, 'tag'),
          title: str(item.content, 'title'),
          copy: str(item.content, 'copy'),
          link: item.link,
        })),
      gridTitle: str(main.config, 'gridTitle'),
      poster: resolveConfigMedia(main.config, 'posterAssetKey', 'posterImageUrl', IMG.hero),
      cta: main.ctaLabel ?? '',
    }),
    [main, chips.items, cats.items, features.items],
  );

  return { content, loading: status === 'loading' };
}

// One editorial split band — image on one side, white copy panel with a giant
// faded word on the other. `reverse` flips the sides so bands alternate.
function EditFeature({ f, reverse, onPress }: { f: EditContent['features'][number]; reverse?: boolean; onPress: () => void }) {
  const ghost = f.title.split(/[\s\n]/)[0];
  return (
    <Pressable onPress={onPress} style={[{ height: 172, flexDirection: reverse ? 'row-reverse' : 'row', backgroundColor: C.white, overflow: 'hidden' }, BORDER(1)]}>
      <View style={{ width: '45%', height: '100%' }}>
        <CachedImage source={f.img} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" />
      </View>
      <View style={{ flex: 1, padding: SP.m, justifyContent: 'center', overflow: 'hidden' }}>
        <Text numberOfLines={1} ellipsizeMode="clip" style={{ position: 'absolute', bottom: -rf(14), left: -8, width: '180%', fontFamily: 'Inter_900Black', fontSize: rf(64), letterSpacing: -2, color: C.ink, opacity: 0.06, textTransform: 'uppercase' }}>{ghost}</Text>
        <Text style={[T.micro, { color: C.dim, letterSpacing: 2 }]}>{f.tag}</Text>
        <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(21), lineHeight: rf(24), color: C.ink, letterSpacing: -0.5, marginTop: 6, textTransform: 'uppercase' }}>{f.title}</Text>
        <Text style={[T.micro, { color: C.dim, marginTop: 6 }]} numberOfLines={2}>{f.copy}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
          <Text style={[T.caption, { color: C.ink, fontFamily: HELV, fontWeight: '700' }]}>View</Text>
          <Feather name="arrow-right" size={13} color={C.ink} />
        </View>
      </View>
    </Pressable>
  );
}

function GenderEditScreen({
  content,
  title,
  loading,
}: {
  content: EditContent;
  title: string;
  /** True until the published campaign is confirmed — render placeholders, not shipped copy. */
  loading: boolean;
}) {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  // "TRENDING FOR HER" was the eight bundled demo products, identical on both
  // pages bar the array name. It is the live rail for this gender now.
  const { products, status, reload } = useCatalogProducts({
    gender: title === 'For Her' ? 'her' : 'him',
    limit: 12,
  });
  const COVER_H = Math.round(W * 1.1);
  const CAT_W = 96;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>
        {/* ── COVER — full-bleed campaign art under the status bar ── */}
        <View style={{ height: COVER_H, overflow: 'hidden' }}>
          {content.cover ? <CachedImage source={content.cover} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" /> : null}
          <LinearGradient colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.55)']} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFillObject as any} />
          {/* header row on the photo */}
          <View style={{ position: 'absolute', top: insets.top + 8, left: SP.l, right: SP.l, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable onPress={() => nav.goBack()} hitSlop={10} style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' }}>
              <Feather name="arrow-left" size={19} color="#fff" />
            </Pressable>
            <Text style={[T.caption, { color: '#fff', letterSpacing: 3 }]}>{title.toUpperCase()}</Text>
            <View style={{ width: 38 }} />
          </View>
          {/* kicker + display headline. Held back until confirmed — the back arrow and page
              title above stay, so the screen is navigable while the campaign resolves. */}
          {!loading && (
            <View style={{ position: 'absolute', left: SP.l, bottom: 56 }}>
              <View style={{ alignSelf: 'flex-start', backgroundColor: C.accent, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={[T.micro, { color: C.accentInk, fontFamily: HELV, fontWeight: '700', letterSpacing: 1.5 }]}>{content.kicker}</Text>
              </View>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(58), lineHeight: rf(56), color: '#fff', letterSpacing: -2, marginTop: 10 }}>{content.headline}</Text>
            </View>
          )}
        </View>

        {/* ── INTRO CARD — overlaps the cover bottom ── */}
        <FadeInUp style={{ marginHorizontal: SP.l, marginTop: -36 }}>
          <View style={[{ backgroundColor: C.white, padding: SP.l }, BORDER(1)]}>
            {loading ? (
              <>
                <Shimmer h={13} />
                <Shimmer w={'72%'} h={13} style={{ marginTop: 6 }} />
              </>
            ) : (
              <Text style={[T.body, { color: C.inkSoft }]}>{content.sub}</Text>
            )}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: SP.m }}>
              {content.chips.map((ch) => (
                <View key={ch} style={[{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: C.white }, BORDER(1)]}>
                  <Text style={[T.micro, { color: C.ink, letterSpacing: 0.5 }]}>{ch}</Text>
                </View>
              ))}
            </View>
          </View>
        </FadeInUp>

        {/* ── NUMBERED CATEGORY TILES — swipeable cutout row ── */}
        <View style={{ marginTop: SP.xl, paddingHorizontal: SP.l }}>
          <View style={{ alignSelf: 'flex-start' }}>
            <View style={{ position: 'absolute', left: -3, right: -6, bottom: 2, height: 10, backgroundColor: C.accent }} />
            <Text style={[T.h2, { textTransform: 'uppercase' }]}>Shop the pieces</Text>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SP.l, gap: SP.s, marginTop: SP.m }}>
          {content.cats.map((c, i) => (
            <Pressable key={c.key} onPress={() => { if (!openLink(nav, c.link)) nav.navigate('Categories', { label: c.label }); }} style={{ width: CAT_W }}>
              <View style={[{ height: 124, backgroundColor: '#F4F4F4', overflow: 'hidden' }, BORDER(1)]}>
                <Text style={{ position: 'absolute', top: 4, left: 7, fontFamily: 'Inter_900Black', fontSize: rf(13), color: C.ink, opacity: 0.35 }}>{`0${i + 1}`}</Text>
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingTop: 16 }}>
                  <CachedImage source={c.img} style={{ width: '86%', height: '86%' }} resizeMode="contain" />
                </View>
              </View>
              <Text style={[T.caption, { color: C.ink, textAlign: 'center', marginTop: 5 }]} numberOfLines={1}>{c.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* ── EDITORIAL SPLIT BANDS — alternating sides ── */}
        <View style={{ paddingHorizontal: SP.l, marginTop: SP.xl, gap: SP.s }}>
          {content.features.map((f, i) => (
            <FadeInUp key={f.key} delay={i * 60}>
              {/* Its own collection page, NOT the catalog. `f.key` is the CMS
                  item key that content/collections.ts is registered against
                  ("Five-minute fits.", "Built different." et al); anything not
                  in the registry still honours its CMS link, and only then
                  falls back to the catalog. */}
              <EditFeature
                f={f}
                reverse={i % 2 === 1}
                onPress={() => {
                  if (getCollection(f.key)) { nav.navigate('Collection', { key: f.key }); return; }
                  if (!openLink(nav, f.link)) nav.navigate('Categories', { label: f.tag });
                }}
              />
            </FadeInUp>
          ))}
        </View>

        {/* ── TRENDING GRID ── */}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: SP.l, marginTop: SP.xl }}>
          <Text style={[T.h2, { textTransform: 'uppercase' }]}>{content.gridTitle}</Text>
          <Pressable onPress={() => nav.navigate('Categories')} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={[T.caption, { color: C.ink, fontFamily: HELV, fontWeight: '600' }]}>View all</Text>
            <Feather name="chevron-right" size={14} color={C.ink} />
          </Pressable>
        </View>
        <View style={{ paddingHorizontal: SP.l, marginTop: SP.m }}>
          <CatalogSection
            status={status}
            count={products.length}
            onRetry={reload}
            empty={<CatalogEmpty title="Nothing live yet" sub="New drops land here as stores go live." />}
          >
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.s }}>
              {products.map((p, i) => (
                <FadeInUp key={p.id} delay={(i % 6) * 30}>
                  <ProductCard p={p} style={CARD_STYLES.mb_s} />
                </FadeInUp>
              ))}
            </View>
          </CatalogSection>
        </View>

        {/* ── STORY POSTER — full-width band into Top Stories ── */}
        <Pressable onPress={() => nav.navigate('TopStories')} style={{ marginHorizontal: SP.l, marginTop: SP.l }}>
          <View style={[{ height: Math.round(W * 1.05), overflow: 'hidden' }, BORDER(1)]}>
            {content.poster ? <CachedImage source={content.poster} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" /> : null}
            <View style={{ position: 'absolute', top: SP.m, left: SP.m, backgroundColor: C.ink, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text style={[T.micro, { color: C.white, letterSpacing: 1.5 }]}>THIS WEEK'S STORY</Text>
            </View>
            <View style={{ position: 'absolute', right: SP.m, bottom: SP.m, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[T.caption, { color: C.ink, fontFamily: HELV, fontWeight: '700' }]}>Read the edit</Text>
              <Feather name="arrow-right" size={13} color={C.ink} />
            </View>
          </View>
        </Pressable>

        {/* ── CTA — black slab on a yellow offset shadow (brand press) ── */}
        <View style={{ paddingHorizontal: SP.l, marginTop: SP.xl }}>
          <View>
            <View style={{ position: 'absolute', top: 5, left: 5, right: -5, bottom: -5, backgroundColor: C.accent, borderWidth: 1, borderColor: C.ink }} />
            <Pressable onPress={() => nav.navigate('Categories')} style={{ backgroundColor: C.ink, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, borderWidth: 1, borderColor: C.ink }}>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(15), color: C.white, letterSpacing: 2 }}>{content.cta}</Text>
              <Feather name="arrow-right" size={16} color={C.white} />
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

export function ForHerEditScreen() {
  const { content, loading } = useEditContent('her');
  return <GenderEditScreen content={content} title="For Her" loading={loading} />;
}
export function ForHimEditScreen() {
  const { content, loading } = useEditContent('him');
  return <GenderEditScreen content={content} title="For Him" loading={loading} />;
}

function FitTile({ piece, w, h, compact, inBag, onPress }: { piece: FitPiece; w: number; h: number; compact?: boolean; inBag?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[{ width: w, height: h, backgroundColor: '#F4F4F4', overflow: 'hidden' }, BORDER(1)]}>
      {/* slot chip */}
      <View style={{ position: 'absolute', top: 8, left: 8, zIndex: 2, backgroundColor: C.ink, paddingHorizontal: 8, paddingVertical: 3 }}>
        <Text style={[T.micro, { color: '#fff', letterSpacing: 0.5 }]}>{piece.slot.toUpperCase()}</Text>
      </View>
      {/* Already in the bag — a tick per piece, so a partly-added fit reads
          correctly instead of looking untouched. */}
      {inBag && (
        <View style={{ position: 'absolute', top: 8, right: 8, zIndex: 2, width: 22, height: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: C.ink }}>
          <Feather name="check" size={12} color="#fff" />
        </View>
      )}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 14 }}>
        <CachedImage source={piece.img} style={{ width: '100%', height: compact ? '82%' : '78%' }} resizeMode="contain" />
      </View>
      {/* price footer */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.92)', borderTopWidth: 1, borderColor: C.hairline }}>
        {!compact && <Text style={[T.productName]} numberOfLines={1}>{piece.label}</Text>}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: compact ? 0 : 2 }}>
          <Text style={[T.price]}>₹{piece.price}</Text>
          {piece.original > piece.price && <Text style={[T.mrp]}>₹{piece.original}</Text>}
        </View>
      </View>
    </Pressable>
  );
}
