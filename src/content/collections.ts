// Editorial collections — the destination for every curated tile that used to
// dump the shopper into the generic catalog.
//
// WHY THIS FILE EXISTS
// The home page and its section pages are full of authored tiles: "The Coffee
// Run", "Five-minute fits.", "Built different.", the 60-minute delivery banner.
// Every one of them tapped through to `Categories` with a `label` param — and
// those labels are editorial copy, not category names, so the catalog had
// nothing to match on and showed an undifferentiated product list. Tapping
// "Built different." and tapping "The Coffee Run" landed on the same page.
//
// A collection here is a NAME the shopper understands mapped to a CONCRETE
// catalog query. Resolution order in CollectionScreen is:
//
//   1. `collection` — a real backend collection (`/catalog/collections/:slug`).
//      Verified to exist; these are curated server-side.
//   2. `categorySlugs` — real category slugs, fetched and merged in order.
//      These are the verified slugs from `/catalog/categories`.
//   3. `search` — free text, last resort.
//
// EDITORIAL NOTE — READ BEFORE TUNING
// The catalog has no notion of "coffee run"; that meaning exists only in the
// copy. So each mapping below is a judgement about what the tile PROMISES, and
// it is meant to be edited. Where a story carries CMS `tags` those drove the
// choice (e.g. The Coffee Run is tagged Casual/Tees/Denim → tees + denim);
// where a tile carries only a headline, the mapping is a best reading of it.
// Change the slugs, not the screen.

export type CollectionQuery = {
  /** Real backend collection slug. Tried first when present. */
  collection?: string;
  /** Real category slugs, merged in listed order. */
  categorySlugs?: string[];
  /** Free-text fallback when neither of the above fits. */
  search?: string;
  /** Pin to one side of the catalog; omit to follow the app's current gender. */
  gender?: 'her' | 'him';
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'rating';
};

export type CollectionDef = {
  /** Small label above the title. */
  kicker: string;
  title: string;
  blurb: string;
  query: CollectionQuery;
};

/**
 * Keyed by the CMS item key, which is stable across content edits — the
 * headline copy is not (an admin retitling "Built different." must not break
 * its destination).
 */
export const COLLECTIONS: Record<string, CollectionDef> = {
  // ── page.edit_him_features ────────────────────────────────────────────────
  'edit-him-feat-coffee': {
    kicker: 'THE COFFEE RUN',
    title: 'Five-minute fits.',
    blurb: 'Grab, throw on, go. The pieces that need no thinking about.',
    // Tee + denim + sneakers is the "five-minute fit" the copy describes.
    query: { categorySlugs: ['tops-tshirts', 'denim-jeans', 'shoes-sneakers'], gender: 'him' },
  },
  'edit-him-feat-closet': {
    kicker: 'CLOSET RESET',
    title: 'Built different.',
    blurb: 'Street-cut staples with some weight behind them.',
    // Real curated backend collection — Street Uniform is the him streetwear set.
    query: { collection: 'him-street-uniform', categorySlugs: ['outerwear-jackets', 'tops-tshirts', 'accessories-caps'], gender: 'him' },
  },

  // ── page.edit_her_features ────────────────────────────────────────────────
  'edit-her-feat-closet': {
    kicker: 'CLOSET REFRESH',
    title: 'New week, new closet.',
    blurb: 'The newest in, before it goes.',
    query: { collection: 'drop-monsoon-edit', categorySlugs: ['dresses', 'tops', 'coords'], gender: 'her', sort: 'newest' },
  },
  'edit-her-feat-friday': {
    kicker: 'FRIDAY FEELING',
    title: 'Off the clock.',
    blurb: 'Desk to dinner without going home first.',
    query: { collection: 'her-date-night-glam', categorySlugs: ['dresses-midi', 'shoes-heels', 'jewelry-necklaces'], gender: 'her' },
  },

  // ── home.reels_banner — the 60-minute delivery banner ─────────────────────
  // Delivery speed is not a catalog filter, so this shows the freshest stock
  // rather than pretending to a "deliverable in 60 minutes" query the backend
  // cannot answer.
  'sixty-minute': {
    kicker: '60-MINUTE DELIVERY',
    title: 'Ready in an hour.',
    blurb: 'In stock now and out the door fast.',
    query: { categorySlugs: ['tops-tshirts', 'denim-jeans', 'shoes-sneakers', 'tops'], sort: 'newest' },
  },
};

export function getCollection(key: string | undefined | null): CollectionDef | null {
  return (key && COLLECTIONS[key]) || null;
}
