// Light design system — token typography, hairline borders, sharp corners
// Reactive palette: C is a Proxy that resolves at access time, so styles
// built inside components (re-evaluated on `night` toggle) flip instantly.

import { useSyncExternalStore } from 'react';
import { Dimensions, Platform, PixelRatio } from 'react-native';
import { initialWindowMetrics } from 'react-native-safe-area-context';

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

// ── OS font-scale cap ────────────────────────────────────────────────
// Android's accessibility "Font size" setting multiplies EVERY Text by
// PixelRatio.getFontScale(). At Large/Huge (1.15–1.3+) the tuned scale
// blows past its containers and overlaps. Rather than disabling scaling
// (an accessibility regression), rf() compensates so the EFFECTIVE
// multiplier never exceeds MAX_FONT_SCALE — text still grows a little
// with the user's setting, but can no longer break the layout.
const FONT_SCALE = PixelRatio.getFontScale();
const MAX_FONT_SCALE = 1.1;
const FONT_SCALE_COMP = FONT_SCALE > MAX_FONT_SCALE ? MAX_FONT_SCALE / FONT_SCALE : 1;

// Responsive font/size. FULLY proportional below the 390dp baseline — earlier
// damping (0.7, then 0.85) kept leaving 360dp phones with type that read
// oversized against their narrower columns, most visibly on the category
// pages. Never upscales beyond the tuned baseline size.
export const rf = (size: number) => {
  const ratio = SHORT_SIDE / BASE_WIDTH;
  const damped = ratio >= 1 ? 1 : ratio;
  return Math.round(size * damped * FONT_SCALE_COMP);
};

// Responsive spacing — gentler than rf (0.75 damping): paddings/margins keep
// their proportions on small screens instead of eating the saved font space.
const rs = (size: number) => {
  const ratio = SHORT_SIDE / BASE_WIDTH;
  if (ratio >= 1) return size;
  return Math.round(size * (1 - (1 - ratio) * 0.75));
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

  // ── Remote-safe festival tokens ─────────────────────────────────────
  // The ONLY keys a server-driven theme may override (see theme/remoteTheme.ts).
  // LIGHT values reproduce today's hardcoded look exactly, so with no theme
  // published the app is pixel-identical to before these existed.
  accent: string; // the campaign highlighter (was the hardcoded #F2E63C yellow)
  accentInk: string; // text/icons ON an accent-filled surface
  accentSoft: string; // pale accent tint for chips/price flashes
  surfaceAlt: string; // alternate neutral surface (thumb backing, bands)
};

export const LIGHT: Palette = {
  bg: '#FFFFFF',
  ink: '#000000',
  inkSoft: '#1a1a1a',
  dim: '#666666',
  faint: '#bdbdbd',
  hairline: '#e6e6e6',
  white: '#FFFFFF',
  ok: '#0E8A45',
  warn: '#A85B00',
  err: '#C0271C',
  green: '#0E8A45', // deep green — passes contrast on white for discount %
  accent: '#F2E63C', // Home headline highlighter — matches every migrated YELLOW const
  accentInk: '#000000', // === ink: exactly what sat on the yellow before, so unthemed pixels are unchanged
  accentSoft: '#FCF8D8', // pale wash of the accent
  surfaceAlt: '#F4F4F4', // the app's established neutral chip/thumb grey
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

// ── Server-driven theme swap ──────────────────────────────────────────
// The machinery night mode left behind, finally reconnected: a festival theme
// reassigns _active (never mutates), rebuilds the precomputed T map, and
// notifies subscribers. Callers pass PRE-VALIDATED tokens only — the allowlist
// lives in theme/remoteTheme.ts and raw server JSON must never reach here.

export type RemoteTokenKey = 'accent' | 'accentInk' | 'accentSoft' | 'surfaceAlt' | 'hairline';
export const REMOTE_TOKEN_KEYS: readonly RemoteTokenKey[] = [
  'accent',
  'accentInk',
  'accentSoft',
  'surfaceAlt',
  'hairline',
];

let _themeVersion = 0;
export const getThemeVersion = () => _themeVersion;
function notifyTheme() {
  _themeVersion += 1;
  subscribers.forEach((fn) => fn());
}

/** Merge validated, allowlisted tokens over LIGHT and repaint subscribed surfaces. */
export function applyPalette(tokens: Partial<Pick<Palette, RemoteTokenKey>>) {
  _active = { ...LIGHT, ...tokens };
  T_ACTIVE = buildT(_active);
  notifyTheme();
}

/** Back to the bundled look — theme expired, was disabled, or failed validation. */
export function resetPalette() {
  if (_active === LIGHT) return;
  _active = LIGHT;
  T_ACTIVE = T_LIGHT;
  notifyTheme();
}

/**
 * Re-render hook for theme-aware components: subscribes to the palette store and
 * returns a version that bumps on every apply/reset. Chrome surfaces (header, tab
 * bar, status bar) call this; body content repaints via its normal renders because
 * every C and T read resolves _active at access time.
 */
export function useThemeVersion(): number {
  return useSyncExternalStore(subscribeTheme, getThemeVersion, getThemeVersion);
}

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

export const SP = { xs: rs(4), s: rs(8), m: rs(12), l: rs(16), xl: rs(24), xxl: rs(32), huge: rs(48) };

// Header top offset = system inset + breathing room. iOS keeps its tuned 56.
//
// The flat "+10" this used to add assumed the note below — that an Android inset is
// just a ~24-30dp status bar. On a punch-hole device it is not: the inset is inflated
// to clear the CAMERA. A Galaxy S10e reports a 116px cutout = 38.7dp, so +10 landed
// every header at 48.7dp — measured on-device, and the reason the Category search bar
// read as floating well below the status bar instead of sitting in the header.
//
// So the gap now tapers: a short inset still gets the full 10dp, a tall one gets as
// little as 2dp because the inset is already the breathing room. The max() floor
// keeps the total above the inset itself — drop below it and content slides under
// the cutout, which on this device means the search button behind the camera.
const ANDROID_TOP = initialWindowMetrics?.insets.top ?? 24;
export const HEADER_TOP = Platform.OS === 'ios'
  ? 56
  : Math.round(Math.max(ANDROID_TOP + 2, Math.min(ANDROID_TOP + 10, 41)));

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
/**
 * The UI text family.
 *
 * 'Helvetica Neue' is a REAL system face on iOS and does not exist on Android —
 * and the app only bundles HelveticaNeueBlack.ttf (aliased Inter_900Black for
 * headings). So on Android all 49 sites naming it were silently falling back to
 * the system font anyway, except that naming an unresolvable family there also
 * makes `fontWeight` unreliable: Android cannot pick a weight within a family it
 * cannot find, so bold text often rendered regular.
 *
 * Android now ships the real Helvetica Neue faces as a native XML font family
 * (see the expo-font plugin config in app.json), so both platforms render the
 * same family and fontWeight resolves to a true face, not synthetic bolding.
 * Exported so screens stop hardcoding the string inline.
 */
export const HELV = Platform.select<string | undefined>({
  ios: 'Helvetica Neue',
  // Android now bundles the real Helvetica Neue faces (Regular/Medium/Bold)
  // as a native XML font family via the expo-font config plugin (app.json),
  // so the same family name resolves with true per-weight faces instead of
  // falling back to Roboto.
  android: 'Helvetica Neue',
  default: undefined,
});
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
// The map the trap actually reads. applyPalette swaps in a rebuild (buildT is
// deterministic — rf() depends only on metrics captured at module load), which
// is what the original night-mode design intended: "flips simply select the
// other prebuilt map". Without this, a palette swap would leave every T.* site
// on LIGHT — themed backgrounds with unthemed text.
let T_ACTIVE: ReturnType<typeof buildT> = T_LIGHT;

export const T: any = new Proxy(
  {},
  {
    get(_, key: string) {
      return T_ACTIVE[key as keyof typeof T_ACTIVE];
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
