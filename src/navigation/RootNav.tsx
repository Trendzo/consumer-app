import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, LayoutChangeEvent, DeviceEventEmitter, BackHandler, ToastAndroid } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, T, BORDER } from '../theme/brutal';
import { BrutalToast, BrutalConfirm } from '../components/Brutal';
import { useApp } from '../state/AppState';

import SplashScreen from '../screens/SplashScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import { LoginScreen, SignupScreen, EmailLoginScreen } from '../screens/AuthScreens';
import HomeScreen from '../screens/HomeScreen';
import ReelsScreen from '../screens/ReelsScreen';
import CartScreen from '../screens/CartScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ProductDetailScreen from '../screens/ProductDetailScreen';
import SearchScreen from '../screens/SearchScreen';
import CategoryScreen from '../screens/CategoryScreen';
import CheckoutScreen from '../screens/CheckoutScreen';
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

// ─── BOTTOM TAB BAR — Liquid Glass, edge-to-edge ────────────
function BrutalTabBar({ state, navigation }: BottomTabBarProps) {
  const items: { name: string; label: string; icon: any }[] = [
    { name: 'HomeTab', label: 'HOME', icon: 'home' },
    { name: 'ReelsTab', label: 'REELS', icon: 'play' },
    { name: 'CartTab', label: 'BAG', icon: 'shopping-bag' },
    { name: 'ProfileTab', label: 'ME', icon: 'user' },
  ];
  const { cartCount, night, curveProgress } = useApp();
  const insets = useSafeAreaInsets();
  const tabStyles = React.useMemo(() => makeTabStyles(), [night]);

  // ── Venom blob: slides between tabs with stretch/squish, big square pill
  const PILL_W = 72;
  const PILL_H = 64;
  const [innerW, setInnerW] = useState(0);
  const H_PAD = 6;
  const itemW = innerW > 0 ? (innerW - H_PAD * 2) / items.length : 0;

  const tx = useSharedValue(0);
  const sx = useSharedValue(1);
  const sy = useSharedValue(1);

  useEffect(() => {
    if (!itemW) return;
    const target = H_PAD + itemW * state.index + (itemW - PILL_W) / 2;
    sx.value = withSequence(
      withTiming(1.85, { duration: 160 }),
      withSpring(1, { damping: 11, stiffness: 170, mass: 0.9 }),
    );
    sy.value = withSequence(
      withTiming(0.75, { duration: 160 }),
      withSpring(1, { damping: 9, stiffness: 200, mass: 0.8 }),
    );
    tx.value = withSpring(target, { damping: 15, stiffness: 130, mass: 1 });
  }, [state.index, itemW]);

  const blobStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { scaleX: sx.value },
      { scaleY: sy.value },
    ],
    borderRadius: curveProgress.value * (PILL_H / 2),
  }));
  const blobInnerStyle = useAnimatedStyle(() => ({
    borderRadius: curveProgress.value * (PILL_H / 2),
  }));

  return (
    <View style={tabStyles.wrap} pointerEvents="box-none">
      {/* Liquid glass blur layer — iOS-style heavy frost */}
      <BlurView intensity={100} tint={night ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />

      {/* Very faint wash so background colors bleed through more */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: night ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.25)' }]} />

      <View
        style={[tabStyles.inner, { paddingBottom: insets.bottom > 0 ? insets.bottom : 12 }]}
        onLayout={(e: LayoutChangeEvent) => setInnerW(e.nativeEvent.layout.width)}
      >
        {/* ── Venom blob indicator (big square, slides + stretches) ── */}
        {innerW > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              tabStyles.blob,
              { width: PILL_W, height: PILL_H, top: tabStyles.inner.paddingTop - 8 },
              blobStyle,
            ]}
          >
            <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: C.ink }, blobInnerStyle]} />
          </Animated.View>
        )}

        {items.map((it, i) => {
          const active = state.index === i;
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
                <Feather name={it.icon} size={22} color={active ? C.white : C.ink} />
              </View>
              <Text style={[tabStyles.lbl, active && tabStyles.lblActive, active && { color: C.white }]}>{it.label}</Text>
              {it.name === 'CartTab' && cartCount > 0 && (
                <View style={tabStyles.badge}>
                  <Text style={tabStyles.badgeTxt}>{cartCount}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const makeTabStyles = () => StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    // soft drop shadow under the glass
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 12,
  },
  topRule: {
    height: 1,
    backgroundColor: C.ink,
  },
  highlight: {
    position: 'absolute',
    top: 1,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  inner: {
    flexDirection: 'row',
    paddingTop: 8,
    paddingHorizontal: 6,
  },
  blob: {
    position: 'absolute',
    left: 0,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  btn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingVertical: 4,
    marginTop: -6,
    gap: 3,
  },
  iconWrap: {
    width: 36,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconWrapActive: {
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.6)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  iconHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  lbl: {
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 9,
    letterSpacing: 0.5,
    color: C.ink,
  },
  lblActive: {
    color: C.ink,
    fontFamily: 'Inter_900Black',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: '24%',
    minWidth: 16,
    height: 16,
    backgroundColor: C.ink,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.white,
    paddingHorizontal: 3,
  },
  badgeTxt: { color: C.white, fontFamily: 'Inter_900Black', fontSize: 9 },
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
      <Tab.Screen name="ReelsTab" component={ReelsScreen} />
      <Tab.Screen name="CartTab" component={CartScreen} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// ─── ROOT ────────────────────────────────────────────────────
type Phase = 'splash' | 'onboarding' | 'main';

export default function RootNav() {
  const [phase, setPhase] = useState<Phase>('splash');
  const { onboarded, setOnboarded, night } = useApp();
  const lastBackRef = React.useRef(0);

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
        <SplashScreen onDone={() => setPhase(onboarded ? 'main' : 'onboarding')} />
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
    <View style={{ flex: 1, backgroundColor: night ? '#000' : '#fff' }} key={night ? 'dark' : 'light'}>
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="Tabs" component={MainTabs} />
        <Stack.Screen name="Login" component={LoginScreen} options={{ animation: 'fade_from_bottom', presentation: 'fullScreenModal' }} />
        <Stack.Screen
          name="Signup"
          component={SignupScreen}
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.85],
            sheetCornerRadius: 0,
            sheetGrabberVisible: false,
          }}
        />
        <Stack.Screen name="EmailLogin" component={EmailLoginScreen} />
        <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
            <Stack.Screen name="Search" component={SearchScreen} options={{ animation: 'fade_from_bottom' }} />
            <Stack.Screen name="Category" component={CategoryScreen} />
        <Stack.Screen name="Cart" component={CartScreen} />
        <Stack.Screen name="Checkout" component={CheckoutScreen} />
        <Stack.Screen name="OrderSuccess" component={OrderSuccessScreen} options={{ animation: 'fade' }} />
        <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} />
        <Stack.Screen name="OrderHistory" component={OrderHistoryScreen} />
        <Stack.Screen name="DailyReward" component={DailyRewardScreen} />
        <Stack.Screen name="SpinWheel" component={SpinWheelScreen} />
        <Stack.Screen name="StyleQuiz" component={StyleQuizScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="TryOn" component={TryOnScreen} />
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
    </View>
  );
}
