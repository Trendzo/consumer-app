// Consumer authentication: MSG91 phone-OTP + the Trendzo backend.
//
// Flow (matches backend src/modules/auth/auth.controller.ts → consumerOtpLogin):
//   1. sendOtp()    — MSG91 widget sends an OTP to the phone, returns a reqId.
//   2. verifyOtp()  — MSG91 verifies the code, returns a short-lived accessToken.
//   3. consumerOtpLogin(accessToken) — POST it to the backend, which re-verifies
//      with MSG91's secret key, find-or-creates the consumer by phone, and
//      returns { token (JWT), consumer }. First OTP for a phone == signup.
//
// The MSG91 native module (@msg91comm/sendotp-react-native) requires a custom
// dev build — it will NOT work in Expo Go. Calls fail loudly if it isn't linked.

import { OTPWidget, Msg91Response } from '@msg91comm/sendotp-react-native';
import { request, ApiError } from './api';
import { MSG91_WIDGET_ID, MSG91_TOKEN_AUTH, DEFAULT_DIAL_CODE } from '../config/env';

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

let widgetReady = false;

/** Initialize the OTP widget once. Safe to call repeatedly; no-ops after the first. */
export function initOtpWidget(): void {
  if (widgetReady) return;
  try {
    OTPWidget.initializeWidget(MSG91_WIDGET_ID, MSG91_TOKEN_AUTH);
    widgetReady = true;
  } catch {
    // Native module not linked (e.g. Expo Go / pre-rebuild). sendOtp will throw
    // a clear error when the user actually tries to log in.
  }
}

/** Pull the string payload out of the widget's `{ type, message }` | string result. */
function unwrapMsg91(res: Msg91Response | string, fallbackErr: string): string {
  if (res && typeof res === 'object' && res.type === 'error') {
    throw new Error(res.message || fallbackErr);
  }
  const val = typeof res === 'string' ? res : res?.message;
  if (!val) throw new Error(fallbackErr);
  return String(val);
}

/**
 * Send an OTP to a national phone number. Returns the MSG91 reqId needed to
 * verify or resend. `dialCode` defaults to the configured country (+91).
 */
export async function sendOtp(national: string, dialCode = DEFAULT_DIAL_CODE): Promise<string> {
  initOtpWidget();
  const identifier = `${dialCode}${national}`;
  const res = await OTPWidget.sendOTP({ identifier });
  return unwrapMsg91(res, 'Could not send OTP. Please try again.');
}

/** Resend the OTP for an in-flight reqId. */
export async function resendOtp(reqId: string): Promise<void> {
  const res = await OTPWidget.retryOTP({ reqId });
  unwrapMsg91(res, 'Could not resend OTP.');
}

/** Verify the entered code; returns the MSG91 accessToken to hand to the backend. */
export async function verifyOtp(reqId: string, otp: string): Promise<string> {
  const res = await OTPWidget.verifyOTP({ reqId, otp });
  return unwrapMsg91(res, 'Invalid or expired OTP.');
}

/** Exchange a verified MSG91 accessToken for a backend session (login == signup). */
export async function consumerOtpLogin(accessToken: string): Promise<Session> {
  return request<Session>('/auth/consumer/otp/msg91', {
    method: 'POST',
    auth: false,
    body: { accessToken },
  });
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
