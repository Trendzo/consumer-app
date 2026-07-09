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
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    RazorpayCheckout = require('react-native-razorpay').default;
  } catch {
    throw new Error('Payments unavailable in this build — update the app');
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
