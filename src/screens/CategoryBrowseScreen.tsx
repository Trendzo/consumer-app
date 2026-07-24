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
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { C, T, SP, BORDER } from '../theme/brutal';
import { BrutalStatusBar, CachedImage } from '../components/Brutal';
import { RealIcon } from '../components/RealIcon';
import { useZoom } from '../navigation/ZoomTransition';
import { useApp } from '../state/AppState';
import { PRODUCTS, CATEGORIES } from '../data/mockData';
import type { Product, Category, Occasion } from '../data/mockData';
import { listCategories, listProducts, listOccasions, isBackendCategoryId } from '../services/catalog';
import { useTabBarScroll } from '../hooks/useTabBarScroll';

// Landscape category-banner art, keyed by taxonomy key. HER only for now —
// HIM banners will be dropped in later; until then HIM falls back to a
// product image. (Add HIM_BANNERS the same way once the assets arrive.)
const HER_BANNERS: Record<string, any> = {
  tops: require('../../assets/category-banners/her/tops.png'),
  dresses: require('../../assets/category-banners/her/dresses.png'),
  coords: require('../../assets/category-banners/her/coords.png'),
  bottoms: require('../../assets/category-banners/her/bottoms.png'),
  denim: require('../../assets/category-banners/her/denim.png'),
  lounge: require('../../assets/category-banners/her/lounge.png'),
  active: require('../../assets/category-banners/her/active.png'),
  swim: require('../../assets/category-banners/her/swim.png'),
  outerwear: require('../../assets/category-banners/her/outerwear.png'),
  shoes: require('../../assets/category-banners/her/shoes.png'),
  bags: require('../../assets/category-banners/her/bags.png'),
  accessories: require('../../assets/category-banners/her/accessories.png'),
  jewelry: require('../../assets/category-banners/her/jewelry.png'),
  beauty: require('../../assets/category-banners/her/beauty.png'),
};

// Men banners (9 so far — shoes/accessories/bags/grooming still to come →
// those fall back to a product image until added).
const HIM_BANNERS: Record<string, any> = {
  tops: require('../../assets/category-banners/him/tops.png'),
  bottoms: require('../../assets/category-banners/him/bottoms.png'),
  denim: require('../../assets/category-banners/him/denim.png'),
  ethnic: require('../../assets/category-banners/him/ethnic.png'),
  formal: require('../../assets/category-banners/him/formal.png'),
  outerwear: require('../../assets/category-banners/him/outerwear.png'),
  active: require('../../assets/category-banners/him/active.png'),
  lounge: require('../../assets/category-banners/him/lounge.png'),
  swim: require('../../assets/category-banners/him/swim.png'),
};

// Editorial text placement per banner — computed OFFLINE by finding the
// emptiest region of each banner (away from the model), so the label sits in
// negative space, poster-style, never on top of the person. `light` = the
// spot is dark, so use white text.
type TxtPos = { h: 'left' | 'center' | 'right'; v: 'top' | 'bottom' };
const HER_TXT: Record<string, TxtPos> = {
  tops: { h: 'left', v: 'top' },
  dresses: { h: 'left', v: 'bottom' },
  coords: { h: 'left', v: 'bottom' },
  bottoms: { h: 'center', v: 'top' },
  denim: { h: 'left', v: 'top' },
  lounge: { h: 'center', v: 'top' },
  active: { h: 'left', v: 'top' },
  swim: { h: 'left', v: 'bottom' },
  outerwear: { h: 'center', v: 'top' },
  shoes: { h: 'right', v: 'bottom' },
  bags: { h: 'right', v: 'bottom' },
  accessories: { h: 'right', v: 'bottom' },
  jewelry: { h: 'right', v: 'top' },
  beauty: { h: 'left', v: 'top' },
};
const HIM_TXT: Record<string, TxtPos> = {
  tops: { h: 'left', v: 'top' },
  bottoms: { h: 'left', v: 'top' },
  denim: { h: 'left', v: 'top' },
  ethnic: { h: 'left', v: 'top' },
  formal: { h: 'right', v: 'top' },
  outerwear: { h: 'left', v: 'bottom' },
  active: { h: 'left', v: 'top' },
  lounge: { h: 'right', v: 'top' },
  swim: { h: 'right', v: 'top' },
};

const { width: W } = Dimensions.get('window');
const RAIL_W = 118;
const PANE_W = W - RAIL_W;
const TILE_W = (PANE_W - SP.m * 2 - SP.s) / 2;
const TILE_H = Math.round(TILE_W * 1.25); // near-square, like the reference

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

const findTaxo = (label: string, list: Taxo[] = TAXONOMY): Taxo | undefined => list.find((t) => t.match.test(label));

// Grey label tile — Home "Flash Fit" look: grey #F4F4F4 + hairline, an uppercase
// ink label at the TOP, and the image filling the rest of the tile.
const StyleTile = React.memo(function StyleTile({
  img, label, onPress, tileRef, w = TILE_W, h = TILE_H,
}: {
  img: string; label: string; onPress: () => void;
  tileRef?: (el: any) => void; w?: number; h?: number;
}) {
  return (
    <Pressable onPress={onPress} style={{ width: w }}>
      {/* Same grey as Home category tiles; image fills; label bottom-left in
          white over just a soft scrim (no heavy black gradient). */}
      <View ref={tileRef} collapsable={false} style={[{ width: w, height: h, backgroundColor: '#f1f1f1', overflow: 'hidden' }, BORDER(1)]}>
        {!!img && <CachedImage transition={0} source={{ uri: img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />}
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.42)']}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '34%' }}
        />
        <Text numberOfLines={1} style={{ position: 'absolute', left: 8, right: 8, bottom: 6, color: '#FFFFFF', fontFamily: 'Helvetica Neue', fontWeight: '500', fontSize: 11 }}>
          {label}
        </Text>
      </View>
    </Pressable>
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
  const { openZoom } = useZoom();
  const zoomRefs = useRef<Record<string, any>>({});
  const him = gender === 'him';

  // Gender-specific taxonomy — men get a completely different category set.
  const TAX = him ? HIM_TAXONOMY : TAXONOMY;

  // ── Rail = ONLY the curated taxonomy (clean names: Tops, Bottoms, Ethnic
  // Wear…). We intentionally do NOT merge backend categories here — they came
  // in with granular labels (Top, Tee, Shirt…) that cluttered the rail. ──
  const [apiCats, setApiCats] = useState<Category[] | null>(null);
  const cats = useMemo<Category[]>(() =>
    TAX
      .filter((t) => !(him && t.herOnly))
      .map((t) => ({ id: 'tx-' + t.key, label: him && t.himLabel ? t.himLabel : t.label, icon: 'grid-outline', tint: '#eeeeee', img: '' })),
  [him]);

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

  // ── SCROLL-SPY — the right pane is ONE continuous scroll through every
  // category; the left rail highlights whichever section is at the top, and
  // tapping the rail jumps the right pane to that section. ──
  const rightRef = useRef<ScrollView>(null);
  const sectionY = useRef<Record<string, number>>({});
  const [activeId, setActiveId] = useState<string>(() => selected.id);
  const suppressSpy = useRef(false); // ignore spy while a tap-jump is animating
  const onRightScroll = useCallback((e: any) => {
    tabScroll.onScroll(e); // keep the hide-on-scroll tab-bar behaviour
    if (suppressSpy.current) return;
    const y = e.nativeEvent.contentOffset.y + 90; // trigger a touch below the top edge
    let cur = cats[0]?.id;
    for (const c of cats) {
      const sy = sectionY.current[c.id];
      if (sy != null && sy <= y) cur = c.id;
    }
    if (cur && cur !== activeId) setActiveId(cur);
  }, [tabScroll, cats, activeId]);
  const jumpTo = useCallback((c: Category) => {
    setActiveId(c.id);
    const y = sectionY.current[c.id];
    if (y == null) return;
    suppressSpy.current = true;
    rightRef.current?.scrollTo({ y: Math.max(0, y - 4), animated: true });
    setTimeout(() => { suppressSpy.current = false; }, 460);
  }, []);
  // Auto-scroll the left rail so the active chip stays in view.
  const railRef = useRef<ScrollView>(null);
  useEffect(() => {
    const i = cats.findIndex((c) => c.id === activeId);
    if (i >= 0) railRef.current?.scrollTo({ y: Math.max(0, i * 46 - 160), animated: true });
  }, [activeId, cats]);

  // One clean representative image per subcategory (mock pool, deterministic) —
  // so every tile shows a single category-style image, no per-category fetch.
  const poolImg = useCallback((label: string, q: string[]): string => {
    const hit = PRODUCTS.find((p) => q.some((k) => p.name.toLowerCase().includes(k)));
    if (hit) return hit.img;
    let h = 0; for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) & 0xffff;
    return PRODUCTS[h % PRODUCTS.length]?.img ?? '';
  }, []);

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
                    fontFamily: 'Helvetica Neue', fontWeight: '400', // thin/regular weight
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

        {/* ═══ RIGHT PANE — ONE continuous scroll through every category ═══ */}
        <ScrollView
          ref={rightRef}
          onScroll={onRightScroll}
          scrollEventThrottle={16}
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={Platform.OS === 'android'}
          contentContainerStyle={{ paddingHorizontal: SP.m, paddingTop: 0, paddingBottom: 180 }}
        >
          {cats.map((c, ci) => {
            const t = findTaxo(c.label, TAX);
            const cSubs: Sub[] = (him && t?.himSubs) ? t.himSubs : (t?.subs ?? DEFAULT_SUBS);
            // Real landscape banner art keyed by taxonomy key (gender-aware).
            // Unmapped keys (e.g. men's shoes/bags until added) → product image.
            const bannerArt = t?.key ? (him ? HIM_BANNERS[t.key] : HER_BANNERS[t.key]) : undefined;
            const bImg = c.img || poolImg(c.label, [c.label.toLowerCase().split(' ')[0]]);
            // editorial text placement (empty-space per banner); default bottom-left
            const tp = (t?.key && (him ? HIM_TXT : HER_TXT)[t.key]) || { h: 'left' as const, v: 'bottom' as const };
            return (
              <View key={c.id} onLayout={(e) => { sectionY.current[c.id] = e.nativeEvent.layout.y; }}>
                {/* landscape banner header for the category — first one flush to
                    the top so it lines up with the left rail's first entry */}
                <Pressable onPress={() => openListing(c.label)}>
                  <View style={{ height: 104, marginTop: ci === 0 ? 0 : SP.l, marginBottom: SP.s, backgroundColor: '#e6e6e6', overflow: 'hidden' }}>
                    <CachedImage transition={0} source={bannerArt ?? { uri: bImg }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} resizeMode="cover" />
                    {/* directional scrim under the label so WHITE text stays legible */}
                    <LinearGradient
                      colors={['rgba(0,0,0,0.42)', 'rgba(0,0,0,0)']}
                      start={{ x: 0.5, y: tp.v === 'top' ? 0 : 1 }}
                      end={{ x: 0.5, y: tp.v === 'top' ? 0.75 : 0.25 }}
                      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                    />
                    {/* editorial label — white, anchored in the empty region */}
                    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingVertical: 12, alignItems: tp.h === 'left' ? 'flex-start' : tp.h === 'right' ? 'flex-end' : 'center', justifyContent: tp.v === 'top' ? 'flex-start' : 'flex-end' }}>
                      <Text numberOfLines={1} style={{ fontFamily: 'Helvetica Neue', fontWeight: '700', fontSize: 14, letterSpacing: 1.5, textTransform: 'uppercase', textAlign: tp.h, color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 4 }}>{c.label}</Text>
                      <Text numberOfLines={1} style={{ fontFamily: 'Helvetica Neue', fontWeight: '500', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', textAlign: tp.h, marginTop: 3, color: 'rgba(255,255,255,0.9)', textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 4 }}>Shop All →</Text>
                    </View>
                  </View>
                </Pressable>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.s }}>
                  {cSubs.map((sub) => (
                    <StyleTile
                      key={c.id + sub.label}
                      img={poolImg(sub.label, sub.q)}
                      label={sub.label}
                      onPress={() => nav.navigate('Category', { id: isBackendCategoryId(c.id) ? c.id : undefined, label: sub.label, search: sub.q[0] ?? sub.label })}
                    />
                  ))}
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}
