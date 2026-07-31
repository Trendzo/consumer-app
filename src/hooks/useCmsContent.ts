// Shared reader for the Home CMS.
//
// The ordering rule this enforces: a screen never shows unconfirmed content. Resolution is
//
//   in-session cache → persisted snapshot → (loading) → bundled fallback, only on failure
//
// so the bundled copy appears only when the network actually failed and nothing was ever
// persisted. Starting at the bundled copy — the obvious implementation — flashes on every cold
// launch: shipped banner paints, published banner replaces it. See services/cms.ts.
//
// Cached per gender because the payload is gender-filtered server-side and HER↔HIM flips are
// frequent; the home screen caches its catalog slices per gender for the same reason.

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  FALLBACK_CONTENT,
  getHomeContent,
  readPersistedAll,
  selectSection,
  writePersisted,
  type CmsGender,
  type CmsSection,
  type CmsStatus,
  type HomeContent,
} from '../services/cms';

/** Survives unmounts, so the second screen to ask renders instantly and identically. */
const lastKnown: Partial<Record<CmsGender, HomeContent>> = {};

/**
 * The one-shot storage read, shared by every caller.
 *
 * A promise rather than a boolean flag: several components mount in the same tick on launch, and
 * a flag would let each of them start its own read before any had finished.
 */
let persistedWarm: Promise<void> | null = null;

function warmFromStorage(): Promise<void> {
  persistedWarm ??= readPersistedAll().then((snapshots) => {
    for (const gender of ['her', 'him'] as const) {
      // A live fetch that already landed outranks anything on disk.
      const snapshot = snapshots[gender];
      if (snapshot && !lastKnown[gender]) {
        lastKnown[gender] = snapshot;
        bumpRails();
      }
    }
  });
  return persistedWarm;
}

/**
 * Rail-arrival notifications.
 *
 * The category conveyor crossfades BOTH rails' art on the UI thread, so it needs both payloads
 * mounted at once. `prefetchRail` deliberately fills `lastKnown` without touching component state
 * — that is what stops it interfering with the rail on screen — so a component that wants both
 * rails has to be told when the second one arrives. Hence this minimal store; the same
 * `useSyncExternalStore` shape the theme uses in components/Brutal.tsx.
 */
let railsVersion = 0;
const railListeners = new Set<() => void>();

function bumpRails(): void {
  railsVersion += 1;
  for (const listener of railListeners) listener();
}

function subscribeRails(cb: () => void): () => void {
  railListeners.add(cb);
  return () => {
    railListeners.delete(cb);
  };
}

const getRailsVersion = (): number => railsVersion;

const OTHER_RAIL: Record<CmsGender, CmsGender> = { her: 'him', him: 'her' };

/** Rails with a prefetch in flight, so two mounts don't both start one. */
const prefetching = new Set<CmsGender>();

/**
 * Pull the rail the user is NOT looking at into `lastKnown`.
 *
 * The HER↔HIM switch is a single drag and has to swap instantly. Without this, the first flip
 * of a session hits the network, the hook has nothing to show, and every CMS section unmounts
 * at once — which collapses the page and yanks the Explore grid up into view. The catalog
 * slices next door are cached per gender for exactly this reason.
 *
 * Deliberately fire-and-forget: it never touches component state, so it cannot cause a render
 * or interfere with the rail actually on screen.
 */
function prefetchRail(gender: CmsGender, city?: string | null): void {
  if (lastKnown[gender] || prefetching.has(gender)) return;
  prefetching.add(gender);
  void getHomeContent(gender, city)
    .then((next) => {
      if (next && Array.isArray(next.sections) && next.sections.length > 0) {
        lastKnown[gender] = next;
        writePersisted(gender, next);
        bumpRails();
      }
    })
    .catch(() => {
      /* the flip will fetch it again; nothing on screen depends on this */
    })
    .finally(() => prefetching.delete(gender));
}

/**
 * How long a FIRST-EVER launch waits before showing the bundled content.
 *
 * This is the one deliberate exception to "fallback only after failure", and it is narrow: it
 * applies only when nothing is on disk and nothing has come back yet — i.e. the first launch
 * after install, and never again, because every successful fetch persists a snapshot. The
 * backend is on a free tier that cold-starts in seconds, and a blank hero for that long is worse
 * product than shipped content that upgrades in place.
 *
 * It cannot cause the flash this file exists to prevent: on launch two onward the disk snapshot
 * paints immediately, so there is no window for the bundled copy to appear.
 *
 * Set to 0 to disable and hold the placeholder until the network actually answers.
 */
const FIRST_PAINT_BUDGET_MS = 2500;

export type CmsContentState = { content: HomeContent | null; status: CmsStatus; gender: CmsGender };

/**
 * The payload for one rail, plus where it came from.
 *
 * `content` is null only while `status === 'loading'`. Callers must render placeholders in that
 * state rather than their own defaults — an inline `section.title ?? 'Steals'` is a default, and
 * showing it before the server has answered is the flash this exists to prevent.
 */
export function useCmsContent(gender: CmsGender, city?: string | null): CmsContentState {
  // Carries the COLD path only. The warm path is resolved during render, below.
  const [cold, setCold] = useState<CmsContentState>(() => ({
    content: null,
    status: 'loading',
    gender,
  }));

  /**
   * Resolved during RENDER, not in an effect — this is the keystone of the flip feeling instant.
   *
   * `lastKnown` is a module-level, grow-only cache, so reading it here is deterministic for a
   * given gender and gives the flip exactly the timing the original
   * `gender === 'her' ? HER_X : HIM_X` module constants had: the new rail's content is present in
   * the SAME render that commits the new gender.
   *
   * Resolving it in an effect instead costs one extra render in which the page still shows the
   * previous rail — which IS the reported "removes the content for a very small instance of a
   * sec, and renders other instead of animation". Every section then hard-cuts a frame later
   * rather than crossfading.
   */
  const warm = lastKnown[gender];
  const resolved: CmsContentState = warm
    ? { content: warm, status: 'ready', gender }
    : cold.content
      ? // Cold rail, but the page is already populated. Hold what is on screen rather than
        // blanking, and keep `gender` as the CONTENT's rail so its items are not filtered
        // against a rail they do not belong to.
        cold
      : { content: null, status: cold.status, gender };

  // Guards a late resolution from overwriting a newer one after a rail flip.
  const railRef = useRef(gender);
  railRef.current = gender;

  // What is on screen right now, readable synchronously — the effect below needs it to decide
  // whether the page is already populated, and reading state inside a setState updater would
  // see a stale value (updaters run during render, not at call time).
  const contentRef = useRef<HomeContent | null>(resolved.content);
  contentRef.current = resolved.content;

  useEffect(() => {
    let cancelled = false;
    /**
     * Commit a cold-path result.
     *
     * Bails out when nothing actually changed. `cachedGet` hands back the SAME object on a cache
     * hit, so without this a revalidation re-renders the largest component in the app for no
     * reason — and if that lands mid-transition (a flip, or a PDP zoom) it drops frames.
     */
    const settle = (next: CmsContentState) => {
      if (cancelled || railRef.current !== gender) return;
      setCold((prev) =>
        prev.content === next.content && prev.status === next.status && prev.gender === next.gender
          ? prev
          : next,
      );
    };

    const inSession = lastKnown[gender];
    // Nothing cached for this rail: the render above is already holding the previous rail's
    // content when there is any, so the effect only has to decide whether to arm the
    // first-launch fallback timer.
    const heldPreviousRail = !inSession && contentRef.current !== null;

    // Storage and network race to paint. `networkWon` is set ONLY on a successful fetch, so a
    // snapshot that resolves after a failed request still gets its turn — an offline launch must
    // show the last real content, not the bundled copy, and network errors resolve fast enough
    // to beat a disk read.
    let networkWon = false;

    if (!inSession) {
      void warmFromStorage().then(() => {
        const snapshot = lastKnown[gender];
        if (!snapshot || networkWon) return;
        settle({ content: snapshot, status: 'ready', gender });
      });
    }

    /** Nothing usable came back. Consult disk before conceding to the bundled copy. */
    const degrade = async () => {
      await warmFromStorage();
      const known = lastKnown[gender];
      settle(
        known
          ? { content: known, status: 'ready', gender }
          : { content: FALLBACK_CONTENT, status: 'fallback', gender },
      );
    };

    // First-launch safety net — see FIRST_PAINT_BUDGET_MS. Skipped when the previous rail is
    // being held: swapping a real page for the bundled copy mid-flip is a visible downgrade,
    // and the flip is not a first launch.
    const budget =
      FIRST_PAINT_BUDGET_MS > 0 && !inSession && !heldPreviousRail
        ? setTimeout(() => {
            if (networkWon || lastKnown[gender]) return;
            settle({ content: FALLBACK_CONTENT, status: 'fallback', gender });
          }, FIRST_PAINT_BUDGET_MS)
        : null;

    getHomeContent(gender, city)
      .then((next) => {
        // An empty payload means nothing has ever been published on this backend — a real
        // answer, but not a usable one, so it degrades the same way a failure does.
        if (!next || !Array.isArray(next.sections) || next.sections.length === 0) {
          void degrade();
          return;
        }
        networkWon = true;
        lastKnown[gender] = next;
        writePersisted(gender, next);
        bumpRails();
        settle({ content: next, status: 'ready', gender });
        // Warm the other rail now that this one is on screen, so the first flip is a pure
        // in-memory swap with no loading state and no layout collapse.
        prefetchRail(OTHER_RAIL[gender], city);
      })
      .catch(() => {
        void degrade();
      });

    // Already cached, so the fetch above will resolve from cache and may not re-trigger the
    // prefetch — kick it here too. `prefetchRail` no-ops when the rail is already known.
    if (inSession) prefetchRail(OTHER_RAIL[gender], city);

    return () => {
      cancelled = true;
      if (budget) clearTimeout(budget);
    };
  }, [gender, city]);

  return resolved;
}

export type CmsSectionState = { section: CmsSection; status: CmsStatus };

/** One section, ready to render, plus the status the caller needs to choose a placeholder. */
export function useCmsSection(key: string, gender: CmsGender, city?: string | null): CmsSectionState {
  const { content, status, gender: contentGender } = useCmsContent(gender, city);
  const section = useMemo(() => selectSection(content, key, contentGender), [content, key, contentGender]);
  return { section, status };
}

export type CmsSectionsState = { sections: Record<string, CmsSection>; status: CmsStatus; gender: CmsGender };

/**
 * Several sections from ONE payload read. Prefer this when a screen renders more than one.
 *
 * MEMOISED, and that matters beyond saving a filter pass: these sections are passed as props
 * into `React.memo`'d components (category browse mounts ~100 and relies on memo to virtualise),
 * so a freshly-built object each render would defeat the memo entirely.
 *
 * `keys` is joined for the dep list because callers pass an array literal, which is a new
 * reference every render.
 */
export function useCmsSections(
  keys: string[],
  gender: CmsGender,
  city?: string | null,
): CmsSectionsState {
  const { content, status, gender: contentGender } = useCmsContent(gender, city);
  const keySignature = keys.join('|');
  const sections = useMemo(() => {
    const out: Record<string, CmsSection> = {};
    for (const key of keySignature.split('|')) out[key] = selectSection(content, key, contentGender);
    return out;
  }, [content, keySignature, contentGender]);
  return { sections, status, gender: contentGender };
}

export type CmsRailsState = {
  /** Null until that rail's payload is cached. */
  her: Record<string, CmsSection> | null;
  him: Record<string, CmsSection> | null;
  /** Only then can a section crossfade between the two on the UI thread. */
  bothWarm: boolean;
  status: CmsStatus;
};

/**
 * BOTH rails' sections at once, for sections that animate between them.
 *
 * The category tiles crossfade HER art to HIM art on a clipped conveyor driven by
 * `curveProgress` — both images have to be mounted simultaneously or there is nothing to
 * crossfade, and doing it on the UI thread is the only way it survives a mid-range device.
 *
 * The server payload is gender-filtered, so "both rails" means both cached payloads. That makes
 * `prefetchRail` load-bearing for the ANIMATION, not just for perf: until the second rail lands
 * `bothWarm` is false and the caller must fall back to an instant swap.
 */
export function useCmsRails(
  keys: string[],
  gender: CmsGender,
  city?: string | null,
): CmsRailsState {
  // Subscribing to the active rail is what drives the fetch and the normal re-renders.
  const active = useCmsContent(gender, city);
  // Re-render when the OTHER rail lands, since a prefetch writes no component state.
  useSyncExternalStore(subscribeRails, getRailsVersion, getRailsVersion);

  const keySignature = keys.join('|');
  // The bundled file is NOT gender-filtered — it carries every audience — so when we are running
  // on it (offline first launch) it can drive both sides of the crossfade on its own. Without this
  // the animation would silently degrade in exactly the situation where nothing else is moving.
  const usingFallback = active.status === 'fallback' && active.content !== null;
  const her = lastKnown.her ?? (usingFallback ? active.content! : undefined);
  const him = lastKnown.him ?? (usingFallback ? active.content! : undefined);

  const rails = useMemo(() => {
    const build = (payload: HomeContent | undefined, rail: CmsGender) => {
      if (!payload) return null;
      const out: Record<string, CmsSection> = {};
      for (const key of keySignature.split('|')) out[key] = selectSection(payload, key, rail);
      return out;
    };
    return { her: build(her, 'her'), him: build(him, 'him') };
  }, [her, him, keySignature]);

  return {
    ...rails,
    bothWarm: rails.her !== null && rails.him !== null,
    status: active.status,
  };
}
