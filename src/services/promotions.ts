// Public promotions — live offers + coupons for the coupon wallet / offer banners.
// GET /promotions/active is unauthenticated. Coupon VALIDATION is not here — it flows
// through the pricing engine (/pricing/* returns rejectedCodes / applied discounts).

import { request } from './api';

type ApiPromotion = {
  id: string;
  code: string | null;
  name: string;
  mechanism: 'offer' | 'coupon';
  discountType: string; // 'flat_amount' | 'percentage' | 'free_shipping' | …
  appliedTo: string;
  config: Record<string, any> | null;
  storeId: string | null;
  validUntil: string;
};

export type Coupon = {
  id: string;
  code: string;
  discount: string; // display label, e.g. "₹500 OFF"
  min: string; // e.g. "Min ₹999" | "No minimum"
  expires: string; // e.g. "11 Sep"
  active: boolean;
  /** One line saying what the code does — the sheet's headline. */
  headline: string;
  /** Where and when it applies, in plain sentences. Built only from fields the
   *  API actually sends, so nothing here is invented. */
  terms: string[];
  /** Raw expiry, for anything that needs to compare rather than print it. */
  validUntil: string;
  /** True when the promotion is scoped to a single store. */
  storeScoped: boolean;
};

const rupees = (paise: number) => Math.round(paise / 100);

function discountLabel(p: ApiPromotion): string {
  const c = p.config ?? {};
  if (p.discountType === 'flat_amount' && c.amountPaise != null) return `₹${rupees(c.amountPaise)} OFF`;
  if (p.discountType === 'percentage' && c.percent != null) return `${c.percent}% OFF`;
  if (p.discountType === 'free_shipping' || p.appliedTo === 'shipping') return 'FREE DELIVERY';
  return p.name;
}

function minLabel(p: ApiPromotion): string {
  const c = p.config ?? {};
  return c.minOrderPaise != null ? `Min ₹${rupees(c.minOrderPaise)}` : 'No minimum';
}

function fmtExpiry(iso: string): string {
  try { return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); }
  catch { return ''; }
}

/** What the discount is applied against, in the shopper's words. */
function appliesToLabel(p: ApiPromotion): string {
  if (p.discountType === 'free_shipping' || p.appliedTo === 'shipping') return 'your delivery charge';
  if (p.appliedTo === 'shipping') return 'your delivery charge';
  return 'your order total';
}

/**
 * The fine print, assembled from what the promotion actually carries.
 *
 * Deliberately NOT a fixed paragraph of legal boilerplate: every line here maps
 * to a field on the promotion, so a coupon with no minimum does not claim one
 * and a catalogue-wide coupon is not described as store-only.
 */
function termsFor(p: ApiPromotion): string[] {
  const c = p.config ?? {};
  const out: string[] = [];
  out.push(`Applies to ${appliesToLabel(p)} when you enter ${p.code ?? p.name} at checkout.`);
  if (c.minOrderPaise != null) out.push(`Your bag must be at least ₹${rupees(c.minOrderPaise)} before delivery and taxes.`);
  else out.push('No minimum bag value.');
  if (c.maxDiscountPaise != null) out.push(`Capped at ₹${rupees(c.maxDiscountPaise)} off in total.`);
  if (c.firstOrderOnly) out.push('First order only — one per new account.');
  if (c.perConsumerLimit != null) out.push(`Can be used ${c.perConsumerLimit} time${c.perConsumerLimit === 1 ? '' : 's'} per account.`);
  out.push(p.storeId ? 'Valid at one partner store only — the bag will say if it does not apply.' : 'Valid across all Trendzo stores.');
  const exp = fmtExpiry(p.validUntil);
  if (exp) out.push(`Valid until ${exp}.`);
  out.push('One code per order. Eligibility is confirmed against your bag when you apply it.');
  return out;
}

function toCoupon(p: ApiPromotion): Coupon {
  return {
    id: p.id,
    code: p.code as string,
    discount: discountLabel(p),
    min: minLabel(p),
    expires: fmtExpiry(p.validUntil),
    active: true,
    headline: `${discountLabel(p)} on ${appliesToLabel(p)}`,
    terms: termsFor(p),
    validUntil: p.validUntil,
    storeScoped: !!p.storeId,
  };
}

/**
 * Roughly what a coupon is worth, for ordering the list.
 *
 * Only ever used to SORT — never shown, never used as a discount. A percentage
 * has no rupee value without a cart, so it sorts by percent against a nominal
 * ₹1000 bag purely to keep the ordering stable and sane.
 */
function sortWeight(c: Coupon, p: ApiPromotion): number {
  const cfg = p.config ?? {};
  if (p.discountType === 'flat_amount' && cfg.amountPaise != null) return cfg.amountPaise;
  if (p.discountType === 'percentage' && cfg.percent != null) return (cfg.percent / 100) * 100_000;
  return 0;
}

/**
 * Coupons the user can apply at checkout (mechanism='coupon' with a code).
 *
 * Ordered best-first, and catalogue-wide codes ahead of store-scoped ones. The
 * product page advertises the head of this list, and taking whatever the API
 * happened to return first meant the banner could push a ₹50 store-only code
 * while a ₹500 sitewide one sat unmentioned in the sheet behind it.
 *
 * NOTE this is what EXISTS, not what a given bag qualifies for. Eligibility
 * depends on cart contents, store scope, first-order status and loyalty tier —
 * only /pricing/cart with the code attached can answer that.
 */
export async function listCoupons(): Promise<Coupon[]> {
  const rows = await request<ApiPromotion[]>('/promotions/active', { auth: false });
  return rows
    .filter((p) => p.mechanism === 'coupon' && !!p.code)
    .map((p) => ({ coupon: toCoupon(p), weight: sortWeight(toCoupon(p), p) }))
    .sort((a, b) =>
      (a.coupon.storeScoped ? 1 : 0) - (b.coupon.storeScoped ? 1 : 0) || b.weight - a.weight)
    .map((x) => x.coupon);
}
