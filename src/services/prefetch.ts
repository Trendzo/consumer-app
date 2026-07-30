// Deferred catalog image warm-up.
//
// This used to run inside AppProvider's mount effect — ~150 remote images
// prefetching during splash/onboarding/login, starving those screens of CPU
// and bandwidth. It now runs after Home first gains focus (see HomeScreen) and
// warms only the above-the-fold images of the ACTIVE gender. Idempotent —
// repeat calls are no-ops.
import { Image as ExpoImage } from 'expo-image';
import {
  HER_PRODUCTS, HIM_PRODUCTS, HER_CATEGORIES, HIM_CATEGORIES,
  HER_HERO, HIM_HERO, HERO_IMG,
} from '../data/mockData';

let warmed = false;

/** Home shows roughly six product cards before the fold; warm a little past that. */
const ABOVE_FOLD_LIMIT = 12;

export function warmCatalog(gender: 'her' | 'him') {
  if (warmed) return;
  warmed = true;

  const active = gender === 'her'
    ? [HER_HERO, ...HER_PRODUCTS.map((p) => p.img), ...HER_CATEGORIES.map((c) => c.img)]
    : [HIM_HERO, ...HIM_PRODUCTS.map((p) => p.img), ...HIM_CATEGORIES.map((c) => c.img)];

  // Only what the user is about to see, and only the few above-the-fold rows of
  // it. Category images are local requires (numbers), not remote URLs — only
  // remote strings are worth network-prefetching, so locals are filtered out.
  //
  // WAVE 2 IS DELIBERATELY GONE. It fired ~85 more fetches on a 4 s timer, which
  // landed exactly while the user was scrolling Home, and none of those URLs went
  // through sizedImage() (they are pngimg.com mock URLs that the resizer leaves
  // untouched), so it was tens of MB of full-size downloads competing with the
  // images actually on screen. Prefetching that much while scrolling is strictly
  // worse than not prefetching. If a second wave ever comes back, gate it on
  // scroll-idle and put the URLs through sizedImage() first.
  const urls = [HERO_IMG, ...active]
    .filter((x): x is string => typeof x === 'string')
    .slice(0, ABOVE_FOLD_LIMIT);

  ExpoImage.prefetch(urls, 'memory-disk').catch(() => {});
}
