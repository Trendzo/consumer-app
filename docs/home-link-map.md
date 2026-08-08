# Home Page Link Map

Every section on the Home page, what each tap does, and where it lands — so the CMS can drive it.
Listed in the order a shopper scrolls past them.

Derived from `src/screens/HomeScreen.tsx`, `src/content/links.ts` and `src/navigation/RootNav.tsx`.

**Legend**

- **CMS** — destination comes from the item's `link`; you control it.
- **FIXED** — hardcoded in the app; a CMS link will not change it.

---

## How a link works

Every CMS item may carry a `link`. The app calls `openLink()` with it; if the link is missing *or*
its route is not on the whitelist, the call returns false and the section falls back to its own
default.

```json
{
  "route": "Steals",
  "params": { "occasion": "brunch" }
}
```

- `route` — must be in `KNOWN_ROUTES`, else ignored.
- `params` — optional, passed straight through to the screen.

> **An unknown route is a no-op, not a crash.** Content outlives app builds, so a route that a future
> build renames degrades to "nothing happens" rather than a red screen. That also means a typo fails
> silently — validate on write.

> **Keep `CMS_ROUTES` on the backend in sync with `KNOWN_ROUTES`** in `src/content/links.ts`. The
> backend cannot import that file, so the two lists are maintained by hand and are the contract
> between you and the app.

---

## 01 · Hero banner

Section key `home.hero` — the full-bleed rotating brand posters at the very top.

| Tap target | Type | Goes to | Params | Fallback if no link |
| --- | --- | --- | --- | --- |
| Banner slide | CMS | `item.link.route` | from link | `ForHer` / `ForHim` by current gender |

## 02 · Header & search

Section key `home.header`. Overlaid on the hero. Only the placeholder text is content-driven.

| Tap target | Type | Goes to | Notes |
| --- | --- | --- | --- |
| Profile icon | FIXED | `Profile` | — |
| Search bar | FIXED | `Search` | placeholder from `config.searchPlaceholder` |
| Mic icon | FIXED | `Search` | opens focused |
| Camera icon | FIXED | `ImageSearch` | — |

## 03 · Marquee

Section key `home.marquee` — the scrolling strip. Text only, from `config.text`.
**No tap targets.**

## 04 · Trending categories grid

Section key `home.explore_grid`. Per-gender art via rails. Cards have two tap paths: a measured
hero-morph, and a plain fallback if the measurement fails.

| Tap target | Type | Goes to | Params | Fallback if no link |
| --- | --- | --- | --- | --- |
| Category card (morph) | FIXED | `CategoryZoom` | `label`, `img`, `tint`, `_frame` | — |
| Category card (plain) | CMS | `item.link.route` | from link | `Categories` + `{ label }` |
| "All" tile | FIXED | `Categories` | — | — |
| Category chip row | FIXED | `Categories` | `{ id, label }` | — |

`content.tint` on an item sets that card's morph colour.

## 05 · Steals

Section key `home.steals`. Title and CTA label are content-driven (`title`, `ctaLabel`).

| Tap target | Type | Goes to | Fallback if no link |
| --- | --- | --- | --- |
| Section head CTA | FIXED | `Steals` | — |
| Deal tile | CMS | `item.link.route` | `Steals` |

## 06 · Top Stories of the Week

Section key `home.top_stories`. Items carry `tag`, `title`, `blurb`, `read` and a `tags[]` array.

| Tap target | Type | Goes to | Fallback if no link |
| --- | --- | --- | --- |
| Story tile | CMS | `item.link.route` | `TopStories` |
| Section head | FIXED | `TopStories` | — |

> **On the Top Stories page itself, the story cards are no longer tappable** — only the products in
> the rail beneath each card open. A `link` on the page-level items (`page.top_stories`) is
> therefore ignored now.

## 07 · Reels For You

Two keys: `home.reels_features` (labelled cards) and `home.reels_previews` (video tiles).

| Tap target | Type | Goes to | Fallback if no link |
| --- | --- | --- | --- |
| Feature card | CMS | `item.link.route` | `ReelsTab` |
| Preview tile | CMS | `item.link.route` | `ReelsTab` |

## 08 · 60-Minute Delivery banner

Section key `home.reels_banner`. Title, CTA label and the three chips are content-driven.

| Tap target | Type | Goes to | Params |
| --- | --- | --- | --- |
| Whole banner | FIXED | `Collection` | `{ key: "sixty-minute" }` |

> **This one deliberately ignores the CMS link.** The authored link is `{ route: "Categories" }`,
> which is the generic-catalog redirect we removed. The banner now always opens its own collection
> page. If you want it configurable again, the link must point at `Collection` with a `key` that
> exists in the app's collection registry.

## 09 · Shop by Occasion

Section key `home.occasion`. Item `key` doubles as the collection slug the destination page resolves
against.

| Tap target | Type | Goes to | Params | Fallback if no link |
| --- | --- | --- | --- | --- |
| "All" tile | FIXED | `ShopByOccasion` | — | — |
| Occasion card | CMS | `item.link.route` | from link | `ShopByOccasion` + `{ occasion: <label lowercased> }` |

## 10 · Flash Fit of the Day

Section key `home.flash_fit`.

| Tap target | Type | Goes to |
| --- | --- | --- |
| Bundle card | FIXED | `FlashFit` |

## 11 · Shop by Vibe

No key of its own — reuses the `home.explore_grid` categories with a hardcoded heading.

| Tap target | Type | Goes to | Params |
| --- | --- | --- | --- |
| "ALL" action | FIXED | `Categories` | — |
| Vibe chip | FIXED | `Categories` | `{ id, label }` |

## 12 · Play & Win

**No CMS key.** The six games are a hardcoded map from game id to route — the backend cannot
currently add, remove or reorder them.

| Game id | Goes to | Icon |
| --- | --- | --- |
| `g1` | `DailyReward` | gift |
| `g2` | `SpinWheel` | wheel |
| `g3` | `LuckyDraw` | trophy |
| `g4` | `StyleQuiz` | palette |
| `g5` | `InviteFriends` | friends |
| `g6` | `AppChallenges` | fire |

Any unrecognised id falls back to `DailyReward`. If you want this content-driven, it needs a new
section key and an app change.

## 13 · See It On You (Try & Buy)

Section key `home.try_on`. Title, subtitle, CTA label and `config.wordmark` are content-driven.

| Tap target | Type | Goes to | Fallback if no link |
| --- | --- | --- | --- |
| CTA / card | CMS | `items[0].link.route` | `TryOnPicker` |

## 14 · Explore More feed

Not a CMS section — this is the live catalog, paginated as you scroll. Sort toggle is in-app state.

| Tap target | Type | Goes to | Params |
| --- | --- | --- | --- |
| Product card | FIXED | `ProductDetail` | `product`, `_zoom`, `_cardFrame` |

## 15 · Footer

Section key `home.footer` — `title` only. **No tap targets.**

---

## Global rule — product cards

Anywhere a product card appears — any rail, any grid, any page — tapping it opens `ProductDetail`
with the measured card frame for the zoom transition. This is built into the shared card component
and is never content-driven.

---

## Route whitelist

Valid values for `link.route`. Anything else is silently ignored. **`Collection` is newly added.**

```
Categories        Category          CategoryZoom      ProductDetail
Search            ImageSearch       Steals            TopStories
Collection ★      ShopByOccasion    FlashFit          ForHer
ForHim            OccasionShopping  NewArrivals       DiscoverBrands
TryOnPicker       TryAndBuy         ReelsTab          CartTab
CategoryTab       HomeTab           CommunityFeed     MoodBoard
CouponWallet      LoyaltyRewards    ReferralRewards   GiftCard
SpinWheel         DailyReward       LuckyDraw         StyleQuiz
InviteFriends     AppChallenges     SavedAddresses    Profile
OrderHistory      About             Sustainability    FashionCalendar
StorePickup
```

---

## What the CMS cannot change today

Worth knowing before you design the admin — these need an app release, not a content edit.

| Area | Why |
| --- | --- |
| Section order on Home | Fixed in the screen's JSX; the CMS supplies contents, not layout order. |
| Which sections exist | The app requests a fixed list of keys (`HOME_SECTION_KEYS`). A new key is ignored until the app asks for it. |
| Play & Win games | Hardcoded id → route map, no section key. |
| Header, Shop by Vibe, Flash Fit destinations | Hardcoded; a link on these items is not read. |
| 60-Minute banner destination | Deliberately hardcoded to its collection page. |
| Collection page contents | Each key maps to catalog queries in `src/content/collections.ts`, not the CMS. |

### Suggested next step for the backend

Collection page contents live in the app rather than the CMS. If you want merchandisers curating
them, the natural shape is extending `/catalog/collections` with editorial slugs, then pointing
tiles at `Collection` with a real slug instead of an app-side key.
