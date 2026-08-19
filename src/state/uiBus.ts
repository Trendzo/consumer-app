// Tiny external stores for high-frequency UI state (toast / confirm).
//
// These used to be useStates inside AppProvider — which meant every toast
// (fired on most taps) handed a brand-new context value to every useApp()
// consumer in the app, re-rendering the ENTIRE mounted tree twice per toast
// (show + auto-hide). Only BrutalToast/BrutalConfirm actually read this
// state, so it lives here instead; they subscribe via useSyncExternalStore
// and nobody else re-renders.

type Listener = () => void;

function makeBus<T>(initial: T) {
  let current = initial;
  const listeners = new Set<Listener>();
  return {
    get: () => current,
    set: (v: T) => {
      current = v;
      listeners.forEach((l) => l());
    },
    subscribe: (l: Listener) => {
      listeners.add(l);
      return () => { listeners.delete(l); };
    },
  };
}

export type ToastData = {
  title: string;
  msg?: string;
  icon?: string;
  action?: { label: string; onPress: () => void };
  /** Screen-bottom offset override. Default 108 clears the tab bar; the PDP
      passes a smaller value so its "Added to bag" toast lands just below the
      floating Try On button instead of colliding with it. */
  bottom?: number;
} | null;

export type ConfirmData = {
  title: string;
  msg?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  danger?: boolean;
  icon?: string;
} | null;

export type AuthSheetData = { onSuccess?: () => void } | null;

export const toastBus = makeBus<ToastData>(null);
export const confirmBus = makeBus<ConfirmData>(null);
export const authBus = makeBus<AuthSheetData>(null);

/**
 * Whether the bottom tab bar is on screen right now.
 *
 * The toast used to sit at a fixed `bottom: 108` — the height that clears the
 * tab bar. On every pushed screen (product, review order, category, try-on)
 * there is no tab bar, so the toast floated with a 108px hole under it. The
 * root navigator writes this on every state change; BrutalToast reads it and
 * pins itself to the bottom edge when there is no bar to clear.
 */
export const tabBarBus = makeBus<boolean>(true);
