// Home CMS content — GET /cms/home (public, no auth).
//
// Everything the home page and its section pages render used to be a module-level `require()`
// array inside HomeScreen.tsx, so changing one banner meant shipping a build. This fetches the
// published version instead.
//
// ── Why the bundled content is NOT the initial state ──────────────────────────
// The obvious shape — start at the bundled copy, swap when the fetch lands — makes every cold
// launch flash: the shipped banner paints, then a different published banner replaces it a
// second later. That reads as a bug even when both are correct. So the bundled content is a
// FAILURE path only, and three things stand between it and the screen:
//
//   1. `lastKnown` — an in-session cache, so navigating back to Home never refetches or flashes.
//   2. A snapshot PERSISTED to AsyncStorage — `cachedGet`'s cache is memory-only, so without
//      this every cold start would have to choose between a flash and an empty screen. With it,
//      the second launch onward paints real, previously-published content immediately.
//   3. `status: 'loading'` — the genuine first-launch case, where callers render placeholders
//      rather than content nobody has confirmed.
//
// The bundled copy is reached only when the fetch fails AND nothing has ever been persisted:
// first launch, offline. Which is exactly what a fallback is for.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { cachedGet } from './api';
import fallback from '../content/home.content.json';
import type { CmsItem, CmsSection, HomeContent } from '../content/types';

export type { CmsItem, CmsSection, HomeContent };

export type CmsGender = 'her' | 'him';

/**
 * Where the content on screen came from.
 *
 *   loading  — nothing confirmed yet (first launch). Render placeholders, NOT defaults.
 *   ready    — a real published snapshot: fetched now, or persisted from a previous launch.
 *   fallback — the fetch failed and nothing was ever persisted; bundled content is in use.
 */
export type CmsStatus = 'loading' | 'ready' | 'fallback';

/**
 * Content shipped in this build. Offline/first-launch fallback and the seed source for the
 * backend. Carries EVERY audience, unlike a server response, which the server has filtered.
 */
export const FALLBACK_CONTENT: HomeContent = fallback as unknown as HomeContent;

/** How long a snapshot is held before revalidating. Campaigns change on the order of days. */
const TTL_MS = 15 * 60_000;

/**
 * Bumped when the payload SHAPE changes. A persisted snapshot from an older app version is
 * discarded rather than rendered, since this build's screens may read fields it does not have.
 */
const PERSIST_VERSION = 1;
const persistKey = (gender: CmsGender) => `cms.home.v${PERSIST_VERSION}.${gender}`;

export function getHomeContent(gender: CmsGender, city?: string | null): Promise<HomeContent> {
  const params = new URLSearchParams({ gender });
  if (city) params.set('city', city);
  return cachedGet<HomeContent>(`/cms/home?${params.toString()}`, {
    auth: false,
    ttlMs: TTL_MS,
  });
}

function parseSnapshot(raw: string | null | undefined): HomeContent | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as HomeContent;
    if (!parsed || !Array.isArray(parsed.sections) || parsed.sections.length === 0) return null;
    // A snapshot written by an older build may lack fields this build's screens read.
    if (parsed.schemaVersion !== FALLBACK_CONTENT.schemaVersion) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Both rails' last-good snapshots in one read.
 *
 * Both, not just the active one, because a HER↔HIM flip is a single tap and would otherwise
 * blank the page while storage is read. One `multiGet` costs the same as one `getItem`.
 *
 * Never throws — an unreadable cache is a miss, not an error.
 */
export async function readPersistedAll(): Promise<Partial<Record<CmsGender, HomeContent>>> {
  try {
    const pairs = await AsyncStorage.multiGet([persistKey('her'), persistKey('him')]);
    const out: Partial<Record<CmsGender, HomeContent>> = {};
    for (const gender of ['her', 'him'] as const) {
      const hit = pairs.find(([k]) => k === persistKey(gender));
      const parsed = parseSnapshot(hit?.[1]);
      if (parsed) out[gender] = parsed;
    }
    return out;
  } catch {
    return {};
  }
}

/** Fire-and-forget. A failed write costs the next launch a loading state, nothing more. */
export function writePersisted(gender: CmsGender, content: HomeContent): void {
  void AsyncStorage.setItem(persistKey(gender), JSON.stringify(content)).catch(() => {});
}

/** Clear persisted snapshots — used when the payload shape or environment changes under us. */
export async function clearPersisted(): Promise<void> {
  await AsyncStorage.multiRemove([persistKey('her'), persistKey('him')]).catch(() => {});
}

/** A server payload has already been filtered and carries no `gender`; absent means keep. */
export function itemMatchesGender(item: CmsItem, gender: CmsGender): boolean {
  return !item.gender || item.gender === 'all' || item.gender === gender;
}

/**
 * A section with no content. Returned while loading so a caller renders its placeholder rather
 * than bundled copy — `title` is null, so an inline `?? 'Steals'` default does NOT fire either.
 */
export const emptySection = (key: string): CmsSection => ({
  key,
  type: 'unknown',
  title: null,
  subtitle: null,
  kicker: null,
  ctaLabel: null,
  config: {},
  items: [],
});

/**
 * One section, gender-filtered.
 *
 * Two rules, and they matter in opposite directions:
 *
 * `content === null` (loading) yields an EMPTY section, not the bundled copy — a caller in the
 * loading state must be unable to render content nobody has confirmed.
 *
 * When content IS present there is NO per-section fallback either: a successful response is
 * taken as complete. That is deliberate and was a bug before. The public endpoint omits sections
 * an admin has DISABLED, so falling back per-section would quietly resurrect the bundled version
 * of a rail somebody deliberately switched off — making the visibility toggle a no-op. "The
 * server did not send it" has to mean "do not show it".
 *
 * The cost is that an app shipped ahead of its backend renders an empty rail for a section the
 * backend has not learned about yet. That resolves itself on the next deploy (the seeder
 * reconciles the section list from code), and an empty new rail is a far smaller problem than an
 * un-disable-able one. Whole-payload fallback still covers the offline case.
 */
export function selectSection(
  content: HomeContent | null | undefined,
  key: string,
  gender: CmsGender,
): CmsSection {
  if (!content) return emptySection(key);
  const source = content.sections.find((s) => s.key === key) ?? emptySection(key);
  return { ...source, items: source.items.filter((i) => itemMatchesGender(i, gender)) };
}
