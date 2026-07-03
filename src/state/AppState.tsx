// Lightweight global state — auth, cart, favorites, onboarding flag.
import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useSharedValue, withSpring, SharedValue } from 'react-native-reanimated';
import { Image as ExpoImage } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GENDER_KEY = '@closetx/gender';
import {
  Product, PRODUCTS, CATEGORIES, BRANDS, OCCASIONS, BUNDLES, COMMUNITY, REELS,
  HER_PRODUCTS, HIM_PRODUCTS, HER_CATEGORIES, HIM_CATEGORIES,
  HER_BUNDLES, HIM_BUNDLES, HER_OCCASIONS, HIM_OCCASIONS, HER_HERO, HIM_HERO,
  HERO_IMG, HERO_IMG_2, COUPON_IMG,
} from '../data/mockData';
import { setNight as applyNight, setGenderCurve, subscribeTheme, LIGHT, DARK, Palette } from '../theme/brutal';

export type DeliveryMethod = 'express' | 'standard' | 'pickup';
type CartItem = Product & { qty: number; size: string; method: DeliveryMethod };

type AppCtx = {
  // auth
  user: { name: string; email: string; phone?: string; address?: string } | null;
  signIn: (email: string, name?: string) => void;
  signOut: () => void;
  updateUser: (patch: Partial<{ name: string; email: string; phone: string; address: string }>) => void;
  // onboarding
  onboarded: boolean;
  setOnboarded: (v: boolean) => void;
  // cart
  cart: CartItem[];
  addToCart: (p: Product, size?: string, method?: DeliveryMethod) => void;
  removeFromCart: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  updateMethod: (id: string, method: DeliveryMethod) => void;
  clearCart: () => void;
  cartTotal: number;
  cartCount: number;
  // favorites
  favorites: Product[];
  toggleFavorite: (p: Product) => void;
  isFavorite: (id: string) => boolean;
  // last order
  lastOrder: { id: string; total: number; items: number; method?: 'express' | 'standard' | 'pickup' | 'tryandbuy'; store?: { id: string; name: string; addr: string; eta: string; slot?: string; code?: string } | null } | null;
  placeOrder: (info?: { method?: 'express' | 'standard' | 'pickup' | 'tryandbuy'; store?: { id: string; name: string; addr: string; eta: string; slot?: string; code?: string } | null }) => void;
  // night mode
  night: boolean;
  toggleNight: () => void;
  // Reactive palette — use this in root backgrounds / critical styles for
  // guaranteed re-render on theme toggle (the legacy `C` object in brutal.ts
  // works for inline-styled children but can miss re-renders in deep trees).
  theme: Palette;
  // Brutalist toast — message shown at bottom of screen (matches UI, not system Alert).
  toast: { title: string; msg?: string; icon?: string; action?: { label: string; onPress: () => void } } | null;
  showToast: (title: string, msg?: string, icon?: string, action?: { label: string; onPress: () => void }) => void;
  hideToast: () => void;
  // Brutalist confirm modal — for destructive / consequential actions
  confirm: { title: string; msg?: string; confirmLabel?: string; cancelLabel?: string; onConfirm?: () => void; danger?: boolean; icon?: string } | null;
  showConfirm: (opts: { title: string; msg?: string; confirmLabel?: string; cancelLabel?: string; onConfirm?: () => void; danger?: boolean; icon?: string }) => void;
  hideConfirm: () => void;
  // gender switch — drives the curve-vs-sharp UI transformation
  gender: 'her' | 'him';
  setGender: (g: 'her' | 'him') => void;
  // Same as setGender, but tells the context that the caller (the drag gesture)
  // already animated curveProgress — so the sync effect skips its spring.
  setGenderFromDrag: (g: 'her' | 'him') => void;
  // Continuous 0→1 curve progress, shared across every component.
  // 0 = HIM (sharp brutalist), 1 = HER (soft rounded). Drag in GenderSwitch
  // updates this in real time so the whole UI morphs with the gesture.
  curveProgress: SharedValue<number>;
};

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppCtx['user']>(null);
  const [onboarded, setOnboarded] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [favorites, setFavorites] = useState<Product[]>([]);
  const [lastOrder, setLastOrder] = useState<AppCtx['lastOrder']>(null);
  const [night, setNight] = useState(false);
  // Nonce bumps on every palette mutation so every component that reads
  // from AppState is forced to re-render and re-pull C values.
  const [, setThemeNonce] = useState(0);
  useEffect(() => {
    const unsub = subscribeTheme(() => setThemeNonce(n => n + 1));
    return unsub;
  }, []);

  // Warm the disk cache for every product/category PNG on app start so the
  // product cards render instantly on first scroll.
  useEffect(() => {
    const urls = [
      HERO_IMG, HERO_IMG_2, COUPON_IMG, HER_HERO, HIM_HERO,
      ...PRODUCTS.map(p => p.img),
      ...HER_PRODUCTS.map(p => p.img),
      ...HIM_PRODUCTS.map(p => p.img),
      ...CATEGORIES.map(c => c.img),
      ...HER_CATEGORIES.map(c => c.img),
      ...HIM_CATEGORIES.map(c => c.img),
      ...BRANDS.map(b => b.logo),
      ...OCCASIONS.map(o => o.img),
      ...BUNDLES.map(b => b.img),
      ...HER_BUNDLES.map(b => b.img),
      ...HIM_BUNDLES.map(b => b.img),
      ...HER_OCCASIONS.map(o => o.img),
      ...HIM_OCCASIONS.map(o => o.img),
      ...COMMUNITY.map(c => c.img),
      ...REELS.map(r => r.img),
    ].filter(Boolean);
    ExpoImage.prefetch(urls, 'memory-disk').catch(() => { /* ignore */ });
  }, []);
  const [gender, setGenderRaw] = useState<'her' | 'him'>('him');
  const [toast, setToast] = useState<AppCtx['toast']>(null);
  const toastTimer = React.useRef<any>(null);
  const showToast = useCallback<AppCtx['showToast']>((title, msg, icon, action) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ title, msg, icon, action });
    // Actionable toasts linger longer so the user has time to hit the button
    toastTimer.current = setTimeout(() => setToast(null), action ? 3600 : 2200);
  }, []);
  const hideToast = useCallback(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(null);
  }, []);
  const [confirm, setConfirm] = useState<AppCtx['confirm']>(null);
  const showConfirm = useCallback((opts: { title: string; msg?: string; confirmLabel?: string; cancelLabel?: string; onConfirm?: () => void; danger?: boolean; icon?: string }) => {
    setConfirm(opts);
  }, []);
  const hideConfirm = useCallback(() => setConfirm(null), []);
  const curveProgress = useSharedValue(0);
  // When the GenderSwitch drag settles (or hydration restores a saved value),
  // the caller updates curveProgress itself and flips this flag so the effect
  // below skips re-animating — otherwise two animations race to the same
  // target and the transition jitters.
  const skipNextCurveSpring = useRef(false);
  useEffect(() => {
    setGenderCurve(gender === 'her');
    if (skipNextCurveSpring.current) {
      skipNextCurveSpring.current = false;
      return;
    }
    curveProgress.value = withSpring(gender === 'her' ? 1 : 0, {
      damping: 22, stiffness: 180, mass: 0.7, overshootClamping: false,
    });
  }, [gender]);

  // Persist gender — hydrate once on mount, write on every change.
  const hydratedGender = useRef(false);
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(GENDER_KEY).then(v => {
      if (cancelled) return;
      if ((v === 'her' || v === 'him') && v !== gender) {
        // Jump curveProgress directly and skip the spring in the gender
        // effect so the restore is instant — no opening animation on cold
        // start. Only arm the skip flag when state is actually changing,
        // otherwise the flag leaks and swallows the next real spring.
        skipNextCurveSpring.current = true;
        curveProgress.value = v === 'her' ? 1 : 0;
        setGenderRaw(v);
      }
      hydratedGender.current = true;
    }).catch(() => { hydratedGender.current = true; });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!hydratedGender.current) return;
    AsyncStorage.setItem(GENDER_KEY, gender).catch(() => {});
  }, [gender]);

  const setGender = useCallback((g: 'her' | 'him') => {
    setGenderRaw(g);
  }, []);
  const setGenderFromDrag = useCallback((g: 'her' | 'him') => {
    // Only arm the skip flag when the state actually changes — otherwise
    // setGenderRaw is a no-op, the effect doesn't run, and the flag leaks
    // into the next real change and silently swallows that spring.
    setGenderRaw(prev => {
      if (prev !== g) skipNextCurveSpring.current = true;
      return g;
    });
  }, []);
  const toggleNight = useCallback(() => {
    setNight(n => {
      const next = !n;
      applyNight(next);
      return next;
    });
  }, []);

  const signIn = useCallback((email: string, name = 'You') => setUser({ email, name }), []);
  const signOut = useCallback(() => setUser(null), []);
  const updateUser = useCallback((patch: Partial<{ name: string; email: string; phone: string; address: string }>) =>
    setUser(u => ({ name: 'You', email: 'guest@trendzo.app', ...(u || {}), ...patch })), []);

  const addToCart = useCallback((p: Product, size = 'M', method: DeliveryMethod = 'express') => {
    setCart(prev => {
      // Merge only when same product + same size + same delivery method (otherwise keep separate lines)
      const existing = prev.find(it => it.id === p.id && it.size === size && it.method === method);
      if (existing) return prev.map(it => (it.id === p.id && it.size === size && it.method === method ? { ...it, qty: it.qty + 1 } : it));
      return [...prev, { ...p, qty: 1, size, method }];
    });
  }, []);
  const removeFromCart = useCallback((id: string) => setCart(prev => prev.filter(it => it.id !== id)), []);
  const updateQty = useCallback((id: string, qty: number) => {
    setCart(prev => prev.map(it => (it.id === id ? { ...it, qty: Math.max(1, qty) } : it)));
  }, []);
  const updateMethod = useCallback((id: string, method: DeliveryMethod) => {
    setCart(prev => prev.map(it => (it.id === id ? { ...it, method } : it)));
  }, []);
  const clearCart = useCallback(() => setCart([]), []);

  const toggleFavorite = useCallback((p: Product) => {
    setFavorites(prev => (prev.find(f => f.id === p.id) ? prev.filter(f => f.id !== p.id) : [...prev, p]));
  }, []);
  const isFavorite = useCallback((id: string) => favorites.some(f => f.id === id), [favorites]);

  const placeOrder = useCallback((info?: { method?: 'express' | 'standard' | 'pickup' | 'tryandbuy'; store?: { id: string; name: string; addr: string; eta: string } | null }) => {
    const total = cart.reduce((s, it) => s + it.price * it.qty, 0);
    const items = cart.reduce((s, it) => s + it.qty, 0);
    setLastOrder({
      id: 'CX' + Math.floor(Math.random() * 90000 + 10000),
      total,
      items,
      method: info?.method || 'express',
      store: info?.store || null,
    });
    setCart([]);
  }, [cart]);

  const cartTotal = useMemo(() => cart.reduce((s, it) => s + it.price * it.qty, 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((s, it) => s + it.qty, 0), [cart]);

  return (
    <Ctx.Provider value={{ user, signIn, signOut, updateUser, onboarded, setOnboarded, cart, addToCart, removeFromCart, updateQty, updateMethod, clearCart, cartTotal, cartCount, favorites, toggleFavorite, isFavorite, lastOrder, placeOrder, night, toggleNight, gender, setGender, setGenderFromDrag, curveProgress, theme: night ? DARK : LIGHT, toast, showToast, hideToast, confirm, showConfirm, hideConfirm }}>
      {children}
    </Ctx.Provider>
  );
}

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useApp must be inside AppProvider');
  return c;
}
