// Light design system — token typography, hairline borders, sharp corners
// Reactive palette: C is a Proxy that resolves at access time, so styles
// built inside components (re-evaluated on `night` toggle) flip instantly.

import { Dimensions } from 'react-native';

// ── Responsive scaling ──────────────────────────────────────────────
// Baseline 390pt ≈ iPhone 13/14 logical width. On screens NARROWER than
// the baseline (most small Android phones), font sizes shrink so big
// wordmarks/headlines don't wrap to a second line or push layout down.
// At/above the baseline sizes are left untouched, so larger phones and
// tablets keep the hand-tuned values.
const { width: _SW, height: _SH } = Dimensions.get('window');
const SHORT_SIDE = Math.min(_SW, _SH);
const BASE_WIDTH = 390;

export const SCREEN = {
  width: _SW,
  height: _SH,
  short: SHORT_SIDE,
  isSmall: SHORT_SIDE < 360,
};

// Responsive font/size. Damped (0.7) so small screens shrink gently rather
// than collapsing. Never upscales beyond the tuned baseline size.
export const rf = (size: number) => {
  const ratio = SHORT_SIDE / BASE_WIDTH;
  if (ratio >= 1) return size;
  const damped = 1 - (1 - ratio) * 0.7;
  return Math.round(size * damped);
};

export type Palette = {
  bg: string;
  ink: string;
  inkSoft: string;
  dim: string;
  faint: string;
  hairline: string;
  white: string;
  ok: string;
  warn: string;
  err: string;
  green: string; // discount / savings accent (only non-mono color in the system)
};

export const LIGHT: Palette = {
  bg: '#FFFFFF',
  ink: '#000000',
  inkSoft: '#1a1a1a',
  dim: '#666666',
  faint: '#bdbdbd',
  hairline: '#e6e6e6',
  white: '#FFFFFF',
  ok: '#000000',
  warn: '#000000',
  err: '#000000',
  green: '#0E8A45', // deep green — passes contrast on white for discount %
};


// Active palette — pinned to LIGHT (night mode removed app-wide).
// No mutation — we reassign the whole ref, and the Proxy reads from it
// on every property access.
let _active: Palette = LIGHT;

const subscribers = new Set<() => void>();
export function subscribeTheme(fn: () => void) {
  subscribers.add(fn);
  return () => { subscribers.delete(fn); };
}

// LIGHT MODE ONLY — night mode was removed app-wide. Kept as a no-op export
// so any lagging call site still compiles; _active is pinned to LIGHT.
export function setNight(_on: boolean) {}

// Proxy forwards every access to the current _active palette.
// `C.ink` → `_active.ink` at read time, so there's no stale snapshot.
export const C: Palette = new Proxy({} as Palette, {
  get(_, key: string | symbol) {
    return (_active as any)[key];
  },
  has(_, key: string | symbol) {
    return key in _active;
  },
  ownKeys() {
    return Object.keys(_active);
  },
  getOwnPropertyDescriptor(_, key: string | symbol) {
    return Object.getOwnPropertyDescriptor(_active, key);
  },
});

export const SP = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32, huge: 48 };

export const RADIUS = { none: 0, sm: 0, md: 0, lg: 0 };

// Gender curve — globally applied to every BORDER() call so the entire app
// rounds when HER is active without per-component wiring. AppState drives
// setGender('her' | 'him'); each switch forces a theme-nonce bump so
// already-mounted components re-read the current radius.
let _isHer = false;
export function setGenderCurve(on: boolean) {
  _isHer = on;
  subscribers.forEach(fn => fn());
}
/** Current gender-curve state — pairs with subscribeTheme for
 *  useSyncExternalStore consumers (see useGenderCurve). */
export const isHer = () => _isHer;
// Sharp corners on every bordered surface — no radius app-wide via BORDER().
function curveRadius(_w: number) {
  return 0;
}

// BORDER is cached per width — it used to allocate a fresh object on every
// call (hundreds of call sites × every render). borderColor joined
// borderRadius as a getter so the cached object still resolves the palette
// and curve at READ time — behavior on night/gender flips is unchanged
// (screens re-render via nonce/remount and re-read the getters).
//
// De-brutalised: the border colour is now the soft hairline (light gray in
// light mode, near-black-gray in dark) instead of the hard black `ink`, so
// every card/button reads as a subtle outline rather than the old brutalist
// black frame. Width/radius are unchanged so layouts don't shift.
const _borderCache: Record<number, any> = {};
export const BORDER = (w = 1) => (_borderCache[w] ??= {
  borderWidth: w,
  get borderColor() { return _active.hairline; },
  get borderRadius() { return curveRadius(w); },
});
// Getter-based so `HAIRLINE.borderColor` reads C.hairline at access time, not module-load time.
export const HAIRLINE = { borderWidth: 1, get borderColor() { return C.hairline; } };

// T maps are PRECOMPUTED once per palette. The old trap rebuilt an 11-entry
// map (with rf() calls) on EVERY property access — 500 T.* sites in render
// paths made that constant allocation/GC churn on every frame of every
// screen. rf() depends only on Dimensions captured at module load, so both
// palettes can be built at init; the trap is now a cached property read and
// night flips simply select the other prebuilt map (call sites unchanged).
// ── Typography scale — quick-commerce SIZES only ─────────────────────
// Only 7 content sizes: 11 / 12 / 14 / 16 / 18 / 20 / 24. The FONTS are the
// Whole app is Helvetica now: headings use the bundled Helvetica Neue Black
// (aliased as Inter_900Black in App.tsx); everything else uses the iOS system
// Helvetica Neue at the weight below. (On Android these weights fall back to
// Roboto, since only the Black face is bundled.)
// Sizes pass through rf() so small Android phones scale down gracefully.
const HELV = 'Helvetica Neue';
const buildT = (P: Palette) => ({
  // Headings → Helvetica Neue Black
  h1: { fontFamily: 'Inter_900Black', fontSize: rf(24), lineHeight: rf(30), color: P.ink, letterSpacing: -0.4 }, // screen titles: "Home", "Your Cart"
  h2: { fontFamily: 'Inter_900Black', fontSize: rf(20), lineHeight: rf(26), color: P.ink, letterSpacing: -0.3 }, // sections: "Trending Now"
  h3: { fontFamily: HELV, fontWeight: '700', fontSize: rf(16), lineHeight: rf(22), color: P.ink, letterSpacing: -0.2 }, // sub-headings, sheet titles

  // Product
  productName: { fontFamily: HELV, fontWeight: '500', fontSize: rf(14), lineHeight: rf(18), color: P.ink }, // card/grid — pair with numberOfLines={2}
  productTitle: { fontFamily: HELV, fontWeight: '600', fontSize: rf(18), lineHeight: rf(24), color: P.ink, letterSpacing: -0.3 }, // detail-page hero

  // Price
  price: { fontFamily: HELV, fontWeight: '700', fontSize: rf(16), color: P.ink }, // boldest element on a card
  mrp: { fontFamily: HELV, fontWeight: '400', fontSize: rf(12), color: P.dim, textDecorationLine: 'line-through' as const }, // struck MRP
  discount: { fontFamily: HELV, fontWeight: '600', fontSize: rf(12), color: P.green }, // "-40%"

  // Body & small text
  body: { fontFamily: HELV, fontWeight: '400', fontSize: rf(14), lineHeight: rf(20), color: P.ink }, // descriptions, paragraphs
  caption: { fontFamily: HELV, fontWeight: '500', fontSize: rf(12), color: P.dim }, // badges, ratings, size chips, "500g / Pack of 2"
  micro: { fontFamily: HELV, fontWeight: '400', fontSize: rf(11), color: P.dim }, // legal, timestamps — absolute floor, never smaller

  // CTA — filled primary buttons carry white text; outline buttons override color.
  button: { fontFamily: HELV, fontWeight: '600', fontSize: rf(16), color: P.white, letterSpacing: 0.2 }, // "Add to Cart", "Buy Now"

  // Oversized brand / splash art — OUTSIDE the 6-size content scale. Kept for
  // hero moments (order-success headline, wordmarks). Uses the heavy Helvetica
  // Neue Black face still loaded under Inter_900Black.
  display: { fontFamily: 'Inter_900Black', fontSize: rf(32), lineHeight: rf(36), color: P.ink, letterSpacing: -0.8 },

  // ── Back-compat aliases (legacy keys → nearest spec token) ──────────
  // Old call sites using these keep working; migrate them to the names above.
  // `mono`/`monoB` are no longer monospaced — the whole app is Helvetica now.
  bodyB: { fontFamily: HELV, fontWeight: '700', fontSize: rf(14), color: P.ink },
  label: { fontFamily: HELV, fontWeight: '600', fontSize: rf(12), color: P.ink, letterSpacing: 0.5 },
  mono: { fontFamily: HELV, fontWeight: '400', fontSize: rf(12), color: P.ink, letterSpacing: 0.5 },
  monoB: { fontFamily: HELV, fontWeight: '700', fontSize: rf(12), color: P.ink, letterSpacing: 0.5 },
});
const T_LIGHT = buildT(LIGHT);

export const T: any = new Proxy(
  {},
  {
    get(_, key: string) {
      return T_LIGHT[key as keyof typeof T_LIGHT];
    },
  },
);


export const ANIM = {
  fast: 180,
  base: 280,
  slow: 480,
  spring: { damping: 14, stiffness: 180, mass: 0.9 },
  springTight: { damping: 18, stiffness: 240, mass: 0.8 },
};
