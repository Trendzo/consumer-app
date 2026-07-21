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
