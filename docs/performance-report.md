# ClosetX Customer App — Performance Report

Why the app is smooth on flagships and janky on everything else, what is causing it, and the
order in which to fix it. Every claim below is tied to a file and line in this repository or to
a measurement taken from the working tree.

---

## 1. Summary

The app is not slow because of one mistake. It is slow because roughly a dozen independent
decisions each consume a resource that a flagship has in surplus and a mid-range phone does
not. A Snapdragon 8-series device absorbs all of them at once; a mid-range device runs out of
one resource, and once any single resource saturates, every frame after that misses.

Ranked by how much they cost, and how cheap they are to fix:

| Rank | Problem | Evidence | Effort |
| --- | --- | --- | --- |
| 1 | 107 MB of bundled images, many 1.5-2.5 MB, drawn into small boxes | measured on disk | Low |
| 2 | Two videos autoplay on Home forever, including on other tabs | `HomeScreen.tsx:1981-1988`, `:2093-2094` | Very low |
| 3 | Nothing is virtualised except Reels; 98 images mount at once on the Category tab | `CategoryBrowseScreen.tsx:679-730` | Medium |
| 4 | The category scroll handler re-renders 98 tiles on the JS thread while scrolling | `CategoryBrowseScreen.tsx:578-588` | Low |
| 5 | One context with 12 volatile values re-renders 46 consumers on every cart tap | `AppState.tsx:357-376` | Medium |
| 6 | Home recomputes a filter, a sort and an unbounded array on every render | `HomeScreen.tsx:883-905` | Low |
| 7 | A self-sustaining network loop on the review-order screen | `ReviewOrderScreen.tsx:75`, `:112-119` | Very low |
| 8 | Release builds ship 4 CPU architectures unminified because the slimming plugin never reached the native project | `plugins/withReleaseSlimming.js` vs `android/gradle.properties:29` | Very low |
| 9 | ~3.35 seconds of hardcoded startup timers before anything is interactive | `RootNav.tsx:241-244`, `SplashScreen.tsx:122-123` | Low |
| 10 | List endpoints return every variant and the full description for every card | `catalog.controller.ts:204-251` | Low |

Items 1, 2, 7 and 8 are a few hours of work in total and remove the largest share of the pain.

---

## 2. Why flagships hide all of this

Understanding the gap matters, because it explains why the team does not see the problem on
their own devices.

**Memory and garbage collection.** A flagship has 12 GB of RAM and can hold every decoded
bitmap the app throws at it. A 4 GB device cannot, so Android reclaims aggressively. Each
reclaim is a pause, and each pause is a dropped frame. Worse, the app then re-decodes the image
it just discarded, so scrolling back up costs as much as scrolling down did the first time.

**Single-threaded JavaScript.** React Native runs the app's logic on one thread. Any work in a
render body or a scroll handler competes directly with the 16.6 ms frame budget. A flagship CPU
finishes a wasteful `filter` plus `sort` plus 60-element `map` inside the budget. A mid-range
CPU at roughly a third of the single-core speed does not, and the frame is simply skipped.

**GPU fill rate.** Stacked translucent layers cost fill rate, which is the single biggest
difference between tiers. The top of Home composites five to six full-width layers at all times
(`HomeScreen.tsx:590-671`, plus the two viewport fades at `:932` and `:938`). The category
browser draws 84 gradient scrims, one per tile (`CategoryBrowseScreen.tsx:488-491`). A flagship
GPU has fill rate to spare; a budget GPU is the bottleneck.

**Hardware video decoders are a fixed, small resource.** This is the least obvious one. Budget
SoCs typically expose one or two concurrent hardware decoder instances. Home holds two players
open permanently and Reels opens up to three (`ReelsScreen.tsx:216`), so the app can ask for
five at once. Past the hardware limit Android silently falls back to software decoding, which
burns CPU on the same cores the JS thread needs. This is why the app can feel fine for thirty
seconds and then degrade.

**Storage speed.** Reading 40 MB of banner PNGs off UFS 4.0 is not the same as reading it off
eMMC. Cold-start and first-scroll asset reads are several times slower on the cheaper part.

The pattern to take from this: the app currently assumes surplus in memory, CPU, fill rate,
decoder instances and IO simultaneously. Removing the assumption in any one of them helps; the
plan in section 9 removes several.

---

## 3. Assets: the single largest cost

Measured from `customer-app/assets`:

- **107.2 MB total**, 296 files.
- **39 images exceed 1 MB**, totalling **71.9 MB**.
- `category-banners` alone is **39.6 MB across 23 files**.
- Every category banner is **1916 x 821 pixels**.

Those banners are drawn into a container **104 pixels tall**
(`CategoryBrowseScreen.tsx:686`). At a 3x screen density a correctly sized asset is roughly
770 x 310. The shipped file has about **16 times more pixels than any device will ever show**.

The multiplier that turns this from waste into jank is that they all mount at once. The right
pane is a plain `ScrollView` with `.map()` (`CategoryBrowseScreen.tsx:679-730`), so opening the
Category tab on HER mounts **14 banners plus 84 sub-tiles: 98 images simultaneously**.

`CachedImage` is already well configured — `cachePolicy="memory-disk"`, `recyclingKey`,
`allowDownscaling`, and `transition={0}` on Android (`Brutal.tsx:16-35`) — so the library
downsamples rather than holding full-size bitmaps. The remaining costs are still real: reading
40 MB from storage, running 14 near-simultaneous decodes, and shipping the bytes in the APK.

Two further asset problems:

**Bundled video.** `assets/reels` is **20.8 MB of MP4**, including a single 9.1 MB file. These
are `require()`d at module scope in `HomeScreen.tsx:1923-1932` and fed to always-playing preview
tiles.

**Prefetch of unsized mock images.** `services/prefetch.ts:32-50` schedules roughly **85 remote
image fetches four seconds after Home focuses** — precisely when the user is scrolling. None go
through `sizedImage()`, because they are `pngimg.com` mock URLs that the resizer deliberately
leaves untouched (`services/images.ts:13`). The header of that same file estimates a catalogue
page at 35-40 MB of downloads.

### What to do

1. Resize every bundled image to its maximum on-screen size at 3x, and convert to WebP. Banners
   become roughly 770 x 310. Expect `category-banners` to fall from 39.6 MB to under 2 MB and
   the whole `assets` folder to land near 10-15 MB.
2. Delete or stream `assets/reels`. Those six files are 20 MB of APK for two muted preview
   tiles.
3. Drop prefetch wave two entirely, or reduce it to the handful of images actually above the
   fold. Prefetching 85 unsized images while the user scrolls is worse than not prefetching.
4. Add `placeholder` to `CachedImage` so large heroes fade from a colour rather than popping.

---

## 4. Rendering: nothing is virtualised

`@shopify/flash-list` is not a dependency, and only `ReelsScreen` configures windowing. Every
other list in the app is a `ScrollView` with `.map()`.

| Screen | Mounted at once | Evidence |
| --- | --- | --- |
| Category browse | 98 images (14 banners + 84 tiles) | `CategoryBrowseScreen.tsx:679-730` |
| Home | ~40 image views + 2 video players, growing without bound | `HomeScreen.tsx:569-587` |
| Category listing | up to 60 cards, each wrapped in a Moti animation | `CategoryScreen.tsx:184`, `:211` |
| Product detail | 16 "More to Love" cards | `ProductDetailScreen.tsx:562-565` |
| Search | 30 results, each a staggered Moti animation | `SearchScreen.tsx:154-158` |

Home explicitly disables clipping (`HomeScreen.tsx:585`, `removeClippedSubviews={false}`), and
its Explore grid grows forever: `maybeLoadMoreExplore` (`:435-440`) is wired to **both**
`onScrollEndDrag` and `onMomentumScrollEnd` (`:581-582`), so a single flick can add two pages.
The source array holds only 24 items and is repeated modulo, so page 20 means 120 mounted cards
showing the same 24 images. Nothing is ever unmounted.

`removeClippedSubviews` on the Category tab detaches native views but leaves all 98 React
components mounted and re-rendering, so it helps the GPU and does nothing for the JS thread.

### What to do

Convert the three worst screens to `FlashList` (or `FlatList` with `windowSize`,
`maxToRenderPerBatch`, `initialNumToRender` and `getItemLayout`): Category browse, Category
listing, and Home's Explore grid. Cap Explore at a sane page count and fire the load handler
from one event, not two. Add `getItemLayout` to the Reels list, which is otherwise well tuned
(`ReelsScreen.tsx:110-143`) and knows every row is exactly `height` tall.

---

## 5. Logical errors

These are defects rather than tuning opportunities. Several are one-line fixes.

### 5.1 A self-sustaining network loop on the review-order screen

`ReviewOrderScreen.tsx:75` computes `items` with `.filter()` directly in the render body, so it
is a **new array identity on every render**. `:112-119` then uses `items` as an effect
dependency. The effect calls `priceCart`, whose result calls `setPricing`, which re-renders,
which produces a new `items`, which re-fires the effect.

The result is a continuous `POST /pricing/cart` loop for as long as the checkout screen is open.
This is the primary checkout path — `CartScreen.tsx:114` always navigates with `preMethod` set.
Fix by wrapping `items` in `useMemo` keyed on `cart` and `preMethod`.

### 5.2 Two videos play forever, on every tab

`LocalReelPreview` (`HomeScreen.tsx:1981-1988`) calls `useVideoPlayer` with `p.play()` and no
pause condition. Two are mounted at `:2093-2094`, outside the deferred-tail gate. There is no
`useFocusEffect`, no viewport check, and `HomeTab` has no `freezeOnBlur` — only `ReelsTab` does
(`RootNav.tsx:201`). Both decoders therefore run from the moment Home mounts, while scrolled
off-screen, and while the user is in Reels, Category or the Bag.

Fix by pausing on blur and when off-screen. This is likely the single largest battery and
thermal cost in the app, and thermal throttling on a mid-range device degrades everything else.

### 5.3 Two infinite animations that never stop

The Home marquee (`HomeScreen.tsx:1425-1429`) uses `withRepeat(..., -1)` with no stop condition,
and the Bag ticker (`CartScreen.tsx:34-42`) uses `Animated.loop` stopped only on unmount — and
tabs stay mounted after first visit. Both keep running on other tabs.

### 5.4 A component defined inside a render function

`HomeScreen.tsx:2138-2154` declares `Tile` inside `FlashFitBundle`. A new function identity each
render means React sees a different component type and **unmounts and remounts all three tiles
and their images** instead of updating them. `FlashFitBundle` re-renders on every Home render
because its only prop is an inline arrow (`:801`).

### 5.5 A one-second timer that re-renders 24 product cards

`HomeSectionScreens.tsx:455` calls `useFlashCountdown()` at screen scope, so every tick
re-renders `FlashFitScreen`, which re-runs a `filter` and rebuilds inline props for ~24 cards
once per second. Home solved this correctly by isolating the timer in its own component
(`HomeScreen.tsx:983-1010`, with a comment saying exactly that); this screen did not get the
same treatment.

### 5.6 A memo that cannot ever hit

`CategoryBrowseScreen.tsx:588` lists `activeId` in the dependency array of the scroll-spy
handler, and the handler's only job is to set `activeId`. The callback identity therefore
changes every time it fires, replacing the `ScrollView`'s `onScroll` prop as well.

### 5.7 A subscription that returns a constant

`Brutal.tsx:155-171` — `useGenderCurve` subscribes to the theme store with
`useSyncExternalStore` and then returns the literal `{ borderRadius: 0 }`. Every
`BrutalButton`, `BrutalIconBtn` and `BrutalBox` in the tree re-renders on every gender flip to
receive a value that never changes.

### 5.8 A font that does not exist on Android

`theme/brutal.ts:147` sets `const HELV = 'Helvetica Neue'`, used by **41 style entries**
including `body`, `caption`, `price` and `button`. Helvetica Neue is not on Android and is not
loaded, so most text silently falls back to the system font — while the app still pays to load
four RobotoMono weights at startup, three of which have zero call sites (`App.tsx:51-61`).

### 5.9 Dead work in render bodies

`CategoryScreen.tsx:111-114` runs one `reduce` and two `filter` passes over up to 60 items on
every render, and **none of the four results is ever rendered**. `HomeScreen` declares 32
`useAnimatedStyle` hooks, several of which return constants or empty objects (`:311`, `:312`,
`:374`) or are never consumed (`:382`, `:399`), plus seven components with zero render sites.

### 5.10 The release slimming plugin never reached the native project

`plugins/withReleaseSlimming.js:15-32` sets `reactNativeArchitectures=arm64-v8a`,
`android.enableMinifyInReleaseBuilds=true` and
`android.enableShrinkResourcesInReleaseBuilds=true`. But `android/` is checked out and
gitignored, and its `gradle.properties:29` still reads
`armeabi-v7a,arm64-v8a,x86,x86_64` with both minify flags absent.

A local `./gradlew assembleRelease` therefore produces a **four-architecture, unminified,
unshrunk APK**. Only an EAS build, which re-runs prebuild, picks the plugin up. Separately,
`android/app/build.gradle:114` still signs release with the **debug keystore**, which is a
release-blocking issue independent of performance.

---

## 6. State and re-render blast radius

`AppState.tsx:357-376` exposes **34 values from a single context**, memoised on 33 dependencies
of which **12 are volatile**: `user`, `token`, `authHydrated`, `onboarded`, `cart`, `cartTotal`,
`cartCount`, `favorites`, `isFavorite`, `lastOrder`, `placeOrder`, `gender`.

There are **46 `useApp()` call sites**. One tap on "add to bag" invalidates four dependencies at
once (`cart`, `cartTotal`, `cartCount`, and `placeOrder`, which is itself a `useCallback` keyed
on `cart` at `:349`), producing a new context object and re-rendering every consumer in the
tree — including the tab bar, Home, Reels and the category browser.

Toast and confirm were already moved out to an external store and correctly do not re-render
consumers (`state/uiBus.ts`, read via `useSyncExternalStore` in `Brutal.tsx:48`, `:105`). That is
the pattern to extend.

`React.memo` is applied to `ProductCard` (`Brutal.tsx:384`) and `StyleTile`
(`CategoryBrowseScreen.tsx:468`), but **almost every call site defeats it** by passing a fresh
inline object or closure: `style={{...}}` at `HomeScreen.tsx:904`, `zoomParams={{ brand: label }}`
plus `frameStyle` plus children at `CategoryScreen.tsx:215-228`, `onPress={() => openListing(sub)}`
inside the tile map at `CategoryBrowseScreen.tsx:718-725`. Only two call sites in the entire app
can actually skip a re-render.

`FeatureScreens.tsx` contains **zero** `useMemo`, `useCallback` or `React.memo` across 1,575
lines and ten screens. `CartScreen.tsx` has none across 406 lines.

Finally, `theme/brutal.ts:79-92` makes `C` a **`Proxy`** and `T` a second one, and `BORDER()`
returns an object with **getters**. Every `C.ink` in a style literal is a trap dispatch, and
Hermes cannot inline these. With hundreds of style literals per screen this is a small cost
repeated an enormous number of times.

### What to do

1. Split the context. At minimum three: identity (`user`, `token`), cart, and preferences
   (`gender`). Most consumers only need one. Alternatively move the cart to an external store
   read through `useSyncExternalStore`, exactly as toast and confirm already are.
2. Remove `placeOrder` and `isFavorite` from the value dependencies by reading `cart` and
   `favorites` from a ref inside them.
3. Hoist inline styles to `StyleSheet.create` constants and wrap list-item callbacks in
   `useCallback`, so the existing `React.memo` boundaries start working.
4. Replace the `C` and `T` proxies with plain frozen objects rebuilt on theme change.

---

## 7. Network and API strategy

**There is no caching, no request deduplication, no in-flight guard, and no abort anywhere**
except Home's five-minute per-gender cache (`HomeScreen.tsx:263-287`). Every `cancelled` flag in
the codebase only discards the result; the socket stays open and the JSON is still parsed.

Concrete consequences:

- **Category browse refetches the whole counted tree on every gender flip**
  (`CategoryBrowseScreen.tsx:547-554`). A HER to HIM and back round trip is three requests for
  data already on the device. `withCounts=true` makes this the expensive aggregate variant.
- **The category listing refetches 60 products on every sort tap** (`CategoryScreen.tsx:65-79`),
  with no cache and no abort of the previous request.
- **The bag re-prices on every quantity tap with no debounce** (`CartScreen.tsx:78-85`), while
  `AppState.tsx:323-329` separately fires a debounced cart PUT. Rapid taps put several
  un-abortable POSTs in flight whose results apply in arrival order.
- **Order placement is serial across stores** (`ReviewOrderScreen.tsx:148-161`), so a two-store
  cart waits for two sequential round trips.
- **Home fires four parallel requests but calls `setApiCache` in four separate handlers**, so
  one load produces up to four full re-renders of a 2,362-line screen.

### Payload weight

The list endpoint and the detail endpoint return **byte-identical shapes** — both call
`shapeListings` (`catalog.controller.ts:204-251`). Every product card row therefore carries the
full `description`, the full `galleryUrls` array, every variant group, and **every variant** with
its own `imageUrls` array, price, compare-at price and availability.

The card adapter (`services/catalog.ts:126-144`) uses about nine of those fields: one price, one
image, one colour, the name, the brand, the rating and the category label. For a four-colour by
six-size product that is 24 variant objects downloaded and parsed to display one price.

Home requests `limit: 50` and the category listing requests `limit: 60`, so a single screen can
pull well over a thousand variant objects. `api.ts:90` parses that response with a synchronous
`JSON.parse` on the JS thread.

### What to do

1. **Add a list projection on the backend.** A `shapeCards` variant returning `id`, `name`,
   `brand.name`, `category.label`, `ratingAvg`, `ratingCount`, one image, and a precomputed
   `pricePaise` / `compareAtPricePaise` / `discountPct` from the cheapest active variant. Keep
   `shapeListings` for product detail. This is the highest-leverage backend change available and
   should cut list payloads by roughly an order of magnitude.
2. **Add a small client cache with request deduplication.** React Query would give caching,
   dedupe, abort and stale-while-revalidate in one dependency, and would remove most of the
   hand-rolled `cancelled` flags. If a new dependency is unwanted, a `Map` of in-flight promises
   keyed by URL plus a short TTL covers most of the benefit.
3. **Pass `AbortSignal` through `request()`** and abort on unmount and on parameter change.
   The plumbing already exists in `api.ts:58-59`; no caller uses it.
4. **Debounce the bag re-price** to about 400 ms and abort the superseded request.
5. **Place multi-store orders in parallel**, or better, use the atomic group endpoint that
   already exists on the backend and in `services/orders.ts:165` but is never called.
6. **Request `limit: 20` for Home**, since it renders six cards at a time.
7. **Enable gzip.** No `Accept-Encoding` is set and there is no ETag handling.

---

## 8. Startup

The app cannot become interactive in under about **3.35 seconds on any device**, because that
floor is made of fixed timers rather than work:

- `RootNav.tsx:241-244` — a hardcoded `setTimeout(..., 1450)` before anything mounts.
- `SplashScreen.tsx:122-123` — a burst at 2050 ms and completion at 3350 ms.
- `RootNav.tsx:251-256` — a further 700 ms delay that then opens a promotional modal on **every**
  launch.

On a flagship the real work fits inside that window and the delay reads as deliberate pacing. On
a mid-range device the real work exceeds the window and is **added** to it, so the two costs
stack instead of overlapping.

The real work is substantial:

- **Module evaluation.** `RootNav.tsx:14-50` statically imports every screen in the app, which
  transitively evaluates **321 `require()` calls**, about 314 of them module-scope asset
  registrations — 132 in `icons.gen.ts` alone, 78 in `HomeScreen.tsx`, 57 in
  `HomeSectionScreens.tsx`. It also pulls in `expo-camera`, `expo-image-picker`,
  `lottie-react-native`, `expo-video` and `expo-clipboard` at startup, none of which are needed
  for first paint.
- **Fonts block first paint.** `App.tsx:63-69` renders nothing but a spinner until five TTF
  files totalling 394 KB resolve. Because `expo-font` is listed as a bare string in `app.json`
  with no `fonts` array, these load at JS runtime rather than being embedded natively.
- **The splash screen is a particle system.** `SplashScreen.tsx:59-114` renders roughly **361
  cells, each a pair of nested `MotiView`s** — several hundred animated nodes on the very first
  frame, on the slowest device in the fleet.
- **Four AsyncStorage reads gate routing**, and the gender read (`AppState.tsx:180-196`) is not
  batched with the other three (`:117-121`).
- For a signed-in shopper, `AppState.tsx:293-322` runs **two sequentially awaited network calls**
  at startup with no `InteractionManager` deferral.

### What to do

1. Delete the 1450 ms and 700 ms timers and drive the splash from real readiness.
2. Embed the fonts natively by giving `expo-font` a `fonts` array in `app.json`, and delete the
   three unused families. Then fix `HELV` so the app uses a font it actually loads.
3. Replace the splash particle grid with a static image or a small Lottie file.
4. Lazy-load the heavy, rarely used screens (`GameScreens`, `FeatureScreens`, `TryOn`,
   `ImageSearch`) behind `React.lazy`, so `expo-camera` and `expo-image-picker` leave the startup
   graph.
5. Batch the fourth AsyncStorage read into the existing `Promise.all`, or use `multiGet`.
6. Defer the cart hydration chain behind `InteractionManager`.
7. Show the promotional modal at most once per day rather than every launch.

---

## 9. Recommended plan

Sequenced so the cheapest large wins land first. Measure after each phase.

### Phase 1 — one day, largest return

1. Resize and convert all bundled images to WebP; expect `assets` to drop from 107 MB to roughly
   10-15 MB.
2. Delete `assets/reels` and the two always-on Home video previews, or pause them on blur and
   off-screen.
3. Memoise `items` in `ReviewOrderScreen` to stop the pricing loop.
4. Apply the release slimming properties to the native project, or regenerate `android/` with
   `expo prebuild --clean` so the plugin runs. Fix the debug-keystore signing while there.
5. Delete prefetch wave two.
6. Remove the 1450 ms and 700 ms startup timers.

### Phase 2 — two to three days, structural

7. Convert Category browse, Category listing and Home's Explore grid to `FlashList`.
8. Split `AppState` into identity, cart and preferences contexts, or move the cart to an external
   store.
9. Hoist inline styles and callbacks at every `ProductCard` and `StyleTile` call site so the
   existing memo boundaries take effect.
10. Move the scroll-spy off the JS thread using `useAnimatedScrollHandler` with a shared value,
    calling `runOnJS` only when the active section actually changes.
11. Fix the `Tile`-inside-render remount and hoist the `FlashFitScreen` countdown into its own
    component.

### Phase 3 — two days, backend and network

12. Add the `shapeCards` list projection and switch the list endpoints to it.
13. Introduce caching with deduplication and abort; wire `AbortSignal` through `request()`.
14. Debounce the bag re-price; parallelise or group multi-store placement.
15. Reduce Home's `limit` to 20 and enable gzip.

### Phase 4 — cleanup

16. Delete the dead animated styles, dead components and unused fonts; fix `HELV`.
17. Replace the `C` and `T` proxies with frozen objects.
18. Reduce gradient scrims, especially the 84 in the category browser — a solid low-opacity
    overlay is nearly indistinguishable and far cheaper.
19. Lazy-load the heavy screens.

---

## 10. How to verify

Do not measure on a flagship. Use a mid-range device with 4 GB of RAM, or an emulator throttled
to two cores.

- **Frame rate.** Enable the RN performance monitor and watch the UI and JS rows separately
  while scrolling Home and the Category tab. The JS row is the one to watch: any dip below 60
  points at render work, not GPU work.
- **Re-render counts.** Add the React DevTools profiler, or temporarily log in `ProductCard`, and
  confirm that adding an item to the bag does not re-render the entire tree.
- **GPU overdraw.** Developer options, "Debug GPU overdraw". Green is acceptable, red is not.
  Check the top of Home and the category tile grid.
- **Memory.** `adb shell dumpsys meminfo com.trendzo.app` before and after scrolling Home to
  page 10. Growth that never comes back down confirms the unbounded Explore grid.
- **Network.** Flipper or a proxy on the review-order screen; confirm the pricing POST fires once
  rather than continuously.
- **Startup.** `adb shell am start -W com.trendzo.app/.MainActivity` for `TotalTime`, repeated
  five times from cold.
- **APK size.** Compare before and after Phase 1. The debug build measured 100.5 MB.

Record each number before Phase 1 so the improvement is provable rather than felt.
