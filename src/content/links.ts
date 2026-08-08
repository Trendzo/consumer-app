// The link registry — every tap target on the home page and its section pages, in one place.
//
// Before this, "what does tapping the Steals hero do?" was answered by reading JSX 800 lines
// into HomeScreen.tsx. Now a link is data (`{ route, params }`) that lives beside the content
// it belongs to in home.content.json, and every tile funnels through `openLink` below.
//
// The route name is validated in three places, deliberately: the backend rejects a write whose
// route is not in `CMS_ROUTES`, `KNOWN_ROUTES` here rejects one at runtime, and the union type
// makes a typo in the bundled JSON a TypeScript error. The middle check is the one that
// matters in production — content is served from a database that a future build's navigator
// knows nothing about, so a route that has since been renamed must degrade to "nothing
// happens" rather than crash the screen.

import type { CmsLink } from './types';

/**
 * Screens registered in `navigation/RootNav.tsx`. Keep in sync with `CMS_ROUTES` in
 * `backend/src/shared/cms/schema.ts` — the backend cannot import this file.
 */
export const KNOWN_ROUTES = [
  'Categories',
  'Category',
  'CategoryZoom',
  'ProductDetail',
  'Search',
  'ImageSearch',
  'Steals',
  'TopStories',
  'Collection',
  'ShopByOccasion',
  'FlashFit',
  'ForHer',
  'ForHim',
  'OccasionShopping',
  'NewArrivals',
  'DiscoverBrands',
  'TryOnPicker',
  'TryAndBuy',
  'ReelsTab',
  'CartTab',
  'CategoryTab',
  'HomeTab',
  'CommunityFeed',
  'MoodBoard',
  'CouponWallet',
  'LoyaltyRewards',
  'ReferralRewards',
  'GiftCard',
  'SpinWheel',
  'DailyReward',
  'LuckyDraw',
  'StyleQuiz',
  'InviteFriends',
  'AppChallenges',
  'SavedAddresses',
  'Profile',
  'OrderHistory',
  'About',
  'Sustainability',
  'FashionCalendar',
  'StorePickup',
] as const;

export type KnownRoute = (typeof KNOWN_ROUTES)[number];

const ROUTE_SET: ReadonlySet<string> = new Set(KNOWN_ROUTES);

export function isKnownRoute(route: string | undefined | null): route is KnownRoute {
  return typeof route === 'string' && ROUTE_SET.has(route);
}

type Navigator = { navigate: (route: string, params?: Record<string, unknown>) => void };

/**
 * Follow a CMS link. Returns true when it navigated.
 *
 * A null link or an unrecognised route is a no-op rather than a throw: content outlives builds,
 * and a dead tap is a far better outcome than a red screen. `extraParams` merges on top so a
 * screen can add what only it knows — the measured card frame for the zoom transition, say.
 */
export function openLink(
  nav: Navigator,
  link: CmsLink | null | undefined,
  extraParams?: Record<string, unknown>,
): boolean {
  if (!link || !isKnownRoute(link.route)) return false;
  const params = { ...(link.params ?? {}), ...(extraParams ?? {}) };
  nav.navigate(link.route, Object.keys(params).length ? params : undefined);
  return true;
}

/**
 * A link's params, for the cases where a screen needs to read one rather than navigate — the
 * occasion rail matches `params.occasion` against its own list before deciding what to show.
 */
export function linkParam(link: CmsLink | null | undefined, key: string): string | null {
  const value = link?.params?.[key];
  return typeof value === 'string' ? value : null;
}
