// Resolving a CMS item's media and copy.
//
// Hand-written and kept separate from `assets.registry.ts`, which is generated — regenerating
// the registry must never clobber logic.
//
// The hybrid rule is the whole point of the CMS's media model: an uploaded `imageUrl` wins,
// otherwise the bundled art named by `assetKey` is used. That means today's home renders from
// the app binary exactly as fast as it does now, while anything an admin uploads takes effect
// without a release.

import { useRef } from 'react';
import { ASSET_REGISTRY } from './assets.registry';
import { IMG, sizedImage } from '../services/images';
import type { CmsItem } from './types';

/**
 * The current list, or the last non-empty one seen.
 *
 * A section that renders `null` when its items are empty *unmounts*, and unmounting several
 * sections at once collapses the page height. Two visible consequences, both reported: the HER↔HIM
 * flip blanks and then hard-cuts instead of animating, and the product zoom's return flight lands
 * in the wrong place because the card moved after its frame was measured.
 *
 * Holding the previous items keeps the layout stable through the gap, so there is always something
 * to animate FROM. A ref rather than state: this must not trigger its own render, and the value is
 * only ever read during the render that needs it.
 */
export function useLastNonEmpty<T>(items: T[]): T[] {
  const held = useRef<T[]>(items);
  if (items.length > 0) held.current = items;
  return items.length > 0 ? items : held.current;
}

/** What `CachedImage` accepts: a bundled module id, or a remote source. */
export type MediaSource = number | { uri: string };

/**
 * TEMPORARY remap — the backend CMS still names the old explore-grid art; the
 * refreshed photos ship in this build under assets/models/. Until the CMS rows
 * are updated to the new keys (at which point they resolve directly and this
 * map is dead weight to delete), the old keys land on the new art. These six
 * keys are used nowhere else in the served content, so the remap is exact.
 */
const ASSET_KEY_REMAP: Record<string, string> = {
  // Bags (her) — the old matching-set art (girl with bag) suits Bags; single
  // hop, so this resolves the registry's numbered/4, not the remapped one.
  'github-import/numbered/3': 'github-import/numbered/4',
  'github-import/numbered/4': 'models/matching-set',   // Matching Sets (her)
  'github-import/numbered/5': 'models/tanks',          // Everyday Tanks (her)
  'github-import/numbered/7': 'models/skirt',          // Mini Skirts (her)
  'github-import/numbered-men/2': 'models/graphic-tshirt', // Graphic Tees (him)
  'github-import/numbered-men/3': 'models/sneakers',   // Sneakers (him)
  'github-import/numbered-men/7': 'models/cargos',     // Cargos (him)
};

/** Bundled art for a key, or null when the key names something this build does not ship. */
export function resolveAsset(assetKey: string | null | undefined): number | null {
  if (!assetKey) return null;
  const key = ASSET_KEY_REMAP[assetKey] ?? assetKey;
  return ASSET_REGISTRY[key] ?? null;
}

/**
 * An item's image. Returns null when the item has neither — callers must hide the tile rather
 * than render an empty frame, because a missing key usually means the app is older than the
 * content (an admin uploaded nothing and named art added after this build shipped).
 */
export function resolveMedia(
  item: Pick<CmsItem, 'assetKey' | 'imageUrl'> | null | undefined,
  px: number = IMG.card,
): MediaSource | null {
  if (!item) return null;
  if (item.imageUrl) return { uri: sizedImage(item.imageUrl, px) };
  const bundled = resolveAsset(item.assetKey);
  return bundled === null ? null : bundled;
}

/** An item's video: uploaded clip first, then a bundled clip named by assetKey. */
export function resolveVideo(
  item: Pick<CmsItem, 'assetKey' | 'videoUrl'> | null | undefined,
): MediaSource | null {
  if (!item) return null;
  if (item.videoUrl) return { uri: item.videoUrl };
  const bundled = resolveAsset(item.assetKey);
  return bundled === null ? null : bundled;
}

/**
 * Filter predicate that also narrows the type: `.filter(withSource)` drops entries whose art
 * could not be resolved AND tells TypeScript the survivors have one. Used everywhere a rail
 * maps CMS items to renderable tiles, because a plain `x.source !== null` arrow does not narrow.
 */
export function withSource<T extends { source: MediaSource | null }>(
  x: T,
): x is T & { source: MediaSource } {
  return x.source !== null;
}

/** Resolve a bare asset key or URL pair, for section-level art (backgrounds, posters). */
export function resolveConfigMedia(
  config: Record<string, unknown>,
  assetKeyField: string,
  urlField: string,
  px: number = IMG.hero,
): MediaSource | null {
  const url = config[urlField];
  if (typeof url === 'string' && url) return { uri: sizedImage(url, px) };
  const key = config[assetKeyField];
  return typeof key === 'string' ? resolveAsset(key) : null;
}

// ─── Typed reads out of the `content` / `config` bags ─────────────────────────
//
// `content` is Record<string, unknown> on purpose — one table holds twenty widget shapes — so
// every read goes through these rather than a cast. A missing or wrong-typed field falls back
// instead of crashing a screen, which matters most in exactly the case these exist for: an app
// older than the content it is being served.

export function str(bag: Record<string, unknown> | undefined, key: string, fallback = ''): string {
  const v = bag?.[key];
  return typeof v === 'string' ? v : fallback;
}

export function num(
  bag: Record<string, unknown> | undefined,
  key: string,
  fallback: number,
): number {
  const v = bag?.[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/**
 * The price ceiling a deal tile advertises, in PAISE — or null when it names none.
 *
 * Steals tiles say "Under ₹999" / "₹1499" in a `priceLine` string but carry no
 * machine-readable ceiling, so tapping one could only ever land on the generic
 * "All deals" band. This reads an authored `maxPaise` when the CMS grows one,
 * and otherwise recovers the number from the copy.
 *
 * Digits only, so "Under ₹1,499" and "₹1499" both give 149900. Returns null
 * rather than 0 for a tile with no price at all — 0 would read as a real
 * ceiling and filter the grid down to nothing.
 */
export function priceCeilingPaise(bag: Record<string, unknown> | undefined): number | null {
  const authored = bag?.maxPaise;
  if (typeof authored === 'number' && Number.isFinite(authored) && authored > 0) return authored;
  const line = str(bag, 'priceLine');
  const digits = line.replace(/[^0-9]/g, '');
  if (!digits) return null;
  const rupees = Number(digits);
  return Number.isFinite(rupees) && rupees > 0 ? rupees * 100 : null;
}

export function strList(bag: Record<string, unknown> | undefined, key: string): string[] {
  const v = bag?.[key];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/** A hex colour, or the fallback when unset or malformed. */
export function color(
  bag: Record<string, unknown> | undefined,
  key: string,
  fallback: string,
): string {
  const v = bag?.[key];
  return typeof v === 'string' && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v) ? v : fallback;
}
