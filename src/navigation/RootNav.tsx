import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, DeviceEventEmitter, BackHandler, ToastAndroid } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { ZoomProvider } from './ZoomTransition';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { PixelIcon, PixelIconName } from '../components/PixelIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, T, BORDER } from '../theme/brutal';
import { BrutalToast, BrutalConfirm } from '../components/Brutal';
import { useApp } from '../state/AppState';

import SplashScreen from '../screens/SplashScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import CompleteProfileScreen from '../screens/CompleteProfileScreen';
import { AuthSheet } from '../components/AuthSheet';
import HomeScreen from '../screens/HomeScreen';
import ReelsScreen from '../screens/ReelsScreen';
import CartScreen from '../screens/CartScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ProductDetailScreen from '../screens/ProductDetailScreen';
import SearchScreen from '../screens/SearchScreen';
import CategoryScreen from '../screens/CategoryScreen';
import CategoryBrowseScreen from '../screens/CategoryBrowseScreen';
import CheckoutScreen from '../screens/CheckoutScreen';
import ReviewOrderScreen from '../screens/ReviewOrderScreen';
import TryOnPickerScreen from '../screens/TryOnPickerScreen';
import AboutScreen from '../screens/AboutScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import { OrderSuccessScreen, OrderTrackingScreen, OrderHistoryScreen } from '../screens/OrderScreens';
import { DailyRewardScreen, SpinWheelScreen, StyleQuizScreen, NotificationsScreen, TryOnScreen } from '../screens/GameScreens';
import {
  SavedAddressesScreen, PaymentMethodsScreen, LoyaltyRewardsScreen, GiftCardScreen,
  ReferralRewardsScreen, NotificationSettingsScreen, LanguageScreen, CustomerSupportScreen,
  StylePreferencesScreen, MeasurementScreen, FashionCalendarScreen,
  SustainabilityScreen, OrderReturnScreen, ReviewsScreen,
  StorePickupScreen, TryAndBuyScreen,
} from '../screens/ProfileScreens';
import {
  ImageSearchScreen, CouponWalletScreen, CommunityFeedScreen, MoodBoardScreen,
  LuckyDrawScreen, InviteFriendsScreen, AppChallengesScreen, NewArrivalsScreen,
  DiscoverBrandsScreen, ForHerScreen, ForHimScreen, OccasionShoppingScreen,
} from '../screens/FeatureScreens';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// ─── BOTTOM TAB BAR — floating pixel-art pill ───────────────
// A white rounded pill that floats above the home indicator. Four pixel-art
// tabs (Home · Reel · Category · Bag); the active one glows hot-pink, the rest
// sit in ink. No blur, no blob — just crisp bitmap glyphs on a solid surface.
const PINK = '#FF1E8E';

function BrutalTabBar({ state, navigation }: BottomTabBarProps) {
  const items: { name: string; label: string; icon: PixelIconName }[] = [
    { name: 'HomeTab', label: 'Home', icon: 'home' },
    { name: 'ReelsTab', label: 'Reel', icon: 'reel' },
    { name: 'CategoryTab', label: 'Category', icon: 'category' },
    { name: 'CartTab', label: 'Bag', icon: 'bag' },
  ];
  const { cartCount, night, tabBarOffset } = useApp();
  const insets = useSafeAreaInsets();
  const tabStyles = React.useMemo(() => makeTabStyles(night), [night]);

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
          const tint = active ? PINK : C.ink;
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
                    <Text style={tabStyles.badgeTxt}>{cartCount}</Text>
                  </View>
                )}
              </View>
              <Text
                numberOfLines={1}
                style={[tabStyles.lbl, { color: tint }, active && tabStyles.lblActive]}
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

const makeTabStyles = (night: boolean) => StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  pill: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: night ? '#141414' : '#FFFFFF',
    borderRadius: 30,
    paddingVertical: 6,
    paddingHorizontal: 6,
    // floating drop shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: night ? 0.5 : 0.14,
    shadowRadius: 14,
    elevation: 14,
  },
  btn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  iconWrap: {
    width: 24,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lbl: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9.5,
    letterSpacing: -0.1,
    textAlign: 'center',
  },
  lblActive: {
    fontFamily: 'Inter_900Black',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: PINK,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeTxt: { color: '#fff', fontFamily: 'Inter_900Black', fontSize: 9 },
});

const navigationRef = createNavigationContainerRef<any>();

// ─── MAIN TABS ──────────────────────────────────────────────
function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={props => <BrutalTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="HomeTab" component={HomeScreen} />
      {/* freezeOnBlur: suspend Reels' JS render tree while another tab is
          shown — its players are already paused on blur; this stops re-renders
          from reaching the offscreen feed too. Scoped to Reels only. */}
      <Tab.Screen name="ReelsTab" component={ReelsScreen} options={{ freezeOnBlur: true }} />
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
  const { onboarded, setOnboarded, token, authHydrated, night } = useApp();
  const lastBackRef = React.useRef(0);

  // Decide where a new launch goes once the splash is done AND the persisted
  // session/onboarding flags have been read from disk. There's no forced
  // login page any more — guests (onboarded or not) land straight in the app
  // and only get prompted to sign in when they try to buy (see requireAuth
  // in AppState, surfaced via AuthSheet).
  //   • logged in OR already onboarded → straight to the app
  //   • brand new                       → onboarding → app
  useEffect(() => {
    if (phase !== 'splash' || !splashDone || !authHydrated) return;
    setPhase(token || onboarded ? 'main' : 'onboarding');
  }, [phase, splashDone, authHydrated, token, onboarded]);

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

  if (phase === 'splash') {
    return (
      <View style={{ flex: 1 }}>
        <SplashScreen onDone={() => setSplashDone(true)} />
        <NightOverlay />
      </View>
    );
  }
  if (phase === 'onboarding') {
    return (
      <View style={{ flex: 1 }}>
        <OnboardingScreen onDone={() => { setOnboarded(true); setPhase('main'); }} />
        <NightOverlay />
      </View>
    );
  }

  return (
    <ZoomProvider navRef={navigationRef}>
    <View style={{ flex: 1, backgroundColor: night ? '#000' : '#fff' }} key={night ? 'dark' : 'light'}>
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="Tabs" component={MainTabs} />
        {/* Profile moved out of the bottom tabs — still reachable as a pushed
            screen (opened from the Home header). */}
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="CompleteProfile" component={CompleteProfileScreen} options={{ gestureEnabled: false }} />
        <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ presentation: 'transparentModal', animation: 'none', gestureEnabled: false, contentStyle: { backgroundColor: 'transparent' } }} />
            <Stack.Screen name="Search" component={SearchScreen} options={{ animation: 'fade_from_bottom' }} />
            <Stack.Screen name="Category" component={CategoryScreen} />
            <Stack.Screen name="Categories" component={CategoryBrowseScreen} />
        <Stack.Screen name="Cart" component={CartScreen} />
        <Stack.Screen name="Checkout" component={CheckoutScreen} />
        <Stack.Screen name="ReviewOrder" component={ReviewOrderScreen} />
        <Stack.Screen name="OrderSuccess" component={OrderSuccessScreen} options={{ animation: 'fade' }} />
        <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} />
        <Stack.Screen name="OrderHistory" component={OrderHistoryScreen} />
        <Stack.Screen name="DailyReward" component={DailyRewardScreen} />
        <Stack.Screen name="SpinWheel" component={SpinWheelScreen} />
        <Stack.Screen name="StyleQuiz" component={StyleQuizScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="TryOn" component={TryOnScreen} />
        <Stack.Screen name="TryOnPicker" component={TryOnPickerScreen} />
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
        <Stack.Screen name="ForHer" component={ForHerScreen} />
        <Stack.Screen name="ForHim" component={ForHimScreen} />
        <Stack.Screen name="OccasionShopping" component={OccasionShoppingScreen} />
      </Stack.Navigator>
    </NavigationContainer>
    <NightOverlay />
    <BrutalToast />
    <BrutalConfirm />
    <AuthSheet />
    </View>
    </ZoomProvider>
  );
}
