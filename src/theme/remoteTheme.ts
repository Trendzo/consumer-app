// Pure logic for the server-driven festival theme — validation, expiry, clock
// correction, persistence parsing. Everything decision-bearing lives here, with
// ZERO runtime imports (the one import below is type-only, erased at compile),
// so vitest can cover it in a plain node environment.
//
// Philosophy, mirrored from useAppConfig's merge(): the server payload is a
// suggestion, LIGHT is the truth. Every field is allowlisted individually;
// anything unknown, malformed or non-https is dropped or downgraded, and any
// throw anywhere yields null — a hostile payload can only ever produce the
// bundled look, never a crash.

import type { Palette, RemoteTokenKey } from './brutal';

// ── Wire types (schemaVersion 1 — see backend shared/cms/theme-schema.ts) ──

export type ThemeWirePayload = {
  schemaVersion: number;
  publicationVersion: number;
  generatedAt: string;
  refreshAfterSeconds: number;
  theme: unknown | null;
};

export type ResolvedHeader = {
  kind: 'default' | 'solid' | 'gradient' | 'image';
  color?: string;
  gradient?: [string, string];
  /** Foreground for everything in the header. Defaults white (today's look over photos). */
  ink: string;
  wordmarkUrl?: string;
  /** Doubles as the full-bleed header image when kind === 'image'. */
  overlayUrl?: string;
  overlayHeight: number;
};

export type ResolvedTheme = {
  slug: string;
  startsAtMs: number;
  endsAtMs: number;
  tokens: Partial<Pick<Palette, RemoteTokenKey>>;
  chrome: {
    statusBarStyle: 'light' | 'dark';
    header: ResolvedHeader;
    tabBar: { activeInk?: string; badgeBg?: string };
  };
  decor: {
    kind: 'none' | 'image' | 'lottie';
    url?: string;
    placement: 'header';
    loop: boolean;
    maxPlays?: number;
  };
  copy: { greeting?: string; searchPlaceholder?: string };
};

// ── Small validators ──────────────────────────────────────────────────

/** Same regex as content/media.ts color() — 3- or 6-digit hex. */
export function isHex(v: unknown): v is string {
  return typeof v === 'string' && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v);
}

export function isHttpsUrl(v: unknown): v is string {
  return typeof v === 'string' && v.length < 2048 && v.startsWith('https://');
}

/** '#RRGGBB'/'#RGB' → 'rgba(r,g,b,a)'. Powers the fade-fringe rule (never fade to 'transparent'). */
export function hexAlpha(hex: string, alpha: number): string {
  let h = hex.slice(1);
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}

const str = (v: unknown, max: number): string | undefined =>
  typeof v === 'string' && v.trim().length > 0 ? v.trim().slice(0, max) : undefined;

const clampInt = (v: unknown, lo: number, hi: number): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : undefined;

// ── Envelope ──────────────────────────────────────────────────────────

export type ParsedEnvelope = {
  publicationVersion: number;
  generatedAt: string;
  refreshAfterSeconds: number;
  theme: unknown | null;
};

/**
 * Reject anything but schemaVersion 1 — a future payload SHAPE must not reach this
 * build's validator. refreshAfterSeconds is clamped so a server typo can neither
 * hammer the API nor freeze a theme for a week.
 */
export function parseEnvelope(json: unknown): ParsedEnvelope | null {
  try {
    if (typeof json !== 'object' || json === null) return null;
    const p = json as Partial<ThemeWirePayload>;
    if (p.schemaVersion !== 1) return null;
    if (typeof p.publicationVersion !== 'number' || !Number.isFinite(p.publicationVersion)) return null;
    if (typeof p.generatedAt !== 'string') return null;
    const refresh =
      typeof p.refreshAfterSeconds === 'number' && Number.isFinite(p.refreshAfterSeconds)
        ? Math.min(86_400, Math.max(300, Math.round(p.refreshAfterSeconds)))
        : 1800;
    return {
      publicationVersion: p.publicationVersion,
      generatedAt: p.generatedAt,
      refreshAfterSeconds: refresh,
      theme: p.theme === undefined ? null : p.theme,
    };
  } catch {
    return null;
  }
}

// ── Theme validation — allowlist merge, downgrade on nonsense ────────

const REMOTE_TOKEN_KEYS: readonly RemoteTokenKey[] = [
  'accent',
  'accentInk',
  'accentSoft',
  'surfaceAlt',
  'hairline',
];

/**
 * Raw wire theme → ResolvedTheme, or null when it cannot be trusted.
 *
 * Rules: unknown token keys are DROPPED (a payload naming `err` simply never
 * reaches the palette); unknown kinds DOWNGRADE ('video' header → 'default',
 * lottie without an https .json url → 'none'); an invalid window rejects the
 * WHOLE theme, because expiry math on garbage dates would be unsafe.
 */
export function validateTheme(raw: unknown): ResolvedTheme | null {
  try {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
    const t = raw as Record<string, unknown>;

    const slug = str(t.slug, 80);
    if (!slug) return null;

    // Window: either bound may be null (open), but a PRESENT bound must parse,
    // and a closed window must be ordered.
    const startsAtMs = t.startsAt == null ? Number.NEGATIVE_INFINITY : Date.parse(String(t.startsAt));
    const endsAtMs = t.endsAt == null ? Number.POSITIVE_INFINITY : Date.parse(String(t.endsAt));
    if (Number.isNaN(startsAtMs) || Number.isNaN(endsAtMs) || startsAtMs >= endsAtMs) return null;

    // Tokens — allowlist only, hex only.
    const tokens: Partial<Pick<Palette, RemoteTokenKey>> = {};
    const rawTokens = (t.tokens ?? {}) as Record<string, unknown>;
    for (const key of REMOTE_TOKEN_KEYS) {
      const v = rawTokens[key];
      if (isHex(v)) tokens[key] = v;
    }

    // Chrome.
    const rawChrome = (t.chrome ?? {}) as Record<string, unknown>;
    const statusBarStyle = rawChrome.statusBarStyle === 'dark' ? 'dark' : 'light';

    const rawHeader = (rawChrome.header ?? {}) as Record<string, unknown>;
    const color = isHex(rawHeader.color) ? rawHeader.color : undefined;
    const g = rawHeader.gradient;
    const gradient: [string, string] | undefined =
      Array.isArray(g) && g.length === 2 && isHex(g[0]) && isHex(g[1]) ? [g[0], g[1]] : undefined;
    const wordmarkUrl = isHttpsUrl(rawHeader.wordmarkUrl) ? rawHeader.wordmarkUrl : undefined;
    const overlayUrl = isHttpsUrl(rawHeader.overlayUrl) ? rawHeader.overlayUrl : undefined;

    // Kind downgrades to 'default' when its prerequisite is missing — a solid
    // band with no color is not a rendering instruction anyone can follow.
    let kind: ResolvedHeader['kind'] = 'default';
    if (rawHeader.kind === 'solid' && color) kind = 'solid';
    else if (rawHeader.kind === 'gradient' && gradient) kind = 'gradient';
    else if (rawHeader.kind === 'image' && overlayUrl) kind = 'image';

    const header: ResolvedHeader = {
      kind,
      ...(color ? { color } : {}),
      ...(gradient ? { gradient } : {}),
      ink: isHex(rawHeader.ink) ? (rawHeader.ink as string) : '#FFFFFF',
      ...(wordmarkUrl ? { wordmarkUrl } : {}),
      ...(overlayUrl ? { overlayUrl } : {}),
      overlayHeight: clampInt(rawHeader.overlayHeight, 24, 160) ?? 72,
    };

    const rawTabBar = (rawChrome.tabBar ?? {}) as Record<string, unknown>;
    const tabBar = {
      ...(isHex(rawTabBar.activeInk) ? { activeInk: rawTabBar.activeInk as string } : {}),
      ...(isHex(rawTabBar.badgeBg) ? { badgeBg: rawTabBar.badgeBg as string } : {}),
    };

    // Decor — image/lottie need an https url; lottie additionally a .json path.
    const rawDecor = (t.decor ?? {}) as Record<string, unknown>;
    const decorUrl = isHttpsUrl(rawDecor.url) ? rawDecor.url : undefined;
    let decorKind: ResolvedTheme['decor']['kind'] = 'none';
    if (rawDecor.kind === 'image' && decorUrl) decorKind = 'image';
    else if (rawDecor.kind === 'lottie' && decorUrl && decorUrl.split('?')[0]!.endsWith('.json')) {
      decorKind = 'lottie';
    }
    const maxPlays = clampInt(rawDecor.maxPlays, 1, 10);
    const decor: ResolvedTheme['decor'] = {
      kind: decorKind,
      ...(decorKind !== 'none' && decorUrl ? { url: decorUrl } : {}),
      placement: 'header',
      // maxPlays wins over loop — "loop forever but stop after 3" is a contradiction.
      loop: rawDecor.loop === true && maxPlays === undefined,
      ...(maxPlays !== undefined ? { maxPlays } : {}),
    };

    const rawCopy = (t.copy ?? {}) as Record<string, unknown>;
    // Caps mirror the backend schema exactly (greeting 80, placeholder 60) — a
    // shorter client cap would truncate copy an editor was allowed to save.
    const greeting = str(rawCopy.greeting, 80);
    const searchPlaceholder = str(rawCopy.searchPlaceholder, 60);

    return {
      slug,
      startsAtMs,
      endsAtMs,
      tokens,
      chrome: { statusBarStyle, header, tabBar },
      decor,
      copy: {
        ...(greeting ? { greeting } : {}),
        ...(searchPlaceholder ? { searchPlaceholder } : {}),
      },
    };
  } catch {
    return null;
  }
}

// ── Clock correction + expiry ─────────────────────────────────────────
// Festival windows are SERVER-TIME facts. A device clock set 3 days ahead must
// not end Diwali early — and one set behind must not extend it. The offset from
// the last successful fetch corrects the device clock in both directions.

export function computeClockOffsetMs(generatedAtIso: string, deviceNowMs: number): number {
  const server = Date.parse(generatedAtIso);
  return Number.isNaN(server) ? 0 : server - deviceNowMs;
}

export function serverNowMs(offsetMs: number, deviceNowMs: number): number {
  return deviceNowMs + offsetMs;
}

export function isThemeLive(t: ResolvedTheme, serverNow: number): boolean {
  return t.startsAtMs <= serverNow && serverNow < t.endsAtMs;
}

// ── Persistence (AsyncStorage key cms.theme.v1) ──────────────────────
// The RAW wire theme is persisted and re-validated on every read: a snapshot
// written by an older build can never feed this build unvalidated fields.

export type PersistedTheme = {
  persistVersion: 1;
  publicationVersion: number;
  generatedAt: string;
  refreshAfterSeconds: number;
  clockOffsetMs: number;
  fetchedAtDeviceMs: number;
  theme: unknown | null;
};

export function parsePersistedTheme(raw: string | null | undefined): PersistedTheme | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<PersistedTheme>;
    if (typeof p !== 'object' || p === null) return null;
    if (p.persistVersion !== 1) return null;
    if (typeof p.publicationVersion !== 'number') return null;
    if (typeof p.generatedAt !== 'string') return null;
    if (typeof p.refreshAfterSeconds !== 'number') return null;
    if (typeof p.clockOffsetMs !== 'number') return null;
    if (typeof p.fetchedAtDeviceMs !== 'number') return null;
    if (!('theme' in p)) return null;
    return p as PersistedTheme;
  } catch {
    return null;
  }
}

export function serializePersistedTheme(p: PersistedTheme): string {
  return JSON.stringify(p);
}
