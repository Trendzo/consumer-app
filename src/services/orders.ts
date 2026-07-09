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

/** Multi-retailer cart checkout — the server buckets lines by store (no storeId).
 *  A coupon/voucher + redeemed points apply ONCE across the whole cart (split per store). */
export type GroupPlaceInput = {
  items: { variantId: string; qty: number }[];
  deliveryMethod: DeliveryMethod;
  paymentMethod: PaymentMethod;
  paymentOutcome?: 'succeeded' | 'failed' | 'pending';
  addressId?: string;
  applyWallet?: boolean;
  couponCode?: string;
  voucherCode?: string;
  pointsToRedeem?: number;
  idempotencyKey?: string;
  pickupSlotId?: string;
  pickupSlotStart?: string;
  pickupSlotEnd?: string;
};

/** Present when the placement awaits a Razorpay Checkout (upi/card, gateway active). */
export type PaymentBlock = {
  gateway: 'razorpay';
  keyId: string;
  gatewayOrderId: string;
  amountPaise: number;
  currency: 'INR';
};

export type GroupPlaceResult = {
  groupId: string;
  combinedTotalPaise: number;
  orders: { orderId: string; storeId: string; status: string; alreadyExisted?: boolean }[];
  alreadyExisted: boolean;
  payment?: PaymentBlock;
};

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

/** Consumer-facing fields of the order-detail row. deliveryOtp/pickupCode ARE for the
 *  consumer (spoken to the driver at handover / shown at the store counter); truly
 *  internal columns (idempotencyKey, routingHistory) must still never be rendered. */
export type OrderDetail = {
  id: string;
  status: string;
  storeNameSnap?: string;
  totalPaise?: number;
  deliveryMethod?: string;
  createdAt?: string;
  /** Consumer→driver handover proof for door deliveries — read it to the driver. */
  deliveryOtp?: string | null;
  /** Counter code for pickup orders — show at the store. */
  pickupCode?: string | null;
  items?: { variantId: string; nameSnap?: string; qty: number; unitPricePaise?: number; imageUrlSnap?: string }[];
};

/** Stable-per-attempt idempotency key. Generate once, reuse across retries of the SAME order. */
export const newIdempotencyKey = () =>
  `idem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

export const quoteOrder = (body: QuoteInput) =>
  request<Quote>('/pricing/quote', { method: 'POST', body });

export const placeOrder = (body: PlaceInput) =>
  request<PlaceResult>('/consumer/checkout', { method: 'POST', body });

/**
 * Place the WHOLE cart in one call: one order_group, one child order per store,
 * all-or-nothing (a stock/price failure in any store unwinds the rest — no
 * half-placed carts). Replaces the client-side per-store placement loop.
 */
export const placeGroupOrder = (body: GroupPlaceInput) =>
  request<GroupPlaceResult>('/consumer/checkout/group', { method: 'POST', body });

export const listOrders = () => request<OrderListRow[]>('/consumer/checkout/orders');

export const getOrder = (id: string) =>
  request<OrderDetail>(`/consumer/checkout/orders/${encodeURIComponent(id)}`);

export const cancelOrder = (id: string, reason?: string) =>
  request<unknown>(`/consumer/checkout/orders/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    body: reason ? { reason } : {},
  });

/* ── Razorpay two-phase checkout ─────────────────────────────────────────── */
/** Checkout succeeded on-device: hand the signed triplet to the server to settle. */
export const verifyPayment = (body: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}) => request<{ verified: boolean; orderIds: string[] }>(
  '/consumer/checkout/verify-payment',
  { method: 'POST', body },
);

/** Checkout dismissed/failed on-device — fail the attempt so retry can own it. */
export const reportPaymentFailed = (razorpayOrderId: string, reason?: string) =>
  request<{ failedOrderIds: string[] }>('/consumer/checkout/payment-failed', {
    method: 'POST',
    body: { razorpayOrderId, ...(reason ? { reason } : {}) },
  });

/** Fresh Checkout for a failed/abandoned order payment. */
export const retryPayment = (orderId: string) =>
  request<{ orderId: string; payment: PaymentBlock }>(
    `/consumer/checkout/orders/${encodeURIComponent(orderId)}/retry-payment`,
    { method: 'POST', body: {} },
  );

/** Fresh single Checkout across a whole (multi-store) group. */
export const retryGroupPayment = (groupId: string) =>
  request<{ groupId: string; payment: PaymentBlock }>(
    `/consumer/checkout/group/${encodeURIComponent(groupId)}/retry-payment`,
    { method: 'POST', body: {} },
  );
