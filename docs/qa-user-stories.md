# ClosetX Customer App — End-to-End User Stories

Test charter for the consumer application. Every story is written from the shopper's point of
view, with steps to reproduce and the observable result that counts as a pass.

## Grading

- **Core** — the flow must work. A failure here blocks release.
- **Edge** — an unusual but reachable path. A failure here is a bug worth filing.
- **Gap** — the behaviour is already known to be wrong or missing, confirmed against the
  source while writing this document. These are included so a tester recognises them instead
  of re-diagnosing them, and so they can be re-graded the day they start passing.

Every Gap entry names what the code does today and where. Treat a Gap that suddenly passes as
a change worth verifying, not as a fluke.

## How to run these

### Environment

1. Backend on `http://localhost:3099`, migrated and seeded: `npm run db:migrate && npm run db:seed`
   in `backend/`. The seed creates one store, the category tree, roughly 450 listings,
   promotions, and collections.
2. `API_BASE` in `customer-app/src/config/env.ts` (override with `EXPO_PUBLIC_API_BASE`). For
   local testing this must be the host machine's LAN IP — a physical Android device cannot
   reach the host's loopback address.
3. Install a debug build: `npx expo run:android` from `customer-app/`.

### Accounts and codes

- Sign-in is phone plus a 4-digit OTP delivered by MSG91. There is **no test-OTP bypass in the
  consumer app** — every code is a real one, so use a number you can receive on.
- Sign-in requires a custom dev build. The OTP module is a native module, so **Expo Go cannot
  sign in at all**.
- `NEWVIBE` is a seeded coupon worth a flat 500 rupees off.
- A fresh install is a guest. Sign out from Profile, or clear app storage, to return to guest.

### Resetting between runs

`npm run db:seed` is idempotent and will not duplicate the catalog. It does not clear orders,
so use a phone number with no history when a story depends on an empty order list.

### What persists

Only four things survive an app restart, all in AsyncStorage: the auth token, the cached user,
the onboarding flag, and the HER/HIM choice. The cart, favourites and last order are in memory
for guests and die with the process. A signed-in shopper's cart is mirrored server-side.

---

## A. First launch, onboarding, gender

### A-1 First launch reaches the shop without an account
**Core.** As a new visitor, I want to browse immediately rather than be forced to register.

1. Install fresh, open the app.
2. Let the splash finish, page through onboarding, finish it.

Expect: the Home tab, signed out, with products visible. There is no login wall at any point —
onboarding shows only when there is no token and the onboarding flag is unset.

### A-2 Onboarding does not reappear
**Core.** Kill and relaunch after A-1. Expect Home directly, no onboarding, no splash loop.

### A-3 HER/HIM changes the whole shop
**Core.** As a shopper, I want one switch to change what I am shown.

1. On Home, switch to HER.
2. Note the Home rails, then open the Category tab.
3. Switch to HIM and repeat.

Expect: Home rails, the category rail, and its sub-tiles all change. The default on a brand-new
install is HIM.

### A-4 Gender survives a restart
**Core.** Set HER, force-stop the app, reopen. Expect HER still selected.

### A-5 Drag-to-switch does not leave a half state
**Edge.** Drag the gender control slowly, release at roughly the midpoint, several times.
Expect it always settles fully on HER or HIM — never a blended header, a stuck animation, or a
rail that disagrees with the header.

### A-6 Gender preference from the profile is applied once, then never again
**Gap.** A consumer record carries `genderPreference`, but only `CompleteProfileScreen` pushes
it into the app's gender, and that screen is unreachable (see H-6). Signing in on a fresh
device therefore keeps the device default, ignoring the account's stored preference.

---

## B. Home

### B-1 Home shows live products
**Core.** With the backend up, open Home. Expect the product rails to be seeded catalogue items
(names such as "Essential T-Shirt", "Silk Slip Dress"), not the bundled mock set.

### B-2 Home falls back cleanly with the backend down
**Core.** Stop the backend, clear the app from memory, reopen.

Expect: Home still renders a full page from bundled mock data, with no error screen, no crash,
and no infinite spinner. Individual sections fall back independently.

### B-3 Home does not refetch on every visit
**Edge.** Open Home, go to Category, return to Home, repeat within five minutes. Expect no
visible reload or flicker — results are cached per gender for five minutes.

### B-4 Re-tapping the active Home tab scrolls to top
**Edge.** Scroll Home well down, tap the Home tab again. Expect a scroll to top, not a reload.

### B-5 Home category tiles are local artwork by design
**Edge.** Turn the backend off and compare the Home category strip with the Category tab. Home's
tiles are always bundled images and never fetch, so they look identical online and offline.
This is intentional so the HER/HIM crossfade never waits on the network.

### B-6 Home section screens are decorative
**Gap.** Steals, Top Stories, Shop By Occasion, Flash Fit, For Her and For Him are entirely
hardcoded — those files import no services at all. Their tiles route into the category browser.
Verify the navigation works; do not expect the merchandising to reflect the catalogue.

### B-7 The spin-to-win popup appears once per launch
**Edge.** Cold start and wait a second on Home. Expect the popup once. Dismiss it, navigate
around, return to Home — it must not reappear until the next cold start. Its call to action
opens Steals.

---

## C. Category browse

This section covers the two-level taxonomy. It is the most recently changed area.

### C-1 The HER rail matches the design
**Core.** As a shopper, I want the category list I was designed to see.

Switch to HER, open the Category tab. Expect exactly these fourteen entries in this order:

Tops, Dresses, Co-ords, Bottoms, Denim, Loungewear, Activewear, Swimwear, Outerwear, Shoes,
Bags, Accessories, Jewelry, Beauty.

### C-2 The HIM rail matches the design, with its own wording
**Core.** Switch to HIM. Expect exactly these thirteen entries in this order:

Tops, Bottoms, Denim, Ethnic Wear, Formalwear, Outerwear, Activewear, Innerwear, Beachwear,
Footwear, Accessories, Bags, Grooming.

Watch specifically for the four renamed nodes: HIM must say Footwear, Innerwear, Beachwear and
Grooming where HER says Shoes, Loungewear, Swimwear and Beauty. Watch also for the two ordering
swaps: HIM puts Outerwear before Activewear and Accessories before Bags; HER is the reverse.

### C-3 Sub-tiles differ per gender under a shared parent
**Core.** Open Tops on HER and note the tiles, then switch to HIM and open Tops.

Expect HER: T-Shirts, Blouses, Shirts, Tank Tops, Camis, Crop Tops, Bodysuits, Sweatshirts,
Hoodies, Sweaters, Cardigans.
Expect HIM: T-Shirts, Shirts, Polos, Hoodies, Sweatshirts, Sweaters, Vests.

Blouses must never appear on HIM; Polos must never appear on HER; T-Shirts must appear on both.

### C-4 A sub-tile opens a populated, correctly filtered grid
**Core.** Tap Tops, then the T-Shirts tile. Expect a grid of t-shirts only. Before the
retaxonomy this searched product names and returned almost nothing, so pay attention to whether
the results genuinely belong to the sub-category.

### C-5 Shop All returns the union of a parent's sub-categories
**Core.** Tap the Tops banner ("Shop All"). Expect noticeably more products than any single
sub-tile, and the t-shirts from C-4 among them.

### C-6 No tile is a dead end
**Core.** Walk every parent on both genders and open several tiles in each. Expect no tile to
open an empty grid — categories with no stock are filtered out of the rail before render.

### C-7 The rail highlights the section you are looking at
**Edge.** Scroll the right pane slowly. Expect the left rail highlight to track the section at
the top, and the rail itself to scroll so the highlight stays visible.

### C-8 Tapping the rail jumps the pane
**Edge.** Tap a rail entry near the bottom. Expect the pane to animate to that section and the
highlight to stay on the tapped entry, not snap back mid-animation.

### C-9 Browse works offline from the bundled taxonomy
**Core.** Enable airplane mode, cold start, open the Category tab.

Expect: the rail and tiles still render from the bundled fallback taxonomy, matching the same
category names as C-1 and C-2. No crash, no blank pane.

### C-10 Coming back online upgrades the tree
**Edge.** From C-9, restore the network and switch gender back and forth. Expect the rail to
repopulate from the backend, with product counts now driving which tiles appear.

### C-11 Sub-tile artwork is present
**Edge.** Check every tile has an image rather than a grey box. Category art is seeded, with a
deterministic mock image as the fallback.

### C-12 HIM banners are missing for four categories
**Gap.** Banner artwork exists for nine HIM categories only. Footwear, Accessories, Bags and
Grooming have no HIM banner and fall back to a product photograph. This is an asset gap, not a
code defect.

### C-13 An empty catalogue empties the browse page
**Edge.** Against a backend with no active listings, open the Category tab. Because zero-count
categories are dropped, the page renders empty rather than showing an unusable rail. Confirm it
does not crash.

---

## D. Category listing page

### D-1 Sorting is applied by the server across the whole category
**Core.** As a shopper, I want price sorting to consider every product, not just the ones
already loaded.

1. Open a category with many products, such as Tops.
2. Sort by price low to high, note the first items.
3. Sort by price high to low.

Expect the two lists to be genuine opposites drawn from the whole category. The screen re-queries
on each sort change rather than reordering the current page.

### D-2 Sort by rating
**Edge.** Choose Rating. Expect the highest-rated products first, and the top three to carry
rank badges.

### D-3 Newest is the default
**Edge.** Enter a category fresh. Expect newest-first ordering with no sort explicitly chosen.

### D-4 Paging does not repeat products
**Core.** Scroll a large category to the end of the first page and into the next.
Expect no product to appear twice. This regressed previously because listings sharing a
timestamp had no tiebreaker.

### D-5 Filter chips do nothing
**Gap.** The filter row (ALL, NEW IN, TOPS, and so on) only changes its own label. It is not
wired to the query and does not affect the grid.

### D-6 The MEN/WOMEN sheet on this screen does nothing
**Gap.** The shop-for selector on the listing page is display-only. The grid follows the global
HER/HIM setting, not this control.

### D-7 A category with a single product renders correctly
**Edge.** Find or create a one-product sub-category. Expect a tidy single-item grid, no layout
collapse, no phantom rows.

---

## E. Search

### E-1 Search finds products by name
**Core.** Open search, type a product word such as "denim". Expect matching products within a
moment. Input is debounced by 300 milliseconds.

### E-2 Search respects the gender switch
**Edge.** Search the same term on HER and on HIM. Expect different result sets, because gender
is passed with the query.

### E-3 No results is handled
**Edge.** Search a nonsense string such as "zzzzqqq". Expect a clean empty state, not a spinner
that never resolves and not the full catalogue.

### E-4 Very long and very short queries
**Edge.** Type a single character, then paste more than 120 characters. The backend accepts 1 to
120 characters; confirm the app does not surface a raw validation error to the shopper in either
case.

### E-5 Rapid typing does not produce out-of-order results
**Edge.** Type a word quickly then immediately delete back to two characters. Expect the results
to match the final query, not a stale longer one.

### E-6 Recent and trending chips are decorative
**Gap.** The recent-search and trending rows are hardcoded strings. Tapping them performs a
search, but the lists never reflect actual history.

### E-7 Image search is simulated
**Gap.** The camera and gallery pickers are real, but the scan is a fixed 1.8-second delay and
the results are always the first eight mock products. No image-search endpoint exists.

---

## F. Product detail

### F-1 A real product opens with live detail
**Core.** From any grid, tap a product. Expect gallery, description, price, colour options,
sizes, rating and reviews drawn from the backend.

### F-2 Colour and size selection
**Core.** Select each colour in turn. Expect the lead image and available sizes to update, and
the selected colour name to be shown.

### F-3 Out-of-stock sizes are distinguishable
**Edge.** Find a product with a sold-out size. Expect it to be visually distinct and not
silently addable.

### F-4 A single-colour product is not broken
**Edge.** Open a product with one colourway. Expect one named swatch, selected, with no empty
"Default" group leaking into the UI.

### F-5 Reviews load and fall back
**Edge.** Open a product with reviews, then repeat with the backend stopped. Expect real reviews
in the first case and a bundled sample in the second, with author first names only.

### F-6 Add to bag from the product page
**Core.** Choose a size and add to bag. Expect a confirmation and the cart badge to increment.

### F-7 Buy Now adds to the bag even if sign-in is abandoned
**Edge.** As a guest, tap Buy Now, then dismiss the sign-in sheet without completing it.

Expect the item to be in the bag anyway — it is added before the auth gate. Confirm this does
not produce a duplicate when Buy Now is then completed.

### F-8 Writing a review is not possible
**Gap.** There is no review-composer UI. The service call exists and is imported but never
invoked.

---

## G. Bag

### G-1 Add, view, and total
**Core.** Add two or three different products. Open the bag. Expect each as its own line with
the right size and colour, and a total consistent with the line prices.

### G-2 Quantity changes update the total
**Core.** Increase and decrease quantity. Expect the total to track it.

### G-3 Quantity cannot go below one from the stepper
**Edge.** Press minus repeatedly on a quantity-one line. Expect it to stop at one. Removing the
line requires the explicit remove control.

### G-4 Removing one size removes every size of that product
**Gap.** Add the same product in two sizes, then remove one line. Both disappear. Remove and
quantity updates key on the product id rather than the cart line, so they hit every line sharing
the product.

### G-5 Changing quantity on one size changes it for all sizes
**Gap.** Same root cause as G-4. Add one product in two sizes, set one to quantity three, and
observe the other change too.

### G-6 The same item under two delivery methods becomes two lines
**Edge.** Add a product for express, then add the identical product and size for standard.
The bag shows two lines. For a signed-in shopper these merge server-side into one line with the
summed quantity, so the server cart and the visible bag disagree.

### G-7 The bag is grouped by delivery method
**Core.** With express and standard items in the bag, expect separate checkout slabs per
method, each with its own total and its own checkout button.

### G-8 An empty bag is handled
**Core.** Remove everything. Expect an empty state with a suggestion rail, not a blank screen or
a zero-rupee checkout button.

### G-9 Bag prices come from the server
**Core.** With every line a real catalogue product, expect the totals to match a backend quote
rather than naive local arithmetic.

### G-10 The bag total is quoted for the wrong method and payment
**Gap.** The whole-cart price call always asks the backend for standard delivery and UPI. Any
bag containing express, pickup or try-and-buy items, or intended for cash on delivery, will show
a total that differs from the final order.

### G-11 A failed price call silently substitutes local arithmetic
**Gap.** Stop the backend with items in the bag and reopen it. The total changes to a locally
computed figure with no error shown. The same happens for any 409 from the pricing endpoint, for
example when the store is closed, which makes G-10 and P-2 hard to notice.

### G-12 The coupon box in the bag is fake
**Gap.** Enter `NEWVIBE` and expect a flat 500 off applied by hardcoded client logic, with no
network call. Any other code is rejected with a "Try NEWVIBE" toast regardless of what
promotions actually exist. Seeded coupons other than NEWVIBE will be rejected.

### G-13 A signed-in shopper's bag survives reinstall
**Core.** Sign in, add items, force-stop, reopen. Expect the bag to be restored from the server.

### G-14 A guest's bag does not survive a restart
**Edge.** As a guest, add items and force-stop the app. The bag is empty on reopen. Guest carts
are in memory only.

### G-15 Signing in with a non-empty guest bag discards the server bag
**Edge.** Sign in on device A and build a bag. On device B, sign out, build a different guest
bag, then sign in as the same shopper.

Expect device B's local bag to win and replace the server bag entirely. There is no merge.

### G-16 Signing in with an empty bag restores the server bag but loses delivery methods
**Edge.** Reverse of G-15: sign in with an empty local bag. The server bag is restored, but every
restored line comes back as express regardless of how it was saved, and brand and original price
are missing from the restored lines.

### G-17 Signing out leaves the previous shopper's bag on the device
**Gap.** Sign in, add items, sign out. The bag is still populated. Sign in as a different
shopper and that bag is pushed to the new account.

### G-18 Server cart limits
**Edge.** As a signed-in shopper, drive one line above 99 and the bag above 100 distinct
variants. The server clamps quantity to 99 and ignores new variants past 100. Confirm the app
does not present a quantity it cannot actually order.

---

## H. Authentication

### H-1 Sign in with a phone number
**Core.** Trigger sign-in from Profile or by checking out. Enter a valid number, receive the
code, enter it. Expect the sheet to close, a welcome toast, and the profile to show as signed in.

### H-2 The pending action resumes after sign-in
**Core.** As a guest, tap checkout in the bag. Sign in through the sheet that appears. Expect to
land on the review-order screen automatically, without tapping checkout again.

### H-3 The OTP auto-submits and autofills
**Edge.** Expect the code to submit on the fourth digit without a separate button, and the SMS
autofill suggestion to populate it on a device that supports it.

### H-4 Wrong code
**Edge.** Enter an incorrect code. Expect an inline "Invalid or expired OTP" message and the
chance to retry, with the sheet still open.

### H-5 Resend is rate-limited client-side
**Edge.** Request a resend. Expect a 30-second cooldown before the option is offered again.
Note there is no server-side rate limit, retry counter or expiry on OTP endpoints.

### H-6 A new shopper is never asked for name and email, and then cannot order
**Gap — highest impact.** Sign in with a phone number that has never been used.

The account is created with a null name and email. The app drops straight into the shop showing
the placeholder name "You". The screen that collects name and email exists but nothing navigates
to it. Order placement rejects any consumer without a name and email, so the first order fails
with a generic "Order failed" toast and no indication of the cause. Reproduce by signing in with
a fresh number and immediately trying to buy.

### H-7 Invalid number format is rejected before sending
**Edge.** Enter fewer than six digits, or letters. Expect the send action to refuse.

### H-8 Misconfigured OTP is reported honestly
**Edge.** Point the app at a backend with no MSG91 credentials and sign in. Expect the sheet to
close with "Login unavailable — browse as guest for now" rather than an endless retry loop.

### H-9 Sign-in is impossible in Expo Go
**Edge.** The OTP module is native. In Expo Go the send step throws. Use a dev build.

### H-10 Suspended and closed accounts
**Edge.** Suspend a consumer in admin, then use the app. Expect "This account is suspended.
Contact support." Closed accounts get their own message. Both are rejected on every request, not
just at login.

### H-11 Sign out clears identity
**Core.** Sign out. Expect the profile to return to the guest state and order history to stop
showing real orders. Note the bag is not cleared — see G-17.

### H-12 Profile edits never reach the server
**Gap.** Change your name in Edit Profile and save. It updates locally only; the screen never
calls the profile endpoint. Force-stop and reopen and the change is still shown from the cached
user, which makes it look persisted. Verify against the backend to see it was not.

---

## I. Addresses

### I-1 Add an address
**Core.** From the address book, add a complete address. Expect it to save and appear in the
list.

### I-2 Pincode and state validation
**Edge.** Try a five-digit pincode, a seven-digit pincode, and a three-letter state code.
Expect each to be refused. Pincode must be exactly six digits and state exactly two characters.

### I-3 No serviceability or consistency check
**Edge.** Save a valid-format pincode that does not match the state, or one in a region with no
store. It is accepted. There is no serviceability check anywhere in the flow, so an
unserviceable address only reveals itself later, if at all.

### I-4 Set a default and delete
**Core.** Set a different address as default, then delete a non-default one. Expect both to take
effect immediately in the list and at checkout.

### I-5 Deleting the address selected for an order
**Edge.** Select an address during checkout, go to the address book in another tab, delete it,
and return. Expect the checkout screen not to proceed with a dangling address.

### I-6 Addresses cannot be edited
**Gap.** There is no edit UI. The update call exists but no screen imports it. Correcting an
address means deleting and re-adding.

### I-7 Address book requires sign-in
**Edge.** As a guest, reach the address book. Expect the sign-in sheet rather than an empty list
or an error.

---

## J. Review order and placement

### J-1 Place a delivery order end to end
**Core.** As a shopper with a complete profile, I want to buy something.

1. Sign in with an account that has a name and email set (see H-6).
2. Add items, open the bag, check out.
3. Choose an address and express delivery.
4. Place the order.

Expect a success screen and the bag to clear.

### J-2 The order appears in history
**Core.** After J-1, open order history. Expect the new order with a plausible status.

### J-3 Placing without a saved address
**Edge.** Check out with no address on file. Expect to be sent to add one rather than allowed to
place an unaddressed order.

### J-4 Try and Buy cannot be cash on delivery
**Core.** Enable Try and Buy, then select cash on delivery. Expect it to be blocked with "Try
and Buy can't be Cash on Delivery". The backend rejects the combination as well.

### J-5 Double-tapping Place Order can create two orders
**Edge.** On a slow connection, tap Place Order twice quickly. A fresh idempotency key is minted
on each tap, so the second tap is not deduplicated by the server. The in-flight flag only guards
within a single render.

### J-6 A multi-store bag places orders one at a time with no rollback
**Gap.** Build a bag spanning two stores and place it. The app loops and calls the single-store
endpoint per store. If the second call fails, the first order stays placed. An all-or-nothing
group endpoint exists on the backend and in the service layer but nothing calls it.

### J-7 Pickup orders always fail
**Gap.** Choose pickup and place the order. The backend requires a pickup slot with a start and
end time; the app never sends one, so placement is rejected. The shopper sees only "Order
failed".

### J-8 Coupons applied on the review screen are never sent
**Gap.** Apply the review screen's coupon toggle, note the reduced total, and place the order.
The code is not transmitted, so the order costs more than the total you just reviewed. The same
applies to the reward-points toggle and the wallet row, all of which are hardcoded display
values.

### J-9 Rejected coupon reasons are never shown
**Gap.** The backend returns a structured reason for every rejected code — expired, minimum cart
not met, first order only, wrong tier, already redeemed, and more. None of it is rendered
anywhere in the app.

### J-10 Insufficient stock is only discovered at placement
**Edge.** Reduce a variant's stock below your cart quantity in admin, then place the order.
Expect a failure at placement. The quote returns per-variant availability but the app never
reads it, so nothing warns the shopper earlier.

### J-11 A price change between review and placement is rejected
**Edge.** Change a variant's price in admin between opening the review screen and placing.
Expect the order to be refused rather than placed at the stale price.

### J-12 A promotion that expires between review and placement is rejected
**Edge.** Same shape as J-11 with a promotion window.

### J-13 Cash on delivery leaves the order unpaid but confirmed
**Core.** Place a cash-on-delivery order. Expect it to confirm and route. Payment stays pending
until cash is taken; the client cannot mark it paid.

### J-14 Payment success is self-declared when the gateway is off
**Gap — security.** With Razorpay unconfigured, the payment outcome defaults to success and is
supplied by the client. Any order can be placed as paid without money moving. The Razorpay flow
exists in the service layer but is not wired to any screen, so this is the only path today.

### J-15 An order for a closed store fails only at the end
**Edge.** See P-2. The bag and review screens show prices for a store that cannot accept the
order; the failure surfaces as a generic toast at the final step.

---

## K. After the order

### K-1 The success screen reflects the order
**Core.** After placing, expect the success screen to show the order and a route onward.

### K-2 Order history is real
**Core.** Signed in, open order history. Expect orders from the backend. Signed out, expect a
mock list — confirm you are not misreading mock data as real.

### K-3 Order tracking is fake
**Gap.** Open tracking. The timeline advances on a four-second timer regardless of the real
order status, and tapping a history row does not pass an order id. The single-order endpoint
exists in the service layer but nothing calls it.

### K-4 The delivery OTP is never shown
**Gap.** The backend issues a six-digit delivery OTP at placement and the driver app enforces it
at the door. The consumer app receives it in the order payload but never displays it, so a
shopper cannot complete a handover that requires it.

### K-5 The pickup code shown is not the real one
**Gap.** The pickup code and QR on the order screen are generated on the device from the store
name. The server's actual pickup code is different, so anything scanned or read out will not
match.

### K-6 Cancelling an order is not possible from the app
**Gap.** The backend permits consumer cancellation while an order is pending, payment-failed,
confirmed, routing or accepted, and the service call exists, but no screen calls it.

### K-7 An unpaid order is cancelled automatically
**Edge.** Place a non-cash order, leave the payment pending, and wait past the abandonment
window (30 minutes by default). Expect the order to be cancelled by the sweep and a notification
to say so.

---

## L. Returns, support, and rewards

### L-1 Returns do not reach the backend
**Gap.** Open a return from order history, choose items, submit. A "Return initiated" toast
appears and nothing is created. The screen works from a hardcoded order list and never calls the
returns service.

### L-2 The return window is enforced only in mock data
**Gap.** The screen checks a local day counter. The real seven-day window, the delivered-status
requirement and the final-sale exclusion are all backend rules this screen never exercises.

### L-3 Customer support creates nothing
**Gap.** Support topics, contacts and FAQs are hardcoded. The issue-tracking service is complete
and entirely unused.

### L-4 Wallet has no screen
**Gap.** There is no wallet screen and no wallet state in the app. The balance shown at checkout
is a fixed number. The wallet service is unused.

### L-5 Loyalty points are a fixed number
**Gap.** The rewards screen shows 1,240 points for every account. The loyalty service is unused.

### L-6 Referral code is hardcoded
**Gap.** The referral screen always shows the same code and the same statistics, ignoring the
account's real referral code.

### L-7 Gift cards cannot be bought or redeemed
**Gap.** The gift card screen offers a purchase the backend does not implement, and the redeem
call it does implement is never made. The screen is unreachable in any case.

### L-8 The coupon wallet is partly real
**Edge.** Open the coupon wallet. It merges live active promotions over a mock list, so it is
the one rewards surface with real data. Confirm seeded promotions appear.

---

## M. Reels

### M-1 Reels play
**Core.** Open the Reels tab. Expect video playback, vertical paging, and no audio bleeding
after leaving the tab.

### M-2 Re-tapping the Reels tab reloads the feed
**Edge.** With Reels open, tap the tab again. Expect a reload.

### M-3 Reels are entirely mock
**Gap.** The feed is built from bundled data and ten fixed sample video URLs. Likes, comments,
saves and shares are local state and vanish on reload. The complete reels service is unused, and
the backend feed, likes and comments are unreachable from the app.

### M-4 Liking a reel adds to favourites
**Edge.** Like a reel and check favourites. The like is routed into the favourites list rather
than to the reels backend.

---

## N. Profile and settings

### N-1 Guest profile offers sign-in
**Core.** As a guest, open Profile. Expect a clear sign-in action and no personal data.

### N-2 Settings screens do not crash
**Edge.** Open every reachable settings screen: notification settings, style preferences,
measurements, payment methods, about. Expect each to render and go back cleanly. All are local
state only.

### N-3 Many profile links say "Coming soon"
**Edge.** Rows without a destination toast "Coming soon". Confirm none of them navigate nowhere
silently or crash.

### N-4 Nineteen routes cannot be opened at all
**Gap.** Of 53 registered stack routes, 19 have no navigation path in the app: Complete Profile,
Notifications, Gift Card, Language, Fashion Calendar, Sustainability, Store Pickup, Try And Buy,
Community Feed, Mood Board, New Arrivals, Discover Brands, Occasion Shopping, and the six game
screens (Daily Reward, Spin Wheel, Style Quiz, Lucky Draw, Invite Friends, App Challenges). The
games are unreachable because the Home section that links to them is defined but never rendered.
Do not write test cases against these until an entry point exists.

### N-5 Virtual try-on calls a third party
**Edge.** Open try-on from a product. It uploads to a Hugging Face space, not the ClosetX
backend, and requires a token in the environment or it throws. Treat failures here as
configuration, not product defects.

---

## O. Cross-cutting behaviour

### O-1 Airplane mode anywhere
**Core.** With the network off, visit Home, Category, a listing grid, search, a product, and the
bag. Expect fallbacks or empty states throughout, and no crash.

### O-2 Server unreachable is reported in plain language
**Edge.** Point the app at a dead host. Expect "Can't reach the server. Check your connection."
rather than a stack trace or a silent nothing.

### O-3 Slow server
**Edge.** Throttle the backend beyond 30 seconds. Expect "The server took too long to respond."
and a usable screen afterwards.

### O-4 Backend returns non-JSON
**Edge.** Put a proxy returning HTML in front of the API. Expect a handled error, not a parse
crash.

### O-5 Backgrounding mid-flow
**Edge.** Background the app on the review screen for several minutes, then return. Expect the
screen to still function, and prices to be re-quoted rather than silently stale.

### O-6 Rotation and small screens
**Edge.** Exercise the category browser, product page and bag on a small device. Expect the
two-pane browser to remain usable and text not to clip.

### O-7 Rapid navigation
**Edge.** Tap quickly between tabs and in and out of products for a minute. Expect no duplicate
screens, no stuck transparent modal, and no frozen zoom transition. Product detail, category
zoom and search are all transparent modals with custom animations and are the likely failure
points.

### O-8 Back behaviour from modal screens
**Edge.** Use the hardware back button from product detail, category zoom and search. Expect a
clean dismissal each time.

### O-9 The bag icon always returns to the bag tab
**Edge.** From deep in a stack, tap the bag. Expect the stack to reset and the cart tab to open,
with no leftover screens behind it.

---

## P. Store availability and stock

### P-1 A hidden store's products disappear from browse
**Edge.** Set the store to suspended, terminated, or paused with hidden visibility. Expect its
products to vanish from browse, search, product detail and collections.

### P-2 A paused-but-visible store is browsable but cannot be ordered from
**Edge.** Set the store to paused with visible visibility. Its products remain browsable and
addable to the bag, but any quote is refused. Because a refused quote falls back silently to
local arithmetic (G-11), the shopper sees plausible prices and only fails at placement.

### P-3 Turning off order acceptance blocks checkout
**Edge.** Use the retailer app to stop accepting orders. Expect placement to fail. The intended
message is "This store is not accepting orders right now" but the shopper sees a generic toast.

### P-4 Automatic reopening
**Edge.** Turn acceptance off and confirm the store reopens automatically at its next opening
window, without manual intervention.

### P-5 A product that sells out while in the bag
**Edge.** Add the last unit, then let another order consume it. Expect the bag to still show it,
the quote to still price it, and only the placement to fail. Nothing warns earlier.

---

## Q. Abuse and data exposure

These are worth one pass each because they are reachable from a normal client.

### Q-1 Coupon reuse beyond its per-shopper limit
**Edge.** Configure a promotion with a per-consumer limit of one and use it twice on the same
account. It succeeds. The limit is stored and usage is counted, but nothing enforces it.

### Q-2 Quoting against another shopper's address
**Edge.** Call the quote endpoint with an address id belonging to a different account. It is
accepted and drives the tax calculation. There is no ownership check at quote time.

### Q-3 Abandoned carts are publicly readable
**Edge.** Call the abandoned-carts endpoint with no authentication and an arbitrary consumer id.
It returns cart contents. This endpoint is unauthenticated.

### Q-4 No rate limiting anywhere
**Edge.** Repeat OTP requests, coupon attempts, or order placements in a tight loop. Nothing
throttles them. There is no rate limiter registered on the backend.

### Q-5 Guest and signed-in totals can differ
**Edge.** Price a bag as a guest, then sign in and price it again with an out-of-state default
address. The tax split changes from intra-state to inter-state and the total moves. First-order
promotions also disappear once the account is known.

---

## R. Regression pass for the category retaxonomy

A focused loop to run whenever the taxonomy, seeds or catalogue endpoints change.

### R-1 Both rails still match the design
Repeat C-1 and C-2 exactly. These are the contract with the design and are also asserted by an
automated test in the backend.

### R-2 A unisex product appears on both rails
**Core.** Find a unisex product, such as a canvas sneaker or a fleece hoodie. Open the sneakers
sub-category on HER, then on HIM. Expect the same product in both.

This is the whole reason the tree stores shared categories once instead of duplicating them per
gender, so it is the single most valuable check in this section.

### R-3 Gendered sub-categories stay on their own rail
**Core.** Confirm Blouses never appears on HIM and Polos never on HER, at both the tile level
and in the resulting grids.

### R-4 Parent and leaf both filter correctly
Repeat C-4 and C-5. A parent must return the union of its children; a leaf must return only its
own.

### R-5 Swimwear has no shared sub-category
**Edge.** Compare Swimwear on HER with Beachwear on HIM. They share no sub-tiles by design, so a
unisex swim product will appear on one rail only. This is expected, not a bug.

### R-6 Every sub-category still has stock
Repeat C-6 after any reseed.

### R-7 Retailer-created products land in browse
**Core.** Create a product in the retailer app, choose a sub-category from the picker, publish
it, then find it in the consumer app under that exact sub-category.

The picker offers only leaf categories, labelled "Parent > Leaf". A product filed against a
parent would never appear in a sub-category tile, which is why parents are not offered.

---

## Known gaps, collected

For triage. Each is expanded above.

| Area | Gap | Story |
| --- | --- | --- |
| Auth | New shoppers are never asked for name and email, then cannot order | H-6 |
| Payments | Payment success is client-declared when the gateway is off | J-14 |
| Checkout | Pickup orders can never succeed | J-7 |
| Checkout | Coupons, points and wallet shown at review are never sent | J-8 |
| Checkout | Multi-store orders are placed with no rollback | J-6 |
| Bag | Remove and quantity act on every line sharing a product | G-4, G-5 |
| Bag | Totals are quoted for standard delivery and UPI regardless of choice | G-10 |
| Bag | A failed quote silently becomes local arithmetic | G-11 |
| Bag | The coupon box is hardcoded to one code | G-12 |
| Bag | Signing out leaves the previous shopper's bag on the device | G-17 |
| Orders | Tracking is a timer, not real status | K-3 |
| Orders | The delivery OTP is never shown | K-4 |
| Orders | The pickup code shown is locally invented | K-5 |
| Orders | Cancellation is unreachable | K-6 |
| Returns | The return flow never reaches the backend | L-1, L-2 |
| Rewards | Wallet, loyalty, referrals and gift cards are all display-only | L-4 to L-7 |
| Support | Issue tracking is unreachable | L-3 |
| Reels | The entire feed is mock | M-3 |
| Profile | Profile edits never reach the server | H-12 |
| Addresses | Addresses cannot be edited | I-6 |
| Navigation | 19 of 53 routes have no entry point | N-4 |
| Listing page | Filter chips and the shop-for selector do nothing | D-5, D-6 |
| Search | Image search is simulated | E-7 |
| Security | Per-shopper coupon limits are not enforced | Q-1 |
| Security | Quotes accept another shopper's address id | Q-2 |
| Security | Abandoned carts are readable without authentication | Q-3 |
| Security | No rate limiting on any endpoint | Q-4 |

## Suggested run order

1. **Smoke, 15 minutes.** A-1, A-3, B-1, C-1, C-2, C-4, F-1, F-6, G-1, H-1, J-1, K-2.
2. **Taxonomy regression, 30 minutes.** All of section R, plus C-3 to C-11 and D-1 to D-4.
3. **Full commerce, half a day.** Sections F through K in order, with a complete profile.
4. **Resilience, 1 hour.** Sections O and P.
5. **Gap confirmation, 1 hour.** Walk the table above and confirm each still behaves as
   described, so the list stays accurate.
