// Public catalog browse — categories, products, collections, brands.
//
// These endpoints live under /api/v1/catalog/* and require NO auth (see backend
// src/modules/catalog/*). The consumer app composes its Home + Category screens
// from them; there is no server-side /home aggregation.
//
// The backend product/category/collection shapes are richer and differently
// named than the app's flat mock types (src/data/mockData.ts). To avoid touching
// every card/detail component, each fetcher is paired with an adapter that maps
// the backend shape onto the existing mock type. Screens keep consuming the
// same `Product`/`Category`/`Brand`/`Bundle`/`Occasion` shapes they always have.

import { request, cachedGet } from './api';
import { sizedImage, IMG } from './images';
import type { Product, Category, Brand, Bundle, Occasion } from '../data/mockData';

export type Gender = 'her' | 'him' | 'unisex';

// ── Backend response shapes (only the fields we consume) ──────────────────────

interface ApiCategory {
  id: string;
  slug: string;
  label: string;
  /** HIM-rail wording for a shared node: "Shoes" on HER, "Footwear" on HIM. */
  labelHim: string | null;
  parentId: string | null;
  iconName: string | null;
  tintColor: string | null;
  imageUrl: string | null;
  gender: Gender;
  sortOrder: number;
  /** HIM-rail position for a shared node; null when both rails order it alike. */
  sortOrderHim: number | null;
  isActive: boolean;
  /** Computed server-side: true when nothing sits under it. */
  isLeaf: boolean;
  /** Descendant-inclusive; only present when the request asked for counts. */
  listingCount?: number;
}

interface ApiVariant {
  id: string;
  groupId: string | null;
  attributes: Record<string, string> | null;
  label: string;
  imageUrls: string[];
  pricePaise: number;
  compareAtPricePaise: number | null;
  discountPct: number | null;
  available: number;
}

interface ApiGroup {
  id: string;
  name: string;
  colorHex: string | null;
  isDefault: boolean;
}

interface ApiProduct {
  id: string;
  name: string;
  description: string | null;
  /** Rich-text long description (sanitized HTML). Only shipped by the detail endpoint. */
  descriptionLong?: string | null;
  gender: Gender;
  /** How the retailer sells it: one SKU, colour/size, or custom option axes. */
  variantMode?: 'single' | 'color_size' | 'custom' | null;
  galleryUrls: string[];
  occasion: string[] | null;
  brand: { id: string; name: string } | null;
  category: { id: string; label: string; slug: string } | null;
  store: { id: string; legalName: string } | null;
  ratingAvg: number;
  ratingCount: number;
  groups: ApiGroup[];
  variants: ApiVariant[];
}

interface ApiCollection {
  id: string;
  slug: string;
  name: string;
  kind: 'outfit' | 'occasion' | 'drop' | 'edit' | 'trend' | 'brand';
  gender: Gender;
  heroImageUrl: string | null;
  accentColors: string[] | null;
  listingCount: number;
  pricePaise: number;
}

interface ApiBrand {
  id: string;
  slug: string;
  name: string;
  tintColor: string | null;
  logoUrl: string | null;
  domain: string | null;
  isActive: boolean;
}

// ── Query helper ──────────────────────────────────────────────────────────────

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

// ── Adapters: backend shape → app mock type ───────────────────────────────────

const FALLBACK_COLORS: [string, string] = ['#f3f3f3', '#e5e5e5'];
const rupees = (paise: number) => Math.round(paise / 100);

/** Pick the first in-stock variant, else the first variant. */
function pickVariant(p: ApiProduct): ApiVariant | undefined {
  return p.variants.find((v) => v.available > 0) ?? p.variants[0];
}

/** Colour swatch for a product card: the chosen variant's group colour, else any group colour. */
function productColors(p: ApiProduct, v?: ApiVariant): [string, string] {
  const groupHex = v?.groupId ? p.groups.find((g) => g.id === v.groupId)?.colorHex : undefined;
  const anyHex = p.groups.find((g) => g.colorHex)?.colorHex;
  const hex = groupHex ?? anyHex;
  return hex ? [hex, hex] : FALLBACK_COLORS;
}

/** The slim grid projection returned by `/catalog/products?view=card`. */
export type ApiCard = {
  id: string;
  name: string;
  brandName: string;
  categoryLabel: string;
  ratingAvg: number;
  ratingCount: number;
  image: string | null;
  pricePaise: number;
  compareAtPricePaise: number | null;
  discountPct: number;
  colors: string[];
  occasion: string | null;
  defaultVariantId: string;
};

/** Only the card projection carries a top-level numeric `pricePaise`. */
function isCard(row: ApiCard | ApiProduct): row is ApiCard {
  return typeof (row as ApiCard).pricePaise === 'number';
}

/** Card payload → the app's Product shape. Same output as `toProduct`, a tenth the input. */
export function cardToProduct(c: ApiCard): Product {
  const price = rupees(c.pricePaise);
  return {
    id: c.id,
    brand: c.brandName || 'TRENDZO',
    name: c.name,
    price,
    original: c.compareAtPricePaise ? rupees(c.compareAtPricePaise) : price,
    rating: c.ratingAvg ?? 0,
    ratingCount: c.ratingCount ?? 0,
    colors: c.colors.length ? (c.colors.length === 1 ? [c.colors[0]!, c.colors[0]!] : [c.colors[0]!, c.colors[1]!]) : FALLBACK_COLORS,
    // Card-sized rendition — the raw Cloudinary originals are ~1.5 MB each.
    img: sizedImage(c.image ?? undefined, IMG.card),
    category: c.categoryLabel ?? '',
    // `occasion` is a plain string in this projection, but be tolerant — a
    // mismatched backend version must degrade to "no tag", never throw.
    tag: c.discountPct > 0
      ? `${c.discountPct}% OFF`
      : (typeof c.occasion === 'string' ? c.occasion.toUpperCase() : undefined),
    variantId: c.defaultVariantId,
  };
}

export function toProduct(p: ApiProduct): Product {
  const v = pickVariant(p);
  const price = v ? rupees(v.pricePaise) : 0;
  const original = v?.compareAtPricePaise ? rupees(v.compareAtPricePaise) : price;
  const discount = v?.discountPct ?? 0;
  return {
    id: p.id,
    brand: p.brand?.name ?? p.store?.legalName ?? 'TRENDZO',
    name: p.name,
    price,
    original,
    rating: p.ratingAvg ?? 0,
    ratingCount: p.ratingCount ?? 0,
    colors: productColors(p, v),
    // Card-sized rendition — the raw Cloudinary originals are ~1.5 MB each.
    img: sizedImage(v?.imageUrls?.[0] ?? p.galleryUrls?.[0], IMG.card),
    category: p.category?.label ?? '',
    tag: discount > 0 ? `${discount}% OFF` : p.occasion?.[0]?.toUpperCase(),
  };
}

export function toCategory(c: ApiCategory): Category {
  return {
    id: c.id, // backend id — used to filter products on the Category screen
    label: c.label,
    icon: c.iconName ?? 'grid-outline',
    tint: c.tintColor ?? '#eeeeee',
    img: sizedImage(c.imageUrl, IMG.card),
  };
}

/** A category as the browse rail needs it: identity, sub-tiles, and how full it is. */
export type CategoryNode = Category & {
  slug: string;
  parentId: string | null;
  isLeaf: boolean;
  listingCount: number;
  children: CategoryNode[];
};

/**
 * The tree is stored once and rendered per rail. A node shared by both rails (Tops, Denim)
 * is `unisex` and can carry HIM-specific wording and position; a node only one rail has
 * (Dresses, Ethnic Wear) is gendered. `rail` picks which of the two readings applies.
 */
const railLabel = (c: ApiCategory, rail: Gender) =>
  rail === 'him' ? (c.labelHim ?? c.label) : c.label;
const railSort = (c: ApiCategory, rail: Gender) =>
  rail === 'him' ? (c.sortOrderHim ?? c.sortOrder) : c.sortOrder;

export function toBrand(b: ApiBrand): Brand {
  return {
    id: b.id,
    name: b.name.toUpperCase(),
    tint: b.tintColor ?? '#111111',
    logo: sizedImage(b.logoUrl, IMG.thumb),
    domain: b.domain ?? '',
  };
}

export function toBundle(c: ApiCollection): Bundle {
  const a = c.accentColors ?? [];
  const colors: [string, string, string] = [a[0] ?? '#f5e6d3', a[1] ?? '#ffe0b2', a[2] ?? '#c9a87c'];
  return {
    id: c.id,
    title: c.name,
    price: rupees(c.pricePaise),
    pieces: c.listingCount,
    colors,
    img: sizedImage(c.heroImageUrl, IMG.card),
  };
}

export function toOccasion(c: ApiCollection): Occasion {
  const a = c.accentColors ?? [];
  const colors: [string, string] = [a[0] ?? '#fff5e1', a[1] ?? '#ffe0b2'];
  return { id: c.id, label: c.name, colors, img: sizedImage(c.heroImageUrl, IMG.card) };
}

// ── Fetchers (already mapped to app types) ────────────────────────────────────

export async function listCategories(gender?: Gender): Promise<Category[]> {
  // Cached: the rail is re-requested on every gender flip and every remount.
  const data = await cachedGet<ApiCategory[]>(
    `/catalog/categories${qs({ gender, activeOnly: true })}`,
    { auth: false, ttlMs: 5 * 60_000 },
  );
  return data.map(toCategory);
}

/**
 * The browse taxonomy for one rail: top-level categories, each with its sub-categories,
 * ordered the way that rail is designed and carrying product counts so the screen can
 * skip anything empty. The backend returns the tree flat with `parentId`; assembling it
 * here keeps the endpoint cacheable and matches what the admin dashboard already does.
 */
export async function listCategoryTree(gender: Gender, signal?: AbortSignal): Promise<CategoryNode[]> {
  // withCounts is the expensive aggregate variant, and HER→HIM→HER used to
  // fire it three times for data already on the device. Cached + de-duplicated.
  const data = await cachedGet<ApiCategory[]>(
    `/catalog/categories${qs({ gender, activeOnly: true, withCounts: true })}`,
    { auth: false, ttlMs: 5 * 60_000, ...(signal ? { signal } : {}) },
  );

  const toNode = (c: ApiCategory): CategoryNode => ({
    ...toCategory(c),
    label: railLabel(c, gender),
    slug: c.slug,
    parentId: c.parentId,
    isLeaf: c.isLeaf,
    listingCount: c.listingCount ?? 0,
    children: [],
  });

  const byId = new Map(data.map((c) => [c.id, toNode(c)]));
  const roots: CategoryNode[] = [];
  for (const c of data) {
    const node = byId.get(c.id)!;
    // A child whose parent was filtered out by gender would otherwise vanish; there are
    // none today (a gendered leaf always sits under a shared or same-gender parent), but
    // promoting it to a root beats dropping it silently.
    const parent = c.parentId ? byId.get(c.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const order = new Map(data.map((c) => [c.id, railSort(c, gender)]));
  const bySort = (a: CategoryNode, b: CategoryNode) =>
    (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0);
  roots.sort(bySort);
  for (const r of roots) r.children.sort(bySort);
  return roots;
}

export async function listProducts(opts: {
  gender?: Gender;
  categoryId?: string;
  /** Slug of a category; a parent returns everything in its sub-categories. */
  categorySlug?: string;
  search?: string;
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'rating';
  limit?: number;
  offset?: number;
  /** Abort when the screen unmounts or its parameters change. */
  signal?: AbortSignal;
} = {}): Promise<Product[]> {
  // view=card asks the backend for the ~9 fields a grid tile draws instead of the
  // full detail shape. The list endpoint used to return the SAME payload as
  // product detail, so a 60-item grid downloaded every variant of every product
  // (24 variant objects for a 4-colour x 6-size item) and JSON.parsed the lot on
  // the JS thread to show one price.
  //
  // CLAMPED TO THE DOCUMENTED CONTRACT (docs/home-api-integration.md §4.1/§4.8):
  // `search` is 1–120 chars and `limit` is 1–100 — exceed either and the whole
  // request comes back 422 `validation_error` instead of results. Clamping here,
  // at the one choke point every grid in the app goes through, means a pasted
  // paragraph in the search box degrades to a search on its first 120 characters
  // rather than an error screen. An empty/whitespace search is dropped entirely,
  // since `search=` would fail the 1-char minimum.
  const search = opts.search?.trim().slice(0, 120) || undefined;
  const limit = Math.min(100, Math.max(1, Math.trunc(opts.limit ?? 50)));
  const data = await cachedGet<(ApiCard | ApiProduct)[]>(
    `/catalog/products${qs({
      gender: opts.gender,
      categoryId: opts.categoryId,
      categorySlug: opts.categorySlug,
      search,
      sort: opts.sort,
      view: 'card',
      limit,
      offset: opts.offset,
    })}`,
    // Short TTL: a sort tap re-queries the same category, and going back to a
    // listing should not refetch 60 products.
    { auth: false, ttlMs: 60_000, ...(opts.signal ? { signal: opts.signal } : {}) },
  );
  // Shape-detect instead of assuming. `view=card` is a NEWER backend parameter,
  // and zod silently drops query params it does not know — so an older deployment
  // accepts the request and answers with the FULL listing shape. Mapping that
  // with cardToProduct produced undefined prices and images, and threw on
  // `occasion` (a string[] there, a string here), which surfaced as the whole
  // screen falling back to mock products.
  return data.map((row) => (isCard(row) ? cardToProduct(row) : toProduct(row as ApiProduct)));
}

export async function getProduct(id: string): Promise<Product> {
  const p = await request<ApiProduct>(`/catalog/products/${encodeURIComponent(id)}`, { auth: false });
  return toProduct(p);
}

// ── Rich product detail (variants / sizes / colours / gallery) + reviews ──────

export type ProductVariant = {
  id: string;
  size: string;
  color: string;
  groupId: string | null;
  price: number; // rupees
  original: number; // rupees
  discountPct: number;
  available: number;
  img: string;
  /**
   * True when `img` came from THIS variant rather than the listing gallery.
   *
   * `img` always resolves to something so cards never render a hole, which means
   * its presence says nothing about whether the variant has a picture of its own.
   * Try-on needs that distinction: offering a "variant" whose thumbnail is really
   * the default image would show the shopper two identical choices that produce
   * the same result.
   */
  hasOwnImage: boolean;
};

export type ProductDetailData = Product & {
  listingId: string;
  /** Drives the size-scale lookup when the variants carry no size attribute. */
  categoryId: string | null;
  description: string;
  gallery: string[];
  /**
   * The listing's own default image (galleryUrls[0]), NOT gallery[0].
   *
   * `gallery` is deliberately variant-first — its head is the cheapest/in-stock
   * variant's picture so the card→detail zoom lands on the same image the
   * shopper tapped. That makes gallery[0] the wrong thing to show anywhere the
   * *listing default* is meant, most importantly try-on: the backend resolves a
   * request with no variantId to galleryUrls[0], so previewing gallery[0] would
   * show one photo and generate from another — while that variant ALSO appears
   * as its own option, giving two identical-looking buttons with different
   * results. Empty string when the listing has no gallery image at all.
   */
  defaultImage: string;
  sizes: string[];
  swatches: { groupId: string; name: string; hex: string | null }[];
  /** 'single' means there is no colour or size axis to offer at all. */
  variantMode: 'single' | 'color_size' | 'custom';
  variants: ProductVariant[];
  ratingCount: number;
  /** Live average over visible (verified + active) reviews. 0 when there are none. */
  ratingAvg: number;
  /** Sanitized rich-text HTML long description; '' when the listing has none. */
  descriptionLong: string;
};

export type Review = {
  id: string;
  author: string;
  rating: number;
  body: string;
  createdAt: string;
  /** Only verified-purchase reviews are returned publicly; drives the badge. */
  verifiedPurchase: boolean;
};

export type SizeScale = {
  id: string;
  name: string;
  values: string[];
  categorySlugs: string[];
  sortOrder: number;
  isActive: boolean;
};

/**
 * Size options for a category — footwear gets UK numbers, belts get inches,
 * apparel gets letters. Only needed as a FALLBACK: a product whose variants
 * carry size attributes already tells us its real sizes. Without this the
 * fallback was a hardcoded ['XS','S','M','L','XL'] shown even on shoes.
 */
export const listSizeScales = (categoryId?: string) =>
  cachedGet<SizeScale[]>(`/catalog/size-scales${qs({ categoryId })}`, {
    auth: false,
    ttlMs: 60 * 60_000,
  });

/** Full product page data — variants, distinct sizes, colour swatches, gallery. */
export async function getProductDetail(id: string): Promise<ProductDetailData> {
  const p = await request<ApiProduct>(`/catalog/products/${encodeURIComponent(id)}`, { auth: false });
  const base = toProduct(p);
  // The DETAIL gallery renders near full-width — request hero-sized renditions
  // there (cards elsewhere use the smaller IMG.card rendition via toProduct).
  const variants: ProductVariant[] = p.variants.map((v) => ({
    id: v.id,
    size: v.attributes?.size ?? v.label ?? 'One Size',
    color: v.attributes?.color ?? '',
    groupId: v.groupId,
    price: rupees(v.pricePaise),
    original: v.compareAtPricePaise ? rupees(v.compareAtPricePaise) : rupees(v.pricePaise),
    discountPct: v.discountPct ?? 0,
    available: v.available,
    img: sizedImage(v.imageUrls?.[0] ?? p.galleryUrls?.[0], IMG.hero),
    hasOwnImage: Boolean(v.imageUrls?.[0]),
  }));
  const sizes = Array.from(new Set(variants.map((v) => v.size).filter(Boolean)));
  const swatches = p.groups
    .filter((g) => g.colorHex || !g.isDefault)
    .map((g) => ({ groupId: g.id, name: g.name, hex: g.colorHex }));
  // Merge gallery + variant images from the RAW urls (dedup), then map every
  // entry to the hero rendition. The card image's raw url stays first so the
  // zoom-in transition lands on the same picture.
  const rawCard = pickVariant(p)?.imageUrls?.[0] ?? p.galleryUrls?.[0] ?? '';
  const merged = [rawCard, ...(p.galleryUrls ?? []), ...p.variants.map((v) => v.imageUrls?.[0] ?? '')]
    .filter(Boolean)
    .filter((u, i, a) => a.indexOf(u) === i)
    .map((u) => sizedImage(u, IMG.hero));
  return {
    ...base,
    listingId: p.id,
    categoryId: p.category?.id ?? null,
    description: p.description ?? '',
    descriptionLong: p.descriptionLong ?? '',
    gallery: merged.length ? merged.slice(0, 6) : (typeof base.img === 'string' ? [base.img] : []),
    // Mirrors the backend's own default resolution (galleryUrls[0]); '' when the
    // listing has none, which is the same condition that makes try-on 422.
    defaultImage: p.galleryUrls?.[0] ? sizedImage(p.galleryUrls[0], IMG.hero) : '',
    sizes,
    swatches,
    /**
     * The retailer's declared mode, or inferred when the backend has not shipped
     * `variantMode` yet (a rolling deploy guarantees the app is sometimes newer).
     *
     * Do NOT blanket-default to 'single' — that would strip the size and colour
     * pickers off genuinely multi-variant products the moment the field is
     * missing. Infer instead: a product is a single only when it truly presents
     * one variant with nothing to choose between.
     */
    variantMode:
      p.variantMode ??
      (variants.length <= 1 && swatches.length === 0 && sizes.length <= 1 ? 'single' : 'color_size'),
    variants,
    ratingCount: p.ratingCount ?? 0,
    ratingAvg: p.ratingAvg ?? 0,
  };
}

export async function listReviews(id: string): Promise<Review[]> {
  return request<Review[]>(`/catalog/products/${encodeURIComponent(id)}/reviews`, { auth: false });
}

/**
 * Write a product review (requireAuth('consumer')). POST /consumer/community/reviews.
 * `listingId` in the body, `rating` 1–5 required, `body` optional (not `text`),
 * `media` optional image URLs. Appears in listReviews immediately.
 */
export async function addReview(
  listingId: string,
  body: { rating: number; body?: string; orderId?: string; media?: string[] },
): Promise<{ id: string; verifiedPurchase: boolean }> {
  return request<{ id: string; verifiedPurchase: boolean }>('/consumer/community/reviews', {
    method: 'POST',
    body: { listingId, ...body },
  });
}

/** True when an id looks like a real backend listing id (`lst_…`). */
export function isBackendListingId(id?: string): boolean {
  return !!id && id.startsWith('lst_');
}

export async function listBundles(gender?: Gender): Promise<Bundle[]> {
  const data = await request<ApiCollection[]>(
    `/catalog/collections${qs({ kind: 'outfit', gender })}`,
    { auth: false },
  );
  return data.map(toBundle);
}

export async function listOccasions(gender?: Gender): Promise<Occasion[]> {
  const data = await request<ApiCollection[]>(
    `/catalog/collections${qs({ kind: 'occasion', gender })}`,
    { auth: false },
  );
  return data.map(toOccasion);
}

/**
 * The products inside one collection, by slug.
 *
 * `GET /catalog/collections/:slug` returns the collection plus its `listings`,
 * shaped exactly like `/catalog/products` — occasion and brand collections
 * auto-resolve from the live catalog server-side, so this is a real answer to
 * "what can I actually wear to a wedding", not a curated guess.
 *
 * Returns an empty array when no such collection exists (404), so a caller can
 * fall back to a plain browse instead of surfacing an error the shopper cannot
 * act on.
 */
export async function listCollectionProducts(slug: string): Promise<Product[]> {
  try {
    const data = await cachedGet<{ listings?: (ApiCard | ApiProduct)[] }>(
      `/catalog/collections/${encodeURIComponent(slug)}`,
      { auth: false, ttlMs: 60_000 },
    );
    const rows = data?.listings ?? [];
    return rows.map((row) => (isCard(row) ? cardToProduct(row) : toProduct(row as ApiProduct)));
  } catch {
    return [];
  }
}

export async function listBrands(): Promise<Brand[]> {
  const data = await cachedGet<ApiBrand[]>(`/catalog/brands`, { auth: false, ttlMs: 10 * 60_000 });
  return data.map(toBrand);
}

/** True when an id looks like a real backend category id (`cat_…`), not a
 *  pseudo home-rail id like 'flash' / 'trending' / 'all'. */
export function isBackendCategoryId(id?: string): boolean {
  return !!id && id.startsWith('cat_');
}

/* ── Facets ───────────────────────────────────────────────────────────────────
 *
 * `/catalog/facets` per docs/home-api-integration.md §4.9 — the counts behind a
 * result total and a filter sheet.
 *
 * Each facet EXCLUDES its own dimension (standard faceted-search rule), which is
 * what lets one call answer both "which genders exist in this category" and
 * "which categories exist for this gender".
 *
 * `total` is the honest result count for the current filters. Grids that show
 * `products.length` are really showing "how many I fetched", which is capped by
 * `limit` — 40 items in a 400-item category reads as 40.
 *
 * CAVEAT, stated in the controller: facet counts do NOT drop listings whose
 * variants are all sold out, so a count can read a hair higher than the grid.
 * Fine for "about this many"; do not use it to assert an exact grid length.
 */
export type Facets = {
  total: number;
  genders: { gender: Gender; count: number }[];
  categories: { categoryId: string; label: string; slug: string; count: number }[];
};

const EMPTY_FACETS: Facets = { total: 0, genders: [], categories: [] };

/**
 * Counts for the current filter set. Never throws — a facet strip is decoration
 * over the grid, and a failed count must not take the products down with it.
 */
export async function getFacets(opts: {
  gender?: Gender;
  categoryId?: string;
  categorySlug?: string;
  storeId?: string;
  search?: string;
  signal?: AbortSignal;
} = {}): Promise<Facets> {
  // Same 1–120 clamp as listProducts — §4.9 shares the constraint.
  const search = opts.search?.trim().slice(0, 120) || undefined;
  try {
    return await cachedGet<Facets>(
      `/catalog/facets${qs({
        gender: opts.gender,
        categoryId: opts.categoryId,
        categorySlug: opts.categorySlug,
        storeId: opts.storeId,
        search,
      })}`,
      { auth: false, ttlMs: 60_000, ...(opts.signal ? { signal: opts.signal } : {}) },
    );
  } catch {
    return EMPTY_FACETS;
  }
}

/* ── Stores ───────────────────────────────────────────────────────────────────
 *
 * `/catalog/stores/*` per docs/home-api-integration.md §5B. The projection is a
 * server-side WHITELIST — GSTIN, PAN, legal entity, fees, payout cadence and
 * suspension reasons are never exposed, so everything here is safe to render.
 *
 * Only stores a shopper can actually buy from come back: `active`, or `paused`
 * with a visible pause. Suspended, terminated and paused-hidden stores vanish.
 */

/**
 * A weekly opening template, keyed `mon`…`sun`.
 *
 * THE DOC AND THE DEPLOYED API DISAGREE HERE. docs/home-api-integration.md §5B
 * documents an array form:
 *     { mon: [ { open: "10:00", close: "21:00" } ] }
 * but the live backend actually returns a per-day object:
 *     { mon: { from: "10:00", to: "21:00", closed: false } }
 * (verified against /catalog/stores/nearby). Both are accepted so whichever the
 * deployment serves, the screen renders — read them through `dayHours()` below
 * rather than indexing the raw shape.
 */
export type DayHours =
  | { open: string; close: string }
  | { from: string; to: string; closed?: boolean };
export type OpeningHours = Record<string, DayHours | DayHours[]> | null;

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

/**
 * Today's opening window, normalised across both shapes above.
 * Returns null when closed today, or when the store has no template at all.
 */
export function dayHours(
  hours: OpeningHours,
  dayIndex: number = new Date().getDay(),
): { from: string; to: string } | null {
  if (!hours) return null;
  const raw = hours[DAY_KEYS[dayIndex % 7]!];
  if (!raw) return null;
  const entry = Array.isArray(raw) ? raw[0] : raw;
  if (!entry) return null;
  if ('closed' in entry && entry.closed) return null;
  const from = 'from' in entry ? entry.from : entry.open;
  const to = 'to' in entry ? entry.to : entry.close;
  return from && to ? { from, to } : null;
}

export type Store = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  phone: string | null;
  openingHours: OpeningHours;
  images: string[];
  /** Great-circle km, rounded to 0.1. Only present on `nearby` rows. */
  distanceKm?: number;
};

/**
 * Stores near a coordinate, nearest first.
 *
 * `lat`/`lng` are REQUIRED by the server — there is no "just show me any store"
 * form, which is why the screen has to resolve a location (or ask for one)
 * before it can call this at all. `radiusKm` caps at 50 and `limit` at 50;
 * exceeding either is a 422, so both are clamped here.
 */
export async function listNearbyStores(opts: {
  lat: number;
  lng: number;
  radiusKm?: number;
  limit?: number;
  signal?: AbortSignal;
}): Promise<Store[]> {
  const radiusKm = Math.min(50, Math.max(0.1, opts.radiusKm ?? 15));
  const limit = Math.min(50, Math.max(1, Math.trunc(opts.limit ?? 20)));
  return cachedGet<Store[]>(
    `/catalog/stores/nearby${qs({ lat: opts.lat, lng: opts.lng, radiusKm, limit })}`,
    // Short TTL: a shopper re-opening the picker within a minute has not moved.
    { auth: false, ttlMs: 60_000, ...(opts.signal ? { signal: opts.signal } : {}) },
  );
}

/**
 * One store. Returns null on 404 rather than throwing — an unknown, suspended
 * or paused-hidden store is a normal outcome the caller renders as "no longer
 * available", not an error screen.
 */
export async function getStore(id: string): Promise<Store | null> {
  try {
    return await cachedGet<Store>(
      `/catalog/stores/${encodeURIComponent(id)}`,
      { auth: false, ttlMs: 5 * 60_000 },
    );
  } catch {
    return null;
  }
}
