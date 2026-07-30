// Pincode lookup — GET /pincode/:pin (public, no auth).
//
// The address form used to take city and state as free text and then send EVERY
// address to the same hardcoded Mumbai coordinate. City and state are now
// resolved from the pincode the customer already types, which is both less typing
// and the only way the state code (used for GST place-of-supply) is reliably
// correct.

import { cachedGet } from './api';

export type PincodeInfo = {
  pincode: string;
  city: string;
  state: string;
  /** GST state code (first two digits of a GSTIN). null if the state is unmapped. */
  stateCode: string | null;
  country: string;
};

/** Pincodes never change, so cache hard. Resolves to null for an unknown pin. */
export const lookupPincode = (pin: string) =>
  cachedGet<PincodeInfo | null>(`/pincode/${encodeURIComponent(pin)}`, {
    auth: false,
    ttlMs: 24 * 60 * 60_000,
  });
