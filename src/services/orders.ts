// Checkout + orders — /pricing/quote (final price) and /consumer/checkout (place, list,
// detail, cancel; all requireAuth('consumer')). Money is integer paise.
//
// IMPORTANT contract notes (from the backend):
//  • One order PER STORE — the cart may span retailers, so place one order per store bucket.
//  • paymentOutcome is a pre-gateway stopgap (client-declared). There is no real gateway yet.
//  • Reuse a STABLE idempotencyKey per placement attempt or retries create duplicate orders.
//  • On success the order status is 'routing' (not 'confirmed').
//  • Placement can 409 on TOCTOU (OrderPriceChanged / OrderStockUnavailable / CouponInvalid …)
//    — re-quote and retry with a fresh key.

import { request } from './api';

export type DeliveryMethod = 'express' | 'standard' | 'pickup' | 'try_and_buy';
export type PaymentMethod = 'upi' | 'card' | 'cod' | 'wallet' | 'gift_card';

export type QuoteInput = {
  storeId: string;
  items: { variantId: string; qty: number }[];
  deliveryMethod: DeliveryMethod;
  paymentMethod: PaymentMethod;
  addressId?: string;
  couponCode?: string;
  voucherCode?: string;
  pointsToRedeem?: number;
  applyWallet?: boolean;
};

export type PlaceInput = QuoteInput & {
  paymentOutcome?: 'succeeded' | 'failed' | 'pending';
  idempotencyKey?: string;
  pickupSlotId?: string;
  pickupSlotStart?: string;
  pickupSlotEnd?: string;
};

// Loose shapes — the backend quote/order payloads are rich; callers read the fields they need.
export type Quote = {
  pricing: { totalPaise: number; deliveryFeePaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number };
  lines: { variantId: string; name: string; qty: number; netLinePaise: number }[];
  deliveryOptions: Record<DeliveryMethod, number>;
  rejectedCodes: { code: string; kind: string; reason: string }[];
  wallet?: { balancePaise: number; appliedPaise: number };
};

export type PlaceResult = { orderId: string; status: string; alreadyExisted?: boolean };

export type OrderListRow = {
  id: string;
  groupId?: string;
  storeId: string;
  storeName: string;
  status: string;
  deliveryMethod?: string;
  paymentMethod?: string;
  grandTotalPaise?: number;
  placedAt?: string;
  deliveredAt?: string | null;
};

/** Only the safe/consumer-facing fields — the raw order-detail row also exposes internal
 *  columns (deliveryOtp, pickupCode, idempotencyKey, routingHistory) that must NOT be shown. */
export type OrderDetail = {
  id: string;
  status: string;
  storeNameSnap?: string;
  totalPaise?: number;
  deliveryMethod?: string;
  createdAt?: string;
  items?: { variantId: string; nameSnap?: string; qty: number; unitPricePaise?: number; imageUrlSnap?: string }[];
};

/** Stable-per-attempt idempotency key. Generate once, reuse across retries of the SAME order. */
export const newIdempotencyKey = () =>
  `idem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

export const quoteOrder = (body: QuoteInput) =>
  request<Quote>('/pricing/quote', { method: 'POST', body });

export const placeOrder = (body: PlaceInput) =>
  request<PlaceResult>('/consumer/checkout', { method: 'POST', body });

export const listOrders = () => request<OrderListRow[]>('/consumer/checkout/orders');

export const getOrder = (id: string) =>
  request<OrderDetail>(`/consumer/checkout/orders/${encodeURIComponent(id)}`);

export const cancelOrder = (id: string, reason?: string) =>
  request<unknown>(`/consumer/checkout/orders/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    body: reason ? { reason } : {},
  });
