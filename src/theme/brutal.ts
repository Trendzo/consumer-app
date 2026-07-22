// Modern Brutalism — monochrome ASCII design system
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
};

export const DARK: Palette = {
  bg: '#0a0a0a',      // page bg — very dark, not pure black
  ink: '#FFFFFF',     // text/borders → white in dark
  inkSoft: '#e6e6e6',
  dim: '#a0a0a0',     // slightly brighter dim so secondary text is readable
  faint: '#555555',
  hairline: '#2a2a2a',
  white: '#1a1a1a',   // "card" surface — clearly lighter than bg for visible cards
  ok: '#FFFFFF',
  warn: '#FFFFFF',
  err: '#FFFFFF',
};

// Swappable palette reference — ALWAYS points at LIGHT or DARK directly.
// No mutation — we reassign the whole ref, and the Proxy reads from it
// on every property access.
let _active: Palette = LIGHT;

const subscribers = new Set<() => void>();
export function subscribeTheme(fn: () => void) {
  subscribers.add(fn);
  return () => { subscribers.delete(fn); };
}

export function setNight(on: boolean) {
  _active = on ? DARK : LIGHT;
  subscribers.forEach(fn => fn());
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

export const SP = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32, huge: 48 };

// Soft-corner radii — the app no longer ships sharp brutalist cards; every
// surface carries a little permanent radius.
export const RADIUS = { none: 0, sm: 8, md: 12, lg: 16 };

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
function curveRadius(w: number) {
  // Cards are permanently rounded now — a little base radius even in HIM/ALL,
  // rounding a touch more when HER is active. No more sharp corners.
  if (!_isHer) return w >= 2 ? 10 : 12;
  // Heavier borders (hero cards) get slightly tighter radius to avoid
  // the "pill" look; thin borders get a softer corner.
  return w >= 2 ? 16 : 14;
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
const buildT = (P: Palette) => ({
  display: { fontFamily: 'Inter_900Black', fontSize: rf(36), color: P.ink, letterSpacing: -1.2, lineHeight: rf(38) },
  h1: { fontFamily: 'Inter_900Black', fontSize: rf(26), color: P.ink, letterSpacing: -0.8 },
  h2: { fontFamily: 'Inter_900Black', fontSize: rf(20), color: P.ink, letterSpacing: -0.5 },
  h3: { fontFamily: 'Inter_700Bold', fontSize: rf(16), color: P.ink, letterSpacing: -0.2 },
  body: { fontFamily: 'Inter_400Regular', fontSize: rf(13), color: P.ink, lineHeight: rf(18) },
  bodyB: { fontFamily: 'Inter_700Bold', fontSize: rf(13), color: P.ink },
  caption: { fontFamily: 'Inter_500Medium', fontSize: rf(11), color: P.dim },
  label: { fontFamily: 'Inter_900Black', fontSize: rf(10), color: P.ink, letterSpacing: 1 },
  mono: { fontFamily: 'SpaceMono_400Regular', fontSize: rf(10), color: P.ink, letterSpacing: 0.5 },
  monoB: { fontFamily: 'SpaceMono_700Bold', fontSize: rf(10), color: P.ink, letterSpacing: 0.5 },
});
const T_LIGHT = buildT(LIGHT);
const T_DARK = buildT(DARK);

export const T: any = new Proxy(
  {},
  {
    get(_, key: string) {
      return (_active === DARK ? T_DARK : T_LIGHT)[key as keyof typeof T_LIGHT];
    },
  },
);

export const ASCII = {
  hr: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  hrFaint: '░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░',
  hrDot: '· · · · · · · · · · · · · · · · · · · · ·',
  caret: '▌',
  arrowR: '──▶',
  arrowL: '◀──',
  plus: '[ + ]',
  check: '[✓]',
  cross: '[✕]',
  bracket: (s: string) => `[${s}]`,
  loading: '░▒▓█▓▒░',
};

export const ANIM = {
  fast: 180,
  base: 280,
  slow: 480,
  spring: { damping: 14, stiffness: 180, mass: 0.9 },
  springTight: { damping: 18, stiffness: 240, mass: 0.8 },
};
