// Checkout + orders — /pricing/quote (final price) and /consumer/checkout (place, list,
// detail, cancel; all requireAuth('consumer')). Money is integer paise.
//
// IMPORTANT contract notes (from the backend):
//  • One order PER STORE — the cart may span retailers, so place one order per store bucket.
//  • Payment outcome is NOT ours to declare. Razorpay is live: a card/UPI placement
//    comes back with a `payment` block and the order waits at 'pending' until the
//    signed capture is verified server-side. The client cannot mark an order paid.
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
  // No paymentOutcome. The server decides whether a payment succeeded and ignores
  // anything a client claims — see backend checkout.validators.ts.
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
  /** Total units across every line — the "3 items" on a history card. */
  itemCount?: number;
  /** Line preview (name/brand/image/qty) so the list renders without an N+1 detail fetch. */
  items?: { name: string; brand: string; image: string | null; qty: number }[];
};

/** A single line of a placed order (server-shaped: `id` IS the orderItemId used to open a return). */
export type OrderDetailItem = {
  id: string;
  listingId: string;
  variantId: string;
  listingNameSnap: string;
  brandSnap: string;
  categorySnap: string;
  galleryImageSnap: string | null;
  attributesLabelSnap: string;
  listingPolicySnap: string;
  qty: number;
  unitPricePaise: number;
  lineSubtotalPaise: number;
  netLinePaise: number;
  outcome: string;
};

/** Consumer-facing fields of the order-detail row (whitelisted by the backend shaper).
 *  deliveryOtp/pickupCode ARE for the consumer (spoken to the driver at handover / shown
 *  at the store counter); truly internal columns (idempotencyKey, routingHistory,
 *  agentHandoffCode) are stripped server-side and never reach the app. */
export type OrderDetail = {
  id: string;
  groupId?: string;
  storeId?: string;
  status: string;
  deliveryMethod?: string;
  paymentMethod?: string;
  paymentMethodLabel?: string;
  storeNameSnap?: string;
  storeAddressSnap?: string;
  /** Live store geo/phone (not snapshotted) — drives Directions / Call store on pickups. */
  storeLat?: number | null;
  storeLng?: number | null;
  storePhone?: string | null;
  addressLine1Snap?: string | null;
  addressLine2Snap?: string | null;
  addressCitySnap?: string | null;
  addressPincodeSnap?: string | null;
  itemsSubtotalPaise?: number;
  couponPaise?: number;
  pointsRedeemedPaise?: number;
  walletAppliedPaise?: number;
  taxPaise?: number;
  deliveryFeePaise?: number;
  grandTotalPaise?: number;
  loyaltyEarnedPoints?: number;
  /** Money actually captured from the shopper — sum of SUCCEEDED payments, in
   *  paise. 0 means nothing was ever charged (e.g. a failed/abandoned prepaid
   *  payment). The single source of truth for whether refund copy is even
   *  meaningful; do NOT infer "charged" from order status. */
  amountPaidPaise?: number;
  /** Consumer→driver handover proof for door deliveries — read it to the driver. */
  deliveryOtp?: string | null;
  /** Counter code for pickup orders — show at the store. */
  pickupCode?: string | null;
  pickupSlotId?: string | null;
  pickupSlotStart?: string | null;
  pickupSlotEnd?: string | null;
  doorWindowExpiresAt?: string | null;
  /** Server-computed return eligibility — deadline, reason, and per-item verdicts.
   *  The app used to run its own 7-day counter, a second copy of a rule that
   *  lives in open-return.ts and also depends on item outcome + final_sale. */
  returnPolicy?: {
    eligible: boolean;
    windowDays: number;
    deadline: string | null;
    reason: string | null;
    items: { orderItemId: string; eligible: boolean; reason: string | null }[];
  };
  /** Refunds raised against this order — including CANCELLATION refunds, which
   *  previously appeared nowhere (only return-driven refunds were visible, via
   *  /consumer/returns). */
  refunds?: {
    id: string;
    amountPaise: number;
    status: 'pending' | 'processing' | 'succeeded' | 'partially_disbursed' | 'failed' | string;
    reason: string | null;
    createdAt: string;
    completedAt: string | null;
    /**
     * Per-leg truth: where each slice of the money is going and whether it landed.
     * A COD refund is paid back as CASH by hand, so "back on your original payment
     * method" is simply false for it — the app needs the destination to say what
     * actually happens. Optional so an older backend still renders.
     */
    disbursements?: {
      id: string;
      destination: 'original_tender' | 'wallet' | 'cash' | 'manual_payout' | string;
      amountPaise: number;
      status: 'pending' | 'succeeded' | 'failed' | string;
      settledAt: string | null;
      cashChannel: 'driver_reverse_pickup' | 'store_counter' | null;
    }[];
    /** Largest leg — drives the one-line summary. */
    primaryDestination?: 'original_tender' | 'wallet' | 'cash' | 'manual_payout' | null;
    primaryCashChannel?: 'driver_reverse_pickup' | 'store_counter' | null;
  }[];
  placedAt?: string;
  acceptedAt?: string | null;
  packedAt?: string | null;
  deliveredAt?: string | null;
  closedAt?: string | null;
  items?: OrderDetailItem[];
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

/* ── Store pickup windows ────────────────────────────────────────────────── */

/** One concrete, dated pickup window — hand `slotId` + both instants back at placement. */
export type PickupSlot = { slotId: string; startsAt: string; endsAt: string; capacity: number };

export type StorePickupSlots = {
  store: { id: string; name: string; address: string; lat: number; lng: number; contactPhone: string | null };
  slots: PickupSlot[];
};

/** Upcoming pickup windows for a store — the server expands its recurring weekly
 *  template into dated windows in IST and drops any that have already ended. */
export const listPickupSlots = (storeId: string, days = 7) =>
  request<StorePickupSlots>(
    `/catalog/stores/${encodeURIComponent(storeId)}/pickup-slots?days=${days}`,
  );

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
