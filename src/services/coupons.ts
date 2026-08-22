// Discount codes — validated by the SERVER, never by the client.
//
// What this replaces: the Bag accepted exactly one hardcoded string ('NEWVIBE')
// and applied a local ₹500; the review page hardcoded a different one
// ('TRENDZO50') worth ₹50 and never transmitted it. Both reduced the DISPLAYED
// total without reducing what the customer was charged, and any genuine
// promotion the business created was rejected by the app as invalid.
//
// There is no validate endpoint, by design. Applying and verifying are the same
// call: /pricing/* prices the cart with the code attached and reports both the
// applied `couponPaise` and a structured `rejectedCodes` explaining exactly why
// a code contributed nothing. A bad code never throws. This module only maps
// that response to copy — it never decides validity itself.

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

/**
 * One entry of the quote's TOP-LEVEL `rejectedCodes`.
 *
 * Read the top-level array, never `stores[].rejectedCodes`. A coupon is
 * order-level, but its eligible subtotal is apportioned across stores, so a
 * store that contributed nothing reports a rejection of its own while the coupon
 * applied perfectly well overall. Rendering the per-store arrays shows
 * "coupon invalid" on a cart whose total already went down. The per-store arrays
 * are only meaningful inside a per-store breakdown, which this app does not show.
 */
export type RejectedCode = { code: string; kind: string; reason: string };

/**
 * Which field the code travels in. `couponCode` and `voucherCode` are separate
 * inputs and separate namespaces: a voucher sent as a coupon comes back
 * `not_found`, and vice versa.
 */
export type CodeKind = 'coupon' | 'voucher';

/**
 * Where the code came from, which is what decides how it is sent.
 *
 * A code picked from a list carries its kind with it: everything in
 * /promotions/active is a coupon, everything in /consumer/rewards is a voucher.
 * A code the shopper TYPES is unknowable — nothing about `46ZA6569` says which
 * namespace it lives in — so it goes out in BOTH fields and the engine decides.
 */
export type CodeSource = CodeKind | 'unknown';

/**
 * The `couponCode` / `voucherCode` pair to send for this code.
 *
 * Sending both for a typed code costs nothing (a code that matches neither
 * simply prices without it) and saves a whole extra round trip versus applying
 * as a coupon and retrying as a voucher — which is a second 400 ms debounce plus
 * a second quote before the shopper's own code appears to work.
 */
export function codeFields(code: string | null, source: CodeSource): { couponCode?: string; voucherCode?: string } {
  if (!code) return {};
  if (source === 'coupon') return { couponCode: code };
  if (source === 'voucher') return { voucherCode: code };
  return { couponCode: code, voucherCode: code };
}

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
  /** `kind` is the field it actually landed in — what placement must send. */
  | { state: 'applied'; code: string; kind: CodeKind; discountPaise: number }
  | { state: 'rejected'; code: string; reason: string; message: string };

/** A rejection that says something. `not_found` is the least informative of all. */
const isInformative = (r: RejectedCode) => r.reason !== 'not_found';

/**
 * Read the server's verdict on one code.
 *
 * `rejected` MUST be the quote's top-level array (see RejectedCode).
 *
 * When a typed code went out in both fields, exactly one rejection is the
 * expected, meaningless one: the namespace it does not belong to always answers
 * `not_found`. So a code is only rejected when EVERY field it was sent in came
 * back rejected — otherwise the other field applied it, and reporting the stray
 * `not_found` would tell the shopper their code failed while the total on screen
 * had already dropped. When both fail, the informative reason wins: an expired
 * coupon reads "That code has expired", not "That code does not exist".
 */
export function readCouponOutcome(
  code: string | null,
  source: CodeSource,
  couponPaise: number,
  rejected: RejectedCode[] | undefined,
  opts?: { signedIn?: boolean },
): CouponOutcome {
  if (!code) return { state: 'none' };
  const mine = (rejected ?? []).filter((r) => r.code.toUpperCase() === code.toUpperCase());
  const sentAs: CodeKind[] = source === 'unknown' ? ['coupon', 'voucher'] : [source];
  const rejectedKinds = new Set(mine.map((r) => r.kind));
  const allRejected = sentAs.every((k) => rejectedKinds.has(k));

  if (allRejected && mine.length > 0) {
    const hit = mine.find(isInformative) ?? mine[0]!;
    let message = couponRejectionMessage(hit.reason);
    // A voucher is issued to ONE person and only resolves for that account, so a
    // signed-out shopper holding a real voucher gets `not_found` — a message that
    // reads as "your code is fake" when the truth is "we don't know who you are".
    if (hit.reason === 'not_found' && !opts?.signedIn) {
      message = 'That code does not exist — sign in if it was issued to your account.';
    }
    return { state: 'rejected', code, reason: hit.reason, message };
  }

  // At least one field applied it. Which one is what placement must send: the
  // kind that is NOT in the rejection list.
  const kind = sentAs.find((k) => !rejectedKinds.has(k)) ?? 'coupon';
  // `discountPaise` is the coupon-line saving specifically, and is legitimately 0
  // when the code discounted shipping instead; callers show a "− ₹x" row only when
  // it is positive, so nothing claims a saving that isn't there.
  return { state: 'applied', code, kind, discountPaise: couponPaise };
}

/**
 * Fold several quotes' verdicts on the SAME code into one.
 *
 * The Bag prices one quote per delivery bucket, and a code can legitimately
 * apply to one bucket and not another (store scope, minimum order). Treating any
 * single rejection as "the code failed" told shoppers their coupon had bounced
 * while a bucket total on the same screen had already dropped. A code is rejected
 * here only when every bucket rejected it.
 */
export function mergeCouponOutcomes(outcomes: CouponOutcome[]): CouponOutcome {
  const real = outcomes.filter((o) => o.state !== 'none');
  if (real.length === 0) return { state: 'none' };
  const applied = real.filter((o): o is Extract<CouponOutcome, { state: 'applied' }> => o.state === 'applied');
  if (applied.length === 0) {
    // All rejected — surface the most informative reason across them.
    const rejections = real as Extract<CouponOutcome, { state: 'rejected' }>[];
    return rejections.find((r) => r.reason !== 'not_found') ?? rejections[0]!;
  }
  return {
    state: 'applied',
    code: applied[0]!.code,
    kind: applied[0]!.kind,
    discountPaise: applied.reduce((s, o) => s + o.discountPaise, 0),
  };
}
