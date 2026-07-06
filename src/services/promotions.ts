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

/** Coupons the user can apply at checkout (mechanism='coupon' with a code). */
export async function listCoupons(): Promise<Coupon[]> {
  const rows = await request<ApiPromotion[]>('/promotions/active', { auth: false });
  return rows
    .filter((p) => p.mechanism === 'coupon' && !!p.code)
    .map((p) => ({
      id: p.id,
      code: p.code as string,
      discount: discountLabel(p),
      min: minLabel(p),
      expires: fmtExpiry(p.validUntil),
      active: true,
    }));
}
