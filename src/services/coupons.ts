// Coupon codes — validated by the SERVER, never by the client.
//
// What this replaces: the Bag accepted exactly one hardcoded string ('NEWVIBE')
// and applied a local ₹500; the review page hardcoded a different one
// ('TRENDZO50') worth ₹50 and never transmitted it. Both reduced the DISPLAYED
// total without reducing what the customer was charged, and any genuine
// promotion the business created was rejected by the app as invalid.
//
// The pricing endpoints already take `couponCode` and return both the applied
// `couponPaise` and a structured `rejectedCodes` explaining exactly why a code
// failed. This module only maps those reasons to copy — it never decides
// validity itself.

/** Reason strings emitted by compute-quote.ts, mapped to customer-facing copy. */
const REASON_COPY: Record<string, string> = {
  not_found: 'That code does not exist.',
  inactive: 'That code is not active right now.',
  expired: 'That code has expired.',
  first_order_only: 'That code is for first orders only.',
  tier_ineligible: 'Your rewards tier does not qualify for this code.',
  store_ineligible: 'That code does not apply to this store.',
  requires_login: 'Sign in to use this code.',
  assigned_to_other: 'That code belongs to another account.',
  fully_redeemed: 'That code has already been fully used.',
  consumer_not_targeted: 'That code is not available on your account.',
  consumer_excluded: 'That code is not available on your account.',
  not_eligible: 'That code does not apply to this order.',
  min_order_not_met: 'Your bag is below this code’s minimum.',
  // The promotion's per-customer cap. Enforced at quote time as of the Spin & Win
  // work — before that it was stored and counted but never actually checked.
  per_consumer_limit_reached: 'You have already used that code.',
};

export const couponRejectionMessage = (reason: string): string =>
  REASON_COPY[reason] ?? 'That code cannot be used on this order.';

export type RejectedCode = { code: string; kind: string; reason: string };

/**
 * Outcome of pricing a cart with a code attached.
 *
 * The SERVER decides whether a code applied. `compute-quote` walks every explicit
 * code after running the engine and pushes a rejection for any that survived the
 * eligibility gates but still contributed nothing — so a code absent from
 * `rejectedCodes` genuinely worked.
 *
 * This module used to second-guess that by also requiring `couponPaise > 0`, which
 * was right for percentage and flat-amount codes and wrong for everything that
 * discounts a different bucket. A free-shipping prize reduces the delivery fee, not
 * the coupon line, so a winner was told their own code "does not apply to this
 * order" while the total in front of them had already dropped.
 */
export type CouponOutcome =
  | { state: 'none' }
  | { state: 'applied'; code: string; kind: CodeKind; discountPaise: number }
  | { state: 'rejected'; code: string; kind: CodeKind; reason: string; message: string };

/**
 * Which field the code travels in.
 *
 * `couponCode` and `voucherCode` are separate inputs on /pricing/*: a voucher
 * sent as a coupon comes back `not_found` and vice versa. Codes chosen from a
 * list carry their kind with them (public promotions are coupons, everything in
 * /consumer/rewards is a voucher); a code the shopper TYPES is unknowable, so it
 * is tried as a coupon and retried as a voucher on `not_found` — see
 * `retryAsVoucher`.
 */
export type CodeKind = 'coupon' | 'voucher';

export function readCouponOutcome(
  code: string | null,
  couponPaise: number,
  rejected: RejectedCode[] | undefined,
  kind: CodeKind = 'coupon',
): CouponOutcome {
  if (!code) return { state: 'none' };
  const hit = (rejected ?? []).find((r) => r.code.toUpperCase() === code.toUpperCase());
  if (hit) return { state: 'rejected', code, kind, reason: hit.reason, message: couponRejectionMessage(hit.reason) };
  // Not rejected ⇒ applied. `discountPaise` is the coupon-line saving specifically,
  // and is legitimately 0 when the code discounted shipping instead; callers show a
  // "− ₹x" row only when it is positive, so nothing claims a saving that isn't there.
  return { state: 'applied', code, kind, discountPaise: couponPaise };
}

/**
 * True when a code sent as a coupon should be re-sent as a voucher.
 *
 * The two namespaces don't overlap, so "no such coupon" is the server telling us
 * we guessed the wrong field — not that the code is bad. One retry only.
 */
export const retryAsVoucher = (o: CouponOutcome): boolean =>
  o.state === 'rejected' && o.kind === 'coupon' && o.reason === 'not_found';
