import { OTPWidget, type Msg91Response } from '@msg91comm/sendotp-react-native';
import { MSG91_WIDGET_ID, MSG91_TOKEN_AUTH } from '../../config/env';

/**
 * MSG91 half of the OTP client: the existing SDK flow, moved behind the provider-neutral
 * interface unchanged. The widget id / token are PUBLIC (the secret authkey is server-side).
 *
 * The MSG91 native module (@msg91comm/sendotp-react-native) requires a custom dev build: it
 * will NOT work in Expo Go. Calls fail loudly if it isn't linked.
 */
export const MSG91_OTP_LENGTH = 4;
export const MSG91_RESEND_SECONDS = 30;

let widgetReady = false;

/** Initialize the OTP widget once. Safe to call repeatedly; no-ops after the first. */
export function initMsg91(): void {
  if (widgetReady) return;
  try {
    OTPWidget.initializeWidget(MSG91_WIDGET_ID, MSG91_TOKEN_AUTH);
    widgetReady = true;
  } catch {
    // Native module not linked (e.g. Expo Go / pre-rebuild). Sending throws a clear error
    // when the user actually tries to log in.
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

/** Returns the reqId to verify or resend against. */
export async function msg91Send(dial: string, national: string): Promise<string> {
  initMsg91();
  const res = await OTPWidget.sendOTP({ identifier: `${dial}${national}` });
  return unwrapMsg91(res, 'Could not send OTP. Please try again.');
}

export async function msg91Resend(reqId: string): Promise<void> {
  const res = await OTPWidget.retryOTP({ reqId });
  unwrapMsg91(res, 'Could not resend OTP.');
}

/** Returns the access token the backend re-verifies. */
export async function msg91Verify(reqId: string, otp: string): Promise<string> {
  const res = await OTPWidget.verifyOTP({ reqId, otp });
  return unwrapMsg91(res, 'Invalid or expired OTP.');
}
