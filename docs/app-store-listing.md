# App Store Connect — submission content

Everything App Store Connect asks for, written out so each field is copy-paste.
Grounded in what the app actually does, not guessed — the privacy answers below were derived from
the code (`src/services/auth.ts`, `orders.ts`, `tryOn.ts`, `geo.ts`) and from `Info.plist`.

**App:** Trendzo · **Bundle ID:** `com.trendzo.consumer` · **Apple ID:** 6800428541
**Team:** `3LCA4AA483`

---

## 1. Version information

| Field | Value |
| --- | --- |
| **App name** (30 max) | `Trendzo` |
| **Subtitle** (30 max) | `Fashion delivered in 60 min` |
| **Category — primary** | Shopping |
| **Category — secondary** | Lifestyle |
| **Age rating** | 4+ (see §5) |
| **Copyright** | `2026 Trendzo` |

### Promotional text (170 max — editable without a new build)

```
New drops every week, delivered from a store near you in about an hour. Try before you buy at your
door, keep what fits, hand back the rest.
```

### Description (4000 max)

```
Trendzo is fashion that arrives before you change your mind.

SHOP THE LOOK
Browse curated edits, weekly drops and trending categories for her and him. Every piece comes from a
real store near you, so what you see is what is actually in stock.

DELIVERED IN ABOUT AN HOUR
Express delivery from your nearest partner store, usually inside 60 minutes. Prefer to wait? Choose
standard delivery, or collect free at the counter with in-store pickup.

TRY BEFORE YOU BUY
With Try and Buy, your order arrives the next day and the delivery agent waits at your door while
you try everything on. Keep what fits and hand back the rest on the spot.

SEE IT ON YOU
Upload a photo and see how a piece looks on you before you order.

STEALS AND FLASH FITS
Price-banded deals, daily flash fits and editorial collections built around real moments: the coffee
run, clock-out looks, weekend plans.

REELS AND COMMUNITY
Watch shoppable reels, save looks to mood boards and see how other people are wearing the same
pieces.

EVERY CHARGE, UP FRONT
Delivery, service and taxes are itemised in your bill before you pay. What the pay button says is
exactly what you are charged.
```

### Keywords (100 char max, comma-separated, no spaces)

```
fashion,clothing,online shopping,60 minute delivery,try and buy,outfits,style,dresses,streetwear
```

### URLs

| Field | Value |
| --- | --- |
| **Support URL** | *required* — a reachable page with a contact route |
| **Marketing URL** | optional |
| **Privacy Policy URL** | **required, and must be live before submission** |

> The privacy policy URL is a hard blocker: App Store Connect will not accept the version without
> it, and the page must actually load.

---

## 2. App Review Information

**This is the single most common rejection cause for this app**, because the whole experience is
behind a phone-OTP sign-in that a reviewer in Cupertino cannot complete — an Indian mobile number
receiving an SMS.

| Field | Value |
| --- | --- |
| **Sign-in required** | **Yes** |
| **Demo account** | A phone number the reviewer can use |
| **Password** | The OTP, or a fixed bypass code |

### Required backend work before submitting

Either:

1. **A test account with a fixed OTP** — a specific phone number where `verifyOtp` accepts a known
   code (e.g. `1111`) without sending an SMS, or
2. **A review bypass** the reviewer can enter.

Without one of these the reviewer cannot get past the auth sheet, and the app is rejected on
Guideline 2.1 every time.

### Notes for the reviewer

```
Trendzo is a fashion marketplace for India. Sign in uses a phone number and a 4-digit OTP.

Please use the demo number above with OTP <fixed code> — it bypasses the SMS.

Delivery, store pickup and Try and Buy are available where partner stores operate (currently
Mumbai). Location permission is requested only when adding a delivery address.

Payments run through Razorpay in test mode for this build; no real charge is made.
```

---

## 3. App Privacy

No tracking SDKs are present in the app (verified against `package.json` — no Firebase, Facebook,
AppsFlyer, Segment, Amplitude, Adjust). So:

- **Used to Track You:** **nothing**. Answer "No" to tracking.
- Everything below is **Linked to You** (tied to the account) and used for **App Functionality**.

| Data type | Collected | Why |
| --- | --- | --- |
| **Phone number** | Yes | Account identity — sign-in is phone + OTP (MSG91) |
| **Name** | Yes | Required before an order can be placed |
| **Email address** | Yes | Required before an order can be placed; order receipts |
| **Physical address** | Yes | Delivery addresses |
| **Coarse location** | Yes | Only while adding an address, and to find nearby pickup stores |
| **Photos** | Yes | Only the photo you choose for virtual try-on |
| **Purchase history** | Yes | Orders, returns, refunds |
| **Customer support** | Yes | Support issues and messages |
| **User content** | Yes | Reviews, community posts, reels, mood boards |
| **Payment info** | **No** | Card details never touch the app — Razorpay's own sheet handles them |

**Third parties that receive data:** Razorpay (payments), MSG91 (OTP delivery), Google Cloud Vertex
AI (virtual try-on image generation), and the Trendzo backend.

> Declare **Photos** honestly. The try-on photo is uploaded to the backend and sent to a third-party
> AI provider — that is data leaving the device, and under-declaring it is a rejection risk.

---

## 4. Build and export compliance

Already handled in code — no action needed in the form:

- `ITSAppUsesNonExemptEncryption = false` is now set in `Info.plist`, so uploads no longer stop to
  ask the export-compliance question. The app uses only standard HTTPS, which is exempt.
- All permission purpose strings are real sentences. The two Apple placeholders
  (`NSLocationAlwaysUsageDescription`, `NSPhotoLibraryAddUsageDescription`) were replaced — Apple
  rejects generic `$(PRODUCT_NAME)` strings.

---

## 5. Age rating

Answer **None** to every content question → **4+**.

One judgement call: the app contains **Spin & Win, Lucky Draw and Push & Win**. These are reward
mechanics with no real-money wagering and no cash payout, so they are *not* gambling and do not
force a 17+ rating. If any of them ever pays out real money, the rating and the review answers must
change.

---

## 6. Screenshots (required)

Required sizes, PNG or JPG, no alpha:

| Display | Size (px) | Required |
| --- | --- | --- |
| 6.9" (iPhone 17 Pro Max) | 1320 × 2868 | **Yes** |
| 6.5" (iPhone 11 Pro Max) | 1242 × 2688 | **Yes** |
| 12.9" iPad Pro | 2048 × 2732 | Only if you ship iPad |

> `app.json` currently sets `"supportsTablet": true`, so **iPad screenshots are required** and the
> reviewer will test on iPad. If the layouts are not iPad-ready, set `supportsTablet: false` and
> rebuild — that is far cheaper than an iPad rejection.

Suggested six, in order: Home hero · Category browse · Product detail · Virtual try-on result ·
Bag with the free-delivery meter · Order tracking.

---

## 7. Pre-submission checklist

- [ ] Privacy policy URL live and loading
- [ ] Support URL live
- [ ] Demo account with a fixed OTP working end to end
- [ ] iPad decision made (`supportsTablet`) and matching screenshots uploaded
- [ ] Screenshots for 6.9" and 6.5"
- [ ] App Privacy answers submitted (§3)
- [ ] Age rating questionnaire answered (§5)
- [ ] Razorpay verified working on a Release build — it is a legacy bridge module running through
      New Architecture interop, so it must be proven on Release, not Debug
- [ ] Home does not freeze on a Release build, cold launch and after navigating back
