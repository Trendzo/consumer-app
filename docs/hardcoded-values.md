# ClosetX Customer App — Hardcoded Values That Should Come From the Backend

An inventory of everything the consumer app decides for itself that the server should be
deciding. Each entry names the file and line, says what the backend can serve today, and
grades how much work the change is.

## How this is graded

- **Wire it** — the endpoint already exists and returns the right data. The app simply does
  not call it. Frontend-only work.
- **Expose it** — the data exists in the database and the backend already uses it internally,
  but no consumer-readable endpoint returns it. Small backend change plus wiring.
- **Build it** — there is no table and no endpoint. Needs product decisions and backend work
  before the app can change.

A separate axis matters more than effort: whether the hardcoded value is merely stale, or
whether it actively **misleads the customer or produces a wrong result**. Those are called out
as **Incorrect**, and they should be fixed regardless of grade.

---

## 1. The short list

If nothing else on this document gets done, do these six.

| What | Why it matters | Grade |
| --- | --- | --- |
| Every saved address gets Mumbai's coordinates | Breaks delivery routing and radius checks for every customer outside Mumbai | Wire it |
| Wallet balance, loyalty points, referral code | The app shows invented numbers as though they were the customer's real balance | Wire it |
| Coupon codes | The customer applies a code that is never sent, and pays more than the total shown | Wire it |
| Pickup slots | Checkout requires a slot the app has no way to fetch, so every pickup order fails | Expose it |
| Try-and-Buy promises | The app promises limits and a trial length the backend does not enforce | Expose it |
| Delivery fees | The same prices are written in two screens and again in the backend config | Expose it |

---

## 2. Incorrect: values that produce wrong behaviour

### 2.1 Every address is geocoded to Mumbai

`ProfileScreens.tsx:114`

```ts
const DEFAULT_COORDS = { lat: 19.076, lng: 72.8777 };
```

Used at `ProfileScreens.tsx:165` for **every address the customer creates**. The backend
requires `lat` and `lng` as finite numbers because they drive order routing and the
`serviceable_radius_meters` check (`compute-quote.ts`), and latitude and longitude also feed the
place-of-supply logic for GST.

So a customer in Delhi saves a Delhi address and the server believes they are in Mumbai. This is
not a cosmetic default; it silently corrupts routing for everyone outside one city.

The fix is a real geocode. `GET /api/v1/pincode/:pin` already exists without auth and returns
city, state and country for a six-digit pincode, which at least lets the app confirm the city
and prefill the state code. For coordinates the app needs either a geocoding provider or a
device-location capture on the address form.

**Grade: Wire it** for city and state; **Build it** for true coordinates.

### 2.2 The app promises Try-and-Buy rules the backend does not have

`ProfileScreens.tsx:1526`, `:1534`, `:1536`, `:1560`

```
"Order up to 5 items. Courier waits 15 min at your door."
"Max trial slots per month: 3"
```

Neither the five-item cap nor the three-per-month cap exists anywhere in the backend. There is
no table, no config key, and no validation. The app is stating rules to the customer that
nothing enforces.

The trial length is worse than merely hardcoded. The app says fifteen minutes in six places
(`AboutScreen.tsx:19`, `CheckoutScreen.tsx:26`, `:268`, `:333`, `OrderScreens.tsx:25`, `:88`,
`:199`, `:203`). The backend reads `try_on_window_seconds`, which is **seeded at 900 seconds but
falls back to 600 in code** (`door-visit.ts:64`). On any environment where that config row is
missing, the courier leaves after ten minutes while the app promised fifteen.

The order detail response already returns `doorWindowExpiresAt` as an absolute timestamp, so the
countdown screen can be driven from real data today. The marketing copy needs the window length
itself, which is not exposed.

**Grade: Wire it** for the live countdown; **Expose it** for the copy; **Build it** for the caps
if they are meant to be real.

### 2.3 Fake balances presented as the customer's own

| Value | Location |
| --- | --- |
| Wallet balance ₹1,240 | `ReviewOrderScreen.tsx:17`, `CheckoutScreen.tsx:19`, `ProfileScreens.tsx:282` |
| Loyalty points 1,240 | `ProfileScreens.tsx:352`, `ProfileScreen.tsx:65` |
| Reward points 240 | `ReviewOrderScreen.tsx:19` |
| Referral code TRENDZO42 | `ProfileScreens.tsx:592`, `:619`, `FeatureScreens.tsx:911-916`, `:960-962` |
| Referral stats 7 invited, ₹800 earned | `ProfileScreens.tsx:607` |
| Saved cards and UPI IDs | `ProfileScreens.tsx:280-282` |

Every one of these has a working endpoint: `GET /consumer/wallet`, `GET /consumer/loyalty`,
`GET /consumer/referrals/me`. The services are written (`services/wallet.ts`,
`services/loyalty.ts`, `services/referrals.ts`) and **no screen imports any of them**.

The referral case is the sharpest: the real code is already on the profile object as
`referralCode`, and the app ignores it in favour of a constant. Two customers who both open the
invite screen are told to share the same code.

**Grade: Wire it.**

### 2.4 Coupons that are never sent

`CartScreen.tsx:88-95` accepts exactly one code:

```ts
if (coupon.toUpperCase() === 'NEWVIBE') { ... }
else showToast('Invalid code', 'Try NEWVIBE', 'x');
```

`ReviewOrderScreen.tsx:295-296`, `:336` hardcode a second, different code, `TRENDZO50`, worth
₹50 — and `placeIt` never transmits it. `ProductDetailScreen.tsx:548` advertises `TRENDZO50` as
an upsell. `FeatureScreens.tsx:241-245` lists five codes with invented expiry dates.

The consequences are concrete: any genuine promotion the business creates is rejected by the app
as invalid, and any code the customer does apply reduces the displayed total without reducing
what they are charged.

`GET /promotions/active` exists with no auth and returns live coupons and offers. The pricing
endpoints already accept `couponCode` and `voucherCode` and return structured `rejectedCodes`
explaining exactly why a code failed. None of that is used.

**Grade: Wire it.**

### 2.5 Support contact details

`ProfileScreens.tsx:783-787` hardcodes the phone number `1800-266-0000`, the address
`care@trendzo.in`, and the opening hours. If any of these change, a shipped app sends customers
to a dead line.

The backend has `env.PUBLIC_SUPPORT_EMAIL`, rendered in the public HTML support page, but no
JSON endpoint returns it.

**Grade: Expose it.**

---

## 3. Wire it: the endpoint already exists

These need no backend work at all. The service functions are written and unused.

| Hardcoded now | File | Endpoint that already exists |
| --- | --- | --- |
| Wallet balance and history | `ProfileScreens.tsx:282` | `GET /consumer/wallet` |
| Loyalty points and history | `ProfileScreens.tsx:352` | `GET /consumer/loyalty` |
| Referral code and stats | `ProfileScreens.tsx:592-607` | `GET /consumer/referrals/me` |
| Gift card list | `ProfileScreens.tsx` gift card screen | `GET /consumer/gift-cards`, `POST /redeem` |
| Returnable orders list | `ProfileScreens.tsx:1141` (`RETURNABLE_ORDERS`) | `GET /consumer/checkout/orders`, `POST /consumer/returns` |
| Support topics as inert buttons | `ProfileScreens.tsx:789-794` | `POST /consumer/issues` and the full issue thread API |
| Reels feed, likes, comments | `ReelsScreen.tsx:20-46` | The complete `/consumer/reels` CRUD and social API |
| Product reviews fallback | `ProductDetailScreen.tsx:32` (`REVIEWS`) | `GET /catalog/products/:id/reviews` |
| Review list screen | `ProfileScreens.tsx:1355` (`MOCK_REVIEWS`) | Same endpoint |
| Coupon wallet expiry dates | `FeatureScreens.tsx:241-245` | `GET /promotions/active` returns real `validUntil` |
| Order tracking status | `OrderScreens.tsx:107` (a four-second timer) | `GET /consumer/checkout/orders/:id` |
| Pickup code | `CheckoutScreen.tsx:61` generates one on the device | The real `pickupCode` is in the order detail response |

The size and colour pickers deserve a note. `ProductDetailScreen.tsx:30-31` declares

```ts
const SIZES = ['XS', 'S', 'M', 'L', 'XL'];
const COLORS = ['#000000', '#666666', '#bdbdbd', '#FFFFFF'];
```

Real sizes and colours already arrive inside every product payload as `variants` and `groups`
with `colorHex`. There is also `GET /catalog/size-scales?categoryId=` which returns the correct
scale per category, so footwear gets UK sizes rather than letters. These constants should be
fallbacks only.

---

## 4. Expose it: the data exists but is not readable by the app

### 4.1 Delivery methods and fees

Written in the app twice, with the same numbers in both places:

- `CartScreen.tsx:23` — `METHOD_META`
- `ReviewOrderScreen.tsx:24-27` — `DELIVERY_META`, express ₹99, standard ₹49, pickup ₹0

The backend holds these in `platform_config.base_delivery_fee_table`
(`{express: 9900, standard: 4900, pickup: 0, try_and_buy: 9900}` paise) multiplied by
`surge_multiplier`, and stores can override per store. The numbers happen to agree right now.
They will not after the first pricing change, and the app will be wrong in two files.

Partial relief already exists: `POST /pricing/quote` returns `deliveryOptions`, a per-method fee
map. `ReviewOrderScreen.tsx:130` does use it when a quote is available and falls back to the
constant otherwise. The labels, delivery-time copy and icons remain local.

**Recommendation:** serve the method list itself — id, label, blurb, estimated time and fee —
rather than only the fee.

### 4.2 Pickup slots

`store_pickup_slots` exists with day, start, end, capacity and active flag. Retailer and admin
endpoints read and write it. **There is no consumer endpoint**, yet checkout validation requires
`pickupSlotId`, `pickupSlotStart` and `pickupSlotEnd`.

This is why every pickup order fails. `CheckoutScreen.tsx:30-33` compensates with three invented
stores, complete with fake distances and opening hours.

Needed: `GET /catalog/stores/:id/pickup-slots`.

### 4.3 Store information

Consumers receive only `{ id, legalName }` on a product. There is no consumer store endpoint at
all: no address, no coordinates, no opening hours, no gallery, no store code.

The app fills the gap with `CheckoutScreen.tsx:30-33`, which hardcodes store names, distances
("2.4 km"), ETAs and hours. `OrderScreens.tsx` derives a fake pickup code from the store name.

Needed: a consumer-safe store projection, and a nearby-stores query if store pickup is a real
feature.

### 4.4 Loyalty economics and tier

`ProfileScreens.tsx:343` hardcodes the tier ladder. The backend derives tiers from
`loyalty_tier_silver_min` (500), `_gold_min` (2000) and `_platinum_min` (5000) — and those three
keys are **read with code fallbacks but never seeded**, so changing them in the database today
has no effect unless an admin inserts the rows.

`GET /consumer/loyalty` returns a balance and transactions but no tier, no thresholds, no
progress to the next tier, and none of the economics: point value in paise, earn rate, minimum
redeemable, maximum redeemable fraction. The app cannot correctly say "use 240 points, saves
₹240" without knowing the point value.

There is also a live inconsistency worth fixing at the same time: the grant path reads
`loyalty_min_redeemable_points` and `loyalty_max_redeem_fraction_bp` while the quote engine reads
`min_redeemable_points` and `max_redeem_fraction_bp`. The prefixed keys are never seeded, so the
two paths disagree — 100 percent redeemable in one, 20 percent in the other.

### 4.5 Return window and reasons

`ProfileScreens.tsx` return screen checks a local day counter. The real window is
`RETURN_WINDOW_DAYS = 7` in `open-return.ts:34` — a TypeScript constant, not a config key, so it
cannot be changed without a deploy on either side.

Return reasons are a fixed Zod enum (`damaged`, `wrong_item`, `not_as_described`, `doesnt_fit`,
`other`) with no endpoint, so the app's reason list is a second copy.

Needed: a return-policy endpoint, or include eligibility and a deadline per order in the order
detail response. The latter is better, because eligibility depends on delivery date, item
outcome and the frozen `final_sale` policy snapshot — all of which only the server knows.

### 4.6 Notification inbox

`GameScreens.tsx:826` hardcodes a notification list. The `notifications` table already stores
consumer rows with kind, title, body, deep link and read state, written by
`shared/notify-consumer.ts`. Admin and retailer have list and mark-read endpoints. **Consumers do
not.**

Needed: `GET /consumer/notifications` and `POST /consumer/notifications/:id/read`.

### 4.7 Everything else in platform config

There is **no consumer-readable config endpoint of any kind**. Over fifty operational values
live in `platform_config` and none are visible to the app. Beyond the ones already listed, these
directly affect what the app should be telling customers:

| Key | Default | Where the app currently guesses |
| --- | --- | --- |
| `payment_abandon_minutes` | 30 | Never mentioned; orders vanish without explanation |
| `pickup_noshow_cancel_days` | 3 | Not surfaced |
| `order_close_after_days` | 7 | Not surfaced |
| `acceptance_window_seconds` | 180 | Not surfaced |
| `holding_window_days` | 14 | Not surfaced |
| `referrer_points` / `referred_points` | 200 / 100 | Invite copy says ₹200, hardcoded |

**Recommendation:** one `GET /consumer/bootstrap` returning a whitelisted, consumer-safe subset
of config plus the legal document versions. Cache it for an hour. This is the single most
useful new endpoint on this list, because it retires a dozen scattered constants at once.

---

## 5. Build it: no backend representation exists

### 5.1 The entire home page

There is no table and no endpoint for home rails, hero banners, stories, deals, editorial
content or rail ordering. The `banners` table exists but is scoped to retailers and admins only,
with no consumer scope.

Everything on Home is therefore a constant in the app, including which images appear, in what
order, and with what copy:

| Content | Location |
| --- | --- |
| Hero campaign banners | `HomeScreen.tsx:38-57` |
| Explore grid tiles | `HomeScreen.tsx:103-120` |
| Steals rail | `HomeScreen.tsx:73-82` |
| Occasion rails | `HomeScreen.tsx:131-150` |
| Stories | `HomeSectionScreens.tsx:181-192` |
| Steals bands | `HomeSectionScreens.tsx:78` |
| Flash-fit bundles | `HomeSectionScreens.tsx:417-422` |
| Editorial "For Her" and "For Him" | `HomeSectionScreens.tsx:567-610` |
| Flash-sale countdown target | `HomeSectionScreens.tsx:428` |

Home also deliberately never fetches categories — `HomeScreen.tsx:290-294` states that the
category strip is always local artwork so the gender crossfade never waits on the network.

Changing any of this needs an app release. A merchandiser cannot run a campaign.

**Recommendation:** a `GET /consumer/home?gender=` returning an ordered list of typed sections
(hero, rail, grid, banner, countdown), each with its title, its items and an optional schedule.
Collections already provide the item-level primitive; what is missing is the layout and
scheduling around them.

### 5.2 Gamification

Nothing exists on the backend: no spin wheel, no daily rewards claim, no streaks, no quests, no
lucky draw, no scratch cards, no style quiz. The app hardcodes all of it — `WEEK_REWARDS` at
`GameScreens.tsx:18`, `SLICES` at `:138`, `QUESTS` at `FeatureScreens.tsx:1077`.

Two config keys are seeded and admin-editable but read by no code at all:
`daily_reward_table` = `[10,20,30,40,50,60,100]` and `quiz_completion_points` = 50.
`welcome_points` = 100 is likewise never granted.

Note that all six game screens are currently unreachable in the app, so this is not urgent — but
if they are switched on, every reward is client-side and trivially forgeable.

### 5.3 Onboarding, legal and static content

Onboarding slides are three bundled images with local copy (`OnboardingScreen.tsx:28-30`), and
`AboutScreen.tsx:19` restates the Try-and-Buy policy in its own words.

`GET /legal/terms` and `GET /legal/privacy` do exist and return a version and label, and the app
uses neither. There is no returns policy, shipping policy or refund policy document kind, and no
consumer terms-acceptance endpoint.

Support FAQ (`ProfileScreens.tsx:796-802`) restates the return window, refund timing and gift
card rules as prose. Every one of those numbers is a duplicate of a backend rule.

### 5.4 Localisation

`ProfileScreens.tsx:719-727` lists nine languages. Nothing is translated; there is no locale
handling and no backend locale support. The screen sets local state only.

### 5.5 Category filter and colour chips

`CategoryScreen.tsx:17` hardcodes filter chips, and `CategoryBrowseScreen.tsx:438` hardcodes
twelve colour swatches. Neither is applied to any query.

`GET /catalog/facets` already returns real category counts and could drive the chips. Colour has
no controlled vocabulary anywhere in the backend — colours exist only per listing as
`variant_groups.colorHex` — so a colour filter needs either a palette table or a derived facet.

Occasions have the same problem: `product_listings.occasion` is free text with no vocabulary and
no endpoint.

---

## 6. Configuration and secrets

`src/config/env.ts` ships defaults compiled into the binary:

```ts
export const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'https://backend-qpmx.onrender.com/api/v1';
export const MSG91_WIDGET_ID = process.env.EXPO_PUBLIC_MSG91_WIDGET_ID || '3667636f3464353730373939';
export const MSG91_TOKEN_AUTH = process.env.EXPO_PUBLIC_MSG91_TOKEN_AUTH || '547225TSvi20QFa026a47d90aP1';
export const DEFAULT_DIAL_CODE = process.env.EXPO_PUBLIC_DIAL_CODE || '91';
```

The MSG91 values are the widget's public pair and the file documents that the secret authkey
stays server-side, so this is not a credential leak. It is still a hardcoded vendor binding: the
OTP provider cannot be changed, rotated or regionally varied without an app release. Given the
backend has no rate limiting on OTP endpoints, a shipped widget token is worth revisiting.

The dial code is the more practical limit. It fixes the app to India. Anything international
needs a country picker driven by a served list.

---

## 7. Recommended endpoints, in order

1. **`GET /consumer/bootstrap`** — whitelisted config: delivery method list with fees and copy,
   try-on window and extension, return window, loyalty economics and tier thresholds, abandon
   and close windows, support contacts, legal document versions, minimum supported app version.
   Cache one hour. Retires the largest number of constants for the least work.
2. **`GET /catalog/stores/:id/pickup-slots`** — unblocks pickup checkout, which cannot currently
   succeed at all.
3. **`GET /consumer/notifications`** plus mark-read — the data is already being written.
4. **Order detail: add return eligibility** — a boolean and a deadline per item, so the app stops
   recomputing a policy it does not own.
5. **`GET /consumer/loyalty` extended** — add tier, thresholds and progress alongside the balance.
6. **`GET /consumer/home?gender=`** — typed, ordered, schedulable sections. The largest piece of
   work here and the one that ends app releases for merchandising.
7. **A consumer store projection** — name, address, coordinates, opening hours, images.

## 8. Suggested sequence

**First, wiring only, no backend changes.** Wallet, loyalty, referrals, gift cards, returns,
issues, reels, reviews, real coupons through the pricing endpoints, real order tracking and the
real pickup code. This alone removes every fake balance and every fake code from the customer's
view.

**Second, the address coordinates.** Either capture device location on the address form or add a
geocode step. Until this lands, routing is wrong for every customer outside Mumbai.

**Third, the bootstrap endpoint,** then delete the duplicated delivery fees, try-on window,
return window and loyalty numbers from the app.

**Fourth, pickup slots and the store projection,** which together make store pickup work for the
first time.

**Fifth, the home CMS,** once someone owns the question of who schedules campaigns and how.

While doing the first pass, delete the promises that nothing enforces — the five-item cap and the
three-trials-per-month limit — or implement them. Stating a rule the system does not apply is
worse than having no rule.
