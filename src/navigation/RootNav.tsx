import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, DeviceEventEmitter, BackHandler, ToastAndroid, InteractionManager } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { ZoomProvider } from './ZoomTransition';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { PixelIcon, PixelIconName } from '../components/PixelIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { C, T, BORDER, HELV} from '../theme/brutal';
import { BrutalToast, BrutalConfirm } from '../components/Brutal';
import { useApp } from '../state/AppState';
import { tabBarBus } from '../state/uiBus';

/** Placeholder while a lazily-loaded screen's chunk resolves. Deliberately plain —
 *  it is on screen for a frame or two at most. */
function ScreenFallback() {
  return <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} />;
}

/** Date-string of the last day the Spin & Win welcome popup was shown. */
const SPIN_POPUP_KEY = '@closetx/spinPopupShownOn';

import SplashScreen from '../screens/SplashScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import CompleteProfileScreen from '../screens/CompleteProfileScreen';
import { AuthSheet } from '../components/AuthSheet';
import { LocationGate } from '../components/LocationGate';
import HomeScreen from '../screens/HomeScreen';
import ReelsScreen from '../screens/ReelsScreen';
import CreateReelScreen from '../screens/CreateReelScreen';
import ReelProductPickerScreen from '../screens/ReelProductPickerScreen';
import CartScreen from '../screens/CartScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ProductDetailScreen from '../screens/ProductDetailScreen';
import SearchScreen from '../screens/SearchScreen';
import CategoryScreen from '../screens/CategoryScreen';
import CategoryBrowseScreen from '../screens/CategoryBrowseScreen';
import CategoryZoomScreen from '../screens/CategoryZoomScreen';
import ReviewOrderScreen from '../screens/ReviewOrderScreen';
import TryOnPickerScreen from '../screens/TryOnPickerScreen';
import AboutScreen from '../screens/AboutScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import { OrderSuccessScreen, OrderTrackingScreen, OrderHistoryScreen } from '../screens/OrderScreens';

import {
  SavedAddressesScreen, PaymentMethodsScreen, LoyaltyRewardsScreen, GiftCardScreen,
  ReferralRewardsScreen, NotificationSettingsScreen, LanguageScreen, CustomerSupportScreen,
  StylePreferencesScreen, MeasurementScreen, FashionCalendarScreen,
  SustainabilityScreen, ReviewsScreen,
  StorePickupScreen, TryAndBuyScreen,
} from '../screens/ProfileScreens';
import { OrderReturnScreen } from '../screens/ReturnScreens';
/**
 * Lazily loaded screen groups.
 *
 * GameScreens and FeatureScreens between them pull in expo-camera,
 * expo-image-picker and expo-clipboard. Statically importing them here put all
 * three native modules — plus every module-scope asset require in those files —
 * into the STARTUP graph, even though nothing in the first-paint path touches
 * them. `import()` defers that module evaluation until the user actually opens
 * one of these screens.
 */
const lazyScreen = <K extends string>(load: () => Promise<Record<K, React.ComponentType<any>>>, key: K) => {
  const L = React.lazy(() => load().then((m) => ({ default: m[key] })));
  return (props: any) => (
    <React.Suspense fallback={<ScreenFallback />}>
      <L {...props} />
    </React.Suspense>
  );
};

const loadGames = () => import('../screens/GameScreens');
const loadFeatures = () => import('../screens/FeatureScreens');

const DailyRewardScreen = lazyScreen(loadGames, 'DailyRewardScreen');
const SpinWheelScreen = lazyScreen(loadGames, 'SpinWheelScreen');
const StyleQuizScreen = lazyScreen(loadGames, 'StyleQuizScreen');
const NotificationsScreen = lazyScreen(loadGames, 'NotificationsScreen');
const TryOnScreen = lazyScreen(loadGames, 'TryOnScreen');

const ImageSearchScreen = lazyScreen(loadFeatures, 'ImageSearchScreen');
const CouponWalletScreen = lazyScreen(loadFeatures, 'CouponWalletScreen');
const CommunityFeedScreen = lazyScreen(loadFeatures, 'CommunityFeedScreen');
const MoodBoardScreen = lazyScreen(loadFeatures, 'MoodBoardScreen');
const LuckyDrawScreen = lazyScreen(loadFeatures, 'LuckyDrawScreen');
const InviteFriendsScreen = lazyScreen(loadFeatures, 'InviteFriendsScreen');
const AppChallengesScreen = lazyScreen(loadFeatures, 'AppChallengesScreen');
const NewArrivalsScreen = lazyScreen(loadFeatures, 'NewArrivalsScreen');
const DiscoverBrandsScreen = lazyScreen(loadFeatures, 'DiscoverBrandsScreen');
const OccasionShoppingScreen = lazyScreen(loadFeatures, 'OccasionShoppingScreen');
import {
  StealsScreen, TopStoriesScreen, ShopByOccasionScreen, FlashFitScreen,
  ForHerEditScreen, ForHimEditScreen,
} from '../screens/HomeSectionScreens';
import CollectionScreen from '../screens/CollectionScreen';
import { PushWinScreen } from '../screens/PushWinScreen';
import { SpinWinPopup } from '../components/SpinWinPopup';
import {
  getWheel as getSpinWheel, claim as claimSpinPrize, hasPendingClaim, takePendingClaim,
  type SpinWheel as SpinWheelData,
} from '../services/spin';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// ─── BOTTOM TAB BAR — floating pixel-art pill ───────────────
// A white floating bar above the home indicator — sharp corners + hairline
// border, matching the app-wide light design language. Active items go ink,
// inactive dim. Four pixel-art tabs (Home · Reel · Category · Bag).
const TAB_ACTIVE = '#111111';
const TAB_INACTIVE = '#666666';

function BrutalTabBar({ state, navigation }: BottomTabBarProps) {
  const items: { name: string; label: string; icon: PixelIconName }[] = [
    { name: 'HomeTab', label: 'Home', icon: 'home' },
    { name: 'ReelsTab', label: 'Reel', icon: 'reel' },
    { name: 'CategoryTab', label: 'Category', icon: 'category' },
    { name: 'CartTab', label: 'Bag', icon: 'bag' },
  ];
  const { cartCount, tabBarOffset } = useApp();
  const activeTint = TAB_ACTIVE;
  const insets = useSafeAreaInsets();
  const tabStyles = tabStylesStatic;

  // Switching tabs should always reveal the bar, even if it was hidden by a
  // scroll on the previous tab.
  useEffect(() => {
    tabBarOffset.value = 0;
  }, [state.index]);

  // Slide the whole bar off the bottom when tabBarOffset → 1 (scrolling down).
  const HIDE_DISTANCE = 78 + (insets.bottom > 0 ? insets.bottom : 10);
  const hideStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: tabBarOffset.value * HIDE_DISTANCE }],
    opacity: 1 - tabBarOffset.value * 0.15,
  }));

  return (
    <Animated.View
      style={[tabStyles.wrap, { paddingBottom: insets.bottom > 0 ? insets.bottom - 4 : 10 }, hideStyle]}
      pointerEvents="box-none"
    >
      <View style={tabStyles.pill}>
        {items.map((it, i) => {
          const active = state.index === i;
          const tint = active ? activeTint : TAB_INACTIVE;
          return (
            <Pressable
              key={it.name}
              onPress={() => {
                if (active && it.name === 'ReelsTab') {
                  DeviceEventEmitter.emit('reelsReload');
                } else if (active && it.name === 'HomeTab') {
                  DeviceEventEmitter.emit('homeScrollToTop');
                } else {
                  navigation.navigate(it.name);
                }
              }}
              style={tabStyles.btn}
            >
              <View style={tabStyles.iconWrap}>
                <PixelIcon name={it.icon} size={22} color={tint} />
                {it.name === 'CartTab' && cartCount > 0 && (
                  <View style={tabStyles.badge}>
                    {/* Capped: an uncapped 3-4 digit count widens the badge past
                        the wrap and puts the clipping straight back. */}
                    <Text style={tabStyles.badgeTxt} numberOfLines={1}>
                      {cartCount > 99 ? '99+' : cartCount}
                    </Text>
                  </View>
                )}
              </View>
              <Text
                numberOfLines={1}
                style={[T.caption, tabStyles.lbl, { color: tint }, active && tabStyles.lblActive]}
              >
                {it.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );
}

const tabStylesStatic = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  // Sharp, flat bar — square corners, hairline border, no shadow (matches the
  // app-wide light design language; was a rounded drop-shadow pill).
  pill: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#e6e6e6',
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  btn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  // Wide enough to CONTAIN the cart badge inside its own bounds. The badge used
  // to hang off at top:-6/right:-10, and Android clips absolutely-positioned
  // children to the parent box regardless of `overflow: visible` — so the black
  // square was drawn with its top and right sliced off. Width only: the height
  // stays 22 so the bar does not grow, and the 22px icon still centres here.
  iconWrap: {
    width: 44,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  lbl: {
    textAlign: 'center',
  },
  lblActive: {
    fontFamily: HELV, fontWeight: '600',
  },
  // Anchored to the wrap's top-right corner with NO negative offset, so every
  // edge stays inside the parent and nothing can be clipped. A 2–3 char count
  // grows leftward from the pinned right edge, which is still inside the wrap.
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 0,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeTxt: { color: '#fff', fontFamily: HELV, fontWeight: '500', fontSize: 9 },
});

const navigationRef = createNavigationContainerRef<any>();

// ─── MAIN TABS ──────────────────────────────────────────────
function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={props => <BrutalTabBar {...props} />}
      // freezeOnBlur: suspend the JS render tree of every non-focused tab —
      // Home's auto-rotating banners and looping video otherwise keep
      // rendering (and dropping frames) behind whichever tab is open. Each
      // tab thaws with full state the moment it regains focus.
      // freezeOnBlur DISABLED — it was the root cause of the frozen Home.
      // react-freeze suspends a blurred screen's React tree. Five screens in
      // this app are `transparentModal` (ProductDetail, CategoryZoom, Search,
      // TryOn, TryOnPicker), so opening ANY of them blurs and freezes the tab
      // underneath. On return the tree unfreezes and Reanimated re-binds — and
      // Home's scroll is a useAnimatedScrollHandler on an animated ScrollView,
      // which re-binds to STALE native views and silently stops responding.
      // That is "Home is stuck after going back from any page".
      // ProductDetailScreen already carries a hand-rolled workaround for the
      // same effect ("animations run without drawing"); rather than repeat that
      // patch on every screen, drop the optimisation that causes it. The cost is
      // that parked screens keep rendering; the benefit is an app that responds.
      screenOptions={{ headerShown: false, freezeOnBlur: false }}
    >
      <Tab.Screen name="HomeTab" component={HomeScreen} />
      <Tab.Screen name="ReelsTab" component={ReelsScreen} />
      <Tab.Screen name="CategoryTab" component={CategoryBrowseScreen} />
      <Tab.Screen name="CartTab" component={CartScreen} />
    </Tab.Navigator>
  );
}

// ─── ROOT ────────────────────────────────────────────────────
type Phase = 'splash' | 'onboarding' | 'main';

export default function RootNav() {
  const [phase, setPhase] = useState<Phase>('splash');
  // splashDone: the splash animation has finished. We still wait on
  // authHydrated before routing so a persisted session isn't missed.
  const [splashDone, setSplashDone] = useState(false);
  const { onboarded, setOnboarded, token, authHydrated, showToast } = useApp();
  const lastBackRef = React.useRef(0);

  // Decide where a new launch goes once the splash is done AND the persisted
  // session/onboarding flags have been read from disk. There's no forced
  // login page any more — guests (onboarded or not) land straight in the app
  // and only get prompted to sign in when they try to buy (see requireAuth
  // in AppState, surfaced via AuthSheet).
  //   • logged in OR already onboarded → straight to the app
  //   • brand new                       → onboarding → app
  // Route as soon as the persisted session is read — WITHOUT waiting for the
  // splash animation. The destination (home/onboarding) mounts and settles
  // UNDERNEATH the splash overlay, so when the particles disperse the app is
  // already loaded — no loading/entry animations after the splash.
  useEffect(() => {
    if (phase !== 'splash' || !authHydrated) return;
    setPhase(token || onboarded ? 'main' : 'onboarding');
  }, [phase, authHydrated, token, onboarded]);

  // Mount the app as soon as the JS thread is free, not on a fixed 1450 ms
  // timer. The old delay assumed Home's first render fits inside the splash's
  // calm window — true on a flagship, false on a mid-range device, where the
  // real work then ADDED to the wait instead of hiding inside it.
  // runAfterInteractions still yields to the splash's intro animation, so the
  // original anti-jitter intent holds without paying a fixed 1.45 s on every
  // launch on every device.
  const [appMountReady, setAppMountReady] = useState(false);
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setAppMountReady(true));
    // HARD FAILSAFE — the ENTIRE app render is gated on this one flag (see the
    // `phase === 'main' && appMountReady` branches below), so if
    // runAfterInteractions never fires the user stares at a splash forever with
    // nothing to tap. That is not hypothetical: the queue is drained only once
    // every InteractionManager handle is released, and a single handle left open
    // by any animation or library starves it indefinitely. Gating a whole app on
    // a callback that has no guarantee of running needs a floor under it.
    // 1200ms is past the splash's own intro, so the anti-jitter intent still
    // holds on a healthy launch and this only ever fires on a broken one.
    const failsafe = setTimeout(() => setAppMountReady(true), 1200);
    return () => { task.cancel(); clearTimeout(failsafe); };
  }, []);

  // SPIN & WIN welcome popup — fires once per app launch, right after the
  // splash particles clear AND the main app is on screen (if the user goes
  // through onboarding first, it waits and fires when they land in the app).
  // At most ONCE PER DAY, not once per launch. It used to open on every single
  // cold start, 700 ms after an already-3.35 s splash — the first thing a
  // returning user had to dismiss, every time.
  const [spinPopup, setSpinPopup] = useState(false);
  const [spinWheel, setSpinWheel] = useState<SpinWheelData | null>(null);
  const spinShownRef = React.useRef(false);
  useEffect(() => {
    if (!splashDone || phase !== 'main' || spinShownRef.current) return;
    spinShownRef.current = true;
    let cancelled = false;
    let t: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      // The local day key is a cheap throttle so a returning shopper is not shown
      // the same popup twice in a session. It is NOT the rule — the server owns
      // how many spins this device has left, and an admin pausing the wheel has
      // to silence the popup everywhere immediately.
      const today = new Date().toDateString();
      const last = await AsyncStorage.getItem(SPIN_POPUP_KEY).catch(() => null);
      if (cancelled || last === today) return;

      const wheel = await getSpinWheel('popup').catch(() => null);
      // No wheel running, or this device is out of spins → show nothing at all.
      // Note the day key is only written once we actually intend to show it, so a
      // paused wheel does not burn today's slot.
      if (cancelled || !wheel || wheel.spinsLeftToday <= 0) return;

      await AsyncStorage.setItem(SPIN_POPUP_KEY, today).catch(() => {});
      setSpinWheel(wheel);
      // Let the first frames of the app settle before covering them.
      t = setTimeout(() => { if (!cancelled) setSpinPopup(true); }, 700);
    })();
    return () => { cancelled = true; if (t) clearTimeout(t); };
  }, [splashDone, phase]);

  /**
   * Collect a prize that was won while signed out.
   *
   * The claim normally rides on `requireAuth`'s success callback, straight from the
   * button that opened the sheet. That covers the happy path and nothing else: if
   * the shopper dismisses the sheet and signs in a few minutes later from Profile,
   * the callback is gone and the win — which the server is still holding — is never
   * collected. Draining the parked token here makes signing in AT ALL settle it,
   * however they got there.
   *
   * `takePendingClaim` clears as it reads, and the server is idempotent on the
   * token, so a race with the button's own callback cannot issue two prizes.
   */
  useEffect(() => {
    if (!token || !hasPendingClaim()) return;
    const parked = takePendingClaim();
    if (!parked) return;
    claimSpinPrize(parked)
      .then((res) => {
        if (!res.prize) return;
        if (res.prize.code) showToast('Prize claimed', `Code ${res.prize.code} — apply it at checkout`, 'gift');
        else if (res.prize.points) showToast('Prize claimed', `${res.prize.points} points added`, 'gift');
      })
      .catch(() => { /* the code is still in Coupons; don't nag on a flaky network */ });
  }, [token, showToast]);

  // Android hardware back: route → Home tab → "press again to exit"
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const nav = navigationRef.current;
      if (!nav || !nav.isReady()) return false;

      // If a stack screen is on top, let RN Navigation pop it
      if (nav.canGoBack()) {
        nav.goBack();
        return true;
      }

      // At root: check which tab is active
      const rootState = nav.getRootState();
      const tabsRoute = rootState.routes.find((r: any) => r.name === 'Tabs');
      const tabState: any = tabsRoute?.state;
      const currentTab = tabState?.routes?.[tabState.index]?.name;

      if (currentTab && currentTab !== 'HomeTab') {
        nav.navigate('Tabs', { screen: 'HomeTab' });
        return true;
      }

      // On Home tab: require double back within 2s to exit
      const now = Date.now();
      if (now - lastBackRef.current < 2000) {
        return false; // allow default → exits app
      }
      lastBackRef.current = now;
      ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
      return true;
    });
    return () => sub.remove();
  }, []);

  const NightOverlay = () => null;

  // Single stable tree: the destination renders below, the splash sits on top
  // as an overlay until its particle burst finishes, then unmounts — the
  // particles spread OPEN over the already-mounted home (its bg fades out).
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {phase === 'onboarding' && appMountReady && (
        <OnboardingScreen onDone={() => { setOnboarded(true); setPhase('main'); }} />
      )}
      {phase === 'main' && appMountReady && <MainApp gateReady={splashDone} />}
      {!splashDone && (
        <View style={StyleSheet.absoluteFill}>
          <SplashScreen onDone={() => setSplashDone(true)} />
        </View>
      )}
      {/* Welcome-gift wheel — only after the splash is gone, and only when the
          server actually has a wheel running for this device. */}
      {spinWheel && (
        <SpinWinPopup
          visible={spinPopup}
          wheel={spinWheel}
          onClose={() => setSpinPopup(false)}
          onShop={() => {
            setSpinPopup(false);
            if (navigationRef.current?.isReady()) navigationRef.current.navigate('Steals');
          }}
        />
      )}
    </View>
  );
}

function MainApp({ gateReady = true }: { gateReady?: boolean }) {
  const NightOverlay = () => null;
  const { tabBarOffset } = useApp();
  return (
    <ZoomProvider navRef={navigationRef}>
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
    <NavigationContainer
      ref={navigationRef}
      onStateChange={(state) => {
        // Whenever the root stack returns to the tab screens (a modal like
        // Search / ProductDetail / CategoryZoom was dismissed), re-reveal the
        // floating tab bar. Those are transparentModals that don't reliably
        // re-fire focus on the tab underneath, so a scroll-hidden bar would
        // otherwise stay stuck off-screen. Fires on nav changes only, never on
        // scroll, so it doesn't fight the scroll-to-hide behaviour.
        const top = state?.routes?.[state.index ?? 0]?.name;
        // The tab bar exists only while the tab navigator is the top route.
        // BrutalToast reads this so a toast fired from a pushed screen sits on
        // the bottom edge instead of floating 108px above nothing.
        tabBarBus.set(top === 'Tabs');
        if (top === 'Tabs') tabBarOffset.value = withTiming(0, { duration: 200 });
      }}
    >
      {/* freezeOnBlur: parked screens stop re-rendering behind the active one —
          the same treatment the tab navigator already had. Push/pop animations
          are native-driven; what made them choppy was blurred screens (Home
          especially) continuing to render underneath the transition. */}
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right', freezeOnBlur: false }}>
        <Stack.Screen name="Tabs" component={MainTabs} />
        {/* Profile moved out of the bottom tabs — still reachable as a pushed
            screen (opened from the Home header). */}
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="CompleteProfile" component={CompleteProfileScreen} options={{ gestureEnabled: false }} />
        <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ presentation: 'transparentModal', animation: 'none', gestureEnabled: false, contentStyle: { backgroundColor: 'transparent' } }} />
        {/* Category hero-morph — transparent so Home stays visible under the flight */}
        <Stack.Screen name="CategoryZoom" component={CategoryZoomScreen} options={{ presentation: 'transparentModal', animation: 'none', gestureEnabled: false, contentStyle: { backgroundColor: 'transparent' } }} />
            {/* transparent so the search bar can morph in place over Home */}
            <Stack.Screen name="Search" component={SearchScreen} options={{ presentation: 'transparentModal', animation: 'none', contentStyle: { backgroundColor: 'transparent' } }} />
            <Stack.Screen name="Category" component={CategoryScreen} />
            <Stack.Screen name="Categories" component={CategoryBrowseScreen} />
        {/* NOTE: no stack-level "Cart" route — the Bag exists ONCE, as the
            CartTab. Every bag icon navigates to Tabs → CartTab so there's a
            single bag page, never a second pushed copy. */}
        {/* Single-page checkout (address + delivery + payment + pay on ONE page,
            Myntra-style). The old 4-step Checkout wizard is retired — every
            buy path (Buy Now and Bag buckets) lands here. */}
        <Stack.Screen name="ReviewOrder" component={ReviewOrderScreen} />
        <Stack.Screen name="OrderSuccess" component={OrderSuccessScreen} options={{ animation: 'fade' }} />
        <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} />
        <Stack.Screen name="OrderHistory" component={OrderHistoryScreen} />
        <Stack.Screen name="DailyReward" component={DailyRewardScreen} />
        <Stack.Screen name="SpinWheel" component={SpinWheelScreen} />
        <Stack.Screen name="StyleQuiz" component={StyleQuizScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        {/* transparentModal + none: pushed OVER the transparent ProductDetail.
            As a regular (opaque) screen, react-native-screens detached
            ProductDetail during the push — its backdrop vanished a frame early
            and the category list flashed through before the camera appeared.
            A transparent presentation keeps every screen below attached, so
            nothing peeks through. Each screen paints its own solid background. */}
        <Stack.Screen name="TryOn" component={TryOnScreen} options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }} />
        <Stack.Screen name="TryOnPicker" component={TryOnPickerScreen} options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }} />
        {/* Posting a reel — full-screen, slides up like a compose sheet. */}
        <Stack.Screen name="CreateReel" component={CreateReelScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="ReelProductPicker" component={ReelProductPickerScreen} />
        <Stack.Screen name="About" component={AboutScreen} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        {/* Profile sub-screens */}
        <Stack.Screen name="SavedAddresses" component={SavedAddressesScreen} />
        <Stack.Screen name="PaymentMethods" component={PaymentMethodsScreen} />
        <Stack.Screen name="LoyaltyRewards" component={LoyaltyRewardsScreen} />
        <Stack.Screen name="GiftCard" component={GiftCardScreen} />
        <Stack.Screen name="ReferralRewards" component={ReferralRewardsScreen} />
        <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
        <Stack.Screen name="Language" component={LanguageScreen} />
        <Stack.Screen name="CustomerSupport" component={CustomerSupportScreen} />
        <Stack.Screen name="StylePreferences" component={StylePreferencesScreen} />
        <Stack.Screen name="Measurement" component={MeasurementScreen} />
        <Stack.Screen name="FashionCalendar" component={FashionCalendarScreen} />
        <Stack.Screen name="Sustainability" component={SustainabilityScreen} />
        <Stack.Screen name="OrderReturn" component={OrderReturnScreen} />
        <Stack.Screen name="Reviews" component={ReviewsScreen} />
        <Stack.Screen name="StorePickup" component={StorePickupScreen} />
        <Stack.Screen name="TryAndBuy" component={TryAndBuyScreen} />
        {/* Feature screens */}
        <Stack.Screen name="ImageSearch" component={ImageSearchScreen} />
        <Stack.Screen name="CouponWallet" component={CouponWalletScreen} />
        <Stack.Screen name="CommunityFeed" component={CommunityFeedScreen} />
        <Stack.Screen name="MoodBoard" component={MoodBoardScreen} />
        <Stack.Screen name="LuckyDraw" component={LuckyDrawScreen} />
        <Stack.Screen name="InviteFriends" component={InviteFriendsScreen} />
        <Stack.Screen name="AppChallenges" component={AppChallengesScreen} />
        <Stack.Screen name="NewArrivals" component={NewArrivalsScreen} />
        <Stack.Screen name="DiscoverBrands" component={DiscoverBrandsScreen} />
        {/* Gender campaign edits — redesigned pages the hero banner opens */}
        <Stack.Screen name="ForHer" component={ForHerEditScreen} />
        <Stack.Screen name="ForHim" component={ForHimEditScreen} />
        <Stack.Screen name="OccasionShopping" component={OccasionShoppingScreen} />
        {/* Dedicated pages for the Home sections (redesigned, modern UI) */}
        <Stack.Screen name="Steals" component={StealsScreen} />
        <Stack.Screen name="TopStories" component={TopStoriesScreen} />
        <Stack.Screen name="ShopByOccasion" component={ShopByOccasionScreen} />
        <Stack.Screen name="FlashFit" component={FlashFitScreen} />
        {/* Editorial collections — every curated tile ("Five-minute fits.",
            "Built different.", the 60-minute banner) lands here with its own
            query instead of being dumped into the generic catalog. */}
        <Stack.Screen name="Collection" component={CollectionScreen} />
        {/* Push & Win arcade — slides up like a game sheet */}
        <Stack.Screen name="PushWin" component={PushWinScreen} options={{ animation: 'slide_from_bottom' }} />
      </Stack.Navigator>
    </NavigationContainer>
    <NightOverlay />
    <BrutalToast />
    <BrutalConfirm />
    <AuthSheet />
    {/* Resolves the shopper's location at app open. Mounted here, beside AuthSheet, so it runs
        once regardless of which tab opens first. */}
    <LocationGate active={gateReady} />
    </View>
    </ZoomProvider>
  );
}
