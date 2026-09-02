// Unit tests for src/theme/remoteTheme.ts — the pure server-driven-theme module.
// Node environment, zero mocks: every function under test is side-effect free.

import { describe, it, expect } from 'vitest';
import {
  parseEnvelope,
  validateTheme,
  computeClockOffsetMs,
  serverNowMs,
  isThemeLive,
  parsePersistedTheme,
  serializePersistedTheme,
  hexAlpha,
  isHex,
  isHttpsUrl,
  type PersistedTheme,
  type ResolvedTheme,
} from './remoteTheme';

// ── Fixtures ──────────────────────────────────────────────────────────

const DIWALI_START = '2026-08-01T00:00:00.000Z';
const DIWALI_END = '2026-12-01T00:00:00.000Z';

/** Fresh copy each call so tests can mutate freely. */
const diwaliFixture = () => ({
  slug: 'diwali-2026',
  startsAt: DIWALI_START,
  endsAt: DIWALI_END,
  tokens: {
    accent: '#C1121F',
    accentInk: '#FFFFFF',
    accentSoft: '#FDE8E9',
    surfaceAlt: '#FFF7ED',
    hairline: '#7A1C1C',
  },
  chrome: {
    statusBarStyle: 'light',
    header: {
      kind: 'gradient',
      gradient: ['#7A1C1C', '#C1121F'],
      ink: '#FFD166',
      wordmarkUrl: 'https://cdn.trendzo.app/diwali/wordmark.png',
      overlayUrl: 'https://cdn.trendzo.app/diwali/rangoli.png',
      overlayHeight: 96,
    },
    tabBar: { activeInk: '#C1121F', badgeBg: '#FFD166' },
  },
  decor: {
    kind: 'lottie',
    url: 'https://cdn.trendzo.app/diwali/diyas.json',
    placement: 'header',
    loop: true,
    maxPlays: 3,
    respectReduceMotion: true,
  },
  copy: {
    greeting: 'Happy Diwali!',
    searchPlaceholder: 'Search festive looks',
  },
});

/** validateTheme that must succeed — narrows away null for the assertions below. */
function resolve(raw: unknown): ResolvedTheme {
  const t = validateTheme(raw);
  expect(t).not.toBeNull();
  return t as ResolvedTheme;
}

/** Minimal valid theme (open window) with per-test overrides. */
const theme = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  slug: 'test-theme',
  ...overrides,
});

// ── 1. parseEnvelope ──────────────────────────────────────────────────

describe('parseEnvelope', () => {
  const validEnvelope = () => ({
    schemaVersion: 1,
    publicationVersion: 7,
    generatedAt: '2026-09-02T05:00:00.000Z',
    refreshAfterSeconds: 900,
    theme: diwaliFixture(),
  });

  it('round-trips a valid schemaVersion-1 envelope', () => {
    const env = validEnvelope();
    expect(parseEnvelope(env)).toEqual({
      publicationVersion: 7,
      generatedAt: '2026-09-02T05:00:00.000Z',
      refreshAfterSeconds: 900,
      theme: env.theme,
    });
  });

  it('rejects schemaVersion 2 (future shape must not reach this validator)', () => {
    expect(parseEnvelope({ ...validEnvelope(), schemaVersion: 2 })).toBeNull();
  });

  it('rejects a missing schemaVersion', () => {
    const env: Record<string, unknown> = validEnvelope();
    delete env.schemaVersion;
    expect(parseEnvelope(env)).toBeNull();
  });

  it('rejects a string schemaVersion "1" (strict equality)', () => {
    expect(parseEnvelope({ ...validEnvelope(), schemaVersion: '1' })).toBeNull();
  });

  it('rejects a missing publicationVersion', () => {
    const env: Record<string, unknown> = validEnvelope();
    delete env.publicationVersion;
    expect(parseEnvelope(env)).toBeNull();
  });

  it.each([['string', 'v7'], ['NaN', Number.NaN], ['null', null], ['Infinity', Number.POSITIVE_INFINITY]])(
    'rejects non-finite/non-numeric publicationVersion (%s)',
    (_label, bad) => {
      expect(parseEnvelope({ ...validEnvelope(), publicationVersion: bad })).toBeNull();
    },
  );

  it('rejects a missing generatedAt', () => {
    const env: Record<string, unknown> = validEnvelope();
    delete env.generatedAt;
    expect(parseEnvelope(env)).toBeNull();
  });

  it('rejects a non-string generatedAt', () => {
    expect(parseEnvelope({ ...validEnvelope(), generatedAt: 1234567890 })).toBeNull();
  });

  it.each([
    [0, 300],
    [1e9, 86_400],
    [900, 900],
  ])('clamps refreshAfterSeconds %d to %d', (input, want) => {
    const parsed = parseEnvelope({ ...validEnvelope(), refreshAfterSeconds: input });
    expect(parsed?.refreshAfterSeconds).toBe(want);
  });

  it('defaults refreshAfterSeconds to 1800 when missing', () => {
    const env: Record<string, unknown> = validEnvelope();
    delete env.refreshAfterSeconds;
    expect(parseEnvelope(env)?.refreshAfterSeconds).toBe(1800);
  });

  it('defaults refreshAfterSeconds to 1800 when non-numeric', () => {
    expect(parseEnvelope({ ...validEnvelope(), refreshAfterSeconds: 'soon' })?.refreshAfterSeconds).toBe(1800);
  });

  it('normalises an undefined theme to null', () => {
    const env: Record<string, unknown> = validEnvelope();
    delete env.theme;
    const parsed = parseEnvelope(env);
    expect(parsed).not.toBeNull();
    expect(parsed?.theme).toBeNull();
  });

  it('passes an explicit null theme through', () => {
    expect(parseEnvelope({ ...validEnvelope(), theme: null })?.theme).toBeNull();
  });

  it.each([
    ['string', 'not-json'],
    ['number', 42],
    ['null', null],
    ['array', [1, 2, 3]],
    ['undefined', undefined],
  ])('rejects non-envelope input (%s)', (_label, bad) => {
    expect(parseEnvelope(bad)).toBeNull();
  });
});

// ── 2. validateTheme — full realistic fixture ─────────────────────────

describe('validateTheme: full Diwali fixture', () => {
  it('resolves every field of a fully-populated valid theme', () => {
    const resolved = resolve(diwaliFixture());

    expect(resolved.slug).toBe('diwali-2026');

    expect(typeof resolved.startsAtMs).toBe('number');
    expect(typeof resolved.endsAtMs).toBe('number');
    expect(resolved.startsAtMs).toBe(Date.parse(DIWALI_START));
    expect(resolved.endsAtMs).toBe(Date.parse(DIWALI_END));

    expect(resolved.tokens).toEqual({
      accent: '#C1121F',
      accentInk: '#FFFFFF',
      accentSoft: '#FDE8E9',
      surfaceAlt: '#FFF7ED',
      hairline: '#7A1C1C',
    });

    expect(resolved.chrome.statusBarStyle).toBe('light');
    expect(resolved.chrome.header).toEqual({
      kind: 'gradient',
      gradient: ['#7A1C1C', '#C1121F'],
      ink: '#FFD166',
      wordmarkUrl: 'https://cdn.trendzo.app/diwali/wordmark.png',
      overlayUrl: 'https://cdn.trendzo.app/diwali/rangoli.png',
      overlayHeight: 96,
    });
    expect(resolved.chrome.tabBar).toEqual({ activeInk: '#C1121F', badgeBg: '#FFD166' });

    expect(resolved.decor.kind).toBe('lottie');
    expect(resolved.decor.url).toBe('https://cdn.trendzo.app/diwali/diyas.json');
    expect(resolved.decor.placement).toBe('header');
    // maxPlays wins over loop: fixture says loop:true AND maxPlays:3 → loop false.
    expect(resolved.decor.loop).toBe(false);
    expect(resolved.decor.maxPlays).toBe(3);
    // Unknown wire fields (respectReduceMotion) never reach the resolved shape.
    expect('respectReduceMotion' in resolved.decor).toBe(false);

    expect(resolved.copy).toEqual({
      greeting: 'Happy Diwali!',
      searchPlaceholder: 'Search festive looks',
    });

    // Window spans "now" (2026-09-02) — the theme is live inside it.
    expect(isThemeLive(resolved, Date.parse('2026-09-02T12:00:00.000Z'))).toBe(true);
  });

  it('statusBarStyle "dark" is honoured; anything else falls back to "light"', () => {
    expect(resolve(theme({ chrome: { statusBarStyle: 'dark' } })).chrome.statusBarStyle).toBe('dark');
    expect(resolve(theme({ chrome: { statusBarStyle: 'inverted' } })).chrome.statusBarStyle).toBe('light');
  });
});

// ── 3. Token allowlisting ─────────────────────────────────────────────

describe('validateTheme: token allowlisting', () => {
  it('drops keys outside the remote allowlist (err/ok/green/bg/ink)', () => {
    const resolved = resolve(
      theme({
        tokens: {
          err: '#FF0000',
          ok: '#00FF00',
          green: '#00AA00',
          bg: '#000000',
          ink: '#111111',
          accent: '#C1121F',
        },
      }),
    );
    expect(resolved.tokens).toEqual({ accent: '#C1121F' });
    expect('err' in resolved.tokens).toBe(false);
    expect('ok' in resolved.tokens).toBe(false);
    expect('green' in resolved.tokens).toBe(false);
    expect('bg' in resolved.tokens).toBe(false);
    expect('ink' in resolved.tokens).toBe(false);
  });

  it.each([
    ['named color', 'red'],
    ['non-hex digits', '#GGG123'],
    ['5-digit hex', '#12345'],
    ['number', 12],
  ])('drops allowlisted key with malformed hex value (%s)', (_label, bad) => {
    const resolved = resolve(theme({ tokens: { accent: bad } }));
    expect(resolved.tokens).toEqual({});
  });

  it('keeps 3-digit hex (#abc) — isHex allows the short form', () => {
    const resolved = resolve(theme({ tokens: { accent: '#abc' } }));
    expect(resolved.tokens).toEqual({ accent: '#abc' });
  });

  it('missing tokens object resolves to an empty tokens map', () => {
    expect(resolve(theme()).tokens).toEqual({});
  });
});

describe('isHex', () => {
  it.each(['#abc', '#ABC', '#C1121F', '#ffffff'])('accepts %s', (v) => {
    expect(isHex(v)).toBe(true);
  });

  it.each([
    ['named color', 'red'],
    ['non-hex letters', '#GGG123'],
    ['5 digits', '#12345'],
    ['4 digits', '#abcd'],
    ['no hash', 'C1121F'],
    ['number', 12],
    ['null', null],
  ])('rejects %s', (_label, v) => {
    expect(isHex(v)).toBe(false);
  });
});

// ── 4. Header downgrades ──────────────────────────────────────────────

describe('validateTheme: header downgrades', () => {
  const headerTheme = (header: Record<string, unknown>) => theme({ chrome: { header } });

  it('unknown kind "video" downgrades to "default"', () => {
    expect(resolve(headerTheme({ kind: 'video' })).chrome.header.kind).toBe('default');
  });

  it('kind "solid" without a color downgrades to "default"', () => {
    expect(resolve(headerTheme({ kind: 'solid' })).chrome.header.kind).toBe('default');
  });

  it('kind "solid" with a valid color is honoured (positive control)', () => {
    const h = resolve(headerTheme({ kind: 'solid', color: '#7A1C1C' })).chrome.header;
    expect(h.kind).toBe('solid');
    expect(h.color).toBe('#7A1C1C');
  });

  it('kind "gradient" with only one stop downgrades to "default"', () => {
    const h = resolve(headerTheme({ kind: 'gradient', gradient: ['#7A1C1C'] })).chrome.header;
    expect(h.kind).toBe('default');
    expect(h.gradient).toBeUndefined();
  });

  it('kind "gradient" with a non-hex stop downgrades to "default"', () => {
    const h = resolve(headerTheme({ kind: 'gradient', gradient: ['#7A1C1C', 'maroon'] })).chrome.header;
    expect(h.kind).toBe('default');
    expect(h.gradient).toBeUndefined();
  });

  it('kind "image" without an overlayUrl downgrades to "default"', () => {
    expect(resolve(headerTheme({ kind: 'image' })).chrome.header.kind).toBe('default');
  });

  it('kind "image" with an http:// overlayUrl downgrades to "default" (https only)', () => {
    const h = resolve(headerTheme({ kind: 'image', overlayUrl: 'http://cdn.x/hero.png' })).chrome.header;
    expect(h.kind).toBe('default');
    expect(h.overlayUrl).toBeUndefined();
  });

  it('missing ink defaults to #FFFFFF', () => {
    expect(resolve(headerTheme({ kind: 'video' })).chrome.header.ink).toBe('#FFFFFF');
  });

  it('non-hex ink defaults to #FFFFFF', () => {
    expect(resolve(headerTheme({ ink: 'gold' })).chrome.header.ink).toBe('#FFFFFF');
  });

  it.each([
    [5, 24],
    [1000, 160],
  ])('clamps overlayHeight %d to %d', (input, want) => {
    expect(resolve(headerTheme({ overlayHeight: input })).chrome.header.overlayHeight).toBe(want);
  });

  it('missing overlayHeight defaults to 72', () => {
    expect(resolve(headerTheme({})).chrome.header.overlayHeight).toBe(72);
  });

  it('non-numeric overlayHeight ("tall") defaults to 72', () => {
    expect(resolve(headerTheme({ overlayHeight: 'tall' })).chrome.header.overlayHeight).toBe(72);
  });

  it('non-hex tabBar colors are dropped individually', () => {
    const t = resolve(theme({ chrome: { tabBar: { activeInk: 'crimson', badgeBg: '#FFD166' } } }));
    expect(t.chrome.tabBar).toEqual({ badgeBg: '#FFD166' });
  });
});

// ── 5. Decor ──────────────────────────────────────────────────────────

describe('validateTheme: decor', () => {
  const decorTheme = (decor: unknown) => theme({ decor });

  it('lottie with an http:// url downgrades to "none"', () => {
    const d = resolve(decorTheme({ kind: 'lottie', url: 'http://cdn.x/a.json' })).decor;
    expect(d.kind).toBe('none');
    expect(d.url).toBeUndefined();
  });

  it('lottie with a url not ending in .json downgrades to "none"', () => {
    const d = resolve(decorTheme({ kind: 'lottie', url: 'https://cdn.x/a.lottie' })).decor;
    expect(d.kind).toBe('none');
  });

  it('lottie with a query string after .json stays "lottie"', () => {
    const d = resolve(decorTheme({ kind: 'lottie', url: 'https://cdn.x/a.json?v=2' })).decor;
    expect(d.kind).toBe('lottie');
    expect(d.url).toBe('https://cdn.x/a.json?v=2');
  });

  it('kind "image" without a url downgrades to "none"', () => {
    expect(resolve(decorTheme({ kind: 'image' })).decor.kind).toBe('none');
  });

  it('kind "image" with an https url is honoured (positive control)', () => {
    const d = resolve(decorTheme({ kind: 'image', url: 'https://cdn.x/garland.png' })).decor;
    expect(d.kind).toBe('image');
    expect(d.url).toBe('https://cdn.x/garland.png');
  });

  it('unknown kind "video" downgrades to "none" and drops its url', () => {
    const d = resolve(decorTheme({ kind: 'video', url: 'https://cdn.x/a.mp4' })).decor;
    expect(d.kind).toBe('none');
    expect(d.url).toBeUndefined();
  });

  it('placement is always "header"', () => {
    expect(resolve(decorTheme({ placement: 'footer' })).decor.placement).toBe('header');
  });

  it('loop true with no maxPlays stays true', () => {
    const d = resolve(decorTheme({ kind: 'image', url: 'https://cdn.x/a.png', loop: true })).decor;
    expect(d.loop).toBe(true);
    expect(d.maxPlays).toBeUndefined();
  });

  it('loop true with maxPlays set becomes false (maxPlays wins)', () => {
    const d = resolve(
      decorTheme({ kind: 'lottie', url: 'https://cdn.x/a.json', loop: true, maxPlays: 3 }),
    ).decor;
    expect(d.loop).toBe(false);
    expect(d.maxPlays).toBe(3);
  });

  it('loop absent resolves to false', () => {
    expect(resolve(decorTheme({})).decor.loop).toBe(false);
  });

  it('clamps maxPlays 99 down to 10', () => {
    expect(resolve(decorTheme({ maxPlays: 99 })).decor.maxPlays).toBe(10);
  });

  it('clamps maxPlays 0 up to 1 (clampInt(0,1,10) → 1, not undefined)', () => {
    const d = resolve(decorTheme({ maxPlays: 0, loop: true })).decor;
    expect(d.maxPlays).toBe(1);
    // Clamped-to-1 still counts as "maxPlays set", so it defeats loop.
    expect(d.loop).toBe(false);
  });

  it('non-numeric maxPlays is dropped entirely', () => {
    const d = resolve(decorTheme({ maxPlays: 'thrice', loop: true })).decor;
    expect(d.maxPlays).toBeUndefined();
    expect(d.loop).toBe(true);
  });
});

// ── 6. Window ─────────────────────────────────────────────────────────

describe('validateTheme: window', () => {
  it('missing startsAt+endsAt resolves to an open window (-Infinity/+Infinity)', () => {
    const t = resolve(theme());
    expect(t.startsAtMs).toBe(Number.NEGATIVE_INFINITY);
    expect(t.endsAtMs).toBe(Number.POSITIVE_INFINITY);
    expect(isThemeLive(t, 0)).toBe(true);
    expect(isThemeLive(t, Date.parse('1970-01-01T00:00:00.000Z') - 8.64e15)).toBe(true);
    expect(isThemeLive(t, 8.64e15)).toBe(true);
  });

  it('rejects the whole theme when endsAt is before startsAt', () => {
    expect(
      validateTheme(theme({ startsAt: '2026-06-01T00:00:00.000Z', endsAt: '2026-01-01T00:00:00.000Z' })),
    ).toBeNull();
  });

  it('rejects the whole theme when startsAt equals endsAt (empty window)', () => {
    expect(
      validateTheme(theme({ startsAt: '2026-06-01T00:00:00.000Z', endsAt: '2026-06-01T00:00:00.000Z' })),
    ).toBeNull();
  });

  it('rejects the whole theme on an unparseable startsAt string', () => {
    expect(validateTheme(theme({ startsAt: 'next diwali', endsAt: DIWALI_END }))).toBeNull();
  });

  it('null startsAt with a valid endsAt is open-ended backwards and live before endsAt', () => {
    const t = resolve(theme({ startsAt: null, endsAt: DIWALI_END }));
    expect(t.startsAtMs).toBe(Number.NEGATIVE_INFINITY);
    expect(t.endsAtMs).toBe(Date.parse(DIWALI_END));
    expect(isThemeLive(t, Date.parse(DIWALI_END) - 1)).toBe(true);
    expect(isThemeLive(t, Date.parse(DIWALI_END))).toBe(false);
  });
});

// ── 7. Copy ───────────────────────────────────────────────────────────

describe('validateTheme: copy', () => {
  it('trims greeting and caps it at 80 chars (matches the backend schema)', () => {
    const long = '  ' + 'g'.repeat(100) + '  ';
    const t = resolve(theme({ copy: { greeting: long } }));
    expect(t.copy.greeting).toBe('g'.repeat(80));
    expect(t.copy.greeting).toHaveLength(80);
  });

  it('caps searchPlaceholder at 60 chars (matches the backend schema)', () => {
    const t = resolve(theme({ copy: { searchPlaceholder: 's'.repeat(200) } }));
    expect(t.copy.searchPlaceholder).toBe('s'.repeat(60));
  });

  it('empty-string greeting is absent from resolved copy', () => {
    const t = resolve(theme({ copy: { greeting: '', searchPlaceholder: 'Find looks' } }));
    expect('greeting' in t.copy).toBe(false);
    expect(t.copy).toEqual({ searchPlaceholder: 'Find looks' });
  });

  it('whitespace-only greeting is absent from resolved copy', () => {
    const t = resolve(theme({ copy: { greeting: '   ' } }));
    expect(t.copy).toEqual({});
  });

  it('missing copy object resolves to empty copy', () => {
    expect(resolve(theme()).copy).toEqual({});
  });
});

// ── 8. Whole-theme rejection + hostile input never throws ─────────────

describe('validateTheme: rejection and hostile input', () => {
  it('rejects a theme with no slug', () => {
    expect(validateTheme({ startsAt: DIWALI_START, endsAt: DIWALI_END })).toBeNull();
  });

  it('rejects an empty-string slug', () => {
    expect(validateTheme({ slug: '' })).toBeNull();
  });

  it('rejects a whitespace-only slug', () => {
    expect(validateTheme({ slug: '   ' })).toBeNull();
  });

  it('caps slug at 80 chars', () => {
    expect(resolve({ slug: 'x'.repeat(200) }).slug).toBe('x'.repeat(80));
  });

  it.each([
    ['string', 'diwali'],
    ['array', [{ slug: 'diwali' }]],
    ['null', null],
    ['number', 7],
    ['undefined', undefined],
  ])('rejects non-object theme input (%s)', (_label, bad) => {
    expect(validateTheme(bad)).toBeNull();
  });

  it('tokens as a string does not throw — resolves with empty tokens', () => {
    const t = resolve(theme({ tokens: 'hostile' }));
    expect(t.tokens).toEqual({});
  });

  it('chrome as a number does not throw — resolves with default chrome', () => {
    const t = resolve(theme({ chrome: 42 }));
    expect(t.chrome.statusBarStyle).toBe('light');
    expect(t.chrome.header).toEqual({ kind: 'default', ink: '#FFFFFF', overlayHeight: 72 });
    expect(t.chrome.tabBar).toEqual({});
  });

  it('decor as an array does not throw — resolves with decor "none"', () => {
    const t = resolve(theme({ decor: ['https://cdn.x/a.json'] }));
    expect(t.decor).toEqual({ kind: 'none', placement: 'header', loop: false });
  });

  it('a deeply weird payload still resolves to safe defaults without throwing', () => {
    const t = resolve({
      slug: 'weird',
      tokens: 'nope',
      chrome: { header: 'not-an-object', tabBar: 7 },
      decor: false,
      copy: 0,
      extraneous: { nested: [Symbol('x')] },
    });
    expect(t.slug).toBe('weird');
    expect(t.tokens).toEqual({});
    expect(t.chrome.header.kind).toBe('default');
    expect(t.decor.kind).toBe('none');
    expect(t.copy).toEqual({});
  });
});

// ── 9. Clock correction + liveness boundaries ─────────────────────────

describe('computeClockOffsetMs / serverNowMs', () => {
  const generatedAt = '2026-09-02T12:00:00.000Z';
  const serverMs = Date.parse(generatedAt);
  const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

  it('a device 3 days behind is corrected forward to server time', () => {
    const deviceNow = serverMs - THREE_DAYS;
    const offset = computeClockOffsetMs(generatedAt, deviceNow);
    expect(offset).toBe(THREE_DAYS);
    expect(serverNowMs(offset, deviceNow)).toBe(serverMs);
  });

  it('a device 3 days ahead is corrected backward to server time', () => {
    const deviceNow = serverMs + THREE_DAYS;
    const offset = computeClockOffsetMs(generatedAt, deviceNow);
    expect(offset).toBe(-THREE_DAYS);
    expect(serverNowMs(offset, deviceNow)).toBe(serverMs);
  });

  it('garbage generatedAt yields offset 0 (device clock trusted as-is)', () => {
    expect(computeClockOffsetMs('not-a-timestamp', 1_770_000_000_000)).toBe(0);
  });
});

describe('isThemeLive boundaries', () => {
  const t = resolve(theme({ startsAt: DIWALI_START, endsAt: DIWALI_END }));
  const startMs = Date.parse(DIWALI_START);
  const endMs = Date.parse(DIWALI_END);

  it('is live exactly at startsAt (inclusive)', () => {
    expect(isThemeLive(t, startMs)).toBe(true);
  });

  it('is not live just before startsAt', () => {
    expect(isThemeLive(t, startMs - 1)).toBe(false);
  });

  it('is not live exactly at endsAt (exclusive)', () => {
    expect(isThemeLive(t, endMs)).toBe(false);
  });

  it('is live just before endsAt', () => {
    expect(isThemeLive(t, endMs - 1)).toBe(true);
  });
});

// ── 10. Persistence ───────────────────────────────────────────────────

describe('parsePersistedTheme / serializePersistedTheme', () => {
  const persisted = (): PersistedTheme => ({
    persistVersion: 1,
    publicationVersion: 7,
    generatedAt: '2026-09-02T05:00:00.000Z',
    refreshAfterSeconds: 1800,
    clockOffsetMs: -4200,
    fetchedAtDeviceMs: 1_772_400_000_000,
    theme: diwaliFixture(),
  });

  it('serialize → parse round-trips losslessly', () => {
    const p = persisted();
    expect(parsePersistedTheme(serializePersistedTheme(p))).toEqual(p);
  });

  it('corrupted JSON parses to null', () => {
    expect(parsePersistedTheme('{"persistVersion":1,')).toBeNull();
  });

  it.each([[0], [2]])('persistVersion %d parses to null', (v) => {
    expect(parsePersistedTheme(JSON.stringify({ ...persisted(), persistVersion: v }))).toBeNull();
  });

  it.each([
    ['publicationVersion'],
    ['generatedAt'],
    ['refreshAfterSeconds'],
    ['clockOffsetMs'],
    ['fetchedAtDeviceMs'],
    ['theme'],
  ])('missing required field %s parses to null', (key) => {
    const clone: Record<string, unknown> = { ...persisted() };
    delete clone[key];
    expect(parsePersistedTheme(JSON.stringify(clone))).toBeNull();
  });

  it('theme:null round-trips (the "theme" in p check passes on an explicit null)', () => {
    const p: PersistedTheme = { ...persisted(), theme: null };
    const back = parsePersistedTheme(serializePersistedTheme(p));
    expect(back).toEqual(p);
    expect(back?.theme).toBeNull();
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty string', ''],
  ])('%s input parses to null', (_label, raw) => {
    expect(parsePersistedTheme(raw)).toBeNull();
  });

  it('a JSON scalar ("42") parses to null', () => {
    expect(parsePersistedTheme('42')).toBeNull();
  });

  it('JSON "null" parses to null', () => {
    expect(parsePersistedTheme('null')).toBeNull();
  });
});

// ── 11. hexAlpha ──────────────────────────────────────────────────────

describe('hexAlpha', () => {
  it('converts 6-digit hex with alpha', () => {
    expect(hexAlpha('#C1121F', 0.6)).toBe('rgba(193,18,31,0.6)');
  });

  it('expands 3-digit hex (#fff)', () => {
    expect(hexAlpha('#fff', 0.5)).toBe('rgba(255,255,255,0.5)');
  });

  it('supports alpha 0 (fade-fringe: never fade to "transparent")', () => {
    expect(hexAlpha('#C1121F', 0)).toBe('rgba(193,18,31,0)');
  });
});

// ── 12. isHttpsUrl ────────────────────────────────────────────────────

describe('isHttpsUrl', () => {
  it('accepts an https url', () => {
    expect(isHttpsUrl('https://cdn.trendzo.app/a.png')).toBe(true);
  });

  it('rejects http', () => {
    expect(isHttpsUrl('http://cdn.trendzo.app/a.png')).toBe(false);
  });

  it('rejects urls of 2048+ chars (length must be < 2048)', () => {
    const at2048 = 'https://' + 'a'.repeat(2040);
    expect(at2048).toHaveLength(2048);
    expect(isHttpsUrl(at2048)).toBe(false);

    const at2047 = 'https://' + 'a'.repeat(2039);
    expect(at2047).toHaveLength(2047);
    expect(isHttpsUrl(at2047)).toBe(true);
  });

  it.each([
    ['number', 42],
    ['null', null],
    ['undefined', undefined],
    ['object', { href: 'https://x' }],
  ])('rejects non-string input (%s)', (_label, bad) => {
    expect(isHttpsUrl(bad)).toBe(false);
  });
});
