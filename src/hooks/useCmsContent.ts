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

import { useEffect, useMemo, useRef, useState } from 'react';
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
      if (snapshot && !lastKnown[gender]) lastKnown[gender] = snapshot;
    }
  });
  return persistedWarm;
}

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

export type CmsContentState = { content: HomeContent | null; status: CmsStatus };

/**
 * The payload for one rail, plus where it came from.
 *
 * `content` is null only while `status === 'loading'`. Callers must render placeholders in that
 * state rather than their own defaults — an inline `section.title ?? 'Steals'` is a default, and
 * showing it before the server has answered is the flash this exists to prevent.
 */
export function useCmsContent(gender: CmsGender, city?: string | null): CmsContentState {
  const [state, setState] = useState<CmsContentState>(() =>
    lastKnown[gender] ? { content: lastKnown[gender]!, status: 'ready' } : { content: null, status: 'loading' },
  );

  // Guards a late resolution from overwriting a newer one after a rail flip.
  const railRef = useRef(gender);
  railRef.current = gender;

  // What is on screen right now, readable synchronously. A functional setState updater runs
  // during render, not at call time, so deciding "is the page already populated?" inside one
  // and reading the answer in the same tick would always see the stale value.
  const contentRef = useRef<HomeContent | null>(state.content);
  contentRef.current = state.content;

  useEffect(() => {
    let cancelled = false;
    const settle = (next: CmsContentState) => {
      if (!cancelled && railRef.current === gender) setState(next);
    };

    // Swap instantly when this rail is already cached — the common path, and what makes the
    // HER↔HIM drag feel immediate.
    const inSession = lastKnown[gender];
    // Nothing cached for the new rail: drop to placeholders ONLY when the screen is empty
    // anyway (first launch). On a flip there is already a full page rendered, and unmounting
    // every section to show placeholders for ~200ms collapses the layout and throws the Explore
    // grid up into view — far worse than the rail lagging by a beat. So the previous rail's
    // content is held until the new one lands.
    const heldPreviousRail = !inSession && contentRef.current !== null;

    if (inSession) setState({ content: inSession, status: 'ready' });
    else if (!heldPreviousRail) setState({ content: null, status: 'loading' });

    // Storage and network race to paint. `networkWon` is set ONLY on a successful fetch, so a
    // snapshot that resolves after a failed request still gets its turn — an offline launch must
    // show the last real content, not the bundled copy, and network errors resolve fast enough
    // to beat a disk read.
    let networkWon = false;

    if (!inSession) {
      void warmFromStorage().then(() => {
        const snapshot = lastKnown[gender];
        if (!snapshot || networkWon) return;
        settle({ content: snapshot, status: 'ready' });
      });
    }

    /** Nothing usable came back. Consult disk before conceding to the bundled copy. */
    const degrade = async () => {
      await warmFromStorage();
      const known = lastKnown[gender];
      settle(
        known
          ? { content: known, status: 'ready' }
          : { content: FALLBACK_CONTENT, status: 'fallback' },
      );
    };

    // First-launch safety net — see FIRST_PAINT_BUDGET_MS. Skipped when the previous rail is
    // being held: swapping a real page for the bundled copy mid-flip is a visible downgrade,
    // and the flip is not a first launch.
    const budget =
      FIRST_PAINT_BUDGET_MS > 0 && !inSession && !heldPreviousRail
        ? setTimeout(() => {
            if (networkWon || lastKnown[gender]) return;
            settle({ content: FALLBACK_CONTENT, status: 'fallback' });
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
        settle({ content: next, status: 'ready' });
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

  return state;
}

export type CmsSectionState = { section: CmsSection; status: CmsStatus };

/** One section, ready to render, plus the status the caller needs to choose a placeholder. */
export function useCmsSection(key: string, gender: CmsGender, city?: string | null): CmsSectionState {
  const { content, status } = useCmsContent(gender, city);
  const section = useMemo(() => selectSection(content, key, gender), [content, key, gender]);
  return { section, status };
}

export type CmsSectionsState = { sections: Record<string, CmsSection>; status: CmsStatus };

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
  const { content, status } = useCmsContent(gender, city);
  const keySignature = keys.join('|');
  const sections = useMemo(() => {
    const out: Record<string, CmsSection> = {};
    for (const key of keySignature.split('|')) out[key] = selectSection(content, key, gender);
    return out;
  }, [content, keySignature, gender]);
  return { sections, status };
}
