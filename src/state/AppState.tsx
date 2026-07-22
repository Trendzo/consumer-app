// Lightweight global state — auth, cart, favorites, onboarding flag.
import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useSharedValue, withSpring, SharedValue } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GENDER_KEY = '@closetx/gender';
import { Product } from '../data/mockData';
import { setNight as applyNight, setGenderCurve, subscribeTheme, LIGHT, DARK, Palette } from '../theme/brutal';
import { toastBus, confirmBus, authBus, ConfirmData } from './uiBus';
import { setAuthToken } from '../services/api';
import type { Session, Consumer } from '../services/auth';
import { getServerCart, putServerCart } from '../services/cart';
import { priceCart } from '../services/pricing';

const TOKEN_KEY = '@closetx/token';
const USER_KEY = '@closetx/user';
const ONBOARDED_KEY = '@closetx/onboarded';

export type DeliveryMethod = 'express' | 'standard' | 'pickup';
type CartItem = Product & { qty: number; size: string; method: DeliveryMethod; variantId?: string };

type AppCtx = {
  // auth
  user: { id?: string; name: string; email: string; phone?: string; address?: string; referralCode?: string; genderPreference?: 'her' | 'him' | 'unisex' | null; profileComplete?: boolean } | null;
  signIn: (email: string, name?: string) => void;
  signOut: () => void;
  updateUser: (patch: Partial<{ name: string; email: string; phone: string; address: string }>) => void;
  // real backend session (phone-OTP). token is the JWT sent as Bearer on API calls.
  token: string | null;
  signInWithSession: (session: Session) => Promise<void>;
  applyConsumer: (consumer: Consumer) => Promise<void>;
  // true once the persisted session (if any) has been read from disk
  authHydrated: boolean;
  // onboarding
  onboarded: boolean;
  setOnboarded: (v: boolean) => void;
  // cart
  cart: CartItem[];
  addToCart: (p: Product, size?: string, method?: DeliveryMethod, variantId?: string) => void;
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
  placeOrder: (info?: { method?: 'express' | 'standard' | 'pickup' | 'tryandbuy'; store?: { id: string; name: string; addr: string; eta: string; slot?: string; code?: string } | null; id?: string; total?: number; items?: number }) => void;
  // night mode
  night: boolean;
  toggleNight: () => void;
  // Reactive palette — use this in root backgrounds / critical styles for
  // guaranteed re-render on theme toggle (the legacy `C` object in brutal.ts
  // works for inline-styled children but can miss re-renders in deep trees).
  theme: Palette;
  // Brutalist toast — message shown at bottom of screen (matches UI, not system Alert).
  // Toast/confirm STATE lives in uiBus (read only by BrutalToast/BrutalConfirm)
  // so showing one doesn't re-render every context consumer in the app.
  showToast: (title: string, msg?: string, icon?: string, action?: { label: string; onPress: () => void }) => void;
  hideToast: () => void;
  // Brutalist confirm modal — for destructive / consequential actions
  showConfirm: (opts: NonNullable<ConfirmData>) => void;
  hideConfirm: () => void;
  // Bottom-sheet phone-OTP login — used to gate "buy" actions (checkout,
  // place order) for guests instead of a dedicated login page. Already
  // signed in → runs onSuccess immediately and returns true; otherwise opens
  // the sheet (onSuccess fires once sign-in succeeds) and returns false.
  requireAuth: (onSuccess?: () => void) => boolean;
  hideAuthSheet: () => void;
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
  const [token, setTokenState] = useState<string | null>(null);
  const [authHydrated, setAuthHydrated] = useState(false);
  const [onboarded, setOnboardedState] = useState(false);
  // Persist the onboarding flag so a returning user never sees onboarding
  // again — it's meant for brand-new users only.
  const setOnboarded = useCallback((v: boolean) => {
    setOnboardedState(v);
    AsyncStorage.setItem(ONBOARDED_KEY, v ? '1' : '0').catch(() => {});
  }, []);
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

  // NOTE: the old ~150-URL catalog prefetch that lived here fired during
  // splash/onboarding/login and starved those screens of CPU/bandwidth.
  // It moved to services/prefetch.ts and now runs after Home first gains
  // focus (see HomeScreen).
  // Hydrate the persisted session (token + consumer) once on cold start so the
  // user stays signed in across launches. setAuthToken makes the token visible
  // to the fetch client (services/api.ts) for Bearer auth.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [t, u, ob] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(USER_KEY),
          AsyncStorage.getItem(ONBOARDED_KEY),
        ]);
        if (cancelled) return;
        if (ob === '1') setOnboardedState(true);
        if (t) {
          setAuthToken(t);
          setTokenState(t);
          if (u) { try { setUser(JSON.parse(u)); } catch { /* ignore corrupt cache */ } }
        }
      } finally {
        if (!cancelled) setAuthHydrated(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const [gender, setGenderRaw] = useState<'her' | 'him'>('him');
  // Toast/confirm write to the uiBus — NOT provider state — so firing one
  // re-renders only the toast/confirm hosts, not every useApp() consumer.
  const toastTimer = React.useRef<any>(null);
  const showToast = useCallback<AppCtx['showToast']>((title, msg, icon, action) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastBus.set({ title, msg, icon, action });
    // Actionable toasts linger longer so the user has time to hit the button
    toastTimer.current = setTimeout(() => toastBus.set(null), action ? 3600 : 2200);
  }, []);
  const hideToast = useCallback(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastBus.set(null);
  }, []);
  const showConfirm = useCallback((opts: NonNullable<ConfirmData>) => {
    confirmBus.set(opts);
  }, []);
  const hideConfirm = useCallback(() => confirmBus.set(null), []);
  const hideAuthSheet = useCallback(() => authBus.set(null), []);
  const requireAuth = useCallback((onSuccess?: () => void) => {
    if (token) { onSuccess?.(); return true; }
    authBus.set({ onSuccess });
    return false;
  }, [token]);
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
      damping: 26, stiffness: 500, mass: 0.5, overshootClamping: false,
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

  // Legacy in-memory sign-in used by the mock email/password + social screens.
  // No token, no persistence — kept because the backend doesn't serve those paths.
  const signIn = useCallback((email: string, name = 'You') => setUser({ email, name }), []);

  // Map a backend Consumer onto the app's `user` shape. name/email may be null
  // until the profile is completed, so fall back to sensible placeholders.
  const consumerToUser = (c: Consumer): NonNullable<AppCtx['user']> => ({
    id: c.id,
    name: c.name || 'You',
    email: c.email || '',
    phone: c.phone,
    referralCode: c.referralCode || undefined,
    genderPreference: c.genderPreference,
    profileComplete: c.profileComplete,
  });

  // Real phone-OTP login: persist token + consumer and expose the token to the
  // fetch client for Bearer auth.
  const signInWithSession = useCallback(async (session: Session) => {
    const u = consumerToUser(session.consumer);
    setAuthToken(session.token);
    setTokenState(session.token);
    setUser(u);
    await Promise.all([
      AsyncStorage.setItem(TOKEN_KEY, session.token),
      AsyncStorage.setItem(USER_KEY, JSON.stringify(u)),
    ]).catch(() => {});
  }, []);

  // Refresh the persisted user after a profile update (PATCH /me).
  const applyConsumer = useCallback(async (c: Consumer) => {
    const u = consumerToUser(c);
    setUser(u);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(u)).catch(() => {});
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
    setTokenState(null);
    setAuthToken(null);
    AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]).catch(() => {});
  }, []);
  const updateUser = useCallback((patch: Partial<{ name: string; email: string; phone: string; address: string }>) =>
    setUser(u => {
      const next = { name: 'You', email: 'guest@trendzo.app', ...(u || {}), ...patch };
      // Keep the persisted copy in sync when there's an authenticated session.
      AsyncStorage.getItem(TOKEN_KEY).then(t => { if (t) AsyncStorage.setItem(USER_KEY, JSON.stringify(next)); }).catch(() => {});
      return next;
    }), []);

  const addToCart = useCallback((p: Product, size = 'M', method: DeliveryMethod = 'express', variantId?: string) => {
    setCart(prev => {
      // Merge when it's the same delivery method AND (same variant if we have a variant id,
      // otherwise same product + size). Keeps separate lines for different sizes/variants.
      const sameLine = (it: CartItem) =>
        it.method === method && (variantId ? it.variantId === variantId : (it.id === p.id && it.size === size));
      if (prev.some(sameLine)) return prev.map(it => (sameLine(it) ? { ...it, qty: it.qty + 1 } : it));
      return [...prev, { ...p, qty: 1, size, method, variantId }];
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

  // ── Server cart sync (logged-in only) ─────────────────────────────────────────
  // The local cart stays UI-authoritative; the server is a cross-device mirror. On
  // login we push a guest cart up (it wins) or, if the local cart is empty, rebuild
  // it from the server (display data re-resolved via /pricing/cart). Every change is
  // debounce-synced. All failures are swallowed (offline / guest safe).
  const cartRef = useRef(cart);
  useEffect(() => { cartRef.current = cart; }, [cart]);
  const cartHydratedRef = useRef(false);
  const skipCartSyncRef = useRef(false);
  useEffect(() => {
    if (!authHydrated) return;
    if (!token) { cartHydratedRef.current = false; return; }
    if (cartHydratedRef.current) return;
    cartHydratedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const localItems = cartRef.current
          .filter(it => it.variantId)
          .map(it => ({ variantId: it.variantId as string, qty: it.qty }));
        if (localItems.length > 0) {
          await putServerCart(localItems); // guest cart survives login (local wins)
          return;
        }
        const server = await getServerCart();
        if (cancelled || !server.items?.length) return;
        const priced = await priceCart(server.items);
        const rebuilt: CartItem[] = priced.stores.flatMap(s => s.lines.map(l => ({
          id: l.listingId, brand: '', name: l.name,
          price: Math.round(l.unitPricePaise / 100), original: Math.round(l.unitPricePaise / 100),
          rating: 0, colors: ['#eeeeee', '#e5e5e5'] as [string, string],
          img: l.imageUrl ?? '', category: '',
          qty: l.qty, size: l.attributesLabel || '', method: 'express' as DeliveryMethod, variantId: l.variantId,
        })));
        if (!cancelled && rebuilt.length) { skipCartSyncRef.current = true; setCart(rebuilt); }
      } catch { /* offline / not authed — keep the local cart */ }
    })();
    return () => { cancelled = true; };
  }, [token, authHydrated]);
  useEffect(() => {
    if (!token || !cartHydratedRef.current) return;
    if (skipCartSyncRef.current) { skipCartSyncRef.current = false; return; }
    const items = cart.filter(it => it.variantId).map(it => ({ variantId: it.variantId as string, qty: it.qty }));
    const t = setTimeout(() => { putServerCart(items).catch(() => {}); }, 500);
    return () => clearTimeout(t);
  }, [cart, token]);

  const toggleFavorite = useCallback((p: Product) => {
    setFavorites(prev => (prev.find(f => f.id === p.id) ? prev.filter(f => f.id !== p.id) : [...prev, p]));
  }, []);
  const isFavorite = useCallback((id: string) => favorites.some(f => f.id === id), [favorites]);

  const placeOrder = useCallback((info?: { method?: 'express' | 'standard' | 'pickup' | 'tryandbuy'; store?: { id: string; name: string; addr: string; eta: string; slot?: string; code?: string } | null; id?: string; total?: number; items?: number }) => {
    // Real order id/total come from the backend when available; fall back to a local
    // synthesised order for the mock (guest) path so the success/tracking UI still works.
    const total = info?.total ?? cart.reduce((s, it) => s + it.price * it.qty, 0);
    const items = info?.items ?? cart.reduce((s, it) => s + it.qty, 0);
    setLastOrder({
      id: info?.id ?? ('CX' + Math.floor(Math.random() * 90000 + 10000)),
      total,
      items,
      method: info?.method || 'express',
      store: info?.store || null,
    });
    setCart([]);
  }, [cart]);

  const cartTotal = useMemo(() => cart.reduce((s, it) => s + it.price * it.qty, 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((s, it) => s + it.qty, 0), [cart]);

  // Memoized so the provider re-rendering (e.g. the themeNonce bump) without a
  // REAL data change hands consumers the identical value and nothing cascades.
  // Everything not listed in deps is a stable useCallback/ref/SharedValue.
  const value = useMemo<AppCtx>(() => ({
    user, signIn, signOut, updateUser, token, signInWithSession, applyConsumer,
    authHydrated, onboarded, setOnboarded,
    cart, addToCart, removeFromCart, updateQty, updateMethod, clearCart, cartTotal, cartCount,
    favorites, toggleFavorite, isFavorite,
    lastOrder, placeOrder,
    night, toggleNight, gender, setGender, setGenderFromDrag, curveProgress,
    theme: night ? DARK : LIGHT,
    showToast, hideToast, showConfirm, hideConfirm, requireAuth, hideAuthSheet,
  }), [
    user, token, authHydrated, onboarded,
    cart, cartTotal, cartCount,
    favorites, isFavorite,
    lastOrder, placeOrder,
    night, gender,
    // stable references, listed for lint-completeness:
    signIn, signOut, updateUser, signInWithSession, applyConsumer, setOnboarded,
    addToCart, removeFromCart, updateQty, updateMethod, clearCart, toggleFavorite,
    toggleNight, setGender, setGenderFromDrag, curveProgress,
    showToast, hideToast, showConfirm, hideConfirm, requireAuth, hideAuthSheet,
  ]);

  return (
    <Ctx.Provider value={value}>
      {children}
    </Ctx.Provider>
  );
}

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useApp must be inside AppProvider');
  return c;
}
