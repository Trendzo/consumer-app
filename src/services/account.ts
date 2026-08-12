// Account deletion.
//
// Apple REQUIRES this: an app that lets you create an account must let you
// delete it from inside the app (App Store Review Guideline 5.1.1(v)). A
// support email or a link buried on a website is not sufficient on its own, and
// it is one of the most reliably enforced rejection reasons.
//
// STATE OF THE BACKEND (probed 2026-08-12): there is no consumer-facing delete
// endpoint yet. `DELETE /consumer/profile/me`, `POST /consumer/profile/me` and
// `POST /consumer/account/delete` all return 404, even though the backend does
// model a closed account (`consumer_closed` is a real auth error code, so
// something server-side can already close one).
//
// So this tries the endpoint the API *should* expose, and reports a specific,
// catchable failure when it is missing — letting the screen fall back to the
// hosted deletion page rather than silently pretending the account was deleted.
// Once the backend ships the route, the fallback simply stops being reached.
import { request, ApiError } from './api';

/** The hosted deletion page. Informational only — see the note below. */
export const ACCOUNT_DELETION_URL = 'https://backend-qpmx.onrender.com/account-deletion';

/**
 * Support address, and the ONLY working fallback today.
 *
 * Do not fall back to ACCOUNT_DELETION_URL: that page carries no form and no
 * endpoint. It instructs the reader to "Sign in, open Profile, tap Delete
 * account" — this screen — so sending them there from here is a loop that
 * deletes nothing. The page's own escape hatch is this email address.
 */
export const ACCOUNT_DELETION_EMAIL = 'trendzodevelopment@gmail.com';

/** A prefilled deletion request, so the shopper does not have to compose one. */
export function deletionMailto(phone?: string): string {
  const subject = 'Delete my Trendzo account';
  const body = [
    'I would like my Trendzo account permanently deleted.',
    '',
    `Registered mobile: ${phone || '(please fill in)'}`,
    '',
    'I understand this removes my account, saved addresses, bag and order history.',
  ].join('\n');
  return `mailto:${ACCOUNT_DELETION_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Thrown when the backend has no deletion route, so the UI can offer the web flow. */
export class DeletionUnsupportedError extends Error {
  constructor() {
    super('Account deletion is not available in this build yet.');
    this.name = 'DeletionUnsupportedError';
  }
}

/**
 * Permanently close the signed-in account.
 *
 * Resolves only when the server confirms. Any 404/405 is treated as "the route
 * does not exist" rather than "your account is gone" — reporting success for a
 * deletion that never happened is the worst possible outcome here.
 */
export async function deleteAccount(reason?: string): Promise<void> {
  try {
    await request<{ deleted: boolean }>('/consumer/profile/me', {
      method: 'DELETE',
      ...(reason ? { body: { reason } } : {}),
    });
  } catch (e: any) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 405)) {
      throw new DeletionUnsupportedError();
    }
    throw e;
  }
}
