// Order lifecycle, client side.
//
// Mirrors backend/src/shared/orders/state-machine.ts. The backend owns 15 statuses
// covering four delivery methods; this module maps a (deliveryMethod, status) pair
// onto the timeline the customer actually sees, and answers the three questions
// every order screen asks: can I cancel, can I return, is this still moving.
//
// Nothing here guesses. Every rule below has a counterpart in the backend:
//   • cancellable statuses   → RULES with actor 'consumer' and to='cancelled'
//   • return window + item   → shared/returns/open-return.ts
//   • at_door / doorWindow   → try-and-buy only (shared/orders/door-visit.ts)
//   • packed → delivered     → pickup only (state-machine.ts comment on that rule)

import type { OrderDetail, OrderDetailItem } from './orders';

export type OrderStatus =
  | 'pending' | 'confirmed' | 'routing' | 'accepted' | 'packed' | 'picked_up'
  | 'out_for_delivery' | 'at_door' | 'undelivered' | 'returning_to_store'
  | 'returned_to_store' | 'delivered' | 'cancelled' | 'payment_failed' | 'closed';

/** Server-side delivery method values (NOT the app's legacy 'tryandbuy' spelling). */
export type Method = 'express' | 'standard' | 'pickup' | 'try_and_buy';

export const RETURN_WINDOW_DAYS = 7; // open-return.ts RETURN_WINDOW_DAYS

/** The app has historically used 'tryandbuy'; the API uses 'try_and_buy'. */
export const toApiMethod = (m?: string): Method =>
  m === 'standard' ? 'standard'
  : m === 'pickup' ? 'pickup'
  : m === 'try_and_buy' || m === 'tryandbuy' ? 'try_and_buy'
  : 'express';

/**
 * Monotonic progress rank. Only for "how far along is this" — the exception states
 * (undelivered / returning_to_store / returned_to_store) deliberately share the rank
 * of the phase they interrupted, because the timeline shows them as a banner instead
 * of a step. cancelled/payment_failed are handled before rank is ever consulted.
 */
const RANK: Record<OrderStatus, number> = {
  pending: 0,
  payment_failed: 0,
  confirmed: 1,
  routing: 1,
  accepted: 2,
  packed: 3,
  picked_up: 4,
  out_for_delivery: 4,
  undelivered: 4,
  returning_to_store: 4,
  returned_to_store: 4,
  at_door: 5,
  delivered: 6,
  closed: 6,
  cancelled: 0,
};

export const rankOf = (s: string) => RANK[s as OrderStatus] ?? 0;

export type Step = {
  label: string;
  /** Line under the label once the step is the current one. */
  hint: string;
  icon: string;
  /** Reached once the order's rank is at least this. */
  at: number;
};

// Express / Standard share a shape; only the copy differs.
const doorSteps = (fast: boolean): Step[] => [
  { label: 'Order placed', hint: 'We have your order', icon: 'check', at: 0 },
  { label: 'Payment confirmed', hint: 'Finding a store', icon: 'credit-card', at: 1 },
  { label: 'Store accepted', hint: 'Your items are being picked', icon: 'shopping-bag', at: 2 },
  { label: 'Packed', hint: 'Waiting for a rider', icon: 'package', at: 3 },
  {
    label: 'Out for delivery',
    hint: fast ? 'On the way to you' : 'With the courier',
    icon: 'truck',
    at: 4,
  },
  { label: 'Delivered', hint: 'Enjoy', icon: 'home', at: 6 },
];

const TRY_STEPS: Step[] = [
  { label: 'Order placed', hint: 'We have your trial', icon: 'check', at: 0 },
  { label: 'Payment confirmed', hint: 'Charged now, refunded for anything you send back', icon: 'credit-card', at: 1 },
  { label: 'Store accepted', hint: 'Your items are being picked', icon: 'shopping-bag', at: 2 },
  { label: 'Packed', hint: 'Waiting for a rider', icon: 'package', at: 3 },
  { label: 'On the way', hint: 'Rider heading to you', icon: 'truck', at: 4 },
  { label: 'Trial at your door', hint: 'Try now — the rider waits', icon: 'home', at: 5 },
  { label: 'Trial closed', hint: 'Keeping what fits', icon: 'check-circle', at: 6 },
];

const PICKUP_STEPS: Step[] = [
  { label: 'Order placed', hint: 'We have your order', icon: 'check', at: 0 },
  { label: 'Payment confirmed', hint: 'Sending it to the store', icon: 'credit-card', at: 1 },
  { label: 'Store accepted', hint: 'Being prepared', icon: 'shopping-bag', at: 2 },
  { label: 'Ready for pickup', hint: 'Head over with your code', icon: 'map-pin', at: 3 },
  { label: 'Collected', hint: 'Picked up at the counter', icon: 'check-circle', at: 6 },
];

export function stepsFor(method: Method): Step[] {
  if (method === 'pickup') return PICKUP_STEPS;
  if (method === 'try_and_buy') return TRY_STEPS;
  return doorSteps(method === 'express');
}

/** Index of the furthest reached step, or -1 when the order never got going. */
export function activeStep(steps: Step[], status: string): number {
  const r = rankOf(status);
  let idx = -1;
  for (let i = 0; i < steps.length; i++) if (r >= steps[i]!.at) idx = i;
  return idx;
}

/* ── Exception states ─────────────────────────────────────────────────────── */

export type Exception = { tone: 'bad' | 'warn'; title: string; body: string; icon: string };

/**
 * Money context the exception copy needs to stay honest.
 *
 * `amountPaidPaise` is the server's authoritative "was the shopper charged" — the
 * sum of succeeded payments. `hasRefund` says a refund row already exists (its
 * real status is shown by the RefundBlock, so the banner must NOT restate it).
 *
 * The bug this closes: the banners promised "you've been refunded" from order
 * status alone, so a cancelled/returned order whose prepaid payment FAILED — no
 * money ever captured, no refund row — still told the shopper their money was on
 * its way back. Refund wording now fires only when something was actually paid.
 */
export type RefundContext = { amountPaidPaise: number; hasRefund: boolean };

/**
 * A banner replacing the "on track" reading of the timeline. Returns null on the
 * happy path. These are real backend states, not UI inventions — `undelivered` and
 * `returning_to_store` are reachable for every door method, `returned_to_store` only
 * after a failed delivery or a door rejection.
 */
export function exceptionFor(status: string, method: Method, refund: RefundContext): Exception | null {
  const wasCharged = refund.amountPaidPaise > 0;
  switch (status) {
    case 'payment_failed':
      return {
        tone: 'bad', icon: 'credit-card',
        title: 'Payment failed',
        body: 'Nothing was charged. Retry the payment to keep this order.',
      };
    case 'cancelled':
      return {
        tone: 'bad', icon: 'x-circle',
        title: 'Order cancelled',
        // Only speak of a refund when money actually moved. When a refund row
        // exists, defer to the RefundBlock for its real status rather than
        // asserting "refunded" (it may still be pending, or have failed).
        body: !wasCharged
          ? 'Nothing was charged, so there is nothing to refund.'
          : refund.hasRefund
            ? 'Your refund is shown below.'
            : 'Your refund is being processed — it goes back the way you paid.',
      };
    case 'undelivered':
      return {
        tone: 'warn', icon: 'alert-triangle',
        title: 'Delivery attempt failed',
        body: 'The rider could not hand the order over. Another attempt is scheduled.',
      };
    case 'returning_to_store':
      return {
        tone: 'warn', icon: 'corner-up-left',
        title: 'On its way back to the store',
        // The refund promise is conditional on having paid. A try-and-buy order
        // whose payment failed still routes items back, but there is nothing to
        // refund.
        body: !wasCharged
          ? (method === 'try_and_buy'
              ? 'The items you did not keep are heading back.'
              : 'The order is going back to the store.')
          : method === 'try_and_buy'
            ? 'The items you did not keep are heading back. Your refund starts once the store receives them.'
            : 'The order is going back to the store. Your refund starts once it arrives.',
      };
    case 'returned_to_store':
      return {
        tone: 'warn', icon: 'corner-up-left',
        title: 'Back at the store',
        body: wasCharged
          ? 'The store has the items. Refunds for anything returned are being processed.'
          : 'The store has the items.',
      };
    default:
      return null;
  }
}

/* ── What the customer may do ─────────────────────────────────────────────── */

/**
 * Consumer-cancellable statuses, straight out of the state machine's rules where
 * `actors` includes 'consumer' and `to` is 'cancelled'. Once a store has PACKED the
 * order the consumer can no longer cancel — only admin/system can.
 */
const CONSUMER_CANCELLABLE = new Set<string>([
  'pending', 'payment_failed', 'confirmed', 'routing', 'accepted',
]);

export const canCancel = (status: string) => CONSUMER_CANCELLABLE.has(status);

/** Payment can be retried while the order still awaits money. */
export const canRetryPayment = (status: string, paymentMethod?: string) =>
  (status === 'payment_failed' || status === 'pending') && paymentMethod !== 'cod';

/** Still moving — worth polling. Terminal + parked states are not. */
export const isLive = (status: string) =>
  status !== 'cancelled' && status !== 'closed' && status !== 'delivered';

/** Item outcomes that leave the goods with the customer, so a return is possible. */
const RETURNABLE_OUTCOMES = new Set(['delivered_kept', 'at_door_kept', 'pending_delivery']);

export const returnWindowEndsAt = (deliveredAt?: string | null): number | null => {
  if (!deliveredAt) return null;
  const t = Date.parse(deliveredAt);
  return Number.isNaN(t) ? null : t + RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
};

/** Whole days left in the return window; 0 once it has closed. */
export function returnDaysLeft(deliveredAt?: string | null): number {
  const end = returnWindowEndsAt(deliveredAt);
  if (end === null) return 0;
  return Math.max(0, Math.ceil((end - Date.now()) / (24 * 60 * 60 * 1000)));
}

/** Per-item return eligibility — mirrors open-return.ts item validation exactly. */
export const isItemReturnable = (it: Pick<OrderDetailItem, 'outcome' | 'listingPolicySnap'>) =>
  RETURNABLE_OUTCOMES.has(it.outcome) && it.listingPolicySnap !== 'final_sale';

/**
 * Whether "Return items" should be offered at all. The backend additionally rejects
 * items already returned; that surfaces as an error on submit rather than a hidden
 * button, because the app cannot see other open returns from the order payload.
 */
export function canOpenReturn(
  o: Pick<OrderDetail, 'status' | 'deliveredAt' | 'items' | 'returnPolicy'>,
): boolean {
  // Prefer the SERVER'S verdict. It knows the real window, each item's outcome
  // and the final_sale policy frozen at placement; the local computation below
  // is a mirror of open-return.ts kept only for older payloads and offline.
  if (o.returnPolicy) return o.returnPolicy.eligible;
  if (o.status !== 'delivered') return false;
  const end = returnWindowEndsAt(o.deliveredAt);
  if (end === null || Date.now() > end) return false;
  return (o.items ?? []).some(isItemReturnable);
}

/** Days left, from the server deadline when present. */
export function returnDaysLeftFor(o: Pick<OrderDetail, 'deliveredAt' | 'returnPolicy'>): number {
  const iso = o.returnPolicy?.deadline;
  if (iso) {
    const t = Date.parse(iso);
    if (!Number.isNaN(t)) return Math.max(0, Math.ceil((t - Date.now()) / (24 * 60 * 60 * 1000)));
  }
  return returnDaysLeft(o.deliveredAt);
}

/* ── Labels ───────────────────────────────────────────────────────────────── */

export const METHOD_LABEL: Record<Method, string> = {
  express: 'Express',
  standard: 'Standard',
  pickup: 'Store pickup',
  try_and_buy: 'Try & Buy',
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Awaiting payment',
  payment_failed: 'Payment failed',
  confirmed: 'Confirmed',
  routing: 'Finding a store',
  accepted: 'Store accepted',
  packed: 'Packed',
  picked_up: 'Picked up',
  out_for_delivery: 'Out for delivery',
  at_door: 'At your door',
  undelivered: 'Delivery failed',
  returning_to_store: 'Returning to store',
  returned_to_store: 'Back at store',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  closed: 'Completed',
};

export const statusLabel = (s: string) => STATUS_LABEL[s as OrderStatus] ?? s;

/**
 * Coarse bucket for the history list's filter row. `RETURNED` is NOT an order
 * status — an order whose items went back is still 'delivered' (or 'closed'), so
 * that bucket is driven by the returns list, not by this function.
 */
export type OrderBucket = 'ACTIVE' | 'DELIVERED' | 'CANCELLED';

export const bucketOf = (status: string): OrderBucket =>
  status === 'cancelled' ? 'CANCELLED'
  : status === 'delivered' || status === 'closed' ? 'DELIVERED'
  : 'ACTIVE';

/**
 * The handover proof the customer must show, if any. Door methods use a spoken OTP;
 * pickup uses a counter code. Both come from the order detail and are null until the
 * backend issues them.
 */
/** Statuses where no handover will ever happen, so the code is meaningless. */
/**
 * Statuses where no handover is coming, so the code must not be shown.
 *
 * `delivered` belongs here for the same reason the cancelled states do. The OTP
 * exists to prove a handover at the door; once it has happened the code is spent.
 * Leaving it on screen was actively misleading on a returned order — the tracking
 * page showed "Refund complete" and, directly beneath it, "Give this to the rider",
 * as though someone were still on their way.
 */
const NO_HANDOVER = new Set([
  'delivered',
  'cancelled',
  'payment_failed',
  'returned_to_store',
  'closed',
]);

export function handoverProof(o: Pick<OrderDetail, 'deliveryOtp' | 'pickupCode' | 'status'>, method: Method):
  | { kind: 'otp' | 'pickup'; code: string; title: string; hint: string }
  | null {
  if (NO_HANDOVER.has(o.status)) return null;
  if (method === 'pickup') {
    if (!o.pickupCode) return null;
    return {
      kind: 'pickup', code: o.pickupCode,
      title: 'Show this at the counter',
      hint: 'Store staff enter this code to release your order.',
    };
  }
  if (!o.deliveryOtp) return null;
  return {
    kind: 'otp', code: o.deliveryOtp,
    title: 'Give this to the rider',
    hint: 'Read the code out only once you have the bag in your hands.',
  };
}
