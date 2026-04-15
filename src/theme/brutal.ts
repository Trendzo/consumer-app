// Modern Brutalism — monochrome ASCII design system
// Reactive palette: C is a Proxy that resolves at access time, so styles
// built inside components (re-evaluated on `night` toggle) flip instantly.

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
function curveRadius(w: number) {
  if (!_isHer) return 0;
  // Heavier borders (hero cards) get slightly tighter radius to avoid
  // the "pill" look; thin borders get a softer corner.
  return w >= 2 ? 16 : 14;
}

// BORDER now returns a getter-backed borderRadius so every re-render
// (on gender toggle or theme toggle) re-reads the current value.
export const BORDER = (w = 1) => ({
  borderWidth: w,
  borderColor: C.ink,
  get borderRadius() { return curveRadius(w); },
});
// Getter-based so `HAIRLINE.borderColor` reads C.hairline at access time, not module-load time.
export const HAIRLINE = { borderWidth: 1, get borderColor() { return C.hairline; } };

// T is built lazily via getters so each access pulls the current C.
export const T: any = new Proxy(
  {},
  {
    get(_, key: string) {
      const map: any = {
        display: { fontFamily: 'Inter_900Black', fontSize: 36, color: C.ink, letterSpacing: -1.2, lineHeight: 38 },
        h1: { fontFamily: 'Inter_900Black', fontSize: 26, color: C.ink, letterSpacing: -0.8 },
        h2: { fontFamily: 'Inter_900Black', fontSize: 20, color: C.ink, letterSpacing: -0.5 },
        h3: { fontFamily: 'Inter_700Bold', fontSize: 16, color: C.ink, letterSpacing: -0.2 },
        body: { fontFamily: 'Inter_400Regular', fontSize: 13, color: C.ink, lineHeight: 18 },
        bodyB: { fontFamily: 'Inter_700Bold', fontSize: 13, color: C.ink },
        caption: { fontFamily: 'Inter_500Medium', fontSize: 11, color: C.dim },
        label: { fontFamily: 'Inter_900Black', fontSize: 10, color: C.ink, letterSpacing: 1 },
        mono: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: C.ink, letterSpacing: 0.5 },
        monoB: { fontFamily: 'SpaceMono_700Bold', fontSize: 10, color: C.ink, letterSpacing: 0.5 },
      };
      return map[key];
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
