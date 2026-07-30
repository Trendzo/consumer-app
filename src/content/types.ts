// Shape of the Home CMS payload.
//
// Mirrors `backend/src/shared/cms/render.ts` (PublicSection / PublicItem). There is no shared
// package across the four repos — the portal keeps its own copy in `src/lib/types.ts` and this
// is the app's — so when a field is added to the payload it has to be added in all three.
//
// The same shape is what `home.content.json` holds, which is the point: the bundled file is a
// drop-in substitute for a server response, not a second format that needs converting.

/** Where a tile navigates. `route` is a screen name registered in RootNav. */
export type CmsLink = {
  route: string;
  params?: Record<string, string | number | boolean>;
};

export type CmsItem = {
  /** Stable identifier, unique within its section. React keys and analytics both use it. */
  key: string;
  /**
   * Present ONLY in the bundled fallback file, which carries every audience because it has no
   * request to filter against. A server response has already been filtered, so the field is
   * absent there and `useCmsSection` treats "no gender" as "keep it".
   */
  gender?: 'her' | 'him' | 'all';
  /** Bundled art registry key. Resolved locally through content/media.ts. */
  assetKey: string | null;
  /** Uploaded art. Takes precedence over assetKey. */
  imageUrl: string | null;
  videoUrl: string | null;
  link: CmsLink | null;
  /** Per-widget copy. Read through the typed helpers in content/media.ts, never blindly. */
  content: Record<string, unknown>;
};

export type CmsSection = {
  key: string;
  type: string;
  title: string | null;
  subtitle: string | null;
  kicker: string | null;
  ctaLabel: string | null;
  config: Record<string, unknown>;
  items: CmsItem[];
};

export type HomeContent = {
  schemaVersion: number;
  /** Publication number the server served, or null for the bundled fallback. */
  version: number | null;
  sections: CmsSection[];
};
