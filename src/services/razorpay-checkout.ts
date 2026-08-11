// Razorpay Checkout launcher. `react-native-razorpay` is a NATIVE module —
// lazy-required so JS bundles built without it (Expo Go / older dev clients)
// fail soft with a clear error instead of crashing at import time.
import type { PaymentBlock } from './orders';

export type CheckoutSuccess = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

/**
 * Open the Razorpay Checkout sheet for a placement's payment block.
 * Resolves with the signed success triplet; rejects when the user dismisses,
 * the payment fails, or the native module is missing.
 */
export async function openRazorpayCheckout(input: {
  payment: PaymentBlock;
  name?: string;
  email?: string;
  phone?: string;
}): Promise<CheckoutSuccess> {
  let RazorpayCheckout: { open: (opts: Record<string, unknown>) => Promise<CheckoutSuccess> };
  try {
    // Check the two native modules BEFORE requiring the package. Its JS entry
    // builds `new NativeEventEmitter(NativeModules.RazorpayEventEmitter)` at
    // import time, which throws on a null argument — so a missing module used to
    // surface as the generic catch below and told us nothing about which half
    // was absent.
    //
    // Both are LEGACY bridge modules (RCT_EXPORT_MODULE, no TurboModule spec)
    // reached through React Native's interop layer under the New Architecture.
    // That interop is what expo-doctor's "unsupported on New Architecture"
    // warning is really about: not certified, rather than known-broken.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { NativeModules } = require('react-native');
    const missing = [
      NativeModules?.RNRazorpayCheckout ? null : 'RNRazorpayCheckout',
      NativeModules?.RazorpayEventEmitter ? null : 'RazorpayEventEmitter',
    ].filter(Boolean);
    if (missing.length) {
      throw new Error(
        `Razorpay native module not linked (${missing.join(', ')}). ` +
          'This build cannot take payments — reinstall the app from a fresh native build.',
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    RazorpayCheckout = require('react-native-razorpay').default;
    if (!RazorpayCheckout?.open) throw new Error('Razorpay checkout module loaded but has no open()');
  } catch (e: any) {
    throw new Error(e?.message || 'Payments unavailable in this build — update the app');
  }
  return RazorpayCheckout.open({
    key: input.payment.keyId,
    order_id: input.payment.gatewayOrderId,
    amount: input.payment.amountPaise,
    currency: input.payment.currency,
    name: 'Trendzo',
    description: 'Order payment',
    prefill: {
      ...(input.name ? { name: input.name } : {}),
      ...(input.email ? { email: input.email } : {}),
      ...(input.phone ? { contact: input.phone } : {}),
    },
    theme: { color: '#111111' },
  });
}
