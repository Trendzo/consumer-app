// Resolving a CMS item's media and copy.
//
// Hand-written and kept separate from `assets.registry.ts`, which is generated — regenerating
// the registry must never clobber logic.
//
// The hybrid rule is the whole point of the CMS's media model: an uploaded `imageUrl` wins,
// otherwise the bundled art named by `assetKey` is used. That means today's home renders from
// the app binary exactly as fast as it does now, while anything an admin uploads takes effect
// without a release.

import { ASSET_REGISTRY } from './assets.registry';
import { IMG, sizedImage } from '../services/images';
import type { CmsItem } from './types';

/** What `CachedImage` accepts: a bundled module id, or a remote source. */
export type MediaSource = number | { uri: string };

/** Bundled art for a key, or null when the key names something this build does not ship. */
export function resolveAsset(assetKey: string | null | undefined): number | null {
  if (!assetKey) return null;
  return ASSET_REGISTRY[assetKey] ?? null;
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
