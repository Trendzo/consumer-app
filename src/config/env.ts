// Runtime config for the consumer app. Everything here is overridable via
// EXPO_PUBLIC_* env vars (see .env.local.example) — Expo inlines those at build
// time. The fallback defaults point at the live Trendzo backend so the app runs
// out of the box.
//
// NOTE ON MSG91 (single-account setup): both apps intentionally use ONE MSG91
// account (547225) — the widgetId/tokenAuth below. Server-side consumer OTP
// verification only succeeds when the backend's MSG91_AUTH_KEY is that SAME
// account's authkey (547225A1mZY…), which is how prod is configured. So keep
// backend MSG91_AUTH_KEY == MSG91_RETAILER_AUTH_KEY. Only give the consumer app
// its own widget (and split the backend keys) if you ever want separate
// analytics / quotas / SMS templates per app.

// Base URL of the backend, including the /api/v1 prefix.
export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE || 'https://backend-qpmx.onrender.com/api/v1';

// MSG91 OTP-widget public credentials (safe to ship; the secret authkey stays
// server-side). Defaults are the retailer widget from the reference app — see
// the note above.
export const MSG91_WIDGET_ID =
  process.env.EXPO_PUBLIC_MSG91_WIDGET_ID || '3667636f3464353730373939';
export const MSG91_TOKEN_AUTH =
  process.env.EXPO_PUBLIC_MSG91_TOKEN_AUTH || '547225TSvi20QFa026a47d90aP1';

// Consumer phones are Indian 10-digit national numbers server-side; the widget
// wants the full international identifier. Default country dial code is +91.
export const DEFAULT_DIAL_CODE = process.env.EXPO_PUBLIC_DIAL_CODE || '91';
