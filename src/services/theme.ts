// Festival theme orchestration — fetch, persist, apply, expire.
//
// The decision logic is pure and lives in theme/remoteTheme.ts; this module owns
// the side effects: AsyncStorage, the network, the palette swap, the expiry
// timer, the foreground listener. Resolution order copies services/cms.ts:
//
//   persisted snapshot (applied SYNCHRONOUSLY before first paint)
//     → async refresh via cachedGet (ETag/304 for free)
//       → bundled LIGHT as the failure path
//
// `theme: null` is the server's normal answer for most of the year; a network
// failure changes nothing on screen; and expiry reverts to LIGHT without the
// network — a tampered device clock cannot keep Diwali alive past the next
// successful fetch (see the clock-offset notes in remoteTheme.ts).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { applyPalette, resetPalette } from '../theme/brutal';
import { useThemeVersion } from '../theme/brutal';
import {
  computeClockOffsetMs,
  isThemeLive,
  parseEnvelope,
  parsePersistedTheme,
  serializePersistedTheme,
  serverNowMs,
  validateTheme,
  type ResolvedTheme,
  type ThemeWirePayload,
} from '../theme/remoteTheme';
import { getPlaceCity } from '../state/location';
import { cachedGet } from './api';

export const THEME_KEY = 'cms.theme.v1';

let _resolved: ResolvedTheme | null = null;
let _appliedPublicationVersion = -1;
let _clockOffsetMs = 0;
let _refreshAfterSeconds = 1800;
let _expiryTimer: ReturnType<typeof setTimeout> | null = null;
let _started = false;
/** generatedAt of the last payload we derived a clock offset from. */
let _offsetFromGeneratedAt: string | null = null;

/** The active theme's chrome/decor/copy — pair with useThemeVersion() to re-render. */
export function getActiveTheme(): ResolvedTheme | null {
  return _resolved;
}

/** One-stop hook for chrome surfaces: subscribes AND returns the current theme. */
export function useFestivalTheme(): ResolvedTheme | null {
  useThemeVersion();
  return _resolved;
}

function clearExpiryTimer() {
  if (_expiryTimer) {
    clearTimeout(_expiryTimer);
    _expiryTimer = null;
  }
}

/**
 * Revert the moment endsAt passes, without waiting for a fetch. Chained hops
 * capped at 6h keep clear of the 2^31ms setTimeout ceiling and absorb drift.
 */
function armExpiryTimer() {
  clearExpiryTimer();
  if (!_resolved || _resolved.endsAtMs === Number.POSITIVE_INFINITY) return;
  const remaining = _resolved.endsAtMs - serverNowMs(_clockOffsetMs, Date.now());
  const hop = Math.max(1_000, Math.min(remaining, 6 * 3600_000));
  _expiryTimer = setTimeout(() => {
    checkExpiryNow();
    if (_resolved) armExpiryTimer();
  }, hop);
}

function applyResolved(t: ResolvedTheme, pubVersion: number) {
  // Idempotence: an unchanged publication must not bump the version and force a
  // pointless repaint (the launch refresh usually lands on exactly this path).
  if (pubVersion === _appliedPublicationVersion && _resolved?.slug === t.slug) return;
  _resolved = t;
  _appliedPublicationVersion = pubVersion;
  applyPalette(t.tokens);
  armExpiryTimer();
  prefetchThemeArt(t);
}

function applyNone(pubVersion: number) {
  if (pubVersion === _appliedPublicationVersion && _resolved === null) return;
  _resolved = null;
  _appliedPublicationVersion = pubVersion;
  clearExpiryTimer();
  resetPalette();
}

/** LIGHT-revert on expiry, no network needed. Safe to call any time. */
export function checkExpiryNow(): void {
  if (_resolved && !isThemeLive(_resolved, serverNowMs(_clockOffsetMs, Date.now()))) {
    _resolved = null;
    clearExpiryTimer();
    resetPalette();
  }
}

/** Warm remote art so the band paints from disk on the next cold start. */
function prefetchThemeArt(t: ResolvedTheme): void {
  const urls = [
    t.chrome.header.wordmarkUrl,
    t.chrome.header.overlayUrl,
    t.decor.kind === 'image' ? t.decor.url : undefined,
  ].filter((u): u is string => !!u);
  if (urls.length > 0) {
    try {
      void ExpoImage.prefetch(urls, 'memory-disk');
    } catch {
      // Prefetch is an optimization; failure costs a slower first paint, nothing more.
    }
  }
}

/**
 * SYNCHRONOUS hydrate from the persisted snapshot — called inside AppState's
 * cold-start multiGet, before authHydrated flips, so the first routed frame
 * paints themed with no flash. Never throws.
 */
export function hydratePersistedTheme(raw: string | null): void {
  try {
    const p = parsePersistedTheme(raw);
    if (!p) return;
    _clockOffsetMs = p.clockOffsetMs;
    _offsetFromGeneratedAt = p.generatedAt;
    _refreshAfterSeconds = p.refreshAfterSeconds;
    const t = p.theme === null ? null : validateTheme(p.theme);
    if (!t) return; // stay LIGHT; the refresh will overwrite the snapshot
    if (!isThemeLive(t, serverNowMs(_clockOffsetMs, Date.now()))) return; // expired while closed
    applyResolved(t, p.publicationVersion);
  } catch {
    // A corrupt snapshot must never touch startup; the fetch path will replace it.
  }
}

/** Fetch, validate, apply, persist. Never throws; on failure the current state stands. */
export async function refreshTheme(): Promise<void> {
  try {
    const deviceNow = Date.now();
    // City must ride along or a city-targeted theme can never resolve: the server
    // fails closed for a caller whose city it does not know.
    const city = getPlaceCity();
    const path = city ? `/cms/theme?city=${encodeURIComponent(city)}` : '/cms/theme';
    const payload = await cachedGet<ThemeWirePayload>(path, {
      auth: false,
      ttlMs: _refreshAfterSeconds * 1000,
    });
    const env = parseEnvelope(payload);
    if (!env) return; // unknown schemaVersion: keep current, expiry still governs

    // Only recompute the offset from a payload we have not already measured.
    // cachedGet legitimately returns a memory hit (or a 304-refreshed stale entry)
    // whose generatedAt is minutes old; pairing that stale instant with a fresh
    // deviceNow would drag "server time" backwards every refresh and make expiry
    // fire late — precisely what the offset exists to prevent.
    if (env.generatedAt !== _offsetFromGeneratedAt) {
      _clockOffsetMs = computeClockOffsetMs(env.generatedAt, deviceNow);
      _offsetFromGeneratedAt = env.generatedAt;
    }
    _refreshAfterSeconds = env.refreshAfterSeconds;

    const t = env.theme === null ? null : validateTheme(env.theme);
    const live = t !== null && isThemeLive(t, serverNowMs(_clockOffsetMs, Date.now()));
    if (live && t) applyResolved(t, env.publicationVersion);
    else applyNone(env.publicationVersion);

    void AsyncStorage.setItem(
      THEME_KEY,
      serializePersistedTheme({
        persistVersion: 1,
        publicationVersion: env.publicationVersion,
        generatedAt: env.generatedAt,
        refreshAfterSeconds: env.refreshAfterSeconds,
        clockOffsetMs: _clockOffsetMs,
        fetchedAtDeviceMs: deviceNow,
        theme: env.theme,
      }),
    ).catch(() => {});
  } catch {
    // Offline / server down: whatever is applied stands, but expiry still runs so a
    // finished festival ends on time even with no network.
    checkExpiryNow();
  }
}

/**
 * Install the foreground listener + fire the launch refresh. Idempotent. The
 * cachedGet TTL makes rapid foregrounds free; past TTL it revalidates with
 * If-None-Match and an unchanged snapshot costs a 304 with no body.
 */
export function startThemeService(): void {
  if (_started) return;
  _started = true;
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      checkExpiryNow();
      void refreshTheme();
    }
  });
  void refreshTheme();
}

/** DEV-only: push a raw wire theme through the full validate/apply path. */
export function debugApplyTheme(rawTheme: unknown): void {
  if (!__DEV__) return;
  const t = rawTheme === null ? null : validateTheme(rawTheme);
  if (t) applyResolved(t, _appliedPublicationVersion + 1);
  else applyNone(_appliedPublicationVersion + 1);
}
