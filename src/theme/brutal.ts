// Modern Brutalism — monochrome ASCII design system
// Reactive palette: C is a Proxy that resolves at access time, so styles
// built inside components (re-evaluated on `night` toggle) flip instantly.

type Palette = {
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
  bg: '#000000',
  ink: '#FFFFFF',     // text/borders → white in dark
  inkSoft: '#e6e6e6',
  dim: '#999999',
  faint: '#444444',
  hairline: '#222222',
  white: '#0a0a0a',   // "card" surface → near-black
  ok: '#FFFFFF',
  warn: '#FFFFFF',
  err: '#FFFFFF',
};

// Mutable current palette object — same reference across the app.
const _current: Palette = { ...LIGHT };

export function setNight(on: boolean) {
  const src = on ? DARK : LIGHT;
  (Object.keys(src) as (keyof Palette)[]).forEach(k => {
    _current[k] = src[k];
  });
}

// Proxy: every property access returns the current palette value.
// Works for both inline styles (resolved at render time) and StyleSheet.create
// blocks that are called inside components on each render.
export const C: Palette = new Proxy(_current, {
  get(_, key: string) {
    return (_current as any)[key];
  },
}) as Palette;

export const SP = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32, huge: 48 };

export const RADIUS = { none: 0, sm: 0, md: 0, lg: 0 };

export const BORDER = (w = 1) => ({ borderWidth: w, borderColor: C.ink });
export const HAIRLINE = { borderWidth: 1, borderColor: C.hairline };

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
