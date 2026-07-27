// MONOCHROME ICON LIBRARY — detailed solid-glyph icons from the Icons8
// "iOS Filled" pack, hotlinked as PNGs (not SVGs) and tinted black or white
// through the URL. Strictly B/W to match the brutalist monochrome theme:
// default tint is C.ink (black in light mode, white in night mode); pass
// `color={C.white}` when the icon sits on an ink-filled box.
// Every name below was verified to return HTTP 200.
import React from 'react';
import { StyleProp, ImageStyle } from 'react-native';
import { C } from '../theme/brutal';
import { CachedImage } from './Brutal';
import { LOCAL_ICONS } from './icons.gen';

export const ICON_NAMES = {
  // ── tabs / chrome ──
  home: 'home',
  reels: 'clapperboard',
  bag: 'shopping-bag',
  user: 'user-male',
  search: 'search',
  mic: 'microphone',
  menu: 'menu',
  dashboard: 'dashboard',
  filter: 'sorting-options',
  // ── garments / categories ──
  tshirt: 't-shirt',
  jeans: 'jeans',
  dress: 'dress-front-view',
  handbag: 'bag-front-view',
  heels: 'womens-shoe',
  sneakers: 'sneakers',
  coat: 'coat',
  jacket: 'jacket',
  sunglasses: 'sun-glasses',
  polo: 'polo-shirt',
  skirt: 'skirt',
  scarf: 'scarf',
  watch: 'watches-front-view',
  lipstick: 'lipstick',
  jewelry: 'diamond-ring',
  clothes: 'hanger',
  // ── games / features ──
  gift: 'gift',
  trophy: 'trophy',
  wheel: 'confetti',
  palette: 'paint-palette',
  friends: 'user-group-man-man',
  fire: 'fire-element',
  camera: 'camera',
  camcorder: 'camcorder',
  photo: 'picture',
  sparkles: 'sparkling',
  sale: 'sale',
  discount: 'discount',
  pricetag: 'price-tag',
  crown: 'crown',
  movie: 'movie',
  play: 'play',
  smartphone: 'smartphone',
  // ── profile / misc ──
  package: 'package',
  marker: 'marker',
  card: 'bank-cards',
  wallet: 'wallet',
  medal: 'medal',
  giftcard: 'gift-card',
  bell: 'bell',
  globe: 'globe',
  support: 'online-support',
  headset: 'headset',
  settings: 'settings',
  ruler: 'ruler',
  calendar: 'calendar',
  plant: 'potted-plant',
  info: 'info',
  sun: 'sun',
  moon: 'crescent-moon',
  pencil: 'pencil',
  clock: 'clock',
  star: 'star',
  heart: 'like',
  forward: 'forward',
  language: 'language',
  cartLoaded: 'shopping-cart-loaded',
} as const;

export type RealIconName = keyof typeof ICON_NAMES;

// Icons8 tints via a hex path segment — only bare 6-digit hex is valid there.
const hex = (color: string) => {
  const h = color.replace('#', '');
  return /^[0-9a-fA-F]{6}$/.test(h) ? h : '000000';
};

// PNG URL for a named icon in a given color.
export const realIconUri = (name: RealIconName, color: string) =>
  `https://img.icons8.com/ios-filled/188/${hex(color)}/${ICON_NAMES[name]}.png`;

export function RealIcon({ name, size = 24, color, style }: {
  name: RealIconName;
  size?: number;
  color?: string;
  style?: StyleProp<ImageStyle>;
}) {
  // Default = ink, read at render time so night-mode remounts re-tint.
  const tint = color ?? C.ink;
  // Local-first: bundled black glyph recolored at render via expo-image
  // tintColor (pixel-exact for solid ios-filled icons, any hex). The old
  // remote path baked the tint into the URL, so the active tab icon was a
  // DIFFERENT URL → network fetch + decode on the first tap of every tab.
  const local = LOCAL_ICONS[ICON_NAMES[name]];
  if (local) {
    return (
      <CachedImage
        source={local}
        tintColor={tint}
        style={[{ width: size, height: size }, style as any]}
        resizeMode="contain"
      />
    );
  }
  return (
    <CachedImage
      source={{ uri: realIconUri(name, tint) }}
      style={[{ width: size, height: size }, style as any]}
      resizeMode="contain"
    />
  );
}

// Best-effort garment icon from a category label — works for the HER/HIM
// mock lists and live backend category names. Order matters: specific terms
// (polo, heel) must match before broad ones (shirt, shoe).
export function categoryIconName(label: string): RealIconName {
  const l = (label || '').toLowerCase();
  const hit = (...keys: string[]) => keys.some((k) => l.includes(k));
  let name: RealIconName = 'clothes';
  if (hit('polo')) name = 'polo';
  else if (hit('heel')) name = 'heels';
  else if (hit('dress', 'mini', 'maxi', 'gown')) name = 'dress';
  else if (hit('jean', 'denim', 'bottom', 'trouser', 'pant')) name = 'jeans';
  else if (hit('shoe', 'sneaker', 'foot', 'boot')) name = 'sneakers';
  else if (hit('bag', 'tote', 'clutch')) name = 'handbag';
  else if (hit('beauty', 'lip', 'makeup')) name = 'lipstick';
  else if (hit('coat')) name = 'coat';
  else if (hit('jacket', 'bomber', 'blazer', 'outer')) name = 'jacket';
  else if (hit('watch')) name = 'watch';
  else if (hit('shade', 'sunglass', 'eyewear', 'glass')) name = 'sunglasses';
  else if (hit('skirt')) name = 'skirt';
  else if (hit('scarf')) name = 'scarf';
  else if (hit('jewel', 'ring', 'necklace', 'accessor')) name = 'jewelry';
  else if (hit('tee', 'top', 'shirt')) name = 'tshirt';
  return name;
}

/** Legacy URL form — kept for callers that need a plain uri string. Prefer
 *  `<RealIcon name={categoryIconName(label)} />` which uses bundled assets. */
export function categoryIcon(label: string, color?: string): string {
  return realIconUri(categoryIconName(label), color ?? C.ink);
}
