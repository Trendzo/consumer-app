// Consumer authentication: phone-OTP (MSG91 or Slide) + the Trendzo backend.
//
// Flow (matches backend src/modules/auth/auth.controller.ts -> consumerOtpLogin):
//   1. services/otp sends an OTP with whichever provider the backend selects
//      (GET /auth/otp-config) and returns a short-lived accessToken after the code is verified.
//   2. consumerOtpLogin(accessToken, provider) - POST it to the backend, which re-verifies
//      with the provider's secret key, find-or-creates the consumer by phone, and
//      returns { token (JWT), consumer }. First OTP for a phone == signup.

import { request, ApiError } from './api';
import type { OtpConfig, OtpProvider } from './otp';

export type Consumer = {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  genderPreference: 'her' | 'him' | 'unisex' | null;
  referralCode: string | null;
  profileComplete: boolean;
};

export type Session = { token: string; consumer: Consumer };

/** Exchange a verified OTP accessToken for a backend session (login == signup). */
export async function consumerOtpLogin(accessToken: string, provider: OtpProvider): Promise<Session> {
  return request<Session>('/auth/consumer/otp/login', {
    method: 'POST',
    auth: false,
    body: { accessToken, provider },
  });
}

/** Which OTP provider to use (and Slide's public client config). Public, no auth. */
export async function fetchOtpConfig(): Promise<OtpConfig> {
  return request<OtpConfig>('/auth/otp-config', { method: 'GET', auth: false });
}

/** Fetch the signed-in consumer's profile. */
export async function getMe(): Promise<Consumer> {
  return request<Consumer>('/consumer/profile/me', { method: 'GET' });
}

/** Update name / email / gender preference. Requires at least one field. */
export async function updateMe(patch: {
  name?: string;
  email?: string;
  genderPreference?: 'her' | 'him' | 'unisex';
}): Promise<Consumer> {
  return request<Consumer>('/consumer/profile/me', { method: 'PATCH', body: patch });
}

export { ApiError };
