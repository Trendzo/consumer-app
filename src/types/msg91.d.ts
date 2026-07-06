// Typed stub for @msg91comm/sendotp-react-native (ships without types).
// Mirrors the surface used by services/auth.ts.
declare module '@msg91comm/sendotp-react-native' {
  export interface Msg91Response {
    type?: 'success' | 'error';
    message?: string;
    [key: string]: unknown;
  }
  export const OTPWidget: {
    initializeWidget(widgetId: string, tokenAuth: string): void;
    sendOTP(data: { identifier: string }): Promise<Msg91Response | string>;
    retryOTP(data: { reqId: string; retryChannel?: number }): Promise<Msg91Response | string>;
    verifyOTP(data: { reqId: string; otp: string }): Promise<Msg91Response | string>;
  };
}
