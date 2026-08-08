# ClosetX / Trendzo — Consumer API Integration Guide

**Scope:** every backend endpoint needed to build the Home page sections in
[`home-link-map.md`](./home-link-map.md) **and every screen those sections lead to**, with full
request/response contracts and all possible responses.

**Audience:** frontend / app integration team.

**Source of truth:** `backend/src/modules/**` + `backend/src/shared/**` at the time of writing.
Every shape below is transcribed from the controller that produces it, not from a spec.

---

## Table of contents

1. [Transport basics](#1-transport-basics)
2. [Global error model](#2-global-error-model)
3. [Home section → screen → endpoint map](#3-home-section--screen--endpoint-map)
4. [The filter endpoint — `GET /catalog/products`](#4-the-filter-endpoint--get-catalogproducts)
5. [Endpoint reference](#5-endpoint-reference)
   - [A. Public config & content](#a-public-config--content)
   - [B. Catalog](#b-catalog)
   - [C. Auth & profile](#c-auth--profile)
   - [D. Cart](#d-cart)
   - [E. Pricing](#e-pricing)
   - [F. Checkout, orders & payments](#f-checkout-orders--payments)
   - [G. Addresses](#g-addresses)
   - [H. Returns](#h-returns)
   - [I. Support issues](#i-support-issues)
   - [J. Offers, rewards, wallet, loyalty, gift cards, referrals, spin](#j-offers-rewards-wallet-loyalty-gift-cards-referrals-spin)
   - [K. Reels](#k-reels)
   - [L. Community (posts + reviews + reports)](#l-community-posts--reviews--reports)
   - [M. Moodboards](#m-moodboards)
   - [N. Virtual try-on](#n-virtual-try-on)
   - [O. Notifications & push](#o-notifications--push)
   - [P. Analytics events](#p-analytics-events)
   - [Q. Media upload](#q-media-upload)
6. [Screen-by-screen recipes](#6-screen-by-screen-recipes)
7. [Gaps — what has no API yet](#7-gaps--what-has-no-api-yet)
8. [Appendix — enums, ids, units](#8-appendix--enums-ids-units)

---

## 1. Transport basics

### Base URL

```
https://backend-qpmx.onrender.com/api/v1
```

Overridable in the app via `EXPO_PUBLIC_API_BASE` (see `customer-app/src/config/env.ts`).
**The `/api/v1` prefix is part of the base** — every path in this document is appended to it.

Health check (outside the prefix): `GET /health` → `{ success: true, data: { status: "ok", uptime } }`.
Ping (inside): `GET /api/v1/ping` → `{ success: true, data: { pong: true } }`.

### Response envelope

Every response — success or failure — is wrapped:

```jsonc
// success
{ "success": true, "data": <payload> }

// failure
{ "success": false, "error": { "code": "not_found", "message": "Order not found", "details": <optional> } }
```

The app's `request()` helper (`services/api.ts`) unwraps `data` and throws `ApiError` carrying
`.code`, `.status`, `.details`. **Never branch on the message string — branch on `error.code`.**

### Authentication

```
Authorization: Bearer <jwt>
```

Four token kinds exist (`admin`, `retailer`, `consumer`, `driver`); the consumer app only ever
holds a **consumer** token, obtained from `POST /auth/consumer/otp/msg91`. A token of the wrong
kind on a route is `403 forbidden`, not `401`.

Routes fall into three auth classes, marked on every endpoint below:

| Class | Meaning |
|---|---|
| **Public** | No `Authorization` header at all. Sending one is harmless. |
| **Optional** | Works signed-out; a valid token *enriches* the response (viewer flags, loyalty/wallet in a quote). Never rejects on a bad token for the optional part. |
| **Consumer** | `requireAuth('consumer')`. Missing/invalid token → 401. |

Consumer tokens use `JWT_CONSUMER_ACCESS_EXPIRES_IN` (long-lived). **There are no refresh
tokens.** On a 401 the app must re-run the OTP flow.

### Caching, ETag, compression

- `@fastify/etag` is registered globally (weak ETags). Send `If-None-Match` on repeat GETs and
  handle **`304 Not Modified` with an empty body** — `res.json()` on a 304 throws.
  The app models this as `ApiError('not_modified', status 304)` and re-dates its cached value.
- Responses > 1 KB are gzip/deflate compressed automatically.
- No `Cache-Control` headers are sent. Client-side TTLs the app currently uses:
  `/catalog/categories` 5 min · `/catalog/brands` 10 min · `/catalog/products` 60 s ·
  `/catalog/size-scales` 60 min · `/cms/home` per `services/cms.ts` · `/app-config` 1 h recommended.
- GETs are de-duplicated in-flight by URL + auth scope in `services/api.ts`. Mutations never are.

### Timeouts and network failures

The client aborts after 30 s by default and surfaces two synthetic codes that the backend never
sends: `timeout` and `unreachable`. A non-JSON body (proxy/502 HTML page) surfaces as
`bad_response`. Treat all three as "retryable, not the user's fault".

### CORS & multipart

CORS reflects any origin (or an allow-list if `CORS_ORIGIN` is set), `credentials: true`.
Multipart uploads cap at **25 MB per file globally**; the reels media route overrides to 100 MB.

### Units and conventions

| Convention | Rule |
|---|---|
| Money | **Always integer paise**, field names end in `Paise`. Divide by 100 for ₹. Never float. |
| Timestamps | ISO-8601 UTC strings. Some rows serialize `Date` → ISO automatically; treat all as ISO. |
| Ids | Prefixed opaque strings — `lst_` listing, `var_` variant, `ord_` order, `og_` order group, `cat_` category, `col_` collection, `str_`/store id, `adr_` address, `cns_` consumer, `rtn_` return, `ref_` refund, `reel_`… Never parse them, but **prefix checks are a legitimate way to tell a real backend id from a bundled mock id** (the app does exactly this with `isBackendListingId`/`isBackendCategoryId`). |
| Gender | `her` \| `him` \| `unisex`. **A `unisex` row appears on BOTH the her and him rails** — filtering `gender=her` returns `her` + `unisex`. |
| Paging | Two styles: `limit`/`offset` (catalog, ledgers) and keyset `cursor` (reels, community, notifications). They are not interchangeable. |

---

## 2. Global error model

### HTTP status → meaning

| Status | When |
|---|---|
| 200 | Success (including "no results" — an empty array is a 200). |
| 304 | `If-None-Match` matched. **Empty body.** |
| 400 | A few domain rules (e.g. Try-and-Buy + COD, self-referral). |
| 401 | Missing/invalid/expired token, suspended or closed account. |
| 403 | Wrong token kind, banned from a surface, prize belongs to another account. |
| 404 | Not found **or not yours** (ownership failures are deliberately 404, not 403). |
| 409 | State conflict — stock, coupon, order state, already-claimed, duplicates. |
| 422 | Zod validation failure, or a semantic "cannot do this" (e.g. product has no image to try on). |
| 500 | Unhandled server error. `{ code: "internal_error" }`, message is generic. |
| 502 / 503 | Upstream failure (pincode API, Vertex try-on, Razorpay unconfigured). |

### Validation failures (422)

```jsonc
{
  "success": false,
  "error": {
    "code": "validation_error",
    "message": "querystring/limit must be <= 100",
    "details": [ /* fastify validation array */ ]
  }
}
```

> **Important:** unknown query params are **silently dropped** by Zod, not rejected. A newer app
> sending a parameter an older deployment doesn't know (e.g. `view=card`) gets a *successful*
> response in the *old* shape. Shape-detect rather than assume — `services/catalog.ts:isCard()`
> is the reference pattern.

### Unknown route (404)

```jsonc
{ "success": false, "error": { "code": "not_found", "message": "Route GET:/api/v1/nope not found" } }
```

### Full error-code catalogue

Every `error.code` the backend can emit (`shared/errors/app-error.ts`), grouped. Codes marked ★
are the ones a consumer-app screen realistically has to handle.

**Auth / identity**
`unauthorized` ★ · `forbidden` ★ · `not_found` ★ · `invalid_credentials` · `email_already_taken` ★
· `signup_identifier_taken` · `consumer_suspended` ★ · `consumer_closed` ★ · `driver_suspended` ·
`driver_inactive` · `profile_incomplete` ★

**Validation / infra**
`validation_error` ★ · `rate_limited` ★ · `internal_error` ★

**Catalog / store**
`invalid_state` ★ · `store_not_active` · `store_paused` · `cannot_publish_incomplete` · `sku_taken`

**Orders**
`order_not_found` ★ · `order_transition_invalid` · `order_stock_unavailable` ★ ·
`order_price_changed` ★ · `order_store_unavailable` ★ · `order_retry_budget_exhausted` ·
`order_cancellation_not_allowed` ★ · `out_of_stock` · `payment_failed` ★ ·
`invalid_pickup_code` · `pickup_code_not_applicable` · `idempotency_conflict`

**Promotions**
`coupon_invalid` ★ · `coupon_expired` ★ · `coupon_exhausted` ★ · `coupon_not_eligible` ★ ·
`coupon_min_order_not_met` ★ · `coupon_already_used` ★ · `coupon_clubbing_blocked` ★ ·
`voucher_already_redeemed` ★

**Wallet / loyalty / gift cards / referrals**
`insufficient_wallet_balance` ★ · `insufficient_points` ★ · `below_minimum` · `exceeds_balance` ·
`exceeds_cap` · `gift_card_invalid` ★ · `gift_card_expired` ★ · `gift_card_already_redeemed` ★ ·
`referral_code_invalid` ★ · `referral_self` ★ · `referral_already_used` ★

**Rewards / spin**
`already_claimed` ★ · `already_spun` ★ · `already_entered`

**Returns / refunds / held items**
`return_not_found` · `return_window_expired` ★ · `return_invalid_state` ★ · `return_already_decided`
· `return_already_open` ★ · `refund_not_found` · `disbursement_not_found` ·
`disbursement_already_terminal` · `held_item_not_found` · `held_item_not_holding` ·
`held_extension_already_used` · `pickup_code_locked` · `pickup_outside_slot`

**Door visit (Try & Buy)**
`door_visit_invalid_item` · `door_visit_must_choose_all_items` · `door_visit_extension_exhausted` ·
`door_visit_refuse_requires_evidence`

**Community / moderation**
`consumer_banned` ★

**Disputes**
`dispute_not_found` · `dispute_invalid_state` · `dispute_already_decided`

### Recommended client copy mapping

`services/api.ts` already maps a few; extend it rather than scattering strings:

| code | Copy |
|---|---|
| `consumer_suspended` | "This account is suspended. Contact support." |
| `consumer_closed` | "This account is closed." |
| `profile_incomplete` | Route to CompleteProfile, don't show an error. |
| `order_stock_unavailable` | "Someone just bought the last one — update your bag." + re-quote |
| `order_store_unavailable` | "This store isn't accepting orders right now." |
| `order_price_changed` | "Prices changed — review your total." + re-quote |
| `unauthorized` | Silent re-auth (OTP sheet), keep the user's intent. |

---

## 3. Home section → screen → endpoint map

Section numbering matches `home-link-map.md`. **CMS = destination comes from the item's `link`;
FIXED = hardcoded route.** Every section's *content* comes from one call:
`GET /cms/home?gender=&city=` — the table below lists the **data endpoints the destination screen
then needs**.

| # | Section (CMS key) | Content endpoint | Destination screen(s) | Data endpoints the destination needs |
|---|---|---|---|---|
| 01 | Hero banner `home.hero` | `GET /cms/home` → section `home.hero` | CMS route, else `ForHer`/`ForHim` | `GET /catalog/products?gender=&limit=12` |
| 02 | Header & search `home.header` | `GET /cms/home` (config.searchPlaceholder) | `Profile`, `Search`, `ImageSearch` | Profile: `/consumer/profile/me`, `/consumer/loyalty`, `/consumer/wallet` · Search: `/catalog/products?search=` · ImageSearch: **no API** (falls back to `/catalog/products?sort=newest&limit=8`) |
| 03 | Marquee `home.marquee` | `GET /cms/home` (config.text) | — none | — |
| 04 | Trending categories `home.explore_grid` | `GET /cms/home` + `GET /catalog/categories?gender=&withCounts=true` | `CategoryZoom`, `Categories`, `Category` | Zoom: `/catalog/products?gender=&search=<label>&limit=30` · Categories: `/catalog/categories?gender=&activeOnly=true&withCounts=true` (+ `page.category_banners` CMS) · Category: `/catalog/products?gender=&categorySlug=&sort=&limit=&offset=` |
| 05 | Steals `home.steals` | `GET /cms/home` | `Steals` | `page.steals_hero` + `page.steals_bento` + `page.steals_bands` CMS sections · `/catalog/products?gender=&sort=price_asc&limit=48` |
| 06 | Top Stories `home.top_stories` | `GET /cms/home` | `TopStories` | `page.top_stories` CMS · `/catalog/products?gender=&limit=48` (rails sliced per story) |
| 07 | Reels For You `home.reels_features`, `home.reels_previews` | `GET /cms/home` | `ReelsTab` | `GET /consumer/reels?limit=10` (+`cursor`), `/consumer/reels/:id/view`, like/save/comment |
| 08 | 60-minute banner `home.reels_banner` | `GET /cms/home` | `Collection` **(FIXED, key `sixty-minute`)** | Resolution order: `GET /catalog/collections/:slug` → else N× `GET /catalog/products?categorySlug=` → else `GET /catalog/products?search=` |
| 09 | Shop by Occasion `home.occasion` | `GET /cms/home` + `GET /catalog/collections?kind=occasion&gender=` | `ShopByOccasion` | `page.occasion` CMS · `GET /catalog/collections/<itemKey>` (item `key` **is** the collection slug) · fallback `/catalog/products` |
| 10 | Flash Fit `home.flash_fit` | `GET /cms/home` | `FlashFit` | `page.flash_fit` CMS · `/catalog/products?gender=&sort=price_asc&limit=48` (bundle assembled client-side) |
| 11 | Shop by Vibe (reuses `home.explore_grid`) | — | `Categories` | same as #04 |
| 12 | Play & Win **(no CMS key)** | — | `DailyReward`, `SpinWheel`, `LuckyDraw`, `StyleQuiz`, `InviteFriends`, `AppChallenges` | SpinWheel: `/spin/wheel`, `/spin/play`, `/spin/claim`, `/consumer/rewards` · InviteFriends: `/consumer/referrals/me`, `/consumer/referrals/redeem` · **the other four have no backend** (§7) |
| 13 | See It On You `home.try_on` | `GET /cms/home` | `TryOnPicker` → `TryOn` | `GET /catalog/products` (picker) · `GET /catalog/products/:id` (variants) · `POST /consumer/tryon` |
| 14 | Explore More feed | — (live catalog) | `ProductDetail` | `/catalog/products?gender=&limit=24&offset=` (pager) · detail: `/catalog/products/:id`, `/catalog/products/:id/reviews`, `/promotions/active` |
| 15 | Footer `home.footer` | `GET /cms/home` | — none | — |

**Global rule:** any product card anywhere → `ProductDetail`, which always calls
`GET /catalog/products/:id` + `GET /catalog/products/:id/reviews`.

### Route whitelist ↔ endpoint owner

Every route a CMS `link` may name (`CMS_ROUTES` in `backend/src/shared/cms/schema.ts`, mirrored by
`KNOWN_ROUTES` in `customer-app/src/content/links.ts`) and the endpoint family that feeds it:

| Route | Fed by |
|---|---|
| `Categories`, `Category`, `CategoryZoom` | `/catalog/categories`, `/catalog/products`, `/catalog/facets` |
| `ProductDetail` | `/catalog/products/:id`, `/catalog/products/:id/reviews` |
| `Search` | `/catalog/products?search=` |
| `ImageSearch` | — (no API) |
| `Steals`, `TopStories`, `FlashFit`, `ShopByOccasion`, `OccasionShopping`, `NewArrivals`, `ForHer`, `ForHim` | `/cms/home` + `/catalog/products` |
| `Collection` | `/catalog/collections/:slug`, `/catalog/products` |
| `DiscoverBrands` | `/catalog/brands` |
| `TryOnPicker`, `TryAndBuy` | `/catalog/products`, `/consumer/tryon` |
| `ReelsTab` | `/consumer/reels/*` |
| `CartTab` | `/consumer/cart/*`, `/pricing/cart` |
| `CommunityFeed` | `/consumer/community/posts*` |
| `MoodBoard` | `/consumer/moodboards*` |
| `CouponWallet` | `/promotions/active`, `/consumer/rewards` |
| `LoyaltyRewards` | `/consumer/loyalty`, `/app-config` |
| `ReferralRewards`, `InviteFriends` | `/consumer/referrals/me` |
| `GiftCard` | `/consumer/gift-cards`, `/consumer/gift-cards/redeem` |
| `SpinWheel` | `/spin/*` |
| `DailyReward`, `LuckyDraw`, `StyleQuiz`, `AppChallenges` | — (no API) |
| `SavedAddresses` | `/consumer/addresses*`, `/pincode/:pin` |
| `Profile` | `/consumer/profile/me` |
| `OrderHistory` | `/consumer/checkout/orders` |
| `StorePickup` | `/catalog/stores/nearby`, `/catalog/stores/:id`, `/catalog/stores/:id/pickup-slots` |
| `About`, `Sustainability`, `FashionCalendar` | `/app-config` (support/company block) — rest is static |

---

## 4. The filter endpoint — `GET /catalog/products`

This is the single browse/filter/search/sort endpoint. Every grid in the app is a call to it.

**Auth:** Public. **Method:** GET. **Path:** `/catalog/products`

### 4.1 Every query parameter

| Param | Type | Default | Constraints | Semantics |
|---|---|---|---|---|
| `gender` | `her` \| `him` \| `unisex` | *(none = all)* | enum | Matches `gender = <value> OR gender = 'unisex'`. So `gender=her` returns her + unisex. Passing `unisex` matches unisex only (`unisex OR unisex`). |
| `categoryId` | string | — | any | **Descendant-inclusive.** Passing a parent returns everything under it. Unknown id → `[]` (never "ignore filter"). |
| `categorySlug` | string | — | any | Same as above, by slug. The app navigates by slug; admin filters by id. If both are sent, both are resolved and merged into one descendant set. |
| `storeId` | string | — | any | Exact store match. Combine with `/catalog/stores/nearby` to build "shop this store". |
| `search` | string | — | trimmed, 1–120 chars | Case-insensitive `ILIKE %term%` on **product name only**. Not description, not brand, not category. |
| `sort` | `newest` \| `price_asc` \| `price_desc` \| `rating` | `newest` | enum | See §4.3. |
| `view` | `full` \| `card` | `full` | enum | **Always send `view=card` for grids.** See §4.4. |
| `limit` | int | `50` | 1–100 | Page size. |
| `offset` | int | `0` | ≥ 0 | Page offset. |

**There is no price-range, colour, size, brand, rating-floor, discount-only, in-stock-only or
occasion filter on this endpoint.** Price bands (the Steals "Under ₹499" chips) and any other
facet are done client-side today by fetching `sort=price_asc` and slicing. Adding server-side
price filtering is a backend change, not a query-param you can guess.

### 4.2 Implicit filters (always on, not overridable)

A row is returned **only** when all of these hold:

1. `productListings.status = 'active'` — drafts, retired and taken-down listings never appear.
2. The listing has **≥1 shoppable variant** — an active variant belonging to an active variant
   group. Applied *before* paging, so `limit`/`offset` count rows you actually receive.
3. Its **store is browsable**: `status = 'active'`, **or** `status = 'paused'` with
   `pause_visibility ≠ 'hidden'`. Suspended, terminated and paused-hidden stores vanish from every
   consumer surface (browse, detail, collections, reviews, facets).

Consequence: a product can disappear between two calls without any error — handle empty pages.

### 4.3 Sorting, and why ties matter

| `sort` | Order | Tie-breaker |
|---|---|---|
| `newest` (default) | `createdAt DESC` | `id ASC` |
| `price_asc` | `min(variant price) ASC` | `id ASC` |
| `price_desc` | `min(variant price) DESC` | `id ASC` |
| `rating` | `ratingAvg DESC, ratingCount DESC` | `id ASC` |

"Price of a listing" = **its cheapest active variant** — the same number `view=card` shows, so
the grid never disagrees with itself. The `id ASC` tie-breakers exist because the seeded catalog
inserts in batches and ties constantly; without them page 2 could repeat page 1 rows.

### 4.4 `view=card` vs `view=full`

`view=card` returns exactly the 12 fields a grid tile draws. `view=full` returns the **product
detail shape** — full description, whole gallery, every variant group and every variant with its
own image list, price, compare-at price and availability. For a 4-colour × 6-size product that is
24 variant objects per card. **Use `card` for every list; `full` only if you deliberately need
detail-shaped rows.**

`view` is a newer parameter. An older deployment ignores it and answers in `full` shape with a
200. Detect by shape (`typeof row.pricePaise === 'number'` ⇒ card) rather than trusting it.

### 4.5 Request examples

```http
# Home "Explore More" first page
GET /catalog/products?gender=her&view=card&limit=24&offset=0

# Category screen, cheapest first, second page
GET /catalog/products?gender=him&categorySlug=denim-jeans&sort=price_asc&view=card&limit=24&offset=24

# Search
GET /catalog/products?search=linen%20shirt&gender=her&view=card&limit=50

# One store's shelf
GET /catalog/products?storeId=str_abc123&view=card&limit=100

# CategoryZoom (label-as-search)
GET /catalog/products?gender=her&search=Dresses&view=card&limit=30
```

### 4.6 Response — `200 OK`, `view=card`

```jsonc
{
  "success": true,
  "data": [
    {
      "id": "lst_9f2c…",
      "name": "Relaxed Linen Shirt",
      "brandName": "AURA",             // brand.name, else store.legalName
      "categoryLabel": "Shirts",
      "ratingAvg": 4.3,                // stored projection (not the live recompute)
      "ratingCount": 27,
      "image": "https://…/img.webp",   // cheapest variant's first image, else listing gallery[0], else null
      "pricePaise": 149900,            // cheapest shoppable variant
      "compareAtPricePaise": 199900,   // or null
      "discountPct": 25,               // server-computed, 0 when no compare-at
      "colors": ["#1b1b1b", "#e8dcc8"],// max 2 group hexes, may be []
      "occasion": "brunch",            // first occasion tag, or null (STRING here, array in `full`)
      "defaultVariantId": "var_77a…"   // add-to-bag without fetching detail
    }
  ]
}
```

### 4.7 Response — `200 OK`, `view=full`

Identical to `GET /catalog/products/:id` **minus `descriptionLong`** and minus the live rating
recompute. See [§5B `GET /catalog/products/:id`](#get-catalogproductsid) for the annotated shape.

### 4.8 All possible responses

| Status | Body | When |
|---|---|---|
| 200 | `data: [...]` | Normal. |
| 200 | `data: []` | No matches, **or** unknown `categoryId`/`categorySlug`, **or** offset past the end. Not an error. |
| 304 | *(empty)* | `If-None-Match` matched. |
| 422 | `validation_error` | `limit > 100`, `limit < 1`, negative `offset`, `search` longer than 120 chars, bad `sort`/`gender`/`view` enum. |
| 500 | `internal_error` | Server fault. |

Unknown params are dropped silently — there is no 400 for a typo'd filter name.

### 4.9 Companion — `GET /catalog/facets` (counts for a filter UI)

**Auth:** Public.

| Param | Type | Notes |
|---|---|---|
| `gender` | enum | optional |
| `categoryId` | string | optional, descendant-inclusive |
| `categorySlug` | string | optional, descendant-inclusive |
| `storeId` | string | optional |
| `search` | string | optional, 1–120 |

Each facet **excludes its own dimension** (standard faceted-search rule), which is what lets the
same call answer both "which genders exist in this category" and "which categories exist for this
gender".

```jsonc
{
  "success": true,
  "data": {
    "total": 412,                                   // all active filters applied together
    "genders":   [ { "gender": "her", "count": 210 }, { "gender": "unisex", "count": 60 } ],
    "categories":[ { "categoryId": "cat_12", "label": "Dresses", "slug": "her-dresses", "count": 84 } ]
  }
}
```

**Caveat, stated in the controller:** facet counts do **not** drop listings whose variants are all
sold-out/inactive (too costly for a count), so a facet can read a hair higher than the grid. Store
browsability *is* applied. Unknown category → `{ total: 0, genders: [], categories: [] }`.

Errors: 422 validation, 500.

---

## 5. Endpoint reference

Legend: **[P]** public · **[O]** optional auth · **[C]** consumer auth required.

---

### A. Public config & content

#### `GET /app-config` **[P]**

Every operational value the app must not hardcode. Cache ~1 h.

**Request:** no params.

**`200`:**

```jsonc
{
  "success": true,
  "data": {
    "support":  { "email": "help@…", "phone": null, "address": null, "hours": null },
    "delivery": {
      "methods": [
        { "id": "express",     "label": "Express",      "blurb": "From your nearest store, in under an hour", "etaLabel": "60 min",   "icon": "zap",     "feePaise": 9900 },
        { "id": "standard",    "label": "Standard",     "blurb": "Tracked shipping, door to door",            "etaLabel": "2-3 days", "icon": "package", "feePaise": 4900 },
        { "id": "pickup",      "label": "Store pickup", "blurb": "Collect at the counter with your code",     "etaLabel": "In store", "icon": "map-pin", "feePaise": 0 },
        { "id": "try_and_buy", "label": "Try & Buy",    "blurb": "Try at your door, keep what fits",          "etaLabel": "Next day", "icon": "home",    "feePaise": 9900 }
      ],
      "surgeMultiplier": 1
    },
    "tryAndBuy": { "windowSeconds": 600, "extensionSeconds": 300, "maxItemsPerTrial": null, "maxTrialsPerMonth": null },
    "returns":   { "windowDays": 7, "reasons": [ { "value": "doesnt_fit", "label": "Does not fit" }, … ] },
    "loyalty":   { "pointValuePaise": 100, "earnRateBp": 10000, "minRedeemablePoints": 100, "maxRedeemFractionBp": 10000,
                   "tiers": [ { "name": "BRONZE", "minPoints": 0 }, { "name": "SILVER", "minPoints": 500 }, { "name": "GOLD", "minPoints": 2000 }, { "name": "PLATINUM", "minPoints": 5000 } ] },
    "referral":  { "referrerPoints": 200, "referredPoints": 100, "welcomePoints": 100 },
    "orderLifecycle": { "acceptanceWindowSeconds": 180, "paymentAbandonMinutes": 30, "orderCloseAfterDays": 7,
                        "pickupNoshowCancelDays": 3, "holdingWindowDays": 14 },
    "company":   { "name": "…", "appName": "…" }
  }
}
```

Notes:
- `delivery.methods[].feePaise` is **advisory** — a store override or coupon can change it.
  Wherever you have a quote, the quote wins.
- `maxItemsPerTrial` / `maxTrialsPerMonth` are `null` on purpose: nothing enforces them, so the
  app must not claim a rule that isn't real.
- `returns.reasons` mirrors the enum accepted by `POST /consumer/returns`. Drive the picker from
  this, not from a hardcoded list.

**All responses:** 200 · 304 · 500.

---

#### `GET /cms/home` **[P]**

The merchandising content for Home and every section page. Serves the **latest published
snapshot** only — never the draft.

| Param | Type | Notes |
|---|---|---|
| `gender` | `her` \| `him` | Optional. Omitted keeps every audience. |
| `city` | string 1–80 | Optional. A city-restricted item is **hidden** from a caller whose city is unknown. |

**`200`:**

```jsonc
{
  "success": true,
  "data": {
    "version": 42,          // null ⇒ nothing has ever been published; treat as "no sections"
    "schemaVersion": 1,     // bump ⇒ payload shape changed; an old app should refuse
    "sections": [
      {
        "key": "home.hero",
        "type": "hero_carousel",
        "title": null, "subtitle": null, "kicker": null, "ctaLabel": null,
        "config": { "autoplayMs": 3500 },
        "items": [
          {
            "key": "hero-monsoon",
            "assetKey": "hero/monsoon",     // bundled asset id, resolved via assets.registry.ts
            "imageUrl": "https://…",        // or null when the item uses a bundled asset
            "videoUrl": null,
            "link": { "route": "Collection", "params": { "key": "sixty-minute" } },
            "content": { "tint": "#f3e6d8" }
          }
        ]
      }
    ]
  }
}
```

Rules the server already applied — do not re-implement:
- Disabled sections and disabled items are gone.
- Gender targeting: an item is `her`, `him` or `all`.
- Publish windows (`startsAt`/`endsAt`) and city targeting are applied at read time.
- **A section whose items are all out of window still ships, with `items: []`** — you get its copy
  and decide what an empty rail looks like. A *missing* section means the app is out of date.

Link handling: `link.route` must be in the app's `KNOWN_ROUTES`; anything else is a **no-op, not a
crash**. `link.params` passes straight through to the screen.

Section keys the app requests today:
`home.hero`, `home.header`, `home.marquee`, `home.explore_grid`, `home.steals`, `home.top_stories`,
`home.reels_features`, `home.reels_previews`, `home.reels_banner`, `home.occasion`,
`home.flash_fit`, `home.try_on`, `home.footer`,
plus page-level: `page.steals_hero`, `page.steals_bento`, `page.steals_bands`, `page.top_stories`,
`page.occasion`, `page.flash_fit`, `page.category_banners`.

**All responses:** 200 · 304 · 422 (bad `gender` enum, `city` > 80 chars) · 500.

---

#### `GET /legal/:kind` **[P]**

`kind` ∈ `terms` | `privacy`. Latest published version only.

```jsonc
{ "success": true, "data": { "kind": "terms", "docName": "Terms & Conditions", "version": 3, "label": "v3 — 12 Jan 2026", "shortText": "…" } }
```

**All responses:** 200 · 422 (bad kind) · 500.

---

#### `GET /pincode/:pin` **[P]**

6-digit Indian pincode → city/state/**GST state code**. The address form needs `stateCode`; it
drives place-of-supply (CGST+SGST vs IGST) and the customer cannot be expected to know it.

```jsonc
{ "success": true, "data": { "pincode": "400001", "city": "Mumbai", "state": "Maharashtra", "stateCode": "27", "country": "India" } }
```

| Status | Body | When |
|---|---|---|
| 200 | object above | Found. |
| 200 | `data: null` | Upstream returned no post office for that pin **or** upstream errored (502 path also returns `data: null` with status 502). |
| 200 | `stateCode: null` | State name not in the GST map — **ask the customer, don't guess a tax jurisdiction.** |
| 422 | `validation_error` | Not exactly 6 digits. |
| 502 | `data: null` | Upstream unreachable/timeout (5 s). |

---

### B. Catalog

#### `GET /catalog/categories` **[P]**

The category tree, **flat with `parentId`** — the client assembles it.

| Param | Type | Default | Notes |
|---|---|---|---|
| `gender` | enum | — | Matches `gender OR unisex`. A shared node (Tops) is stored once as `unisex` and appears on both rails. |
| `activeOnly` | `"true"`\|`"false"` | `"true"` | String literals, not booleans. |
| `withCounts` | `"true"`\|`"false"` | `"false"` | Adds descendant-inclusive `listingCount`. Costs one extra aggregate — use it for the browse rail, skip it for pick-lists. |

**`200`:**

```jsonc
{
  "success": true,
  "data": [
    {
      "id": "cat_tops", "slug": "tops", "label": "Tops",
      "labelHim": "T-Shirts",        // HIM-rail wording for a shared node; null when both rails agree
      "parentId": null,
      "iconName": "shirt-outline", "tintColor": "#eae2d6", "imageUrl": "https://…",
      "gender": "unisex",
      "sortOrder": 10,
      "sortOrderHim": 20,            // HIM-rail position; null when both rails order alike
      "isActive": true,
      "isLeaf": false,               // computed server-side
      "listingCount": 128            // only when withCounts=true; descendant-inclusive
    }
  ]
}
```

Rendering rules: pick `labelHim ?? label` and `sortOrderHim ?? sortOrder` on the HIM rail.
**Listings only ever sit on leaves** — a parent's count is the sum of its descendants.

**All responses:** 200 · 304 · 422 · 500.

---

#### `GET /catalog/size-scales` **[P]**

| Param | Type | Notes |
|---|---|---|
| `categoryId` | string | Optional. With it: universal scales (empty `categorySlugs`) **plus** any scale matching the category or one of its ancestors. Without it: every active scale. |

```jsonc
{ "success": true, "data": [ { "id": "ss_apparel", "name": "Apparel (XS–XXL)", "values": ["XS","S","M","L","XL"], "categorySlugs": ["tops","dresses"], "sortOrder": 1, "isActive": true } ] }
```

Only a **fallback** — a product whose variants carry `attributes.size` already tells you its real
sizes. Without this the fallback was a hardcoded XS–XL shown even on shoes.

**All responses:** 200 · 304 · 422 · 500.

---

#### `GET /catalog/brands` **[P]**

| Param | Type | Default |
|---|---|---|
| `activeOnly` | `"true"`\|`"false"` | `"true"` |

```jsonc
{ "success": true, "data": [ { "id": "brd_1", "slug": "aura", "name": "AURA", "tintColor": "#111111", "logoUrl": "https://…", "domain": "aura.in", "isActive": true } ] }
```

**All responses:** 200 · 304 · 422 · 500.

---

#### `GET /catalog/products` **[P]** — see [§4](#4-the-filter-endpoint--get-catalogproducts)

---

#### `GET /catalog/products/:id` **[P]**

Full product detail. Superset of the list row: adds `descriptionLong` and a **live** rating
recomputed from the reviews shoppers actually see (active + verified purchase), so the header
matches the reviews list.

**`200`:**

```jsonc
{
  "success": true,
  "data": {
    "id": "lst_9f2c…",
    "storeId": "str_abc",
    "name": "Relaxed Linen Shirt",
    "description": "Short marketing line",
    "descriptionLong": "<p>Sanitized rich-text HTML…</p>",   // detail-only; null when none
    "gender": "her",
    "listingPolicy": "return",              // return | replace | final_sale  ← drives returnability
    "variantMode": "color_size",            // single | color_size | custom
    "galleryUrls": ["https://…", "…"],
    "occasion": ["brunch", "work"],         // ARRAY here (a plain string in view=card)
    "brand":    { "id": "brd_1", "name": "AURA" },        // or null
    "category": { "id": "cat_tops", "label": "Tops", "slug": "tops" },
    "store":    { "id": "str_abc", "legalName": "Aura Retail Pvt Ltd" },
    "ratingAvg": 4.33,                      // LIVE avg over visible reviews; 0 when none
    "ratingCount": 27,
    "groups": [
      { "id": "grp_1", "name": "Ivory", "colorHex": "#efe7db", "isDefault": true }
    ],
    "variants": [
      {
        "id": "var_77a", "groupId": "grp_1",
        "attributes": { "color": "Ivory", "size": "M" },   // may be null
        "label": "Ivory / M",                              // retailer's own rendering
        "imageUrls": ["https://…"],
        "pricePaise": 149900,
        "compareAtPricePaise": 199900,                     // or null
        "discountPct": 25,
        "available": 4                                     // stock − reserved, floored at 0
      }
    ]
  }
}
```

Client rules worth copying from `services/catalog.ts`:
- `variantMode: 'single'` ⇒ **no colour or size axis to offer at all**. Don't invent swatches.
  If the field is missing (older backend), infer: single only when ≤1 variant, 0 swatches, ≤1 size.
- Build the gallery **variant-first** (chosen variant's image, then listing gallery, then other
  variants, deduped) so the card→detail zoom lands on the same picture. But for **try-on**, use
  `galleryUrls[0]` — the backend resolves a try-on with no `variantId` to exactly that.
- `available === 0` ⇒ show the variant but block add-to-bag.

| Status | When |
|---|---|
| 200 | Found and shoppable. |
| 404 `not_found` "Product not found" | Wrong id, listing not `active`, **zero shoppable variants**, or its store is suspended/terminated/paused-hidden. |
| 500 | — |

---

#### `GET /catalog/products/:id/reviews` **[P]**

| Param | Type | Default | Range |
|---|---|---|---|
| `limit` | int | 20 | 1–100 |
| `offset` | int | 0 | ≥0 |

```jsonc
{
  "success": true,
  "data": [
    { "id": "rev_1", "rating": 5, "body": "Runs true to size.", "verifiedPurchase": true,
      "createdAt": "2026-07-01T10:22:13.000Z", "author": "Aisha" }
  ]
}
```

Only **active + verified-purchase** reviews are public; `author` is the reviewer's **first name
only** (falls back to `"Trendzo Shopper"`). Newest first. A review by a non-buyer is stored and
visible to its author under "my reviews" but never here — tell the reviewer that in the composer.

| Status | When |
|---|---|
| 200 | Including `[]`. |
| 404 `not_found` | Product not found / not browsable (same rule as detail). |
| 422 | `limit > 100`, negative offset. |

Write path: [`POST /consumer/community/reviews`](#post-consumercommunityreviews).

---

#### `GET /catalog/collections` **[P]**

| Param | Type | Notes |
|---|---|---|
| `kind` | `outfit`\|`occasion`\|`drop`\|`edit`\|`trend` | Optional. (Rows may also carry `brand`, which is not filterable here.) |
| `gender` | enum | Optional; matches `gender OR unisex`. |
| `featured` | `"true"`\|`"false"` | Optional. |

```jsonc
{
  "success": true,
  "data": [
    {
      "id": "col_1", "slug": "her-date-night-glam", "name": "Date Night Glam",
      "kind": "outfit", "gender": "her",
      "heroImageUrl": "https://…", "accentColors": ["#f5e6d3", "#ffe0b2", "#c9a87c"],
      "status": "active", "isFeatured": true, "sortOrder": 3,
      "startsAt": null, "endsAt": null,
      "listingCount": 4,        // explicit members that are live + browsable
      "pricePaise": 589600      // sum of each member's cheapest active variant
      // …plus the remaining collection columns
    }
  ]
}
```

Time-window rules: collections whose window has **ended** are hidden. Not-yet-started ones are
hidden **except `kind=drop`** — upcoming drops are listed (with a future `startsAt`) so the app can
render launch countdowns, while `GET /catalog/collections/:slug` still 404s their contents until
launch.

`listingCount`/`pricePaise` are `0` for auto-resolving kinds (brand/occasion collections with no
explicit memberships) — their cards don't show these.

**All responses:** 200 · 304 · 422 · 500.

---

#### `GET /catalog/collections/:slug` **[P]**

```jsonc
{
  "success": true,
  "data": {
    "id": "col_1", "slug": "her-date-night-glam", "name": "Date Night Glam", "kind": "outfit",
    "…": "all collection columns",
    "listings": [ /* array shaped EXACTLY like /catalog/products?view=full */ ]
  }
}
```

Resolution, server-side:
- `kind: 'brand'` + `brandId` → every live listing of that brand (auto-resolves; new listings
  appear without an admin re-adding them).
- `kind: 'occasion'` + `occasionTag` → every live listing carrying that tag.
- otherwise → explicit memberships, **ordered by the curator's `sortOrder`**.

| Status | When |
|---|---|
| 200 | Found, active, inside its window. `listings` may be `[]`. |
| 404 `not_found` | Unknown slug, `status ≠ active`, not started yet, or already ended. |

> The app treats 404 here as "fall back to a plain browse", not as an error to show. See
> `listCollectionProducts()`.

---

#### `GET /catalog/stores/nearby` **[P]**

| Param | Type | Default | Range |
|---|---|---|---|
| `lat` | number | **required** | −90…90 |
| `lng` | number | **required** | −180…180 |
| `radiusKm` | number | 15 | >0, ≤50 |
| `limit` | int | 20 | 1–50 |

```jsonc
{
  "success": true,
  "data": [
    { "id": "str_abc", "name": "Aura Retail Pvt Ltd", "address": "…", "lat": 19.07, "lng": 72.87,
      "phone": "+9122…", "openingHours": { "mon": [ { "open": "10:00", "close": "21:00" } ] },
      "images": ["https://…"], "distanceKm": 1.4 }
  ]
}
```

Nearest first, great-circle distance rounded to 0.1 km. Only stores a shopper can buy from
(`active`, or `paused` + not hidden). The projection is a **whitelist** — GSTIN, PAN, legal entity,
fees, payout cadence and suspension reasons are never exposed.

**All responses:** 200 (incl. `[]`) · 422 (missing/invalid lat-lng, `radiusKm > 50`) · 500.

---

#### `GET /catalog/stores/:id` **[P]**

Same object as a `nearby` row, without `distanceKm`.

| Status | When |
|---|---|
| 200 | Visible store. |
| 404 `not_found` | Unknown, suspended, terminated or paused-hidden. |

---

#### `GET /catalog/stores/:id/pickup-slots` **[P]**

| Param | Type | Default | Range |
|---|---|---|---|
| `days` | int | 7 | 1–14 |

Expands the store's **recurring weekly template** into concrete dated windows in IST, dropping any
window whose end has already passed. Chronological.

```jsonc
{
  "success": true,
  "data": {
    "store": { "id": "str_abc", "name": "…", "address": "…", "lat": 19.07, "lng": 72.87, "contactPhone": "+9122…" },
    "slots": [
      { "slotId": "sps_1", "startsAt": "2026-08-09T04:30:00.000Z", "endsAt": "2026-08-09T09:30:00.000Z", "capacity": 8 }
    ]
  }
}
```

Hand the chosen slot straight back at placement as `pickupSlotId` + `pickupSlotStart` +
`pickupSlotEnd`.

| Status | When |
|---|---|
| 200 | `slots` may be `[]` (no template, or everything today already passed). |
| 404 `not_found` | Store missing **or `status ≠ 'active'`** — note this is stricter than `/stores/:id`, which also allows paused-visible. |
| 422 | `days > 14`. |

---

### C. Auth & profile

#### `POST /auth/consumer/otp/msg91` **[P]**

Login **and** signup are the same call — the first successful OTP verify creates the account.

**Body:**

```jsonc
{ "accessToken": "<MSG91 widget access token, 20–2048 chars>" }
```

The client completes the OTP round-trip against the MSG91 widget; the backend **re-verifies the
token against MSG91** before trusting the phone number.

**`200`:**

```jsonc
{
  "success": true,
  "data": {
    "token": "<JWT — send as Bearer on every consumer call>",
    "consumer": {
      "id": "cns_…", "phone": "9876543210", "name": null, "email": null,
      "genderPreference": null, "referralCode": "CX3F9A21B7",
      "profileComplete": false      // name && email — REQUIRED before an order can be placed
    }
  }
}
```

| Status | Code | When |
|---|---|---|
| 200 | — | Verified. |
| 401 | `consumer_suspended` | Account suspended. |
| 401 | `consumer_closed` | Account closed. |
| 422 | `validation_error` | Token missing/too short/too long. |
| 500 | `internal_error` | Account could not be created (double-race that also failed to re-read). |
| 4xx/5xx | varies | MSG91 verification failure propagates. |

**On success:** call `setAuthToken(token)` — this also clears the GET cache so a signed-out
session can never read the previous user's cached responses.

---

#### `GET /consumer/profile/me` **[C]**

```jsonc
{ "success": true, "data": { "id": "cns_…", "phone": "98…", "name": "Aisha", "email": "a@x.com",
  "genderPreference": "her", "referralCode": "CX3F9A21B7", "profileComplete": true } }
```

| Status | When |
|---|---|
| 200 | — |
| 401 `unauthorized` / `consumer_suspended` / `consumer_closed` | Auth. |
| 404 `not_found` | Token valid but the account row is gone. |

---

#### `PATCH /consumer/profile/me` **[C]**

**Body** (at least one field; **phone is identity and cannot be changed here**):

```jsonc
{ "name": "Aisha Khan", "email": "aisha@example.com", "genderPreference": "her" }
```

Constraints: `name` 2–120 chars · `email` must pass the shared email schema ·
`genderPreference` ∈ `her|him|unisex`.

**`200`:** same shape as `GET /me`.

| Status | Code | When |
|---|---|---|
| 200 | — | Updated. |
| 409 | `email_already_taken` | Email belongs to another account. |
| 422 | `validation_error` | Empty body ("No fields to update"), bad name length, bad email. |
| 404 | `not_found` | Account gone. |

> **Checkout gate:** `place order` throws `409 profile_incomplete` when name **or** email is
> missing. Route the user through this PATCH first — the app's `CompleteProfile` screen.

---

### D. Cart

Server-side cart is a **cross-device sync of `{variantId, qty}` only** — no prices, no validation.
Guest carts stay client-side and never reach the DB. Limits: **max 100 lines, qty 1–99 per line.**
Duplicate `variantId`s are merged (qty summed) and the whole array is canonicalised on every write.

Every response is the same shape:

```jsonc
{ "success": true, "data": { "items": [ { "variantId": "var_1", "qty": 2 } ], "updatedAt": "2026-08-08T…Z" } }
```

(`updatedAt` is `null` when the consumer has never had a cart row.)

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/consumer/cart` | — | Read. |
| PUT | `/consumer/cart` | `{ "items": [ { "variantId", "qty" } ] }` (≤100) | Full replace. |
| POST | `/consumer/cart/items` | `{ "variantId", "qty" }` | Add/merge one line. |
| PATCH | `/consumer/cart/items/:variantId` | `{ "qty": 0..99 }` | Absolute qty. **`qty: 0` removes the line.** |
| DELETE | `/consumer/cart/items/:variantId` | — | Remove one line. |
| DELETE | `/consumer/cart` | — | Empty the cart (row is kept). |

Concurrency: item mutations run in a transaction with `SELECT … FOR UPDATE`, so two devices can't
clobber each other.

**All responses:** 200 · 401 · 422 (qty out of range, >100 items, empty `variantId`) · 500.
**`variantId`s are NOT foreign-key checked here** — validity is enforced at pricing/checkout.

---

### E. Pricing

**The single source of truth for every price, discount, fee, tax, loyalty figure and total.** The
same engine (`computeQuote`) runs at placement, so a quoted total always equals a placed total.
Optional auth: a guest gets a clean preview, a signed-in token adds loyalty/wallet.

#### `POST /pricing/cart` **[O]** — the whole cart, grouped by store

**Body:**

```jsonc
{
  "items": [ { "variantId": "var_1", "qty": 2 } ],       // required, ≥1
  "deliveryMethod": "standard",   // optional: express|standard|pickup|try_and_buy (default standard)
  "paymentMethod": "upi",         // optional: upi|card|cod|wallet|gift_card (default upi)
  "couponCode": "MONSOON20",      // optional
  "voucherCode": "SPIN-7F2A",     // optional
  "pointsToRedeem": 240,          // optional, ≥0
  "applyWallet": true             // optional
}
```

A coupon/voucher and redeemed points apply **once across the whole cart** and are split across the
per-store buckets, so the cart preview equals what a group checkout will place.

**`200`:**

```jsonc
{
  "success": true,
  "data": {
    "stores": [
      {
        "storeId": "str_abc",
        "storeName": "Aura Retail Pvt Ltd",
        "lines": [ /* PricedLine[] — see below */ ],
        "pricing": { /* PricingBreakdown — see below */ },
        "deliveryOptions": { "express": 9900, "standard": 4900, "pickup": 0, "try_and_buy": 9900 },
        "rejectedCodes": [ { "code": "MONSOON20", "kind": "coupon", "reason": "store_ineligible" } ]
      }
    ],
    "aggregate": { "…": "cart-level totals", "defaultDeliveryMethod": "standard" },
    "rejectedCodes": [ { "code": "X", "kind": "coupon", "reason": "not_found" } ]
  }
}
```

#### `POST /pricing/quote` **[O]** — one store-order (checkout step)

**Body** = the place-order body minus the placement-only fields:

```jsonc
{
  "storeId": "str_abc",                    // required
  "items": [ { "variantId": "var_1", "qty": 2 } ],
  "deliveryMethod": "express",             // required
  "paymentMethod": "upi",                  // required (gift_card accepted HERE, not at placement)
  "addressId": "adr_1",                    // optional — falls back to the default address for non-pickup
  "couponCode": "…", "voucherCode": "…",
  "pointsToRedeem": 240,
  "applyWallet": true
}
```

**`200`:**

```jsonc
{
  "success": true,
  "data": {
    "pricing":  { /* PricingBreakdown */ },
    "lines":    [ /* PricedLine[] */ ],
    "deliveryOptions": { "express": 9900, "standard": 4900, "pickup": 0, "try_and_buy": 9900 },
    "rejectedCodes":   [ { "code": "…", "kind": "coupon", "reason": "…" } ],
    "wallet":   { "balancePaise": 50000, "appliedPaise": 20000, "amountDuePaise": 129900 },
    "stock":    [ { "variantId": "var_1", "available": 4, "required": 2, "ok": true } ]
  }
}
```

##### `PricingBreakdown` — every field

| Field | Meaning |
|---|---|
| `lineSubtotalPaise` | Sum of `unitPrice × qty` before anything. |
| `appliedPromotions[]` | `{ promotionId, mechanism, discountType, appliedTo, amountPaise, voucherCodeId? }` — only promos that actually contributed a non-zero discount. |
| `excludedPromotions[]` | `{ promotionId, reason }` — considered and dropped. |
| `retailerPromoDiscountPaise` | Retailer-funded discount. |
| `platformPromoDiscountPaise` | Platform-funded discount. |
| `couponDiscountPaise` | Explicit coupon/voucher discount. |
| `loyaltyDiscountPaise` | Value of redeemed points. |
| `shippingSubsidyPaise` | Free-shipping style subsidy. |
| `postPromoSubtotalPaise` | Subtotal after retailer+platform promos. |
| `taxBasePaise` | Base GST is computed on. |
| `cgstPaise` / `sgstPaise` / `igstPaise` | Intra-state splits CGST+SGST; inter-state is IGST. Exactly one pair is non-zero. |
| `deliveryFeePaise` / `handlingFeePaise` / `convenienceFeePaise` | Fees. |
| `tcsPaise` | Tax collected at source. |
| `totalPaise` | **What the consumer pays.** |
| `loyaltyEarnedPoints` | Informational at quote time; recorded at delivery. |
| `loyaltyRedeemedPoints` | Debited at placement. |

##### `PricedLine` — zero math on the client

`{ variantId, listingId, name, attributesLabel, imageUrl, qty, unitPricePaise, grossPaise,
discountAllocPaise, taxAllocPaise, netLinePaise }` — aggregate discounts and tax are allocated to
lines proportionally to line subtotal, with the last line absorbing rounding crumbs so the totals
reconcile exactly.

##### `rejectedCodes[].reason` — the full set

`not_found` · `fully_redeemed` · `requires_login` · `assigned_to_other` · `inactive` · `expired` ·
`first_order_only` · `tier_ineligible` · `per_consumer_limit_reached` · `store_ineligible` ·
plus engine-level reasons normalised from the discount engine (cart minimum not met, clubbing
conflict, consumer targeting, no matching line).

**A bad code never throws.** The cart prices without it and tells you why — surface the reason,
don't show a generic error.

##### Wallet semantics

`wallet.appliedPaise` is advisory (placement re-reads and debits under CAS). `paymentMethod:
'wallet'` is wallet-only and applies regardless of `applyWallet`; for any other method,
`applyWallet: true` uses the wallet as a **partial tender** and the remainder goes on the chosen
method. `amountDuePaise = totalPaise − appliedPaise` is what the gateway will charge.

##### All responses (both pricing endpoints)

| Status | Code | When |
|---|---|---|
| 200 | — | Priced (possibly with `rejectedCodes` and `stock[].ok === false`). |
| 400 | `validation_error` | Try-and-Buy + COD (prepaid only). |
| 404 | `not_found` | Unknown store / unknown variant ("Unknown variant …" from the cart endpoint) / unknown address / consumer row missing. |
| 409 | `order_store_unavailable` | Store not `active`, **or currently paused for orders** ("not accepting orders right now"). |
| 409 | `invalid_state` | A listing or variant in the cart is not purchasable. |
| 422 | `validation_error` | Empty `items`, qty ≤ 0, bad enum. |
| 500 | `internal_error` | — |

> **`stock[].ok === false` is a 200, not an error.** Block the CTA client-side; placement will 409.

---

### F. Checkout, orders & payments

All **[C]**. Placement re-runs the same quote, so the placed total equals the quoted total.
`consumerId` always comes from the token — never from the body.

#### `POST /consumer/checkout` — place a single-store order

**Body** = `PriceQuoteBody` plus placement fields. Note `paymentMethod` here excludes `gift_card`
(gift cards are a wallet top-up, not a tender):

```jsonc
{
  "storeId": "str_abc",
  "items": [ { "variantId": "var_1", "qty": 2 } ],
  "deliveryMethod": "express",          // express|standard|pickup|try_and_buy
  "paymentMethod": "upi",               // upi|card|cod|wallet
  "addressId": "adr_1",
  "couponCode": "…", "voucherCode": "…", "pointsToRedeem": 240, "applyWallet": true,
  "idempotencyKey": "ik_…",             // OPTIONAL but strongly recommended — server generates one otherwise
  "pickupSlotId": "sps_1",              // required for real pickup orders
  "pickupSlotStart": "2026-08-09T04:30:00.000Z",
  "pickupSlotEnd":   "2026-08-09T09:30:00.000Z"
}
```

**`200`:**

```jsonc
{
  "success": true,
  "data": {
    "orderId": "ord_…",
    "groupId": null,
    "status": "confirmed",              // or "pending" while a gateway payment is outstanding
    "pricing": { /* PricingBreakdown */ },
    "walletAppliedPaise": 20000,
    "amountChargedPaise": 129900,
    "alreadyExisted": false,            // true ⇒ idempotent replay, nothing new was created
    "payment": {                        // PRESENT ONLY for upi/card when Razorpay is configured
      "gateway": "razorpay",
      "keyId": "rzp_live_…",
      "gatewayOrderId": "order_ABC123",
      "amountPaise": 129900,
      "currency": "INR"
    }
  }
}
```

Flow implications:
- **COD**: no `payment` block. The payment row is born `pending`, but the order **still confirms
  and routes** — confirmation is decoupled from capture for COD.
- **wallet-only**: no `payment` block when the wallet covers the total.
- **upi/card**: open Razorpay Checkout with the returned block, then call `verify-payment` (success)
  or `payment-failed` (dismissed).
- `alreadyExisted: true` means your `idempotencyKey` matched an existing order — treat as success,
  do not re-charge.

| Status | Code | When |
|---|---|---|
| 200 | — | Placed (or replayed). |
| 400 | `validation_error` | Try-and-Buy + COD. |
| 404 | `not_found` | Unknown store/variant/address. |
| 409 | `profile_incomplete` | Name or email missing → send to CompleteProfile. |
| 409 | `order_stock_unavailable` | Lost the race on stock (per-variant CAS). Re-quote. |
| 409 | `order_store_unavailable` | Store inactive / not accepting orders. |
| 409 | `insufficient_wallet_balance` | `paymentMethod: 'wallet'` but the wallet can't cover it. |
| 409 | `insufficient_points` | `pointsToRedeem` exceeds balance. |
| 409 | `voucher_already_redeemed` | Single-use voucher lost the race. |
| 409 | `coupon_exhausted` | Global cap hit between quote and placement. |
| 409 | `invalid_state` | Listing/variant no longer purchasable. |
| 422 | `validation_error` | Schema. |
| 500/503 | `internal_error` | Includes "Payment gateway is not configured". |

#### `POST /consumer/checkout/group` — multi-retailer cart, one call

The server buckets the cart by each variant's store and places **one child order per store under
one group, all-or-nothing**. Any failure unwinds the placed siblings and 409s back for a re-quote.

**Body:** same as above **minus `storeId`** (`items`, `deliveryMethod`, `paymentMethod`,
`addressId`, `applyWallet`, `couponCode`, `voucherCode`, `pointsToRedeem`, `idempotencyKey`,
pickup-slot trio). Cart-level codes/points are resolved once against the whole cart and split.

**`200`:**

```jsonc
{
  "success": true,
  "data": {
    "groupId": "og_…",
    "combinedTotalPaise": 419700,
    "orders": [
      { "orderId": "ord_1", "storeId": "str_a", "status": "confirmed",
        "pricing": { /* PricingBreakdown */ }, "walletAppliedPaise": 0,
        "amountChargedPaise": 219900, "alreadyExisted": false }
    ],
    "alreadyExisted": false,
    "payment": { "gateway": "razorpay", "keyId": "…", "gatewayOrderId": "order_XYZ",
                 "amountPaise": 419700, "currency": "INR" },   // ONE checkout for the whole cart
    "rejectedCodes": [ { "code": "…", "kind": "coupon", "reason": "…" } ]   // only when non-empty
  }
}
```

Errors: same catalogue as single placement, plus a 409 unwind when any child fails.

#### `POST /consumer/checkout/verify-payment`

```jsonc
{ "razorpayOrderId": "order_ABC", "razorpayPaymentId": "pay_XYZ", "razorpaySignature": "…" }
```

Server verifies the HMAC triplet, then settles the pending payment row(s) → order(s) confirm and
route. **Idempotent**; the Razorpay webhook is the belt-and-braces twin, so a missed client call
still settles.

**`200`:** `{ "verified": true, "orderIds": ["ord_1","ord_2"] }`

| Status | Code | When |
|---|---|---|
| 400 | `validation_error` | Signature verification failed. |
| 403 | `forbidden` | Payment doesn't belong to you. |
| 404 | `not_found` | Unknown payment reference. |
| 503 | `internal_error` | Gateway not configured. |

#### `POST /consumer/checkout/payment-failed`

```jsonc
{ "razorpayOrderId": "order_ABC", "reason": "user dismissed" }   // reason optional, ≤300 chars
```

Fails the pending attempt so a retry owns it. **`200`:** `{ "failedOrderIds": ["ord_1"] }`
Errors: 403 / 404 as above.

#### `POST /consumer/checkout/orders/:id/retry-payment`

Supersedes the failed/abandoned attempt, mints a fresh Razorpay order, moves `payment_failed →
pending`, returns a new Checkout block.

**`200`:** `{ "orderId": "ord_1", "payment": { "gateway": "razorpay", "keyId": "…", "gatewayOrderId": "…", "amountPaise": 129900, "currency": "INR" } }`

| Status | Code | When |
|---|---|---|
| 404 | `not_found` | Not your order. |
| 409 | `invalid_state` | Order is not `pending`/`payment_failed` ("Order is … — nothing to pay"), already paid, or has no payment attempt. |
| 503 | `internal_error` | Gateway not configured. |

#### `POST /consumer/checkout/group/:id/retry-payment`

Same, for a whole group. **`200`:** `{ "groupId": "og_…", "payment": { … amountPaise: <sum of payable children> } }`
409s: "Nothing awaiting payment in this group" / "Group is already paid". 404 when the group isn't yours.

#### `GET /consumer/checkout/orders` — order history

No params. Newest first (`placedAt DESC`).

```jsonc
{
  "success": true,
  "data": [
    {
      "id": "ord_…", "groupId": null, "storeId": "str_abc", "storeName": "Aura Retail Pvt Ltd",
      "status": "delivered",
      "deliveryMethod": "express", "paymentMethod": "upi", "paymentMethodLabel": "UPI",
      "grandTotalPaise": 149900,
      "placedAt": "2026-08-01T…Z", "deliveredAt": "2026-08-01T…Z",
      "itemCount": 3,                          // sum of qty
      "items": [ { "name": "Relaxed Linen Shirt", "brand": "AURA", "image": "https://…", "qty": 2 } ]
    }
  ]
}
```

The line preview exists so the history list renders real cards ("+2 more") **without an N+1 detail
fetch per row**.

**All responses:** 200 (incl. `[]`) · 401 · 500.

#### `GET /consumer/checkout/orders/:id` — order detail

Ownership-enforced. Consumer-safe **whitelist** projection — internal routing, fee/TCS snaps, COD
cash, idempotency keys and the agent handoff code never leave the server. The consumer's own
handover proofs (`deliveryOtp`, `pickupCode`) **are** included.

```jsonc
{
  "success": true,
  "data": {
    "amountPaidPaise": 129900,        // succeeded payments + walletAppliedPaise. 0 ⇒ nothing was ever charged
    "id": "ord_…", "groupId": null, "storeId": "str_abc", "addressId": "adr_1",
    "deliveryMethod": "express", "paymentMethod": "upi", "paymentMethodLabel": "UPI",
    "status": "delivered",

    // own PII snapshot (frozen at placement)
    "consumerNameSnap": "Aisha", "consumerEmailSnap": "a@x.com", "consumerPhoneSnap": "98…",
    "addressLine1Snap": "…", "addressLine2Snap": null, "addressCitySnap": "Mumbai",
    "addressPincodeSnap": "400001", "addressStateCodeSnap": "27",
    "addressLatSnap": 19.07, "addressLngSnap": 72.87,

    // store snapshot + LIVE contact/geo (for "Get directions" / "Call store")
    "storeNameSnap": "…", "storeAddressSnap": "…", "storeGstinSnap": "27…", "storeStateCodeSnap": "27",
    "storeLat": 19.07, "storeLng": 72.87, "storePhone": "+9122…",

    // pricing snapshot
    "itemsSubtotalPaise": 149900, "retailerPromoPaise": 0, "platformPromoPaise": 0,
    "couponPaise": 0, "pointsRedeemedPaise": 0, "walletAppliedPaise": 20000,
    "taxPaise": 7495, "taxSplitKind": "intra", "cgstPaise": 3747, "sgstPaise": 3748, "igstPaise": 0,
    "deliveryFeePaise": 9900, "handlingFeePaise": 0, "convenienceFeePaise": 0,
    "grandTotalPaise": 149900, "loyaltyEarnedPoints": 150,

    // handover proofs — consumer-facing, KEEP
    "deliveryOtp": "4821", "pickupCode": "PK-9F2A",

    // pickup slot + try-on window
    "pickupSlotId": null, "pickupSlotStart": null, "pickupSlotEnd": null,
    "doorWindowExpiresAt": null,

    // SERVER-computed return eligibility — do not re-derive on the client
    "returnPolicy": {
      "eligible": true,
      "windowDays": 7,
      "deadline": "2026-08-08T…Z",     // null when not delivered
      "reason": null,                   // "not_delivered" | "window_expired" | null
      "items": [ { "orderItemId": "oi_1", "eligible": true, "reason": null } ]
      // per-item reason: "window_expired" | "final_sale" | "already_returned" | null
    },

    "refunds": [
      {
        "id": "ref_1", "amountPaise": 149900, "status": "succeeded",
        "reason": "order_cancelled:Cancelled by customer",
        "createdAt": "…", "completedAt": "…",
        "disbursements": [
          { "id": "dsb_1", "destination": "original_tender", "amountPaise": 129900,
            "status": "succeeded", "settledAt": "…", "cashChannel": null }
        ],
        "primaryDestination": "original_tender",   // largest leg — drives the one-line copy
        "primaryCashChannel": null
      }
    ],

    "placedAt": "…", "acceptedAt": "…", "packedAt": "…", "deliveredAt": "…", "closedAt": null,

    "items": [
      {
        "id": "oi_1", "listingId": "lst_…", "variantId": "var_…",
        "listingNameSnap": "Relaxed Linen Shirt", "brandSnap": "AURA", "categorySnap": "Shirts",
        "galleryImageSnap": "https://…", "attributesLabelSnap": "Ivory / M",
        "listingPolicySnap": "return",          // return | replace | final_sale (FROZEN at placement)
        "qty": 2, "unitPricePaise": 74950, "lineSubtotalPaise": 149900, "netLinePaise": 149900,
        "outcome": "delivered_kept"
      }
    ]
  }
}
```

Three things worth designing around:
1. **`amountPaidPaise === 0` means nothing was ever taken** — don't promise a refund.
2. **`returnPolicy` is authoritative.** It depends on `deliveredAt`, each item's outcome and the
   `final_sale` policy frozen at placement. A client-side day counter drifts from `open-return.ts`.
3. **`refunds[].primaryDestination`** tells you where the money actually goes — `original_tender`,
   `wallet`, `cash` (COD refunds handed over physically), or `manual_payout`. Hardcoding "back on
   your original payment method" is wrong for three of the four.

| Status | When |
|---|---|
| 200 | Yours. |
| 404 `not_found` | Unknown **or someone else's**. |

#### `POST /consumer/checkout/orders/:id/cancel`

```jsonc
{ "reason": "Changed my mind" }    // optional, 1–300 chars; defaults to "Cancelled by customer"
```

**`200`:** `{ "orderId": "ord_…", "previousStatus": "confirmed", "refundId": "ref_…" | null }`

The state machine decides whether a **consumer** may cancel from the current status — in practice
`pending`, `payment_failed`, `confirmed`, `accepted`; **not after packing**.

| Status | Code | When |
|---|---|---|
| 404 | `not_found` / `order_not_found` | Not yours / gone. |
| 409 | `order_cancellation_not_allowed` | Already terminal (`cancelled`/`closed`), or the transition isn't permitted for a consumer from this status. |

Side effects: reservations released, pending COD payments failed, and a **DB-only cancellation
refund** created for whatever was actually paid (wallet portion credited back via CAS).
Promo/voucher redemption counters are deliberately **not** reverted.

---

### G. Addresses

All **[C]**. `is_default` is enforced by a partial unique index — promotion happens in a
transaction that first clears the prior default.

Row shape everywhere:

```jsonc
{ "id": "adr_1", "label": "Home", "line1": "…", "line2": null, "city": "Mumbai",
  "pincode": "400001", "stateCode": "27", "lat": 19.07, "lng": 72.87,
  "isDefault": true, "createdAt": "…" }
```

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/consumer/addresses` | — | `[row]`, default first then newest. |
| POST | `/consumer/addresses` | full body ↓ | created row |
| PATCH | `/consumer/addresses/:id` | any subset | updated row |
| DELETE | `/consumer/addresses/:id` | — | `{ "id", "deleted": true }` |
| POST | `/consumer/addresses/:id/set-default` | — | updated row |

**Create/patch body:**

```jsonc
{
  "label": "Home",            // optional, ≤40, nullable
  "line1": "12 Marine Drive", // required, 1–200
  "line2": null,              // optional, ≤200, nullable
  "city": "Mumbai",           // required, 1–100
  "pincode": "400001",        // required, EXACTLY 6 digits
  "stateCode": "27",          // required, EXACTLY 2 chars — uppercased server-side. Get it from /pincode/:pin
  "lat": 19.076,              // required, finite
  "lng": 72.877,              // required, finite
  "isDefault": true           // optional
}
```

Behaviours:
- The **first** address a consumer creates is always the default, regardless of `isDefault`.
- Deleting the default promotes the most recent remaining address.

| Status | Code | When |
|---|---|---|
| 404 | `not_found` | Not yours. |
| 409 | `invalid_state` | Delete refused — "Address is in use by an active order". |
| 422 | `validation_error` | 5-digit pincode, 3-char state code, missing lat/lng, etc. |

---

### H. Returns

All **[C]**.

#### `POST /consumer/returns`

```jsonc
{
  "orderId": "ord_…",
  "items": [
    {
      "orderItemId": "oi_1",
      "reasonCategory": "doesnt_fit",   // damaged|wrong_item|not_as_described|doesnt_fit|other
      "reasonText": "Sleeves too long", // optional, ≤500
      "photos": ["https://…"]           // optional, ≤6 URLs (upload via /uploads first)
    }
  ]
}
```

**`200`:** `{ "orderId": "ord_…", "returnIds": ["rtn_1"], "reversePickupId": "rpk_1" }`
(`reversePickupId` present only when a home pickup task was created.)

| Status | Code | When |
|---|---|---|
| 404 | `not_found` / `order_not_found` | Not your order. |
| 409 | `return_invalid_state` | Order not `delivered`, no `deliveredAt`, item outcome not returnable, or item was **final sale**. |
| 409 | `return_window_expired` | Past the 7-day window (`app-config.returns.windowDays`). |
| 409 | `return_already_open` | A return already exists for that item (incl. concurrent race). |
| 422 | `validation_error` | Items don't belong to the order; empty `items`; >6 photos. |

Drive the picker from `orderDetail.returnPolicy.items[]` — grey out exactly the lines that can't
be sent back rather than failing at submit.

#### `GET /consumer/returns`

Newest first, each with its item snapshot, refund status and reverse-pickup task.

```jsonc
{
  "success": true,
  "data": [
    {
      "id": "rtn_1", "kind": "standard_return",       // door_return | standard_return
      "openedAt": "…", "reasonText": "…", "reasonCategory": "doesnt_fit",
      "storeDecision": "pending",                      // pending|accepted|rejected|rejected_at_door
      "storeDecidedAt": null,
      "orderId": "ord_…", "orderItemId": "oi_1",
      "itemName": "Relaxed Linen Shirt", "itemBrand": "AURA",
      "itemAttributes": "Ivory / M", "itemImage": "https://…",
      "itemOutcome": "at_store_pending_verification", "netLinePaise": 149900,
      "refund": { "id": "ref_1", "status": "pending", "amountPaise": 149900 },   // null until raised
      "reversePickup": {
        "id": "rpk_1", "status": "assigned",
        "collectOtp": "7391",     // ONLY while status is pending|assigned — read it to the driver
        "assignedAt": "…", "collectedAt": null, "deliveredAt": null
      }
    }
  ]
}
```

**All responses:** 200 (incl. `[]`) · 401 · 500.

---

### I. Support issues

All **[C]**. Unified tickets: queries, complaints and disputes.

#### `GET /consumer/issues`

| Param | Type | Notes |
|---|---|---|
| `status` | `open`\|`requested_evidence`\|`decided`\|`escalated` | optional |
| `kind` | `query`\|`complaint`\|`dispute` | optional |
| `limit` | int 1–200 | default 100 |

Row: `{ id, kind, storeId, orderId, returnId, subject, description, evidence[], status,
awaitingParty, decision, decisionNote, decidedAt, lastMessageAt, createdAt, closedAt }`.
Sorted by `lastMessageAt DESC`.

#### `GET /consumer/issues/:id`

Same row plus:

```jsonc
{
  "messages":    [ { "id", "senderType", "senderId", "body", "attachments": [], "at" } ],
  "transitions": [ { "id", "fromStatus", "toStatus", "awaitingPartyTo", "actorType", "actorId", "reason", "metadata", "at" } ]
}
```

404 when not visible to you.

#### `POST /consumer/issues`

```jsonc
{
  "kind": "complaint",              // query|complaint|dispute
  "orderId": "ord_…",               // at least ONE of orderId / returnId is required
  "returnId": "rtn_…",
  "subject": "Item arrived damaged", // 1–200
  "description": "…",                // 1–5000
  "evidence": ["https://…"]          // URLs, default []
}
```

The store is resolved from the order/return and ownership is asserted.

| Status | Code | When |
|---|---|---|
| 404 | `not_found` | Order/return not yours, or store can't be resolved. |
| 422 | `validation_error` | Neither `orderId` nor `returnId`; length limits. |

#### `POST /consumer/issues/:id/messages`

```jsonc
{ "body": "Here are the photos", "attachments": ["https://…"] }   // body 1–5000
```

404 when the issue isn't visible to you.

---

### J. Offers, rewards, wallet, loyalty, gift cards, referrals, spin

#### `GET /promotions/active` **[P]**

Live offers + coupons for the offers banner and coupon wallet. **Vouchers are deliberately
excluded** (they're personal — see `/consumer/rewards`).

```jsonc
{
  "success": true,
  "data": [
    { "id": "prm_1", "code": "MONSOON20",       // for coupons the NAME is the code typed at checkout; null for offers
      "name": "MONSOON20", "mechanism": "coupon",  // offer | coupon
      "discountType": "percent", "appliedTo": "cart",
      "config": { "percent": 20, "maxAmountPaise": 50000 },   // public by design
      "storeId": null, "validUntil": "2026-09-01T…Z" }
  ]
}
```

Only `status = active`, inside the validity window, and not fully redeemed.
**Validation is not here** — whether a code actually applies is answered by `/pricing/*`
(`rejectedCodes`). One source of truth.

**All responses:** 200 · 304 · 500.

#### `GET /consumer/rewards` **[C]**

Vouchers issued to **this account** — wheel prizes, personal grants. Unredeemed first.

```jsonc
{
  "success": true,
  "data": {
    "rewards": [
      { "id": "vc_1", "code": "SPIN-7F2A", "name": "Flat ₹200 off",
        "discountType": "flat", "config": { "amountPaise": 20000 },
        "validUntil": "2026-09-01T…Z",
        "state": "available",       // available | used | expired  ← one flat state, switch on this
        "wonAt": "2026-08-01T…Z" }
    ]
  }
}
```

Capped at 100 rows. Feed the checkout "have a code?" field from here **and** `/promotions/active` —
a shopper can't be expected to know whether what they hold is a coupon or a voucher (the pricing
engine accepts either in `couponCode`).

#### `GET /consumer/wallet` **[C]**

| Param | Type | Default | Range |
|---|---|---|---|
| `limit` | int | 50 | 1–100 |
| `offset` | int | 0 | ≥0 |

```jsonc
{
  "success": true,
  "data": {
    "balancePaise": 50000,
    "version": 12,                 // CAS version; informational
    "total": 34,                   // total ledger rows, for paging
    "transactions": [
      { "id": "wtx_1", "kind": "refund_credit", "amountPaise": 20000, "balanceAfterPaise": 50000,
        "refOrderId": "ord_…", "refRefundId": "ref_…", "refGiftCardId": null,
        "note": "…", "at": "…" }
    ]
  }
}
```

No wallet row yet ⇒ `{ balancePaise: 0, version: 0, total: 0, transactions: [] }` (a GET never
creates one). Read-only.

#### `GET /consumer/loyalty` **[C]**

Same paging. `{ balancePoints, total, transactions: [ { id, kind, points, balanceAfterPoints,
refOrderId, note, expiresAt, at } ] }`.
Convert to rupees with `app-config.loyalty.pointValuePaise`; gate redemption with
`minRedeemablePoints` / `maxRedeemFractionBp`.

#### `GET /consumer/gift-cards` **[C]**

```jsonc
{ "success": true, "data": { "totalPaise": 100000,
  "cards": [ { "id": "gc_1", "code": "GC-XXXX", "balancePaise": 100000, "expiresOn": "2026-12-31" } ] } }
```

#### `POST /consumer/gift-cards/redeem` **[C]**

```jsonc
{ "code": "GC-XXXX" }    // 1–64 chars, case-insensitive (uppercased server-side)
```

**Redeem-to-wallet model** — the card's balance is credited to the wallet and the card is zeroed.
Gift cards are **never a direct checkout tender**; pay with `wallet` afterwards.

**`200`:** `{ "giftCardId": "gc_1", "creditedPaise": 100000, "walletBalancePaise": 150000 }`

| Status | Code | When |
|---|---|---|
| 404 | `gift_card_invalid` | Unknown code **or the card belongs to someone else** (same opaque error, so codes can't be probed). |
| 409 | `gift_card_expired` | Past `expiresOn`. |
| 409 | `gift_card_already_redeemed` | Balance already 0, or a concurrent redeem won. |
| 503 | `internal_error` | Wallet CAS retries exhausted. |

#### `GET /consumer/referrals/me` **[C]**

```jsonc
{ "success": true, "data": {
  "code": "CX3F9A21B7",
  "shareLink": "https://closetx.app/invite/CX3F9A21B7",   // null when the account has no code
  "referredCount": 3, "pointsEarned": 600,
  "redeemed": false, "refereePointsEarned": 0 } }
```

#### `POST /consumer/referrals/redeem` **[C]**

```jsonc
{ "code": "CX1234ABCD" }
```

Instant-redeem: **both sides** get loyalty points (`app-config.referral.*`).

**`200`:** `{ "referrerName": "Aisha", "referrerPointsGranted": 200, "refereePointsGranted": 100 }`
(A rewards-banned side is recorded with `0` granted — not an error.)

| Status | Code | When |
|---|---|---|
| 404 | `referral_code_invalid` | Unknown code. |
| 400 | `referral_self` | Your own code. |
| 409 | `referral_already_used` | You've already redeemed one (once per lifetime). |

#### Spin & Win

Public with optional auth: **a guest can read the wheel and spin it; only claiming needs an
account.** `deviceId` is a client-generated, stable-per-install string in AsyncStorage — the only
anonymous identity in the system.

##### `GET /spin/wheel` **[O]**

| Param | Type | Notes |
|---|---|---|
| `deviceId` | string 8–64 | **required** |
| `surface` | `popup`\|`screen` | default `popup` |

```jsonc
{
  "success": true,
  "data": {
    "wheel": {
      "id": "spw_1", "name": "Monsoon Wheel",
      "spinsLeftToday": 1,                 // resets at IST midnight
      "guestSpinAllowed": true,
      "segments": [
        { "id": "sws_1", "sortOrder": 0, "label": "₹200 OFF", "sublabel": "on ₹1499+",
          "icon": "gift", "colorHex": "#f4c542", "soldOut": false }
      ]
    }
  }
}
```

**`{ "wheel": null }` is a normal 200** meaning "nothing is running" (or guests aren't allowed and
you're signed out) — render nothing, don't show an error. **Win weights are never serialised.**
An account that has already taken everything this wheel gives gets `spinsLeftToday: 0`.

##### `POST /spin/play` **[O]**

```jsonc
{ "deviceId": "…", "surface": "popup" }
```

**`200`:**

```jsonc
{
  "success": true,
  "data": {
    "playId": "spp_1",
    "segmentIndex": 3,               // POSITION on the rendered wheel — animate the pointer here
    "segmentId": "sws_4",
    "label": "₹200 OFF", "sublabel": "on ₹1499+",
    "won": true,
    "rewardKind": "promotion",       // promotion | points | none
    "requiresLogin": true,           // guest win — must POST /spin/claim after sign-in
    "claimToken": "spt_…",           // null on a loss
    "claimExpiresAt": "2026-08-09T…Z",
    "prize": null                    // populated immediately when the spinner was already signed in
    // prize: { "code": "SPIN-7F2A", "points": null, "label": "₹200 OFF" }
  }
}
```

| Status | Code | When |
|---|---|---|
| 404 | `not_found` | No wheel running. |
| 401 | `unauthorized` | Wheel doesn't allow guest spins. |
| 403 | `forbidden` | Rewards disabled on this account. |
| 409 | `already_spun` | "No spins left today — come back tomorrow". |
| 409 | `already_claimed` | Per-consumer claim cap already reached. |
| 409 | `invalid_state` | Wheel has no slices configured. |
| 409 | `coupon_exhausted` | Every prize has been claimed. |

##### `POST /spin/claim` **[C]**

```jsonc
{ "claimToken": "spt_…" }   // 10–80 chars
```

Binds a guest's pending win to the account that just signed in. **Idempotent on `claimToken`** —
replaying returns the same voucher (which matters, because the app claims right after an OTP
round-trip, exactly when a flaky connection triggers a retry).

**`200`:** `{ "won": true, "alreadyClaimed": false, "prize": { "code": "SPIN-7F2A", "points": null, "label": "₹200 OFF" } }`
A losing token returns `{ "won": false, "prize": null }`.

| Status | Code | When |
|---|---|---|
| 404 | `not_found` | Token unknown. |
| 403 | `forbidden` | Prize belongs to another account, or rewards disabled. |
| 409 | `coupon_expired` | Past `claimExpiresAt`. |
| 409 | `already_claimed` | Per-consumer cap reached. |

**The prize is spendable at checkout** — put the returned `code` into `couponCode` on
`/pricing/*` and placement. An unclaimed guest prize is unspendable by construction: the pricing
engine refuses an assigned voucher for an unauthenticated caller.

---

### K. Reels

**Auth is per-route on purpose:** reads are open to everyone (a signed-out visitor must see real
reels), writes and personal shelves need a consumer token. Sharing is device-side and needs no
call.

Keyset paging: `cursor` = the ISO `createdAt` of the last row you received.

**Reel object** (same everywhere):

```jsonc
{
  "id": "reel_1",
  "caption": "Monsoon fits",
  "videoUrl": "https://…", "thumbnailUrl": "https://…",
  "durationSec": 22, "width": 1080, "height": 1920,
  "status": "active",
  "likeCount": 12, "commentCount": 3, "saveCount": 5, "viewCount": 220,
  "createdAt": "2026-08-01T…Z",
  "author": { "id": "cns_…", "name": "Aisha", "avatarUrl": "https://…" },
  "product": {
    "id": "lst_…", "name": "Relaxed Linen Shirt",
    "image": "https://…",       // the FEATURED VARIANT's photo wins over the listing default
    "status": "active",
    "variant": { "id": "var_…", "label": "Ivory / M", "size": "M", "color": "Ivory", "pricePaise": 149900 }
  },                             // product is null when the reel tags nothing
  "viewerHasLiked": false,
  "viewerHasSaved": false
}
```

| Method | Path | Auth | Query / Body | Response |
|---|---|---|---|---|
| GET | `/consumer/reels` | **[O]** | `cursor?`, `limit` 1–50 (def 10) | `{ items: Reel[], nextCursor }` — active reels, newest first |
| GET | `/consumer/reels/:id` | **[O]** | — | Reel |
| GET | `/consumer/reels/:id/comments` | **[O]** | `cursor?`, `limit` 1–50 (def 20) | `{ items: [{ id, body, createdAt, author }], nextCursor }` |
| POST | `/consumer/reels/:id/view` | **[O]** | — | `{ viewCount: 221 }` |
| POST | `/consumer/reels/media` | **[C]** | multipart `file` | see below |
| POST | `/consumer/reels` | **[C]** | body ↓ | Reel |
| DELETE | `/consumer/reels/:id` | **[C]** | — | `{ deleted: true }` |
| GET | `/consumer/reels/mine` | **[C]** | `cursor?`, `limit` | `{ items, nextCursor }` |
| GET | `/consumer/reels/saved` | **[C]** | `cursor?`, `limit` | `{ items, nextCursor }` (all `viewerHasSaved: true`) |
| POST / DELETE | `/consumer/reels/:id/like` | **[C]** | — | `{ liked: bool, likeCount }` |
| POST / DELETE | `/consumer/reels/:id/save` | **[C]** | — | `{ saved: bool, saveCount }` |
| POST | `/consumer/reels/:id/comments` | **[C]** | `{ body: 1–1000 }` | comment object |
| DELETE | `/consumer/reels/:id/comments/:commentId` | **[C]** | — | `{ deleted: true }` |

**Optional auth semantics:** a valid token adds `viewerHasLiked` / `viewerHasSaved`; without one
both are `false`. Signed-out is the normal case for the feed, not an error.

**Like/save are idempotent** — a duplicate insert is swallowed (unique violation), so double-taps
are safe.

#### `POST /consumer/reels/media` (step 1 of 2)

`multipart/form-data` with a `file` field. Accepted MIME: `video/mp4`, `video/quicktime`,
`video/webm`. Max **100 MB**. **Hard 30-second cap enforced against the server-measured duration.**

**`200`:** `{ videoUrl, videoPublicId, thumbnailUrl, durationSec, width, height, bytes }`

| Status | Code | Message |
|---|---|---|
| 422 | `validation_error` | "No file in request…" / "Unsupported format '…' — reels must be MP4, MOV, or WebM" / "File too large — reels are capped at 100 MB" / "Reel too long — max 30s, got 42s." / "Couldn't read this video — re-export it and try again." (unmeasurable duration is fatal) |

A rejected clip is deleted from storage server-side — no orphans.

#### `POST /consumer/reels` (step 2)

```jsonc
{
  "videoUrl": "https://…",       // required
  "videoPublicId": "…",          // required
  "thumbnailUrl": "https://…",   // required
  "durationSec": 22, "width": 1080, "height": 1920, "bytes": 8421000,   // optional, advisory
  "caption": "…",                // optional, ≤2200
  "productId": "lst_…",          // OPTIONAL — tagging a product is a choice, and requires no purchase
  "variantId": "var_…"           // optional, only alongside productId
}
```

| Status | Code | When |
|---|---|---|
| 403 | `consumer_banned` | Banned from posting reels. |
| 404 | `not_found` | "Tagged product not found" / "Variant not found for this product". |
| 422 | `validation_error` | `variantId` without `productId`; bad URLs; `durationSec > 30`. |

`POST /:id/comments` also 403s with `consumer_banned`, and both comment routes 404 on a
non-active reel. Deleting a reel cascades its likes/saves/comments.

---

### L. Community (posts + reviews + reports)

All **[C]** — the whole module requires a consumer token, including the posts feed.
Keyset paging identical to reels.

**Post object:** `{ id, body, media[], status, likeCount, commentCount, saveCount, createdAt,
author: { id, name, avatarUrl }, viewerHasLiked, viewerHasSaved }`

| Method | Path | Body / Query | Response |
|---|---|---|---|
| GET | `/consumer/community/posts` | `cursor?`, `limit` 1–50 (def 10) | `{ items, nextCursor }` |
| GET | `/consumer/community/posts/:id` | — | Post |
| POST | `/consumer/community/posts` | `{ body: 1–5000, media: url[] ≤10 }` | `{ id, body, media, status, createdAt }` |
| DELETE | `/consumer/community/posts/:id` | — | `{ deleted: true }` |
| POST/DELETE | `/consumer/community/posts/:id/like` | — | `{ liked, likeCount }` |
| POST/DELETE | `/consumer/community/posts/:id/save` | — | `{ saved, saveCount }` |
| GET | `/consumer/community/posts/:id/comments` | `cursor?`, `limit` 1–50 (def 20) | `{ items, nextCursor }` |
| POST | `/consumer/community/posts/:id/comments` | `{ body: 1–1000 }` | comment |
| DELETE | `/consumer/community/posts/:id/comments/:commentId` | — | `{ deleted: true }` |
| GET | `/consumer/community/posts/mine` | `limit` 1–100 (def 50) | rows incl. `takedownReason` |
| GET | `/consumer/community/reviews/mine` | `limit` 1–100 (def 50) | rows incl. `takedownReason` |

#### `POST /consumer/community/reviews`

The write path behind `GET /catalog/products/:id/reviews`.

```jsonc
{
  "listingId": "lst_…",   // required
  "orderId": "ord_…",     // optional; must be YOUR order if sent
  "rating": 5,            // required, integer 1–5
  "body": "…",            // optional, ≤5000  ← the field is `body`, NOT `text`
  "media": ["https://…"]  // optional, ≤10 URLs
}
```

**`200`:** `{ id, listingId, rating, body, media, status, verifiedPurchase, createdAt }`

**`verifiedPurchase` is derived server-side, never trusted from the client**: you must have a
non-cancelled, non-payment-failed order containing that listing. It drives both the badge and
public visibility — a review from a non-buyer is stored and visible to its author under
`/reviews/mine`, but never shown to other shoppers. **Say that in the composer** or the reviewer
will think their review vanished.

| Status | Code | When |
|---|---|---|
| 403 | `consumer_banned` | Banned from writing reviews. |
| 404 | `not_found` / `order_not_found` | Unknown listing / order not yours. |
| 422 | `validation_error` | Rating outside 1–5, >10 media. |

#### `POST /consumer/community/reports`

```jsonc
{
  "targetType": "reel",     // community_post | product_review | reel | reel_comment | post_comment
  "targetId": "reel_1",
  "reason": "…"             // 3–1000
}
```

**`200`:** `{ id, targetType, targetId, status, createdAt }` · 404 when the target doesn't exist.

---

### M. Moodboards

Owner routes are **[C]**; the share read is **[P]**.

**Board detail:** `{ id, name, note, isPublic, status, createdAt, updatedAt, itemCount,
coverImageUrl, items: [ { id, listingId, sortOrder, addedAt, listing: { id, name, image, status } } ] }`
List view returns the same **minus `items`** (summary only).

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| GET | `/consumer/moodboards` | C | — | summaries, most recently updated first |
| POST | `/consumer/moodboards` | C | `{ name: 1–80, note?: ≤500\|null, isPublic?: bool }` | created summary |
| GET | `/consumer/moodboards/:id` | C | — | detail (ownership enforced) |
| PATCH | `/consumer/moodboards/:id` | C | any subset of the create body | detail |
| DELETE | `/consumer/moodboards/:id` | C | — | `{ deleted: true }` |
| POST | `/consumer/moodboards/:id/items` | C | `{ listingId }` | `{ id, listingId, addedAt }` |
| DELETE | `/consumer/moodboards/:id/items/:itemId` | C | — | `{ deleted: true }` |
| GET | `/public/moodboards/:id` | **P** | — | detail **minus `status`**; only `isPublic && status='active'` |

Items reference listings and **join the live listing on read**, so a delisted product surfaces its
`status` rather than freezing a stale snapshot.

| Status | Code | When |
|---|---|---|
| 404 | `not_found` | Board not yours / item not on that board / product unknown / public board not shareable. |
| 409 | `invalid_state` | "Product already in this board". |
| 422 | `validation_error` | Empty PATCH body ("No fields to update"), name length. |

---

### N. Virtual try-on

#### `POST /consumer/tryon` **[C]**

```jsonc
{
  "personImageUrl": "https://…",   // required — upload the selfie via /uploads first
  "listingId": "lst_…",            // required
  "variantId": "var_…"             // optional
}
```

**The client picks the garment by reference, never by URL.** The server resolves the hosted URL
from its own catalog data (SSRF guard):
- `variantId` with an image → that variant's first image
- `variantId` without one → falls back to the **listing default** (`galleryUrls[0]`)
- no `variantId` → the listing default
- no images at all → 422

**`200`:** `{ "result": "https://…/tryon.png", "steps": ["https://…/tryon.png"] }`

| Status | Code | When |
|---|---|---|
| 404 | `not_found` | Product / variant-for-this-product not found. |
| 422 | `invalid_state` | "This product has no image to try on". |
| 503 | `rate_limited` | Provider saturated (429 / RESOURCE_EXHAUSTED) → "Try-on is busy right now — please try again in a moment." **Retryable.** |
| 502 | `internal_error` | "Try-on failed — please try again." |

> Known gap, documented in the backend: a garment blocked by the provider's safety filter also
> lands in the 502 bucket, where "please try again" is the wrong advice (that failure is permanent
> for that product). Don't build an aggressive auto-retry loop on 502.

Because a variant's thumbnail can silently be the listing default, use the detail response's
`hasOwnImage` notion when building the picker — otherwise two try-on options look different but
produce the same result.

---

### O. Notifications & push

#### `GET /consumer/notifications` **[C]**

| Param | Type | Notes |
|---|---|---|
| `before` | ISO datetime | cursor — the `createdAt` of the last row seen |
| `limit` | int 1–50 | default 20 |

```jsonc
{
  "success": true,
  "data": {
    "items": [
      { "id": "ntf_1", "kind": "order", "title": "Out for delivery",
        "body": "Your order is on the way", "deepLink": "trendzo://orders/ord_…",
        "payload": { "orderId": "ord_…" }, "read": false, "createdAt": "…" }
    ],
    "nextCursor": "2026-08-01T…Z",   // null once the page is short — stop paging
    "unreadCount": 3                  // badge
  }
}
```

| Method | Path | Response |
|---|---|---|
| POST | `/consumer/notifications/:id/read` | `{ id, read: true }` (idempotent; 404 if not yours) |
| POST | `/consumer/notifications/read-all` | `{ markedRead: 7 }` |
| DELETE | `/consumer/notifications/:id` | `{ id, deleted: true }` — **soft delete**, row survives for analytics |

#### Push subscriptions **[C]**

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/consumer/push-subscriptions` | — | rows |
| POST | `/consumer/push-subscriptions` | `{ platform: web\|ios\|android (def web), endpoint: url ≤2000, p256dh?: ≤256, auth?: ≤256, userAgent?: ≤512 }` | `{ id }` |
| DELETE | `/consumer/push-subscriptions/:id` | — | `{ revoked: bool }` |

---

### P. Analytics events

Both **[C]**. Fire-and-forget; never block UI on them.

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/consumer/events/listing-view` | `{ listingId, variantId?, sessionId?, source?: ≤64 }` | `{ id }` |
| POST | `/consumer/events/cart-add` | `{ variantId, qty: 1–1000 (def 1) }` | `{ id }` |

404 when the listing/variant is unknown, or the variant doesn't belong to the listing.

---

### Q. Media upload

#### `POST /uploads` **[C]** (any signed-in identity)

`multipart/form-data`, one `file` field. **This route requires auth** — it writes to our bucket and
the rich-text sanitizer trusts the resulting URLs.

| Query param | Values | Effect |
|---|---|---|
| `folder` | 1–120 chars | Sub-folder under `closetx/`. Default `uploads`. |
| `resourceType` | `auto`\|`image`\|`video`\|`raw` | Force a type. |
| `purpose` | `listing-gallery`\|`listing-description` | Retailer-side strict caps (5 MB, JPEG/PNG/WebP). Omit for consumer uploads → 25 MB lax ceiling. |

**`200`:** `{ url, publicId, width, height, format, bytes, resourceType, mimetype, filename }`

Use it for: review photos, return evidence photos, issue attachments, try-on selfies, community
post media.

| Status | Code | When |
|---|---|---|
| 401 | `unauthorized` | Not signed in. |
| 422 | `validation_error` | No file; truncated (over the cap); bad query params; purpose-specific mime/size violation. |

---

## 6. Screen-by-screen recipes

Order matters where noted. Anything marked *parallel* can fire together on mount.

### HomeTab
1. *parallel*: `GET /cms/home?gender=<rail>&city=<city?>` · `GET /app-config` · `GET /catalog/products?gender=<rail>&view=card&limit=24` · `GET /catalog/brands` · `GET /catalog/collections?kind=outfit&gender=<rail>` · `GET /catalog/collections?kind=occasion&gender=<rail>`
2. Warm the other rail after interactions settle: `GET /catalog/products?gender=<other>&view=card&limit=24`
3. Explore pager: `offset = products.length`, same `limit`. A short page ⇒ exhausted.
4. Spin popup (if configured): `GET /spin/wheel?deviceId=&surface=popup`

### Search
`GET /catalog/products?search=<q>&gender=&view=card&limit=50` — debounce ≥300 ms and abort the
previous request (the shared client de-dupes but not across changing URLs).

### Categories (CategoryTab / `Categories`)
1. `GET /catalog/categories?gender=<rail>&activeOnly=true&withCounts=true`
2. Assemble the tree client-side by `parentId`; use `labelHim`/`sortOrderHim` on the HIM rail.
3. Hide nodes with `listingCount === 0`.
4. Banners: `GET /cms/home` → `page.category_banners`.

### Category (a leaf or parent)
`GET /catalog/products?gender=&categorySlug=<slug>&sort=<sort>&view=card&limit=24&offset=`
Optionally `GET /catalog/facets?...` for a result count and sibling counts.

### CategoryZoom
`GET /catalog/products?gender=&search=<label>&view=card&limit=30` — fire **after** the morph
animation so the fetch doesn't compete with it.

### ProductDetail
1. `GET /catalog/products/:id` (full shape — variants, groups, gallery, `descriptionLong`, live rating)
2. *parallel*: `GET /catalog/products/:id/reviews` · `GET /catalog/products?gender=&view=card&limit=24` (More to Love) · `GET /promotions/active`
3. On add-to-bag: `POST /consumer/events/cart-add` (fire-and-forget) + cart write.
4. Review composer: `POST /consumer/community/reviews`, then re-fetch reviews.

### CartTab
1. `GET /consumer/cart` (signed-in) — merge with the local guest cart.
2. `POST /pricing/cart` with the full items array on every quantity change (debounced).
3. Suggestions rail: `GET /catalog/products?gender=&view=card&limit=12`.
4. Coupon field: send as `couponCode`; read `rejectedCodes[].reason` for the inline message.

### ReviewOrder → checkout
1. *parallel*: `GET /consumer/addresses` · `GET /consumer/wallet` · `GET /consumer/loyalty` · `GET /consumer/rewards` · `GET /promotions/active` · `GET /app-config`
2. If profile incomplete → `PATCH /consumer/profile/me` first.
3. Pickup chosen → `GET /catalog/stores/:id/pickup-slots?days=7`.
4. `POST /pricing/cart` (multi-store) or `POST /pricing/quote` (single store) with the **final**
   `deliveryMethod` + `paymentMethod` — quoting the default method and charging another is the
   classic mismatch bug.
5. Place: `POST /consumer/checkout` or `/consumer/checkout/group` with an `idempotencyKey`.
6. If `payment` is present → open Razorpay → `POST …/verify-payment` (or `…/payment-failed`).
7. On `409 order_stock_unavailable` / `order_price_changed` → re-quote and show the delta.

### OrderHistory / OrderTracking
- `GET /consumer/checkout/orders` (list is already card-ready — no per-row detail fetch).
- `GET /consumer/checkout/orders/:id` for the detail: status timeline, `deliveryOtp`/`pickupCode`,
  `returnPolicy`, `refunds`, live `storeLat`/`storeLng`/`storePhone`.
- Cancel: `POST …/orders/:id/cancel`. Retry payment: `POST …/orders/:id/retry-payment`.

### OrderReturn
1. `GET /consumer/checkout/orders/:id` → drive the item picker from `returnPolicy.items[]`.
2. Photos → `POST /uploads`.
3. `POST /consumer/returns`.
4. Track: `GET /consumer/returns` (refund status + reverse-pickup OTP).

### SavedAddresses
`GET /consumer/addresses` · `GET /pincode/:pin` on pincode blur (fills city/state/**stateCode**) ·
create/patch/delete/set-default.

### ReelsTab
1. `GET /consumer/reels?limit=10` → `nextCursor` paging.
2. `POST /consumer/reels/:id/view` when a reel becomes ≥50% visible for ≥1 s (works signed-out).
3. Like/save/comment require auth — trigger the OTP sheet on 401 and replay the action.
4. Create: `POST /consumer/reels/media` → `POST /consumer/reels`.

### TryOnPicker → TryOn
1. `GET /catalog/products?...` for the picker (any live listing is fair game).
2. `GET /catalog/products/:id` for variants; only offer a variant that has its **own** image.
3. Selfie → `POST /uploads` → `POST /consumer/tryon`.

### Profile & sub-screens
`GET /consumer/profile/me` · `GET /consumer/loyalty` · `GET /consumer/wallet` ·
`GET /consumer/gift-cards` · `GET /consumer/referrals/me` · `GET /consumer/issues` ·
`GET /consumer/checkout/orders` · `GET /consumer/notifications`.

### StorePickup
`GET /catalog/stores/nearby?lat=&lng=&radiusKm=15&limit=20` → `GET /catalog/stores/:id` →
`GET /catalog/stores/:id/pickup-slots?days=7` → optionally
`GET /catalog/products?storeId=…&view=card`.

---

## 7. Gaps — what has no API yet

### No backend at all — these screens are UI-only today

| Screen / feature | Status |
|---|---|
| `DailyReward` | No endpoint. Streak/claim state is local. |
| `LuckyDraw` | No endpoint. |
| `StyleQuiz` | No endpoint. |
| `AppChallenges` | No endpoint. |
| `ImageSearch` (visual search) | No endpoint. The screen falls back to `GET /catalog/products?sort=newest&limit=8` as an honest stand-in. |
| `FashionCalendar`, `Sustainability`, `About` (beyond the `/app-config` support/company block) | Static content. |
| `StylePreferences`, `Measurement`, `Language`, `PaymentMethods` | Local-only. `genderPreference` is the one preference that persists (`PATCH /consumer/profile/me`). |
| Flash Fit bundle assembly | No "bundle" endpoint — assembled client-side from `sort=price_asc`. |
| Top Stories rails | No per-story product API — each story is given a different slice of one `/catalog/products` call. |
| Play & Win game list | Hardcoded id→route map. No CMS key, no endpoint. Adding/reordering games needs an app release. |

### Backend exists but the app doesn't call it yet

| Endpoint family | Note |
|---|---|
| `/consumer/community/*` | Full posts + comments + likes/saves + reports API is live; `CommunityFeed` is not wired to it. |
| `/consumer/moodboards/*` + `/public/moodboards/:id` | Full CRUD + share link live; `MoodBoard` is not wired. |
| `/catalog/stores/nearby`, `/catalog/stores/:id` | Live; `StorePickup` still needs wiring (pickup-slots **is** used). |
| `/consumer/events/*` | Analytics ingest live, not called. |
| `/consumer/push-subscriptions` | Live, not called. |
| `/catalog/facets` | Live; no screen uses it — it's the natural backing for a result count and a filter sheet. |
| `/consumer/reels/mine`, `/consumer/reels/saved` | Live; only the main feed is wired. |

### Known filter limitations (backend change required)

- No server-side **price range**, **colour**, **size**, **brand**, **rating floor**,
  **discount-only** or **in-stock-only** filter on `/catalog/products`.
- No server-side **occasion** filter on `/catalog/products` (only via an occasion *collection*).
- `search` matches **product name only** — not brand, description or category.
- Collection page contents are app-side (`src/content/collections.ts`) for the keys the CMS points
  at. The natural fix is extending `/catalog/collections` with editorial slugs and pointing tiles at
  `Collection` with a real slug instead of an app-side key.

---

## 8. Appendix — enums, ids, units

### Order status (`orderStatus`)

`pending` · `confirmed` · `routing` · `accepted` · `packed` · `picked_up` · `out_for_delivery` ·
`at_door` · `undelivered` · `returning_to_store` · `returned_to_store` · `delivered` · `cancelled` ·
`payment_failed` · `closed`

**Terminal:** `cancelled`, `closed`. Consumer cancellation is permitted from `pending`,
`payment_failed`, `confirmed`, `accepted` — not after `packed`.

### Order item outcome (`orderItemOutcome`)

`pending_delivery` · `delivered_kept` · `at_door_kept` · `at_door_returned` · `at_door_refused` ·
`at_door_return_rejected` · `at_store_pending_verification` · `store_accepted_return` ·
`store_rejected_held` · `held_collected_at_counter` · `held_redelivered` · `held_abandoned` ·
`held_window_expired` · `dispute_open` · `dispute_resolved_refund` ·
`dispute_resolved_fresh_delivery` · `dispute_resolved_pickup` …

### Delivery method

`express` · `standard` · `pickup` · `try_and_buy`
(`reverse_pickup` exists in the DB enum for driver earnings only — an order never carries it.)

### Payment method

Pricing accepts `upi` · `card` · `cod` · `wallet` · `gift_card`.
**Placement accepts `upi` · `card` · `cod` · `wallet` only** — gift cards are redeemed to the
wallet first.

### Payment status

`pending` · `succeeded` · `failed` · `superseded`

### Listing policy (returnability, frozen at placement)

`return` · `replace` · `final_sale` — `final_sale` items can never be returned.

### Return reason category

`damaged` · `wrong_item` · `not_as_described` · `doesnt_fit` · `other`
(Drive the picker from `app-config.returns.reasons`, which carries labels.)

### Return kind / store decision

`door_return` · `standard_return` — `pending` · `accepted` · `rejected` · `rejected_at_door`

### Refund status / disbursement destination

`pending` · `processing` · `succeeded` · `partially_disbursed` · `failed`
→ `original_tender` · `wallet` · `cash` · `manual_payout`

### Collection kinds

`outfit` · `occasion` · `drop` · `edit` · `trend` (rows may also be `brand`, which
`/catalog/collections?kind=` does not accept as a filter).

### Variant mode

`single` (one SKU, no axes) · `color_size` · `custom`

### Gender

`her` · `him` · `unisex` — a `unisex` row appears on both rails.

### Money

Integer paise everywhere. `₹ = paise / 100`. Never send or compare floats.

### Paging cheat-sheet

| Endpoint family | Style | Params |
|---|---|---|
| `/catalog/products`, `/catalog/products/:id/reviews` | offset | `limit` (≤100), `offset` |
| `/consumer/wallet`, `/consumer/loyalty` | offset | `limit` (≤100), `offset` |
| `/consumer/reels*`, `/consumer/community/posts*` | keyset | `cursor` (ISO createdAt), `limit` (≤50) |
| `/consumer/notifications` | keyset | `before` (ISO), `limit` (≤50) |
| `/consumer/issues`, `/consumer/community/*/mine` | cap only | `limit` |
| `/consumer/checkout/orders`, `/consumer/addresses`, `/consumer/returns`, `/consumer/gift-cards`, `/consumer/moodboards` | none | returns everything |

### Idempotency

- **Checkout:** send `idempotencyKey`; a replay returns the original order with
  `alreadyExisted: true`.
- **Spin claim:** idempotent on `claimToken`.
- **Reel/post like & save:** idempotent by unique index.
- **Notifications mark-read:** idempotent.
- Everything else is **not** idempotent — guard double-submits client-side.
