// Pricing — the backend is the single source of truth for money. POST /pricing/cart
// prices a whole (possibly multi-store) cart; POST /pricing/quote prices one store-order
// for checkout. Both are optionalAuth: a guest gets a clean preview, a logged-in consumer
// gets wallet/loyalty enrichment. All amounts are integer paise — divide by 100 for rupees.

import { request } from './api';

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
    rejectedCodes: { code: string; kind: string; reason: string }[];
  }[];
  aggregate: {
    itemsSubtotalPaise: number;
    discountPaise: number;
    deliveryFeePaise: number;
    taxPaise: number;
    grandTotalPaise: number;
    loyaltyEarnedPoints: number;
    defaultDeliveryMethod: string;
  };
  rejectedCodes: { code: string; kind: string; reason: string }[];
};

/** paise → whole rupees (integer). */
export const toRupees = (paise: number) => Math.round((paise ?? 0) / 100);

/**
 * Price a cart. `auth:true` attaches the bearer token if the user is logged in (enriching
 * with wallet/loyalty); guests still get a valid preview. 404s if any variantId is unknown.
 */
export async function priceCart(items: CartLineItem[], couponCode?: string): Promise<CartPricing> {
  return request<CartPricing>('/pricing/cart', {
    method: 'POST',
    body: { items, ...(couponCode ? { couponCode } : {}) },
    auth: true,
  });
}
