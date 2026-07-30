// Category browser — SHEIN-style two-pane "Menu" page.
//
// Left: vertical rail of every top-level category. Right: one continuous scroll,
// a section per category with its banner ("Shop All") and its sub-category tiles.
//
// The taxonomy comes from the BACKEND (`listCategoryTree`), which returns the tree
// already resolved for this rail — HIM sees "Footwear" where HER sees "Shoes", and
// each node carries a product count so empty tiles are never drawn. The TAXONOMY /
// HIM_TAXONOMY arrays below are the offline fallback only; they mirror the seed, so
// the two agree. Banner artwork stays local (shipped in the bundle) and is keyed by
// category slug.
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, FlatList, Pressable, Dimensions, Platform } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { C, T, SP, BORDER, HELV} from '../theme/brutal';
import { BrutalStatusBar, CachedImage } from '../components/Brutal';
import { RealIcon } from '../components/RealIcon';
import { useApp } from '../state/AppState';
import { listCategoryTree } from '../services/catalog';
import type { CategoryNode } from '../services/catalog';
import { useTabBarScroll } from '../hooks/useTabBarScroll';
import { useCmsSection } from '../hooks/useCmsContent';
import type { CmsSection } from '../content/types';
import { resolveMedia, str } from '../content/media';
import { IMG } from '../services/images';

/**
 * Category banner art and its label placement are the `page.category_banners` CMS section.
 *
 * The item KEY is the gendered taxonomy slug (`her-tops`, `him-denim`) — that is the lookup,
 * not just a React key. Backend categories arrive keyed by slug, and a shared node carries no
 * gender prefix (`tops`), so the lookup tries the gendered key first and then the bare one.
 *
 * Coverage is deliberately partial: HER has 14 banners and HIM 9. A category with no banner
 * falls back to a product image, which is why the lookup returning nothing is a normal
 * outcome rather than an error. Admin can fill the gaps without an app release now.
 *
 * Text placement was computed offline by finding the emptiest region of each banner, so the
 * label sits in negative space rather than across the model.
 */
type TxtPos = { h: 'left' | 'center' | 'right'; v: 'top' | 'bottom' };

const DEFAULT_TXT: TxtPos = { h: 'left', v: 'bottom' };

function bannerFor(section: CmsSection, slug: string, him: boolean) {
  const bare = slug.replace(/^(her|him)-/, '');
  const prefix = him ? 'him' : 'her';
  const item =
    section.items.find((i) => i.key === `${prefix}-${bare}`) ??
    section.items.find((i) => i.key === bare);
  if (!item) return null;
  const source = resolveMedia(item, IMG.card);
  if (!source) return null;
  const h = str(item.content, 'textH');
  const v = str(item.content, 'textV');
  return {
    source,
    pos: {
      h: h === 'center' || h === 'right' ? h : 'left',
      v: v === 'top' ? 'top' : 'bottom',
    } as TxtPos,
  };
}

const { width: W } = Dimensions.get('window');
const RAIL_W = 118;
const PANE_W = W - RAIL_W;
const TILE_W = (PANE_W - SP.m * 2 - SP.s) / 2;
const TILE_H = Math.round(TILE_W * 1.25); // near-square, like the reference

// ── Standard fashion taxonomy (SHEIN-style) ───────────────────────────────────
// Each entry: how to recognise a backend category (match), the subcategories
// shown under SHOP BY STYLE, and per-sub search keywords used both to pick a
// tile image from the loaded products and as the search term when tapped.
// OFFLINE FALLBACK ONLY. The live taxonomy comes from `listCategoryTree`; these arrays
// mirror the backend seed (`backend/src/shared/catalog/taxonomy.ts`) so the page still
// renders with no network. `q` supplies the stand-in tile image; `match` is vestigial.
type Sub = { label: string; q: string[] };
type Taxo = { key: string; label: string; himLabel?: string; match: RegExp; herOnly?: boolean; subs: Sub[]; himSubs?: Sub[] };

const TAXONOMY: Taxo[] = [
  {
    key: 'tops', label: 'Tops', match: /top|tee|shirt|blouse/i,
    subs: [
      { label: 'T-Shirts', q: ['t-shirt', 'tshirt', 'tee'] },
      { label: 'Blouses', q: ['blouse'] },
      { label: 'Shirts', q: ['shirt'] },
      { label: 'Tank Tops', q: ['tank'] },
      { label: 'Camis', q: ['cami'] },
      { label: 'Crop Tops', q: ['crop'] },
      { label: 'Bodysuits', q: ['bodysuit'] },
      { label: 'Sweatshirts', q: ['sweatshirt'] },
      { label: 'Hoodies', q: ['hoodie'] },
      { label: 'Sweaters', q: ['sweater', 'knit'] },
      { label: 'Cardigans', q: ['cardigan'] },
    ],
    himSubs: [
      { label: 'T-Shirts', q: ['t-shirt', 'tshirt', 'tee'] },
      { label: 'Polos', q: ['polo'] },
      { label: 'Shirts', q: ['shirt'] },
      { label: 'Sweatshirts', q: ['sweatshirt'] },
      { label: 'Hoodies', q: ['hoodie'] },
      { label: 'Sweaters', q: ['sweater', 'knit'] },
      { label: 'Vests', q: ['vest'] },
      { label: 'Tanks', q: ['tank'] },
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
      { label: 'Pants', q: ['pant'] },
      { label: 'Trousers', q: ['trouser'] },
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
    key: 'lounge', label: 'Loungewear', himLabel: 'Innerwear', match: /lounge|lingerie|sleep|pajama|inner/i,
    subs: [
      { label: 'Pajama Sets', q: ['pajama', 'sleep'] },
      { label: 'Robes', q: ['robe'] },
      { label: 'Bras', q: ['bra'] },
      { label: 'Bralettes', q: ['bralette', 'bra'] },
      { label: 'Shapewear', q: ['shape'] },
      { label: 'Loungewear Sets', q: ['lounge'] },
    ],
    himSubs: [
      { label: 'Pajama Sets', q: ['pajama', 'sleep'] },
      { label: 'Vests', q: ['vest'] },
      { label: 'Boxers', q: ['boxer'] },
      { label: 'Briefs', q: ['brief'] },
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
    key: 'swim', label: 'Swimwear', himLabel: 'Beachwear', match: /swim|beach/i,
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
    key: 'outerwear', label: 'Outerwear', match: /jacket|coat|outer|blazer|puffer/i,
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
      { label: 'Sandals', q: ['sandal'] },
      { label: 'Sliders', q: ['slider'] },
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
      { label: 'Hats', q: ['hat'] },
      { label: 'Caps', q: ['cap'] },
      { label: 'Sunglasses', q: ['sunglass'] },
      { label: 'Scarves', q: ['scarf', 'scarves'] },
      { label: 'Hair Accessories', q: ['hair', 'clip', 'scrunchie'] },
      { label: 'Socks', q: ['sock'] },
      { label: 'Tights', q: ['tight'] },
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
// ── Men's taxonomy — a DISTINCT category set for HIM (no Dresses/Jewelry;
// adds Ethnic Wear, Formalwear, Grooming, etc.). Keys reuse the shared banner
// keys where they line up (tops, bottoms, shoes…) and add men-only ones. ──
const HIM_TAXONOMY: Taxo[] = [
  { key: 'tops', label: 'Tops', match: /top|tee|shirt|polo/i, subs: [
    { label: 'T-Shirts', q: ['t-shirt', 'tshirt', 'tee'] },
    { label: 'Shirts', q: ['shirt'] },
    { label: 'Polos', q: ['polo'] },
    { label: 'Hoodies', q: ['hoodie'] },
    { label: 'Sweatshirts', q: ['sweatshirt'] },
    { label: 'Sweaters', q: ['sweater', 'knit'] },
    { label: 'Vests', q: ['vest'] },
  ] },
  { key: 'bottoms', label: 'Bottoms', match: /bottom|pant|trouser|short|jogger|chino/i, subs: [
    { label: 'Jeans', q: ['jean', 'denim'] },
    { label: 'Trousers', q: ['trouser', 'pant'] },
    { label: 'Cargos', q: ['cargo'] },
    { label: 'Joggers', q: ['jogger', 'track'] },
    { label: 'Shorts', q: ['short'] },
    { label: 'Chinos', q: ['chino'] },
  ] },
  { key: 'denim', label: 'Denim', match: /denim|jean/i, subs: [
    { label: 'Jeans', q: ['jean'] },
    { label: 'Baggy Jeans', q: ['baggy', 'loose'] },
    { label: 'Slim Jeans', q: ['slim'] },
    { label: 'Denim Jackets', q: ['denim jacket', 'jacket'] },
    { label: 'Denim Shorts', q: ['denim short', 'short'] },
  ] },
  { key: 'ethnic', label: 'Ethnic Wear', match: /ethnic|kurta|sherwani|nehru|pathani|traditional/i, subs: [
    { label: 'Kurtas', q: ['kurta'] },
    { label: 'Kurta Sets', q: ['kurta set'] },
    { label: 'Nehru Jackets', q: ['nehru', 'jacket'] },
    { label: 'Sherwanis', q: ['sherwani'] },
    { label: 'Pathani', q: ['pathani'] },
  ] },
  { key: 'formal', label: 'Formalwear', match: /formal|suit|blazer/i, subs: [
    { label: 'Blazers', q: ['blazer'] },
    { label: 'Suits', q: ['suit'] },
    { label: 'Formal Shirts', q: ['formal shirt', 'shirt'] },
    { label: 'Formal Trousers', q: ['formal trouser', 'trouser'] },
    { label: 'Waistcoats', q: ['waistcoat', 'vest'] },
  ] },
  { key: 'outerwear', label: 'Outerwear', match: /jacket|coat|outer|bomber|puffer/i, subs: [
    { label: 'Jackets', q: ['jacket'] },
    { label: 'Bombers', q: ['bomber'] },
    { label: 'Coats', q: ['coat'] },
    { label: 'Puffers', q: ['puffer', 'padded'] },
    { label: 'Overshirts', q: ['overshirt'] },
  ] },
  { key: 'active', label: 'Activewear', match: /active|sport|gym|athle/i, subs: [
    { label: 'Gym T-Shirts', q: ['gym', 'tee', 't-shirt'] },
    { label: 'Track Pants', q: ['track', 'jogger'] },
    { label: 'Shorts', q: ['short'] },
    { label: 'Tanks', q: ['tank', 'vest'] },
    { label: 'Windbreakers', q: ['windbreaker', 'jacket'] },
  ] },
  { key: 'lounge', label: 'Innerwear', match: /inner|lounge|sleep|pajama|vest|boxer|brief/i, subs: [
    { label: 'Vests', q: ['vest'] },
    { label: 'Boxers', q: ['boxer'] },
    { label: 'Briefs', q: ['brief'] },
    { label: 'Pajamas', q: ['pajama', 'sleep'] },
    { label: 'Lounge Pants', q: ['lounge'] },
  ] },
  { key: 'swim', label: 'Beachwear', match: /swim|beach/i, subs: [
    { label: 'Swim Shorts', q: ['swim', 'short'] },
    { label: 'Beach Shirts', q: ['beach', 'shirt'] },
  ] },
  { key: 'shoes', label: 'Footwear', match: /shoe|sneaker|boot|footwear|sandal|loafer/i, subs: [
    { label: 'Sneakers', q: ['sneaker'] },
    { label: 'Formal Shoes', q: ['formal', 'oxford', 'derby'] },
    { label: 'Loafers', q: ['loafer'] },
    { label: 'Sandals', q: ['sandal', 'slider'] },
    { label: 'Boots', q: ['boot'] },
  ] },
  { key: 'accessories', label: 'Accessories', match: /accessor|cap|belt|watch|sunglass/i, subs: [
    { label: 'Caps', q: ['cap', 'hat'] },
    { label: 'Belts', q: ['belt'] },
    { label: 'Sunglasses', q: ['sunglass', 'shade'] },
    { label: 'Watches', q: ['watch'] },
    { label: 'Wallets', q: ['wallet'] },
  ] },
  { key: 'bags', label: 'Bags', match: /bag|backpack/i, subs: [
    { label: 'Backpacks', q: ['backpack'] },
    { label: 'Duffles', q: ['duffle', 'duffel'] },
    { label: 'Slings', q: ['sling'] },
    { label: 'Laptop Bags', q: ['laptop'] },
  ] },
  { key: 'grooming', label: 'Grooming', match: /groom|fragrance|beard|skincare|cologne/i, subs: [
    { label: 'Fragrances', q: ['fragrance', 'perfume', 'cologne'] },
    { label: 'Beard Care', q: ['beard'] },
    { label: 'Skincare', q: ['skincare', 'face'] },
    { label: 'Hair', q: ['hair'] },
  ] },
];

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

/*
 * `poolImg` used to live here.
 *
 * It borrowed artwork from the bundled demo catalogue for any category the
 * backend had not given an image — keyword-matched on the label, else picked by
 * name hash — so a category with no art showed a photo of a product that is not
 * in it and is not for sale. Categories without art now fall back to the local
 * banner set, and failing that to the plain grey label tile.
 */

// Grey label tile — Home "Flash Fit" look: grey #F4F4F4 + hairline, an uppercase
// ink label at the TOP, and the image filling the rest of the tile.
// `node` + a STABLE `onPress(node)` rather than `onPress: () => void`. Every call
// site used to pass a fresh `() => openListing(sub)` closure, which gave the memo
// a new prop identity on every render and meant this React.memo could never once
// skip a re-render.
const StyleTile = React.memo(function StyleTile({
  img, label, node, onPress, tileRef, w = TILE_W, h = TILE_H,
}: {
  // string = remote URL (backend category art); number = a bundled require().
  img: string | number; label: string;
  node: CategoryNode; onPress: (n: CategoryNode) => void;
  tileRef?: (el: any) => void; w?: number; h?: number;
}) {
  const press = useCallback(() => onPress(node), [onPress, node]);
  return (
    <Pressable onPress={press} style={{ width: w }}>
      {/* Same grey as Home category tiles; image fills; label bottom-left in
          white over just a soft scrim (no heavy black gradient). */}
      <View ref={tileRef} collapsable={false} style={[{ width: w, height: h, backgroundColor: '#f1f1f1', overflow: 'hidden' }, BORDER(1)]}>
        {!!img && (
          <CachedImage
            transition={0}
            source={typeof img === 'number' ? img : { uri: img }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="contain"
          />
        )}
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.42)']}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '34%' }}
        />
        <Text numberOfLines={1} style={{ position: 'absolute', left: 8, right: 8, bottom: 6, color: '#FFFFFF', fontFamily: HELV, fontWeight: '500', fontSize: 11 }}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
});

/** Gap BETWEEN sections only — the first banner stays flush with the rail's first row. */
const SectionGap = () => <View style={{ height: SP.l }} />;

/**
 * One category: its landscape banner plus the grid of its leaf tiles.
 *
 * Extracted and memoised so the FlatList below can actually virtualise. As a
 * `.map()` inside a ScrollView this mounted every banner and every tile at once
 * — 98 images on the HER rail — and `removeClippedSubviews` only detached the
 * native views while leaving all 98 React components mounted and re-rendering.
 */
const CategorySection = React.memo(function CategorySection({
  cat, him, banners, onOpen,
}: {
  cat: CategoryNode; him: boolean; banners: CmsSection; onOpen: (c: CategoryNode) => void;
}) {
  const banner = bannerFor(banners, cat.slug, him);
  const bImg = cat.img;
  const tp = banner?.pos ?? DEFAULT_TXT;
  const openSelf = useCallback(() => onOpen(cat), [onOpen, cat]);

  return (
    <View>
      <Pressable onPress={openSelf}>
        <View style={{ height: 104, marginBottom: SP.s, backgroundColor: '#e6e6e6', overflow: 'hidden' }}>
          <CachedImage transition={0} source={banner?.source ?? { uri: bImg }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} resizeMode="cover" />
          {/* Directional scrim under the label so WHITE text stays legible. A
              solid low-opacity fill instead of the old LinearGradient — with one
              of these per category the gradient shader was a real fill-rate cost
              on budget GPUs, and at this size the two are near indistinguishable. */}
          <View
            style={{
              position: 'absolute', left: 0, right: 0,
              [tp.v === 'top' ? 'top' : 'bottom']: 0,
              height: '55%',
              backgroundColor: 'rgba(0,0,0,0.28)',
            }}
          />
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingVertical: 12, alignItems: tp.h === 'left' ? 'flex-start' : tp.h === 'right' ? 'flex-end' : 'center', justifyContent: tp.v === 'top' ? 'flex-start' : 'flex-end' }}>
            <Text numberOfLines={1} style={{ fontFamily: HELV, fontWeight: '700', fontSize: 14, letterSpacing: 1.5, textTransform: 'uppercase', textAlign: tp.h, color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 4 }}>{cat.label}</Text>
            <Text numberOfLines={1} style={{ fontFamily: HELV, fontWeight: '500', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', textAlign: tp.h, marginTop: 3, color: 'rgba(255,255,255,0.9)', textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 4 }}>Shop All →</Text>
          </View>
        </View>
      </Pressable>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.s }}>
        {cat.children.map((sub) => (
          <StyleTile
            key={sub.id}
            img={sub.img}
            label={sub.label}
            node={sub}
            onPress={onOpen}
          />
        ))}
      </View>
    </View>
  );
});

// Section heading — T.h2 uppercase, matching Home's section heads.
function SectionLabel({ children }: { children: string }) {
  return (
    <Text style={[T.h2, { color: C.ink, textTransform: 'uppercase', marginTop: SP.l, marginBottom: SP.s }]}>
      {children}
    </Text>
  );
}

export default function CategoryBrowseScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { gender } = useApp();
  const tabScroll = useTabBarScroll();
  const him = gender === 'him';
  // Banner art per category. One payload read shared by every section below; the object
  // identity is stable between renders, so CategorySection's memo still holds.
  const { section: banners } = useCmsSection('page.category_banners', gender);

  // ── The rail + its sub-tiles come from the backend taxonomy ──────────────────
  // Until it lands (and if the device is offline) we render the bundled taxonomy so
  // the page is never blank. Both describe the same tree; the seed is generated from
  // these very arrays.
  const fallback = useMemo<CategoryNode[]>(() => {
    const TAX = him ? HIM_TAXONOMY : TAXONOMY;
    return TAX.filter((t) => !(him && t.herOnly)).map((t) => ({
      id: 'tx-' + t.key,
      slug: t.key,
      parentId: null,
      label: him && t.himLabel ? t.himLabel : t.label,
      icon: 'grid-outline',
      tint: '#eeeeee',
      img: '',
      isLeaf: false,
      listingCount: 1, // unknown offline — show every tile rather than hide them all
      children: ((him && t.himSubs) ? t.himSubs : (t.subs ?? DEFAULT_SUBS)).map((s) => ({
        id: `tx-${t.key}-${s.label}`,
        slug: `${t.key}-${s.label}`,
        parentId: 'tx-' + t.key,
        label: s.label,
        icon: 'grid-outline',
        tint: '#eeeeee',
        img: '',
        isLeaf: true,
        listingCount: 1,
        children: [],
      })),
    }));
  }, [him]);

  const [tree, setTree] = useState<CategoryNode[] | null>(null);
  useEffect(() => {
    const ac = new AbortController();
    listCategoryTree(gender, ac.signal)
      .then((t) => { if (t.length) setTree(t); })
      .catch(() => { /* aborted, or offline — keep the bundled taxonomy */ });
    return () => ac.abort();
  }, [gender]);

  // Drop anything with nothing in it — a tile that opens an empty grid is worse than
  // no tile. Offline rows carry count 1, so the fallback is unaffected.
  const cats = useMemo<CategoryNode[]>(() => {
    const src = tree ?? fallback;
    return src
      .map((c) => ({ ...c, children: c.children.filter((s) => s.listingCount > 0) }))
      .filter((c) => c.listingCount > 0 && c.children.length > 0);
  }, [tree, fallback]);

  // Full listing page for a category — the id/slug is what narrows it now; a parent
  // shows everything in its sub-categories, a leaf shows just its own.
  const openListing = useCallback((c: CategoryNode) => {
    nav.navigate('Category', { id: c.id, slug: c.slug, label: c.label });
  }, [nav]);

  // ── SCROLL-SPY — the right pane is ONE continuous scroll through every
  // category; the left rail highlights whichever section is at the top, and
  // tapping the rail jumps the right pane to that section. ──
  const rightRef = useRef<FlatList<CategoryNode>>(null);
  const [activeId, setActiveId] = useState<string>('');
  const suppressSpy = useRef(false); // ignore spy while a tap-jump is animating

  // Viewability instead of hand-measured section offsets. The old handler listed
  // `activeId` in its own dependency array while being the only thing that sets
  // `activeId`, so its identity changed every time it fired — replacing the
  // ScrollView's onScroll prop on every scroll frame. It also cannot work under
  // virtualisation, since off-screen sections are never laid out and so never
  // record an offset.
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<{ item: CategoryNode }> }) => {
    if (suppressSpy.current) return;
    const first = viewableItems[0]?.item;
    if (first) setActiveId((cur) => (cur === first.id ? cur : first.id));
  }).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 40, minimumViewTime: 80 }).current;

  const jumpTo = useCallback((c: CategoryNode) => {
    setActiveId(c.id);
    const index = cats.findIndex((x) => x.id === c.id);
    if (index < 0) return;
    suppressSpy.current = true;
    rightRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0 });
    setTimeout(() => { suppressSpy.current = false; }, 460);
  }, [cats]);

  // ── FlatList plumbing. All stable so CategorySection's memo can hold. ──
  const keyExtractor = useCallback((c: CategoryNode) => c.id, []);
  const renderSection = useCallback(
    ({ item }: { item: CategoryNode }) => (
      <CategorySection cat={item} him={him} banners={banners} onOpen={openListing} />
    ),
    [him, openListing, banners],
  );
  const onScrollToIndexFailed = useCallback((info: { index: number; averageItemLength: number }) => {
    rightRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true });
    setTimeout(() => rightRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0 }), 120);
  }, []);
  // Auto-scroll the left rail so the active chip stays in view.
  const railRef = useRef<ScrollView>(null);
  useEffect(() => {
    const i = cats.findIndex((c) => c.id === activeId);
    if (i >= 0) railRef.current?.scrollTo({ y: Math.max(0, i * 46 - 160), animated: true });
  }, [activeId, cats]);

  // Land on the category the caller asked for (Home's tiles pass a label), else the
  // first one. Re-runs when the tree arrives, since ids change from tx-* to cat_*.
  const jumpedFor = useRef<string | null>(null);
  useEffect(() => {
    if (cats.length === 0) return;
    const key = `${gender}:${cats[0]!.id}`;
    if (jumpedFor.current === key) return;
    jumpedFor.current = key;
    /**
     * Try EVERY hint the caller gave, in order of precision.
     *
     * This used to be `slug ?? id ?? label` — one value, picked by which was
     * merely *defined*. Callers that pass a local id alongside a good label
     * (Home's tiles historically, Discover Brands today) therefore resolved on
     * the id, missed, and silently landed on `cats[0]` — tap "Dresses", get
     * "Belts". Falling through to the next hint costs nothing and cannot make a
     * correct call worse, since slug still wins whenever it is present.
     */
    const hints = [route.params?.slug, route.params?.id, route.params?.label].filter(Boolean);
    let target: (typeof cats)[number] | undefined;
    for (const want of hints) {
      target = cats.find((c) => c.slug === want || c.id === want || c.label === want);
      if (target) break;
    }
    setActiveId((target ?? cats[0]!).id);
  }, [cats, gender, route.params]);

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <BrutalStatusBar />

      {/* ═══ SEARCH BAR — sharp hairline row, camera + search button ═══ */}
      <View style={{ paddingTop: 56, paddingHorizontal: SP.m, paddingBottom: SP.s, backgroundColor: '#FFFFFF' }}>
        <View style={[{ flexDirection: 'row', alignItems: 'center', height: 50, paddingLeft: 18, paddingRight: 4, backgroundColor: '#FFFFFF' }, BORDER(1)]}>
          <Pressable onPress={() => nav.navigate('Search')} style={{ flex: 1, height: '100%', justifyContent: 'center' }}>
            <Text style={[T.body, { color: C.dim }]} numberOfLines={1}>Oversized t-shirt</Text>
          </Pressable>
          <Pressable onPress={() => nav.navigate('ImageSearch')} hitSlop={8} style={{ paddingHorizontal: 10 }}>
            <RealIcon name="camera" size={20} />
          </Pressable>
          <Pressable onPress={() => nav.navigate('Search')} style={{ width: 42, height: 42, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }}>
            <RealIcon name="search" size={19} color={C.white} />
          </Pressable>
        </View>
      </View>

      <View style={{ flex: 1, flexDirection: 'row' }}>
        {/* ═══ LEFT RAIL — full category list ═══ */}
        <ScrollView
          ref={railRef}
          style={{ width: RAIL_W, flexGrow: 0, backgroundColor: '#f5f5f5' }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {cats.map((c) => {
            const active = c.id === activeId;
            return (
              <Pressable
                key={c.id}
                onPress={() => jumpTo(c)}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 8,
                  alignItems: 'center',
                  backgroundColor: active ? '#FFFFFF' : 'transparent',
                }}
              >
                {active && <View style={{ position: 'absolute', left: 0, top: 10, bottom: 10, width: 3, backgroundColor: '#999999' }} />}
                <Text
                  style={{
                    fontFamily: HELV, fontWeight: '400', // thin/regular weight
                    fontSize: 11,
                    letterSpacing: 0.3,
                    textTransform: 'uppercase',     // CAPS
                    textAlign: 'center',
                    lineHeight: 15,
                    color: active ? '#444444' : '#9a9a9a', // grey only, never black
                  }}
                >
                  {c.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ═══ RIGHT PANE — ONE virtualised scroll through every category ═══ */}
        <FlatList
          ref={rightRef}
          data={cats}
          keyExtractor={keyExtractor}
          renderItem={renderSection}
          ItemSeparatorComponent={SectionGap}
          onScroll={tabScroll.onScroll}
          scrollEventThrottle={16}
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          // Sections have variable height (a category has 2-12 leaves), so an
          // exact getItemLayout is not possible; these bound how much mounts at
          // once instead. Two screens of buffer keeps fast flicks from showing
          // blanks without going back to mounting all 98 images.
          windowSize={5}
          initialNumToRender={2}
          maxToRenderPerBatch={3}
          updateCellsBatchingPeriod={60}
          removeClippedSubviews={Platform.OS === 'android'}
          // Without a fixed row height FlatList cannot land a scrollToIndex on an
          // unmeasured row; retry once the target has been rendered.
          onScrollToIndexFailed={onScrollToIndexFailed}
          contentContainerStyle={{ paddingHorizontal: SP.m, paddingTop: 0, paddingBottom: 180 }}
        />
      </View>
    </View>
  );
}
