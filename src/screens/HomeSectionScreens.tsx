// Dedicated pages for the Home sections — each one a UNIQUE layout built in the
// modern Trendzo language (full-bleed art, soft gradients, hairline white cards,
// editorial headings). No two share a layout, and none of them is the generic
// Category browse page. All are gender-aware via useApp().gender.
//
//   • StealsScreen        — price-banded deals (bento hero + band filter + grid)
//   • TopStoriesScreen    — editorial magazine feed, every poster its own story
//   • ShopByOccasionScreen— occasion selector + themed hero + curated grid
//   • FlashFitScreen      — live countdown + a shoppable "fit" + more flash deals
import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, T, SP, BORDER, rf } from '../theme/brutal';
import { CachedImage, ProductCard, FadeInUp, CARD } from '../components/Brutal';
import { useApp } from '../state/AppState';
import { PRODUCTS, HER_PRODUCTS, HIM_PRODUCTS } from '../data/mockData';
import type { Product } from '../data/mockData';

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

// Deterministic product pool for a gender — combines the gender edit with the
// general catalog and clones to a target size (unique ids), so grids/rails
// never run short. `spread` re-scales prices to fan across the deal bands.
function buildPool(gender: 'her' | 'him', count: number, spread = false): (Product & { id: string })[] {
  const base = gender === 'her' ? HER_PRODUCTS : HIM_PRODUCTS;
  const pool = [...base, ...PRODUCTS];
  const factors = [0.35, 0.5, 0.65, 0.8, 1];
  return Array.from({ length: count }, (_, i) => {
    const p = pool[i % pool.length];
    if (!spread) return { ...p, id: `pool-${i}-${p.id}` };
    // Deal pages overlay their own badge (% OFF / FLASH), so drop the catalog
    // tag here to avoid two badges stacking in the same top-left corner.
    const price = Math.max(299, Math.round((p.price * factors[i % factors.length]) / 10) * 10);
    return { ...p, id: `pool-${i}-${p.id}`, price, tag: undefined };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// STEALS — price-banded deals. Editorial hero, a band selector, a small bento of
// hero deals, then a savings-first product grid that filters by the active band.
// ════════════════════════════════════════════════════════════════════════════
const STEAL_HERO = {
  her: require('../../assets/steals/her/tops.jpeg'),
  him: require('../../assets/steals/him/jacket.jpeg'),
};
const STEAL_BENTO = {
  her: [
    { label: 'Beauty', priceLine: '₹999', img: require('../../assets/steals/her/beauty.jpeg') },
    { label: 'Jewelry', priceLine: '₹1499', img: require('../../assets/steals/her/jewelry.jpeg') },
    { label: 'Tops', priceLine: '₹1999', img: require('../../assets/steals/her/tops.jpeg') },
  ],
  him: [
    { label: 'Tees', priceLine: '₹1499', img: require('../../assets/steals/him/tee.jpeg') },
    { label: 'Eyewear', priceLine: '₹1999', img: require('../../assets/steals/him/eyewear.jpeg') },
    { label: 'Jackets', priceLine: '₹2499', img: require('../../assets/steals/him/jacket.jpeg') },
  ],
};
const STEAL_BANDS = [
  { label: 'All deals', max: Infinity },
  { label: 'Under ₹499', max: 499 },
  { label: 'Under ₹999', max: 999 },
  { label: 'Under ₹1499', max: 1499 },
  { label: 'Under ₹1999', max: 1999 },
];
const STEAL_GAP = SP.s;
const STEAL_COL = (W - SP.l * 2 - STEAL_GAP) / 2;
const STEAL_SMALL_H = Math.round(STEAL_COL * 0.95);
const STEAL_BIG_H = STEAL_SMALL_H * 2 + STEAL_GAP;

function DealTile({ label, priceLine, img, w, h, onPress }: { label: string; priceLine: string; img: any; w: number; h: number; onPress: () => void }) {
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
  const { gender } = useApp();
  const [band, setBand] = useState(0);
  const bento = STEAL_BENTO[gender];
  const pool = useMemo(() => buildPool(gender, 30, true), [gender]);
  const activeMax = STEAL_BANDS[band].max;
  const deals = useMemo(() => pool.filter((p) => p.price <= activeMax), [pool, activeMax]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SectionHeader title="Steals" onBack={() => nav.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>
        {/* ── HERO — full-bleed steal photo with a bold savings headline ── */}
        <View style={{ height: Math.round(W * 0.62), overflow: 'hidden' }}>
          <CachedImage source={STEAL_HERO[gender]} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" />
          <LinearGradient colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.78)']} style={StyleSheet.absoluteFillObject as any} />
          <View style={{ flex: 1, justifyContent: 'flex-end', padding: SP.l }}>
            <View style={{ alignSelf: 'flex-start', backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 4, marginBottom: 10 }}>
              <Text style={[T.micro, { color: C.ink, fontFamily: 'Helvetica Neue', fontWeight: '700', letterSpacing: 1 }]}>LOWEST PRICES</Text>
            </View>
            <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(46), lineHeight: rf(46), color: '#fff', letterSpacing: -1.5 }}>Steal it{'\n'}before it's gone.</Text>
            <Text style={[T.caption, { color: 'rgba(255,255,255,0.9)', marginTop: 10 }]}>Handpicked drops at their lowest. New steals every hour.</Text>
          </View>
        </View>

        {/* ── PRICE-BAND SELECTOR ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SP.l, gap: SP.s, paddingVertical: SP.l }}>
          {STEAL_BANDS.map((b, i) => (
            <Pressable key={b.label} onPress={() => setBand(i)} style={[{ paddingHorizontal: 16, paddingVertical: 9, backgroundColor: band === i ? C.ink : C.white }, BORDER(1)]}>
              <Text style={[T.caption, { color: band === i ? C.white : C.ink }]}>{b.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* ── HERO DEALS — bento: one tall tile + a stacked pair ── */}
        <View style={{ paddingHorizontal: SP.l, flexDirection: 'row', gap: STEAL_GAP }}>
          <DealTile label={bento[0].label} priceLine={bento[0].priceLine} img={bento[0].img} w={STEAL_COL} h={STEAL_BIG_H} onPress={() => nav.navigate('Categories', { label: bento[0].label })} />
          <View style={{ gap: STEAL_GAP }}>
            {bento.slice(1).map((b) => (
              <DealTile key={b.label} label={b.label} priceLine={b.priceLine} img={b.img} w={STEAL_COL} h={STEAL_SMALL_H} onPress={() => nav.navigate('Categories', { label: b.label })} />
            ))}
          </View>
        </View>

        {/* ── DEAL GRID — filtered by the active band ── */}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: SP.l, marginTop: SP.xl }}>
          <Text style={[T.h2, { textTransform: 'uppercase' }]}>{STEAL_BANDS[band].label}</Text>
          <Text style={[T.micro]}>{deals.length} steals</Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: STEAL_GAP, paddingHorizontal: SP.l, marginTop: SP.m }}>
          {deals.map((p, i) => (
            <FadeInUp key={p.id} delay={(i % 6) * 30}>
              <ProductCard p={p} style={{ marginBottom: SP.s }}>
                <View style={{ position: 'absolute', top: 0, left: 0, backgroundColor: C.green, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={[T.micro, { color: '#fff', fontFamily: 'Helvetica Neue', fontWeight: '700' }]}>{`${Math.max(20, Math.round((1 - p.price / p.original) * 100))}% OFF`}</Text>
                </View>
              </ProductCard>
            </FadeInUp>
          ))}
        </View>

        <View style={{ alignItems: 'center', marginTop: SP.xl }}>
          <Text style={[T.micro]}>That's the lot for now · new steals in 60 min</Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TOP STORIES OF THE WEEK — an editorial magazine. A featured lead story, then a
// vertical feed where EVERY poster carries its own headline, chapter number,
// blurb, tags and a shoppable product rail. No two stories read the same.
// ════════════════════════════════════════════════════════════════════════════
type Story = { id: string; img: any; tag: string; title: string; blurb: string; read: string; tags: string[] };

const HER_STORIES: Story[] = [
  { id: 'hs1', img: require('../../assets/story-posters/her-60-min.png'), tag: '60-Minute Edit', title: 'Ready in an Hour', blurb: 'The pieces that reach your door before you finish getting ready — styled for a night that starts now.', read: '4 min', tags: ['Fast', 'Party', 'Heels'] },
  { id: 'hs2', img: require('../../assets/story-posters/her-friday.png'), tag: 'Friday Feeling', title: 'Into the Weekend', blurb: 'Clock-out to cocktails without a costume change. Soft tailoring that works twice as hard as you do.', read: '3 min', tags: ['Work', 'Evening', 'Dresses'] },
  { id: 'hs3', img: require('../../assets/story-posters/her-roommate.png'), tag: 'Roommate Picks', title: 'Borrowed & Better', blurb: 'The oversized, the cropped, the endlessly borrowable. A shared-closet capsule you will not want to give back.', read: '5 min', tags: ['Casual', 'Denim', 'Layers'] },
  { id: 'hs4', img: require('../../assets/story-posters/her-latest-drops.png'), tag: 'Just Dropped', title: 'The Latest Drops', blurb: 'Fresh off the rack and already trending. The first look at what everyone will be wearing next.', read: '2 min', tags: ['New', 'Trending', 'Tops'] },
  { id: 'hs5', img: require('../../assets/story-posters/her-casual-affair.png'), tag: 'Off Duty', title: 'A Casual Affair', blurb: 'Effortless never happens by accident. The relaxed uniform, engineered to look like you did not try.', read: '4 min', tags: ['Everyday', 'Comfort', 'Sets'] },
];
const HIM_STORIES: Story[] = [
  { id: 'ms1', img: require('../../assets/story-posters/him-coffee.png'), tag: 'Morning Routine', title: 'The Coffee Run', blurb: 'Thrown on, never thrown together. The five-minute fit that carries you from the queue to the meeting.', read: '3 min', tags: ['Casual', 'Tees', 'Denim'] },
  { id: 'ms2', img: require('../../assets/story-posters/him-60-min.png'), tag: '60-Minute Edit', title: 'Fast, Literally', blurb: 'Ordered at noon, worn by one. A full look at your door inside the hour — no compromise on the fit.', read: '2 min', tags: ['Fast', 'Street', 'Sneakers'] },
  { id: 'ms3', img: require('../../assets/story-posters/him-friday.png'), tag: 'Friday Feeling', title: 'Clock-Out Looks', blurb: 'The pivot from desk to bar in one layer. Sharp enough for the office, loose enough for after.', read: '4 min', tags: ['Work', 'Evening', 'Shirts'] },
  { id: 'ms4', img: require('../../assets/story-posters/him-bros.png'), tag: 'Crew Love', title: 'Rolling With the Crew', blurb: 'Matching energy, not matching outfits. The group-chat-approved fits for whatever the weekend throws.', read: '5 min', tags: ['Weekend', 'Jackets', 'Caps'] },
];

const STORY_LEAD_H = Math.round(W * 1.12);
const STORY_POSTER_H = Math.round(W * 0.92);

function StoryRail({ products, onOpenAll }: { products: (Product & { id: string })[]; onOpenAll: () => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SP.m, paddingRight: SP.l }}>
      {products.map((p) => (
        <ProductCard key={p.id} p={p} style={{ width: CARD.w * 0.86 }} />
      ))}
      <Pressable onPress={onOpenAll} style={{ width: 120, height: CARD.imgH, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <View style={[{ width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' }, BORDER(1)]}>
          <Feather name="arrow-right" size={20} color={C.ink} />
        </View>
        <Text style={[T.caption, { color: C.ink }]}>Shop all</Text>
      </Pressable>
    </ScrollView>
  );
}

export function TopStoriesScreen() {
  const nav = useNavigation<any>();
  const { gender } = useApp();
  const stories = gender === 'her' ? HER_STORIES : HIM_STORIES;
  const pool = useMemo(() => buildPool(gender, 40), [gender]);
  const lead = stories[0];
  const rest = stories.slice(1);
  // Each story gets a DIFFERENT slice of the pool so its rail is unique.
  const railFor = (i: number) => pool.slice(i * 5, i * 5 + 5);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SectionHeader title="Top Stories" onBack={() => nav.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>
        {/* ── SECTION INTRO ── */}
        <View style={{ alignItems: 'center', paddingTop: SP.l, paddingHorizontal: SP.l }}>
          <Text style={[T.micro, { letterSpacing: 2, color: C.dim }]}>THE EDIT · WEEK OF NOW</Text>
          <Text style={[T.h1, { textAlign: 'center', textTransform: 'uppercase', marginTop: 6 }]}>Top Stories{'\n'}of the Week</Text>
        </View>

        {/* ── FEATURED LEAD — tall full-bleed cover ── */}
        <Pressable onPress={() => nav.navigate('Categories', { label: lead.title })} style={{ marginHorizontal: SP.l, marginTop: SP.l }}>
          <View style={[{ height: STORY_LEAD_H, overflow: 'hidden', backgroundColor: C.hairline }, BORDER(1)]}>
            <CachedImage source={lead.img} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" />
            <LinearGradient colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.85)']} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFillObject as any} />
            <View style={{ position: 'absolute', top: SP.m, left: SP.m, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={[T.micro, { color: C.ink, fontFamily: 'Helvetica Neue', fontWeight: '700', letterSpacing: 1 }]}>COVER STORY</Text>
              </View>
              <View style={{ backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={[T.micro, { color: '#fff' }]}>{lead.read} read</Text>
              </View>
            </View>
            <View style={{ position: 'absolute', left: SP.l, right: SP.l, bottom: SP.l }}>
              <Text style={[T.caption, { color: 'rgba(255,255,255,0.85)' }]}>{lead.tag}</Text>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(38), lineHeight: rf(40), color: '#fff', letterSpacing: -1, marginTop: 4 }}>{lead.title}</Text>
              <Text style={[T.body, { color: 'rgba(255,255,255,0.9)', marginTop: 8 }]} numberOfLines={2}>{lead.blurb}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
                <Text style={[T.button, { color: '#fff', fontSize: rf(14) }]}>Shop the story</Text>
                <Feather name="arrow-right" size={16} color="#fff" />
              </View>
            </View>
          </View>
        </Pressable>

        {/* ── STORY FEED — every entry is its own poster + copy + product rail ── */}
        {rest.map((s, i) => (
          <View key={s.id} style={{ marginTop: SP.xxl }}>
            {/* chapter marker */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.s, paddingHorizontal: SP.l }}>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(18), color: C.ink }}>{`0${i + 2}`}</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: C.hairline }} />
              <Text style={[T.micro, { letterSpacing: 1.5, color: C.dim }]}>{s.tag.toUpperCase()}</Text>
            </View>

            <Pressable onPress={() => nav.navigate('Categories', { label: s.title })} style={{ marginHorizontal: SP.l, marginTop: SP.m }}>
              <View style={[{ height: STORY_POSTER_H, overflow: 'hidden', backgroundColor: C.hairline }, BORDER(1)]}>
                <CachedImage source={s.img} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" />
                <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)']} start={{ x: 0, y: 0.45 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFillObject as any} />
                <View style={{ position: 'absolute', left: SP.l, right: SP.l, bottom: SP.l }}>
                  <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(30), lineHeight: rf(32), color: '#fff', letterSpacing: -0.8 }}>{s.title}</Text>
                </View>
              </View>
            </Pressable>

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

            {/* shoppable rail */}
            <View style={{ marginTop: SP.l, paddingLeft: SP.l }}>
              <StoryRail products={railFor(i)} onOpenAll={() => nav.navigate('Categories', { label: s.title })} />
            </View>
          </View>
        ))}

        <View style={{ alignItems: 'center', marginTop: SP.xxl }}>
          <Text style={[T.micro]}>End of this week's edit · new stories every Monday</Text>
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
type Occ = { id: string; label: string; img: any; note: string; tint: readonly [string, string]; accent: string };
const HER_OCC: Occ[] = [
  { id: 'brunch', label: 'Brunch', img: require('../../assets/github-import/women/dress.png'), note: 'Soft linens, easy florals and one good sandal. Made for slow mornings and long tables.', tint: ['#FDECEF', '#F7D6E0'], accent: '#C84F87' },
  { id: 'party', label: 'Party', img: require('../../assets/github-import/women/top.png'), note: 'Shine, sequins and a hemline with opinions. Turn heads before you say a word.', tint: ['#F3E9FB', '#E3CFF6'], accent: '#8A4FC8' },
  { id: 'date', label: 'Date', img: require('../../assets/github-import/women/heels.png'), note: 'A little bit of red, a heel that means business. Dress for the second glance.', tint: ['#FBE9E9', '#F6CFCF'], accent: '#C84F4F' },
  { id: 'wedding', label: 'Wedding', img: require('../../assets/github-import/women/ethenic.png'), note: 'Occasion-wear that photographs beautifully and lasts through the last dance.', tint: ['#FBF3E2', '#F2E1BE'], accent: '#B48A2E' },
  { id: 'casual', label: 'Casual', img: require('../../assets/github-import/women/pants.png'), note: 'The off-duty uniform — relaxed denim, easy layers, nothing to overthink.', tint: ['#EEF2F6', '#D9E2EC'], accent: '#4F6C8A' },
];
const HIM_OCC: Occ[] = [
  { id: 'office', label: 'Office', img: require('../../assets/github-import/men/shirt.png'), note: 'Crisp shirting and clean lines. Quietly sharp, never trying too hard.', tint: ['#EEF2F6', '#D9E2EC'], accent: '#4F6C8A' },
  { id: 'street', label: 'Street', img: require('../../assets/github-import/men/jackets.png'), note: 'Layered, boxy and built for the pavement. Loud where it counts.', tint: ['#EDEDED', '#D6D6D6'], accent: '#333333' },
  { id: 'gym', label: 'Gym', img: require('../../assets/github-import/men/tshirt.png'), note: 'Breathable, flexible, ready to move. Performance that still looks the part.', tint: ['#E7F4EE', '#CDE7DA'], accent: '#2E8B63' },
  { id: 'travel', label: 'Travel', img: require('../../assets/github-import/men/jeans.png'), note: 'Wrinkle-friendly and layer-ready for gate to gate. Comfort that keeps up.', tint: ['#EAF0FB', '#CFDDF6'], accent: '#3A5FA0' },
  { id: 'weekend', label: 'Weekend', img: require('../../assets/github-import/men/shoes.png'), note: 'Off the clock and onto the good stuff. Easy fits for slow plans.', tint: ['#FBF1E7', '#F2DEC6'], accent: '#B4772E' },
];

export function ShopByOccasionScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { gender } = useApp();
  const occasions = gender === 'her' ? HER_OCC : HIM_OCC;
  // Home passes an occasion slug (e.g. "streetwear"); match by id / prefix / label.
  const param = String(route.params?.occasion ?? '').toLowerCase();
  const found = param
    ? occasions.findIndex((o) => param === o.id || param.startsWith(o.id) || param === o.label.toLowerCase())
    : -1;
  const [active, setActive] = useState(found === -1 ? 0 : found);
  const occ = occasions[active];
  const pool = useMemo(() => buildPool(gender, 40), [gender]);
  const grid = useMemo(() => pool.slice(active * 6, active * 6 + 8), [pool, active]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SectionHeader title="Occasions" onBack={() => nav.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>
        {/* ── INTRO ── */}
        <View style={{ paddingHorizontal: SP.l, paddingTop: SP.l }}>
          <Text style={[T.micro, { letterSpacing: 2, color: C.dim }]}>DRESS FOR THE MOMENT</Text>
          <Text style={[T.h1, { textTransform: 'uppercase', marginTop: 6 }]}>Shop by Occasion</Text>
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
                  <Text style={[T.micro, { color: '#fff', fontFamily: 'Helvetica Neue', fontWeight: '700', letterSpacing: 0.5 }]}>{occ.label.toUpperCase()}</Text>
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

        {/* ── QUICK MOMENT CARDS — the other occasions, at a glance ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SP.l, gap: SP.s, marginTop: SP.l }}>
          {occasions.map((o, i) => (
            <Pressable key={o.id} onPress={() => setActive(i)} style={{ width: 108 }}>
              <View style={[{ height: 128, overflow: 'hidden' }, BORDER(1)]}>
                <LinearGradient colors={o.tint} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
                <CachedImage source={o.img} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                {active === i && <View style={[StyleSheet.absoluteFillObject, { borderWidth: 2, borderColor: C.ink }]} />}
              </View>
              <Text style={[T.caption, { textAlign: 'center', marginTop: 6, color: active === i ? C.ink : C.dim }]}>{o.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* ── CURATED GRID ── */}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: SP.l, marginTop: SP.xl }}>
          <Text style={[T.h2, { textTransform: 'uppercase' }]}>Wear it to {occ.label}</Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.s, paddingHorizontal: SP.l, marginTop: SP.m }}>
          {grid.map((p, i) => (
            <FadeInUp key={p.id} delay={(i % 6) * 30}>
              <ProductCard p={p} style={{ marginBottom: SP.s }} />
            </FadeInUp>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// FLASH FIT OF THE DAY — a live countdown, one fully shoppable "fit" (top +
// bottom + shoes) with a buy-the-whole-look CTA, then a grid of more flash deals.
// ════════════════════════════════════════════════════════════════════════════
type FitPiece = { slot: string; label: string; price: number; original: number; img: any };
const HER_FIT: FitPiece[] = [
  { slot: 'Top', label: 'Ribbed Knit Top', price: 799, original: 1499, img: require('../../assets/github-import/women/top.png') },
  { slot: 'Bottom', label: 'Pleated Mini Skirt', price: 999, original: 1999, img: require('../../assets/github-import/women/skirts.png') },
  { slot: 'Shoes', label: 'Block Heel Sandal', price: 1299, original: 2499, img: require('../../assets/github-import/women/heels.png') },
];
const HIM_FIT: FitPiece[] = [
  { slot: 'Top', label: 'Boxy Graphic Tee', price: 599, original: 1299, img: require('../../assets/github-import/men/tshirt.png') },
  { slot: 'Bottom', label: 'Relaxed Denim', price: 1099, original: 2299, img: require('../../assets/github-import/men/jeans.png') },
  { slot: 'Shoes', label: 'Court Sneaker', price: 1499, original: 2999, img: require('../../assets/github-import/men/shoes.png') },
];

function useFlashCountdown() {
  const [t, setT] = useState({ h: 5, m: 32, s: 8 });
  useFocusEffect(useCallback(() => {
    const id = setInterval(() => setT((p) => {
      let { h, m, s } = p;
      s -= 1;
      if (s < 0) { s = 59; m -= 1; }
      if (m < 0) { m = 59; h -= 1; }
      if (h < 0) { h = 23; }
      return { h, m, s };
    }), 1000);
    return () => clearInterval(id);
  }, []));
  return t;
}

function CountdownCell({ n }: { n: string }) {
  return (
    <View style={{ backgroundColor: C.ink, paddingHorizontal: 9, paddingVertical: 7, minWidth: 34, alignItems: 'center' }}>
      <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(18), color: '#fff' }}>{n}</Text>
    </View>
  );
}

const FIT_BIG_H = Math.round(W * 0.62);
const FIT_SMALL_H = (FIT_BIG_H - SP.s) / 2;

export function FlashFitScreen() {
  const nav = useNavigation<any>();
  const { gender, showToast } = useApp();
  const fit = gender === 'her' ? HER_FIT : HIM_FIT;
  const time = useFlashCountdown();
  const total = fit.reduce((s, p) => s + p.price, 0);
  const totalOriginal = fit.reduce((s, p) => s + p.original, 0);
  const saved = totalOriginal - total;
  const pool = useMemo(() => buildPool(gender, 24, true), [gender]);
  const cellW = (W - SP.l * 2 - SP.s) / 2;

  const buyTheFit = () => showToast('Fit added', `${fit.length} pieces · you saved ₹${saved}`, 'shopping-bag');

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SectionHeader title="Flash Fit" onBack={() => nav.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>
        {/* ── COUNTDOWN BAR ── */}
        <View style={{ paddingHorizontal: SP.l, paddingTop: SP.l }}>
          <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SP.m, backgroundColor: C.white }, BORDER(1)]}>
            <View>
              <Text style={[T.micro, { letterSpacing: 1.5, color: C.dim }]}>FLASH FIT OF THE DAY</Text>
              <Text style={[T.h3, { marginTop: 3 }]}>Ends in</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <CountdownCell n={String(time.h).padStart(2, '0')} />
              <Text style={{ fontFamily: 'Inter_900Black', color: C.ink }}>:</Text>
              <CountdownCell n={String(time.m).padStart(2, '0')} />
              <Text style={{ fontFamily: 'Inter_900Black', color: C.ink }}>:</Text>
              <CountdownCell n={String(time.s).padStart(2, '0')} />
            </View>
          </View>
        </View>

        {/* ── THE FIT — head-to-toe, laid out as a bento (top big, two stacked) ── */}
        <View style={{ paddingHorizontal: SP.l, marginTop: SP.l }}>
          <Text style={[T.h2, { textTransform: 'uppercase' }]}>Today's Complete Fit</Text>
          <Text style={[T.caption, { color: C.dim, marginTop: 6 }]}>One look, {fit.length} pieces — shop them together or one at a time.</Text>
        </View>
        <View style={{ paddingHorizontal: SP.l, marginTop: SP.m, flexDirection: 'row', gap: SP.s }}>
          {/* big piece (top) */}
          <FitTile piece={fit[0]} w={cellW} h={FIT_BIG_H} onPress={() => nav.navigate('Categories', { label: fit[0].slot })} />
          {/* stacked pair (bottom + shoes) */}
          <View style={{ gap: SP.s }}>
            <FitTile piece={fit[1]} w={cellW} h={FIT_SMALL_H} compact onPress={() => nav.navigate('Categories', { label: fit[1].slot })} />
            <FitTile piece={fit[2]} w={cellW} h={FIT_SMALL_H} compact onPress={() => nav.navigate('Categories', { label: fit[2].slot })} />
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
                  <Text style={[T.caption, { color: 'rgba(255,255,255,0.55)', textDecorationLine: 'line-through' }]}>₹{totalOriginal}</Text>
                </View>
                <Text style={[T.caption, { color: '#5FD08C', marginTop: 4 }]}>You save ₹{saved}</Text>
              </View>
              <Pressable onPress={buyTheFit} style={{ backgroundColor: '#fff', paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[T.button, { color: C.ink, fontSize: rf(14) }]}>Add the fit</Text>
                <Feather name="arrow-right" size={16} color={C.ink} />
              </Pressable>
            </View>
          </View>
        </View>

        {/* ── MORE FLASH DEALS ── */}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: SP.l, marginTop: SP.xxl }}>
          <Text style={[T.h2, { textTransform: 'uppercase' }]}>More Flash Deals</Text>
          <Text style={[T.micro]}>Under ₹999</Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.s, paddingHorizontal: SP.l, marginTop: SP.m }}>
          {pool.filter((p) => p.price <= 999).map((p, i) => (
            <FadeInUp key={p.id} delay={(i % 6) * 30}>
              <ProductCard p={p} style={{ marginBottom: SP.s }}>
                <View style={{ position: 'absolute', top: 0, left: 0, backgroundColor: C.ink, paddingHorizontal: 8, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Feather name="zap" size={10} color="#fff" />
                  <Text style={[T.micro, { color: '#fff', fontFamily: 'Helvetica Neue', fontWeight: '700' }]}>FLASH</Text>
                </View>
              </ProductCard>
            </FadeInUp>
          ))}
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
const EDIT_YELLOW = '#F2E63C';

type EditContent = {
  kicker: string;
  headline: string;
  sub: string;
  cover: any;
  chips: string[];
  cats: { label: string; img: any }[];
  features: { img: any; tag: string; title: string; copy: string }[];
  gridTitle: string;
  poster: any;
  cta: string;
};

const HER_EDIT: EditContent = {
  kicker: "THE WOMEN'S CAMPAIGN",
  headline: 'HER\nEDIT.',
  sub: 'Bold, soft, unapologetic — the pieces she reaches for first, at her door in 60 minutes.',
  cover: require('../../assets/banners/her-new1.png'),
  chips: ['60-MIN DELIVERY', 'NEW DROPS WEEKLY', 'EASY RETURNS'],
  cats: [
    { label: 'Dresses', img: require('../../assets/github-import/women/dress.png') },
    { label: 'Tops', img: require('../../assets/github-import/women/top.png') },
    { label: 'Skirts', img: require('../../assets/github-import/women/skirts.png') },
    { label: 'Heels', img: require('../../assets/github-import/women/heels.png') },
    { label: 'Jewelry', img: require('../../assets/github-import/women/jwellery.png') },
    { label: 'Pants', img: require('../../assets/github-import/women/pants.png') },
    { label: 'Ethnic', img: require('../../assets/github-import/women/ethenic.png') },
    { label: 'Eyewear', img: require('../../assets/github-import/women/glasses.png') },
  ],
  features: [
    { img: require('../../assets/banners/her-closet.jpg'), tag: 'CLOSET REFRESH', title: 'New week,\nnew closet.', copy: 'Seven days of fits, zero repeats. Swap the basics, keep the attitude.' },
    { img: require('../../assets/banners/her-friday.jpg'), tag: 'FRIDAY FEELING', title: 'Off the\nclock.', copy: 'Desk to dinner in one layer — sharp enough for work, easy enough for after.' },
  ],
  gridTitle: 'TRENDING FOR HER',
  poster: require('../../assets/story-posters/her-latest-drops.png'),
  cta: 'EXPLORE ALL · HER',
};

const HIM_EDIT: EditContent = {
  kicker: "THE MEN'S CAMPAIGN",
  headline: 'HIS\nCODE.',
  sub: 'Raw, rugged, refined — the rotation he lives in, at his door in 60 minutes.',
  cover: require('../../assets/banners/him-new1.png'),
  chips: ['60-MIN DELIVERY', 'NEW DROPS WEEKLY', 'EASY RETURNS'],
  cats: [
    { label: 'Tees', img: require('../../assets/github-import/men/tshirt.png') },
    { label: 'Shirts', img: require('../../assets/github-import/men/shirt.png') },
    { label: 'Jeans', img: require('../../assets/github-import/men/jeans.png') },
    { label: 'Jackets', img: require('../../assets/github-import/men/jackets.png') },
    { label: 'Shoes', img: require('../../assets/github-import/men/shoes.png') },
    { label: 'Watches', img: require('../../assets/github-import/men/watchs.png') },
    { label: 'Caps', img: require('../../assets/github-import/men/cap.png') },
    { label: 'Shorts', img: require('../../assets/github-import/men/short.png') },
  ],
  features: [
    { img: require('../../assets/banners/him-coffee.jpg'), tag: 'THE COFFEE RUN', title: 'Five-minute\nfits.', copy: 'Thrown on, never thrown together — the morning uniform that just works.' },
    { img: require('../../assets/banners/him-closet.jpg'), tag: 'CLOSET RESET', title: 'Built\ndifferent.', copy: 'Heavy cotton, clean lines, zero fuss. Staples that outlast trends.' },
  ],
  gridTitle: 'TRENDING FOR HIM',
  poster: require('../../assets/story-posters/him-bros.png'),
  cta: 'EXPLORE ALL · HIM',
};

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
          <Text style={[T.caption, { color: C.ink, fontFamily: 'Helvetica Neue', fontWeight: '700' }]}>View</Text>
          <Feather name="arrow-right" size={13} color={C.ink} />
        </View>
      </View>
    </Pressable>
  );
}

function GenderEditScreen({ content, title }: { content: EditContent; title: string }) {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const products = title === 'For Her' ? HER_PRODUCTS : HIM_PRODUCTS;
  const COVER_H = Math.round(W * 1.1);
  const CAT_W = 96;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>
        {/* ── COVER — full-bleed campaign art under the status bar ── */}
        <View style={{ height: COVER_H, overflow: 'hidden' }}>
          <CachedImage source={content.cover} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" />
          <LinearGradient colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.55)']} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFillObject as any} />
          {/* header row on the photo */}
          <View style={{ position: 'absolute', top: insets.top + 8, left: SP.l, right: SP.l, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable onPress={() => nav.goBack()} hitSlop={10} style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' }}>
              <Feather name="arrow-left" size={19} color="#fff" />
            </Pressable>
            <Text style={[T.caption, { color: '#fff', letterSpacing: 3 }]}>{title.toUpperCase()}</Text>
            <View style={{ width: 38 }} />
          </View>
          {/* kicker + display headline */}
          <View style={{ position: 'absolute', left: SP.l, bottom: 56 }}>
            <View style={{ alignSelf: 'flex-start', backgroundColor: EDIT_YELLOW, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={[T.micro, { color: C.ink, fontFamily: 'Helvetica Neue', fontWeight: '700', letterSpacing: 1.5 }]}>{content.kicker}</Text>
            </View>
            <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(58), lineHeight: rf(56), color: '#fff', letterSpacing: -2, marginTop: 10 }}>{content.headline}</Text>
          </View>
        </View>

        {/* ── INTRO CARD — overlaps the cover bottom ── */}
        <FadeInUp style={{ marginHorizontal: SP.l, marginTop: -36 }}>
          <View style={[{ backgroundColor: C.white, padding: SP.l }, BORDER(1)]}>
            <Text style={[T.body, { color: C.inkSoft }]}>{content.sub}</Text>
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
            <View style={{ position: 'absolute', left: -3, right: -6, bottom: 2, height: 10, backgroundColor: EDIT_YELLOW }} />
            <Text style={[T.h2, { textTransform: 'uppercase' }]}>Shop the pieces</Text>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SP.l, gap: SP.s, marginTop: SP.m }}>
          {content.cats.map((c, i) => (
            <Pressable key={c.label} onPress={() => nav.navigate('Categories', { label: c.label })} style={{ width: CAT_W }}>
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
            <FadeInUp key={f.tag} delay={i * 60}>
              <EditFeature f={f} reverse={i % 2 === 1} onPress={() => nav.navigate('Categories', { label: f.tag })} />
            </FadeInUp>
          ))}
        </View>

        {/* ── TRENDING GRID ── */}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: SP.l, marginTop: SP.xl }}>
          <Text style={[T.h2, { textTransform: 'uppercase' }]}>{content.gridTitle}</Text>
          <Pressable onPress={() => nav.navigate('Categories')} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={[T.caption, { color: C.ink, fontFamily: 'Helvetica Neue', fontWeight: '600' }]}>View all</Text>
            <Feather name="chevron-right" size={14} color={C.ink} />
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.s, paddingHorizontal: SP.l, marginTop: SP.m }}>
          {products.map((p, i) => (
            <FadeInUp key={p.id} delay={(i % 6) * 30}>
              <ProductCard p={p} style={{ marginBottom: SP.s }} />
            </FadeInUp>
          ))}
        </View>

        {/* ── STORY POSTER — full-width band into Top Stories ── */}
        <Pressable onPress={() => nav.navigate('TopStories')} style={{ marginHorizontal: SP.l, marginTop: SP.l }}>
          <View style={[{ height: Math.round(W * 1.05), overflow: 'hidden' }, BORDER(1)]}>
            <CachedImage source={content.poster} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" />
            <View style={{ position: 'absolute', top: SP.m, left: SP.m, backgroundColor: C.ink, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text style={[T.micro, { color: C.white, letterSpacing: 1.5 }]}>THIS WEEK'S STORY</Text>
            </View>
            <View style={{ position: 'absolute', right: SP.m, bottom: SP.m, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[T.caption, { color: C.ink, fontFamily: 'Helvetica Neue', fontWeight: '700' }]}>Read the edit</Text>
              <Feather name="arrow-right" size={13} color={C.ink} />
            </View>
          </View>
        </Pressable>

        {/* ── CTA — black slab on a yellow offset shadow (brand press) ── */}
        <View style={{ paddingHorizontal: SP.l, marginTop: SP.xl }}>
          <View>
            <View style={{ position: 'absolute', top: 5, left: 5, right: -5, bottom: -5, backgroundColor: EDIT_YELLOW, borderWidth: 1, borderColor: C.ink }} />
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
  return <GenderEditScreen content={HER_EDIT} title="For Her" />;
}
export function ForHimEditScreen() {
  return <GenderEditScreen content={HIM_EDIT} title="For Him" />;
}

function FitTile({ piece, w, h, compact, onPress }: { piece: FitPiece; w: number; h: number; compact?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[{ width: w, height: h, backgroundColor: '#F4F4F4', overflow: 'hidden' }, BORDER(1)]}>
      {/* slot chip */}
      <View style={{ position: 'absolute', top: 8, left: 8, zIndex: 2, backgroundColor: C.ink, paddingHorizontal: 8, paddingVertical: 3 }}>
        <Text style={[T.micro, { color: '#fff', letterSpacing: 0.5 }]}>{piece.slot.toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 14 }}>
        <CachedImage source={piece.img} style={{ width: '100%', height: compact ? '82%' : '78%' }} resizeMode="contain" />
      </View>
      {/* price footer */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.92)', borderTopWidth: 1, borderColor: C.hairline }}>
        {!compact && <Text style={[T.productName]} numberOfLines={1}>{piece.label}</Text>}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: compact ? 0 : 2 }}>
          <Text style={[T.price]}>₹{piece.price}</Text>
          <Text style={[T.mrp]}>₹{piece.original}</Text>
        </View>
      </View>
    </Pressable>
  );
}
