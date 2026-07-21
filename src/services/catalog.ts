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

import { request } from './api';
import { sizedImage, IMG } from './images';
import type { Product, Category, Brand, Bundle, Occasion } from '../data/mockData';

export type Gender = 'her' | 'him' | 'unisex';

// ── Backend response shapes (only the fields we consume) ──────────────────────

interface ApiCategory {
  id: string;
  slug: string;
  label: string;
  iconName: string | null;
  tintColor: string | null;
  imageUrl: string | null;
  gender: Gender;
  sortOrder: number;
  isActive: boolean;
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
  gender: Gender;
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
  const data = await request<ApiCategory[]>(
    `/catalog/categories${qs({ gender, activeOnly: true })}`,
    { auth: false },
  );
  return data.map(toCategory);
}

export async function listProducts(opts: {
  gender?: Gender;
  categoryId?: string;
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<Product[]> {
  const data = await request<ApiProduct[]>(
    `/catalog/products${qs({
      gender: opts.gender,
      categoryId: opts.categoryId,
      search: opts.search,
      limit: opts.limit ?? 50,
      offset: opts.offset,
    })}`,
    { auth: false },
  );
  return data.map(toProduct);
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
};

export type ProductDetailData = Product & {
  listingId: string;
  description: string;
  gallery: string[];
  sizes: string[];
  swatches: { groupId: string; name: string; hex: string | null }[];
  variants: ProductVariant[];
  ratingCount: number;
};

export type Review = { id: string; author: string; rating: number; body: string; createdAt: string };

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
    description: p.description ?? '',
    gallery: merged.length ? merged.slice(0, 6) : [base.img],
    sizes,
    swatches,
    variants,
    ratingCount: p.ratingCount ?? 0,
  };
}

export async function listReviews(id: string): Promise<Review[]> {
  return request<Review[]>(`/catalog/products/${encodeURIComponent(id)}/reviews`, { auth: false });
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

export async function listBrands(): Promise<Brand[]> {
  const data = await request<ApiBrand[]>(`/catalog/brands`, { auth: false });
  return data.map(toBrand);
}

/** True when an id looks like a real backend category id (`cat_…`), not a
 *  pseudo home-rail id like 'flash' / 'trending' / 'all'. */
export function isBackendCategoryId(id?: string): boolean {
  return !!id && id.startsWith('cat_');
}
