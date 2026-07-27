// Deferred catalog image warm-up.
//
// This used to run inside AppProvider's mount effect — ~150 remote images
// prefetching during splash/onboarding/login, starving those screens of CPU
// and bandwidth. It now runs after Home first gains focus (see HomeScreen),
// in two waves: above-the-fold for the ACTIVE gender first, everything else
// a few seconds later. Idempotent — repeat calls are no-ops.
import { Image as ExpoImage } from 'expo-image';
import {
  PRODUCTS, CATEGORIES, BRANDS, OCCASIONS, BUNDLES, COMMUNITY, REELS,
  HER_PRODUCTS, HIM_PRODUCTS, HER_CATEGORIES, HIM_CATEGORIES,
  HER_BUNDLES, HIM_BUNDLES, HER_OCCASIONS, HIM_OCCASIONS, HER_HERO, HIM_HERO,
  HERO_IMG, HERO_IMG_2, COUPON_IMG,
} from '../data/mockData';

let warmed = false;

export function warmCatalog(gender: 'her' | 'him') {
  if (warmed) return;
  warmed = true;

  const active = gender === 'her'
    ? [HER_HERO, ...HER_PRODUCTS.map((p) => p.img), ...HER_CATEGORIES.map((c) => c.img)]
    : [HIM_HERO, ...HIM_PRODUCTS.map((p) => p.img), ...HIM_CATEGORIES.map((c) => c.img)];

  // Wave 1 — what the user is about to see. Category images are now local
  // PNG requires (numbers), not remote URLs — only remote strings are worth
  // network-prefetching, so local assets are filtered out here.
  ExpoImage.prefetch([HERO_IMG, ...active].filter((x): x is string => typeof x === 'string'), 'memory-disk').catch(() => {});

  // Wave 2 — the rest of the catalog, once the home has had time to settle.
  setTimeout(() => {
    const rest = [
      HERO_IMG_2, COUPON_IMG, gender === 'her' ? HIM_HERO : HER_HERO,
      ...PRODUCTS.map((p) => p.img),
      ...(gender === 'her' ? HIM_PRODUCTS : HER_PRODUCTS).map((p) => p.img),
      ...CATEGORIES.map((c) => c.img),
      ...(gender === 'her' ? HIM_CATEGORIES : HER_CATEGORIES).map((c) => c.img),
      ...BRANDS.map((b) => b.logo),
      ...OCCASIONS.map((o) => o.img),
      ...BUNDLES.map((b) => b.img),
      ...HER_BUNDLES.map((b) => b.img),
      ...HIM_BUNDLES.map((b) => b.img),
      ...HER_OCCASIONS.map((o) => o.img),
      ...HIM_OCCASIONS.map((o) => o.img),
      ...COMMUNITY.map((c) => c.img),
      ...REELS.map((r) => r.img),
    ].filter((x): x is string => typeof x === 'string');
    ExpoImage.prefetch(rest, 'memory-disk').catch(() => {});
  }, 4000);
}
