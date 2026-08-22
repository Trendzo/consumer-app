// Pricing — the backend is the single source of truth for money. POST /pricing/cart
// prices a whole (possibly multi-store) cart; POST /pricing/quote prices one store-order
// for checkout. Both are optionalAuth: a guest gets a clean preview, a logged-in consumer
// gets wallet/loyalty enrichment. All amounts are integer paise — divide by 100 for rupees.

import { request } from './api';
import type { RejectedCode } from './coupons';

export type CartLineItem = { variantId: string; qty: number };

export type CartPricing = {
  stores: {
    storeId: string;
    storeName: string;
    lines: {
      variantId: string;
      listingId: string;
      name: string;
      attributesLabel: string;
      imageUrl: string | null;
      qty: number;
      unitPricePaise: number;
      netLinePaise: number;
    }[];
    pricing: { totalPaise: number; deliveryFeePaise: number };
    deliveryOptions: { express: number; standard: number; pickup: number; try_and_buy: number };
    /**
     * DO NOT render this for coupon messaging — use the top-level `rejectedCodes`.
     *
     * A coupon is order-level, but its eligible subtotal is apportioned across
     * stores, so a store that contributed nothing reports a rejection of its own
     * while the coupon applied fine overall. Showing these turns a working coupon
     * into "coupon invalid" on a cart whose total has already gone down. Only
     * meaningful inside a per-store breakdown, which this app does not render.
     */
    rejectedCodes: RejectedCode[];
  }[];
  aggregate: {
    itemsSubtotalPaise: number;
    discountPaise: number;
    /** Split of discountPaise for honest line items. */
    mrpPromoPaise: number;
    couponPaise: number;
    pointsRedeemedPaise: number;
    deliveryFeePaise: number;
    taxPaise: number;
    grandTotalPaise: number;
    /** Wallet is a partial tender ON TOP of grandTotal, not a discount. */
    walletAppliedPaise: number;
    /** grandTotalPaise − walletAppliedPaise → what UPI/card/COD collects. */
    amountDuePaise: number;
    loyaltyEarnedPoints: number;
    defaultDeliveryMethod: string;
  };
  /** The order-level verdict. THIS is the one to read — see the per-store note above. */
  rejectedCodes: RejectedCode[];
};

/** paise → whole rupees (integer). */
export const toRupees = (paise: number) => Math.round((paise ?? 0) / 100);

/**
 * Price a cart. `auth:true` attaches the bearer token if the user is logged in (enriching
 * with wallet/loyalty); guests still get a valid preview. 404s if any variantId is unknown.
 */
export async function priceCart(
  items: CartLineItem[],
  /** Prefer `codeFields(code, source)` from ./coupons — a typed code has to go
   *  out in BOTH fields, and building that pair by hand at each call site is how
   *  the two screens came to disagree about vouchers. */
  couponCode?: string,
  opts?: {
    pointsToRedeem?: number;
    applyWallet?: boolean;
    voucherCode?: string;
    /** Pass once the customer has chosen — omitting it prices the DEFAULT method,
     *  which makes the shown total disagree with what checkout charges. */
    deliveryMethod?: 'express' | 'standard' | 'pickup' | 'try_and_buy';
    paymentMethod?: 'upi' | 'card' | 'cod' | 'wallet' | 'gift_card';
  },
): Promise<CartPricing> {
  return request<CartPricing>('/pricing/cart', {
    method: 'POST',
    body: {
      items,
      ...(couponCode ? { couponCode } : {}),
      ...(opts?.voucherCode ? { voucherCode: opts.voucherCode } : {}),
      ...(opts?.pointsToRedeem != null ? { pointsToRedeem: opts.pointsToRedeem } : {}),
      ...(opts?.applyWallet != null ? { applyWallet: opts.applyWallet } : {}),
      ...(opts?.deliveryMethod ? { deliveryMethod: opts.deliveryMethod } : {}),
      ...(opts?.paymentMethod ? { paymentMethod: opts.paymentMethod } : {}),
    },
    auth: true,
  });
}
