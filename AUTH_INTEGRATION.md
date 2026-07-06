# Consumer auth — phone OTP + backend integration

This app now has a **real, backend-wired login** alongside the original (mock)
email/password + social screens, which are kept but unchanged.

## The flow

```
Login landing ──"Continue with phone"──▶ PhoneAuth (enter phone ─▶ enter OTP)
                                              │
                                    verifyOtp → accessToken
                                              │
                              POST /api/v1/auth/consumer/otp/msg91
                                     { token, consumer }
                                              │
                        profileComplete? ──no──▶ CompleteProfile (name/email/gender)
                                     │                     │  PATCH /consumer/profile/me
                                    yes                    ▼
                                     └────────────▶ back into the app (session persisted)
```

- **OTP is signup + login in one** — the backend find-or-creates the consumer by
  verified phone. First OTP for a number creates the account.
- The **JWT is persisted** to AsyncStorage (`@closetx/token` / `@closetx/user`) and
  rehydrated on launch, so users stay signed in. `signOut()` clears it.
- The token is attached as `Authorization: Bearer` on every backend call via the
  module-level holder in `src/services/api.ts`.

## New / changed files

| File | Purpose |
|---|---|
| `src/config/env.ts` | API base + MSG91 widget creds (env-overridable) |
| `src/services/api.ts` | fetch client: envelope unwrap, Bearer token, error mapping |
| `src/services/auth.ts` | MSG91 sendOtp/verifyOtp + `consumerOtpLogin` / `getMe` / `updateMe` |
| `src/screens/PhoneAuthScreen.tsx` | phone → OTP UI |
| `src/screens/CompleteProfileScreen.tsx` | name/email/gender completion |
| `src/types/msg91.d.ts` | type stub for the native OTP module |
| `src/state/AppState.tsx` | `token`, `signInWithSession`, `applyConsumer`, persistence, hydrate; `signOut` clears token |
| `src/components/Brutal.tsx` | `BrutalInput` gained `maxLength/autoFocus/editable/error/...` |
| `src/navigation/RootNav.tsx` | registers `PhoneAuth` + `CompleteProfile` |
| `src/screens/AuthScreens.tsx` | landing gained a "Continue with phone" button |

## To run it

1. **Install the OTP native module** (added to `package.json`):
   ```
   cd consumer-app && npm install
   ```
2. **It requires a custom dev build — it does NOT work in Expo Go.** Rebuild:
   ```
   npx expo prebuild        # if ios/android dirs aren't present
   npx expo run:ios         # or: npx expo run:android
   ```
3. **Configure credentials** — copy `.env.local.example` to `.env.local`, then
   `npx expo start -c`.

## ⚠️ One thing to confirm before consumer OTP verifies end-to-end

The MSG91 widget defaults in `src/config/env.ts` are the **retailer** widget
(the only credentials present in this repo — pulled from the `mobile` app). The
backend verifies **consumer** OTP tokens against a *separate* consumer MSG91
account (`MSG91_AUTH_KEY`, not `MSG91_RETAILER_AUTH_KEY`). The send/verify UX
works with either pair, but the final `/consumer/otp/msg91` step will only pass
once you set the **consumer** widget's `EXPO_PUBLIC_MSG91_WIDGET_ID` /
`EXPO_PUBLIC_MSG91_TOKEN_AUTH` in `.env.local`.
