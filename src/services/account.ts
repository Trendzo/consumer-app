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

/** The hosted deletion page — the fallback while the API route does not exist. */
export const ACCOUNT_DELETION_URL = 'https://backend-qpmx.onrender.com/account-deletion';

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
