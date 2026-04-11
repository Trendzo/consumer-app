// Lightweight global state — auth, cart, favorites, onboarding flag.
import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { Product } from '../data/mockData';
import { setNight as applyNight } from '../theme/brutal';

type CartItem = Product & { qty: number; size: string };

type AppCtx = {
  // auth
  user: { name: string; email: string } | null;
  signIn: (email: string, name?: string) => void;
  signOut: () => void;
  // onboarding
  onboarded: boolean;
  setOnboarded: (v: boolean) => void;
  // cart
  cart: CartItem[];
  addToCart: (p: Product, size?: string) => void;
  removeFromCart: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  clearCart: () => void;
  cartTotal: number;
  cartCount: number;
  // favorites
  favorites: Product[];
  toggleFavorite: (p: Product) => void;
  isFavorite: (id: string) => boolean;
  // last order
  lastOrder: { id: string; total: number; items: number } | null;
  placeOrder: () => void;
  // night mode
  night: boolean;
  toggleNight: () => void;
};

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppCtx['user']>(null);
  const [onboarded, setOnboarded] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [favorites, setFavorites] = useState<Product[]>([]);
  const [lastOrder, setLastOrder] = useState<AppCtx['lastOrder']>(null);
  const [night, setNight] = useState(false);
  const toggleNight = useCallback(() => {
    setNight(n => {
      const next = !n;
      applyNight(next);
      return next;
    });
  }, []);

  const signIn = useCallback((email: string, name = 'You') => setUser({ email, name }), []);
  const signOut = useCallback(() => setUser(null), []);

  const addToCart = useCallback((p: Product, size = 'M') => {
    setCart(prev => {
      const existing = prev.find(it => it.id === p.id && it.size === size);
      if (existing) return prev.map(it => (it.id === p.id && it.size === size ? { ...it, qty: it.qty + 1 } : it));
      return [...prev, { ...p, qty: 1, size }];
    });
  }, []);
  const removeFromCart = useCallback((id: string) => setCart(prev => prev.filter(it => it.id !== id)), []);
  const updateQty = useCallback((id: string, qty: number) => {
    setCart(prev => prev.map(it => (it.id === id ? { ...it, qty: Math.max(1, qty) } : it)));
  }, []);
  const clearCart = useCallback(() => setCart([]), []);

  const toggleFavorite = useCallback((p: Product) => {
    setFavorites(prev => (prev.find(f => f.id === p.id) ? prev.filter(f => f.id !== p.id) : [...prev, p]));
  }, []);
  const isFavorite = useCallback((id: string) => favorites.some(f => f.id === id), [favorites]);

  const placeOrder = useCallback(() => {
    const total = cart.reduce((s, it) => s + it.price * it.qty, 0);
    const items = cart.reduce((s, it) => s + it.qty, 0);
    setLastOrder({ id: 'CX' + Math.floor(Math.random() * 90000 + 10000), total, items });
    setCart([]);
  }, [cart]);

  const cartTotal = useMemo(() => cart.reduce((s, it) => s + it.price * it.qty, 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((s, it) => s + it.qty, 0), [cart]);

  return (
    <Ctx.Provider value={{ user, signIn, signOut, onboarded, setOnboarded, cart, addToCart, removeFromCart, updateQty, clearCart, cartTotal, cartCount, favorites, toggleFavorite, isFavorite, lastOrder, placeOrder, night, toggleNight }}>
      {children}
    </Ctx.Provider>
  );
}

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useApp must be inside AppProvider');
  return c;
}
