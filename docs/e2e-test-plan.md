# Trendzo — End-to-End Test Plan

A device-by-device pass over every flow in the consumer app — checking that it does not crash, does
not stutter, and that each journey ends where it should. Work top to bottom; the order is the order
a real shopper meets the app.

**Cases:** 90 · **Platforms:** iOS 26.5, Android · **Builds:** Debug *and* Release

> **Run every flow twice — once on a Debug build, once on Release.** They are not equivalent. Debug
> runs unoptimised JS and an instrumented Reanimated runtime, so animation smoothness cannot be
> judged there. Release strips that, but has its own failure mode: view flattening under the New
> Architecture can break things that work in Debug.
>
> Record the build type against every result. A defect that appears in only one of the two is a more
> valuable finding than one that appears in both.

---

## 01 · Cold start & first run

Install fresh — delete the app first so onboarding and permissions actually run.

- [ ] **START-01** — Delete the app, reinstall, launch.
      → Splash plays once, then Onboarding. **No white flash, no double splash, no crash.**
- [ ] **START-02** — Time from tap to interactive Home.
      → Under ~4s on Release. Note the figure — it is your baseline for later runs.
- [ ] **START-03** — Swipe through all onboarding pages, then finish.
      → Paging snaps one screen per swipe. Lands on Home or auth, never a blank screen.
- [ ] **START-04** — Deny the location permission when the gate appears.
      → App stays usable. Denial is handled, not a dead end or a crash.
- [ ] **START-05** — Relaunch a second time (warm start).
      → Onboarding does **not** replay. Session and gender selection persist.

## 02 · Sign in — phone & OTP

Login is a bottom sheet, not a page. OTP is 4 digits via MSG91.

- [ ] **AUTH-01** — Trigger the auth sheet from a gated action (add to bag, or Profile).
      → Sheet slides up over a **dimmed** page. The background must not turn white.
- [ ] **AUTH-02** — Enter a valid number, request the OTP.
      → Keyboard never covers the input. The 4 boxes fill as you type.
- [ ] **AUTH-03** — Enter a wrong OTP.
      → A clear error that says what to do next. No silent failure, no crash.
- [ ] **AUTH-04** — Use Resend, then complete with the correct OTP.
      → Resend is rate-limited or has a countdown. Correct code signs you in and closes the sheet.
- [ ] **AUTH-05** — Complete Profile, then background and reopen the app.
      → Still signed in. Profile data persisted.

## 03 · Home feed

The busiest screen and the most likely place to see jank.

- [ ] **HOME-01** — Flick from the top all the way to the footer, then back up.
      → One flick carries a long way and settles smoothly. **No stutter, no snapping back, no blank sections.**
- [ ] **HOME-02** — Sit at the very top of the hero.
      → Only the hero's own frosted search bar shows. **The white floating search bar must never appear over the hero.**
- [ ] **HOME-03** — Scroll down past the hero, then double-tap the Home tab.
      → Page returns to top and the white search bar disappears with it. (This was the stranded-bar bug.)
- [ ] **HOME-04** — Toggle the HER / HIM switch several times.
      → Content swaps, puck animates, **no vibration**. Repeat toggles do not refetch endlessly.
- [ ] **HOME-05** — Pull to refresh.
      → Spinner shows, content reloads, scroll position is sane afterwards.
- [ ] **HOME-06** — Scroll to the bottom repeatedly to trigger load-more.
      → One page appends per flick — not two. No duplicate products in the grid.
- [ ] **HOME-07** — Scroll fast through the banner and story rails.
      → Images fill in without the layout jumping. Auto-rotating banner pauses while scrolling.

## 04 · Browse & discovery

- [ ] **BROWSE-01** — Open each tab: Home, Reels, Category, Bag.
      → All four load. Switching tabs keeps each one's scroll position.
- [ ] **BROWSE-02** — Category tab → open a category → scroll the grid → back.
      → Grid scrolls smoothly. Back returns to the previous scroll position.
- [ ] **BROWSE-03** — Search: type a term with results, then one with none.
      → Results appear; the empty case says so plainly rather than showing a blank grid.
- [ ] **BROWSE-04** — Open Image Search and submit a photo.
      → Permission prompt handled; a denied permission does not crash.
- [ ] **BROWSE-05** — Visit Steals, Flash Fit, Shop by Occasion, HER EDIT, HIS CODE.
      → Every page loads real products, or states clearly that it has none. No page shows invented stock.
- [ ] **BROWSE-06** — On Steals, switch every price band.
      → Grid refilters. An empty band says so rather than showing the previous band's items.

## 05 · Product open / close

The shared-element zoom. Judge smoothness on Release only.

- [ ] **PDP-01** — Tap a product card on Home and watch the open animation.
      → The image flies from the exact card position into the gallery slot. **No jump, jitter or double-step.**
- [ ] **PDP-02** — Close it and watch the image return.
      → It lands back on the same card it came from, at the right size and position.
- [ ] **PDP-03** — Repeat from Steals, Category grid, Search results and a Top Stories rail.
      → Same quality from every surface — this is where jitter has been reported.
- [ ] **PDP-04** — Tap a card once and wait — do not double-tap.
      → One tap always opens the product. A tap must never do nothing.
- [ ] **PDP-05** — Open, close, open, close rapidly ten times.
      → No stuck overlay, no invisible sheet left behind, and **the page underneath still scrolls.**
- [ ] **PDP-06** — Swipe the gallery, switch colour, pick a size, open the fullscreen viewer.
      → Gallery pages cleanly. Viewer opens at the tapped image and closes back.
- [ ] **PDP-07** — Scroll the detail page to the bottom, then use hardware/system back.
      → Back runs the same close animation as the on-screen arrow, not a hard cut.

## 06 · Try On

- [ ] **TRY-01** — Open Try On from a product and from the home section.
      → Camera permission requested once and handled. Denial degrades gracefully.
- [ ] **TRY-02** — Pick an existing photo instead of the camera.
      → Photo loads and processes. A failure shows a real message, not a spinner forever.
- [ ] **TRY-03** — Leave Try On and return to the product.
      → Product page is intact — not blank, not duplicated, still scrollable.

## 07 · Bag & coupons

- [ ] **BAG-01** — Add several products, including two sizes of the same item.
      → Both lines appear separately with the right size and price.
- [ ] **BAG-02** — Change quantities and remove a line.
      → Totals recalculate immediately and correctly.
- [ ] **BAG-03** — Add items until the free-delivery threshold (₹999) is crossed.
      → The meter fills and the message updates to reflect the unlocked state.
- [ ] **BAG-04** — Type a coupon code, and apply one from the wallet.
      → Keyboard never hides the field. A valid code discounts; an invalid one explains why.
- [ ] **BAG-05** — Empty the bag completely.
      → A proper empty state with a way back to shopping.

## 08 · Checkout — four steps

- [ ] **CHK-01** — Walk steps 1 → 4, using Back between each.
      → The running total is correct at every step. Back never loses entered data.
- [ ] **CHK-02** — Check out with no saved address.
      → The add-address path appears instead of a dead Continue button.
- [ ] **CHK-03** — Add an address using the map picker.
      → Map loads, pin is settable, address saves and is selectable.
- [ ] **CHK-04** — Try each fulfilment method — express, standard, Try & Buy, store pickup.
      → Charges change accordingly. Pickup is free. Nothing contradicts the terms sheet.
- [ ] **CHK-05** — On a small phone, check the bottom bar against the system nav.
      → Buttons clear the home indicator / nav buttons on both platforms.

## 09 · Review order & payment

Money screen — check the arithmetic as carefully as the UI.

- [ ] **PAY-01** — Open **Terms & policies** from the ⓘ next to delivery charges.
      → A sheet slides up over a **dimmed** page, capped at ~78% height and scrollable inside.
      **The background must never go white.**
- [ ] **PAY-02** — Scroll that sheet to the bottom, then dismiss by tapping the dim area and by the ✕.
      → All five sections reachable. Both dismissals work.
- [ ] **PAY-03** — Compare the bill breakdown against the pay button figure.
      → Delivery, service and GST are itemised. **The button figure equals what is actually charged.**
- [ ] **PAY-04** — Apply wallet credit as a partial payment.
      → The button shows the remaining amount to charge, not the order total.
- [ ] **PAY-05** — Select Try & Buy, then try to choose Cash on Delivery.
      → COD is blocked with a reason — Try & Buy is prepaid only, since refunds need a payment to return to.
- [ ] **PAY-06** — Pay online — open the Razorpay sheet and then **cancel** it. ⚠️ *high risk*
      → Returns to Review Order cleanly. No duplicate order, no stuck spinner.
- [ ] **PAY-07** — Complete a real payment end to end.
      → Order is created exactly once and Order Success shows.
- [ ] **PAY-08** — Place a COD order.
      → Succeeds without opening a payment sheet.
- [ ] **PAY-09** — Turn airplane mode on, then tap Pay.
      → A real network error. No half-created order, no crash.

## 10 · After the order

- [ ] **POST-01** — From Order Success, open tracking.
      → Status and timeline reflect the order just placed.
- [ ] **POST-02** — Open Order History.
      → The new order is listed with the correct total and items.
- [ ] **POST-03** — Start a return on a delivered order.
      → Return flow completes. Refund copy matches the destination — no invented promises.
- [ ] **POST-04** — Leave a review.
      → Submits and appears on the product.

## 11 · Reels

- [ ] **REEL-01** — Swipe through ten reels.
      → One reel per swipe. Video starts promptly; no audio from off-screen reels.
- [ ] **REEL-02** — Switch to another tab mid-playback, then return.
      → Playback pauses on leave and resumes sanely. **No audio continues in the background.**
- [ ] **REEL-03** — Open a tagged product from a reel, then come back.
      → Returns to the same reel, still playable.
- [ ] **REEL-04** — Check the product card, @user block and action rail positions.
      → All clear the tab bar and home indicator on both platforms.
- [ ] **REEL-05** — Create a reel and attach products.
      → Picker works, reel posts or fails with a clear message.

## 12 · Rewards & games

- [ ] **GAME-01** — Play Spin & Win, Push & Win, Daily Reward, Lucky Draw, Style Quiz.
      → Each completes and credits correctly. **No vibration on any result.**
- [ ] **GAME-02** — Check a won reward reaches Rewards / Coupon Wallet.
      → It is there and usable at checkout.
- [ ] **GAME-03** — Dismiss the welcome wheel popup, then relaunch.
      → It does not reappear every launch.

## 13 · Profile & settings

- [ ] **PROF-01** — Open every row in Profile one by one.
      → Every screen opens and goes back. **No route crashes on any row.**
- [ ] **PROF-02** — Edit profile, add/edit/delete an address, add a payment method.
      → Changes persist across an app restart. Keyboard never covers a field.
- [ ] **PROF-03** — Sign out, then sign back in.
      → Session clears fully; signing back in restores the bag and orders.

## 14 · Regression — this week's changes

Each of these is a specific fix. If one fails, it has regressed.

| What changed | Check |
| --- | --- |
| iOS scroll deceleration | Home flick coasts smoothly on iOS, comparable to Android |
| Vibration removed app-wide | No buzz anywhere: gender switch, buttons, game results |
| Hero search bar | White bar never visible over the hero, by any route |
| Top Stories cards | Cards not tappable; only products open; cover story has a rail |
| Collection pages | The five editorial tiles open their own page, never the catalog |
| Delivery terms sheet | Background stays dimmed, never white |
| Categories page | No black overlays or shadows; labels below tiles; all tiles portrait |
| Product zoom | Open and close are smooth from every surface |

- [ ] **REG-01** — Open all five new Collection pages: *Five-minute fits.*, *Built different.*,
      *New week, new closet.*, *Off the clock.*, and the 60-Minute Delivery banner.
      → Each shows its own titled grid of real products — **and the five are not identical to each other.**
- [ ] **REG-02** — On each Collection page, open a product and come back.
      → Zoom works, back returns to the collection, not to Home.
- [ ] **REG-03** — Confirm no remaining tile drops you on the generic catalog unless it is genuinely a category.
      → Category chips → catalog is correct. Editorial tiles → catalog is a defect.

## 15 · Stability sweep

Run last, on Release, after the app has been used for a while.

- [ ] **STAB-01** — Use the app continuously for ten minutes across all tabs.
      → No crash, no progressive slowdown, no runaway memory.
- [ ] **STAB-02** — Background the app for five minutes mid-checkout, then return.
      → State is intact. No crash on resume.
- [ ] **STAB-03** — Toggle airplane mode on and off while browsing.
      → Failed loads show retry, and retry actually works once back online.
- [ ] **STAB-04** — Rotate the device / use the largest system font size.
      → No clipped text or overlapping controls on key screens.
- [ ] **STAB-05** — Push deep — Home → Category → Product → Try On → Search — then back all the way out.
      → Every back step lands correctly and the app returns to Home.
      **No invisible screen left swallowing scrolls.**
- [ ] **STAB-06** — Repeat STAB-05 on a low-end Android device.
      → Usable frame rate throughout.

---

## 16 · Known risks

Open questions going into this pass. Test these hardest.

### 🔴 Blocker — Release build froze on Home

A Release build showed Home content but would not scroll at all from a cold launch, before opening
anything. Debug with identical JS was not confirmed against it, so the cause is still unknown.

**Test:** cold-launch the Release build and scroll Home before touching anything. If it freezes,
stop and report — nothing below it is trustworthy.

### 🔴 Blocker — Razorpay on the New Architecture

`react-native-razorpay` is flagged by expo-doctor as unsupported on the New Architecture, which this
app has enabled. It is untested under Release.

**Test:** PAY-06 through PAY-09, on Release, on both platforms. Payment failing is the worst
possible defect here.

### 🟡 Watch — Product zoom smoothness

Reported as jittery on iOS, but only ever observed on a Debug build — where animation is expected to
be worse. Never measured on Release.

**Test:** PDP-01 to PDP-03 on Release first. Only treat it as a defect if it persists there.

### 🟡 Watch — Editorial collection mappings

The catalog has no "coffee run" concept, so each new Collection page maps to a curated set of real
category slugs (see `src/content/collections.ts`). The products are real; whether they match the
editorial intent is a judgement call.

**Test:** REG-01 — check the products actually suit each tile's promise, and adjust the slugs if not.

### 🟡 Watch — Backend cold starts

The API is hosted on a free tier that sleeps. A first request after idle can take ~50s, which reads
in the app as an empty or hanging screen.

**Test:** warm the API before timing anything, and do not log an empty feed as a defect without
checking this first.

---

Log each failure with: build type (Debug / Release), platform, device, the case ID, and what you saw
versus what this plan expects. A case that fails on one build type and passes on the other is the
most useful bug report you can file.
