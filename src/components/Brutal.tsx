// Reusable brutalism primitives
import React, { ReactNode, useRef, useEffect, useSyncExternalStore } from 'react';
import { View, Text, Pressable, TextInput, StatusBar, StyleSheet, ViewStyle, TextStyle, Animated, Image, Modal, Dimensions, Platform, KeyboardAvoidingView, Keyboard } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { MotiView } from 'moti';
import Reanimated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { C, T, BORDER, SP, HAIRLINE, rf, subscribeTheme, isHer, HELV, HEADER_TOP } from '../theme/brutal';
import { useApp } from '../state/AppState';
import { toastBus, confirmBus } from '../state/uiBus';
import { useZoomCard } from '../navigation/ZoomTransition';

// CachedImage — drop-in `<Image>` replacement backed by expo-image.
// Aggressively caches to memory + disk so product PNGs load once over the
// network, then stay instant for the rest of the session.
/** Neutral fill shown until the real bitmap decodes — a 1x1 grey, expanded by
 *  expo-image. Large heroes used to pop in from nothing; now they resolve out of
 *  a colour, which also stops the layout flashing white on dark art. Callers can
 *  override with their own `placeholder` prop. */
const IMG_PLACEHOLDER = { blurhash: 'L6PZfSjE.AyE_3t7t7R**0o#DgR4' };

export function CachedImage({ source, style, resizeMode = 'contain', ...rest }: any) {
  // A bundled require() is a NUMBER, and most call sites wrap their value in
  // `{ uri: x }` — which silently renders nothing for a local asset. Unwrap that
  // case so either form works and no call site has to care where the image lives.
  const inner = source && typeof source === 'object' && 'uri' in source ? source.uri : source;
  const isBundled = typeof inner === 'number';
  const uri = typeof inner === 'string' ? inner : undefined;
  return (
    <ExpoImage
      source={isBundled ? inner : uri ? { uri } : source}
      style={style}
      contentFit={resizeMode === 'cover' ? 'cover' : resizeMode === 'stretch' ? 'fill' : 'contain'}
      // Only for REMOTE images. Bundled requires decode from local storage fast
      // enough that a placeholder just adds a visible extra step.
      {...(uri && !isBundled ? { placeholder: IMG_PLACEHOLDER, placeholderContentFit: 'cover' as const } : {})}
      cachePolicy="memory-disk"
      // Android: the 200ms fade ran a compositor animation for every image that
      // (re)entered the viewport while scrolling — measurable jank on older
      // phones. Instant swap there; iOS keeps the subtle fade.
      transition={Platform.OS === 'android' ? 0 : 200}
      // Lets expo-image reuse the underlying native view for the same URL
      // instead of tearing it down when lists recycle.
      recyclingKey={uri}
      allowDownscaling
      {...rest}
    />
  );
}

/**
 * Measured keyboard height for MODALS. An RN Modal is its own Android window
 * and never inherits the activity's adjustResize — a KeyboardAvoidingView
 * inside one has nothing to react to. Pad the sheet by this value instead.
 */
export function useKeyboardHeight() {
  const [kb, setKb] = React.useState(0);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => setKb(e.endCoordinates?.height ?? 0));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKb(0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return kb;
}

// Light-mode only — dark status-bar content over the app's white surfaces.
export function BrutalStatusBar() {
  return <StatusBar barStyle="dark-content" />;
}

// ─── BRUTAL CONFIRM — full brand-matching alert modal ─────────
// Replaces native Alert.alert. Centered card with title, optional message,
// and Confirm/Cancel buttons. Slides in from bottom with a soft scale.
export function BrutalConfirm() {
  // Confirm state comes from the uiBus — only THIS component re-renders when
  // a confirm opens/closes, instead of every context consumer in the app.
  const confirm = useSyncExternalStore(confirmBus.subscribe, confirmBus.get);
  const { hideConfirm } = useApp();
  if (!confirm) return null;
  const danger = !!confirm.danger;
  return (
    <Modal transparent visible={!!confirm} animationType="none" statusBarTranslucent onRequestClose={hideConfirm}>
      <Pressable onPress={hideConfirm} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: SP.l }}>
        <MotiView
          from={{ opacity: 0, translateY: 30, scale: 0.94 }}
          animate={{ opacity: 1, translateY: 0, scale: 1 }}
          transition={{ type: 'timing', duration: 240 }}
          onStartShouldSetResponder={() => true}
          style={[{ width: '100%', maxWidth: 400, backgroundColor: '#FFFFFF', overflow: 'hidden' }, BORDER(2)]}
        >
          {/* Header strip */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: SP.m, backgroundColor: C.ink }}>
            <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white }}>
              <Feather name={(confirm.icon as any) || (danger ? 'alert-triangle' : 'info')} size={14} color={C.ink} />
            </View>
            <Text style={[T.h3, { color: C.white, flex: 1 }]}>{confirm.title}</Text>
            <Pressable onPress={hideConfirm} hitSlop={10}>
              <Feather name="x" size={16} color={C.white} />
            </Pressable>
          </View>
          {/* Body */}
          {confirm.msg && (
            <View style={{ padding: SP.l }}>
              <Text style={T.body}>{confirm.msg}</Text>
            </View>
          )}
          {/* Action bar */}
          <View style={{ flexDirection: 'row', borderTopWidth: 1, borderColor: C.hairline }}>
            <Pressable
              onPress={hideConfirm}
              style={{ flex: 1, padding: SP.m, alignItems: 'center', backgroundColor: C.white, borderRightWidth: 1, borderColor: C.hairline }}
            >
              <Text style={[T.button, { color: C.ink, fontSize: rf(14) }]}>{confirm.cancelLabel || 'Cancel'}</Text>
            </Pressable>
            <Pressable
              onPress={() => { confirm.onConfirm?.(); hideConfirm(); }}
              style={{ flex: 1, padding: SP.m, alignItems: 'center', backgroundColor: C.ink }}
            >
              <Text style={[T.button, { color: C.white, fontSize: rf(14) }]}>{confirm.confirmLabel || (danger ? 'Confirm' : 'OK')}</Text>
            </Pressable>
          </View>
        </MotiView>
      </Pressable>
    </Modal>
  );
}

// ─── BRUTAL TOAST — brand-matching inline notification ─────────
// Renders at the bottom of the screen above the tab bar. Global, driven
// by `useApp().showToast('title', 'msg?')`. Auto-dismisses after ~2s.
export function BrutalToast() {
  // Toast state comes from the uiBus — showing/hiding a toast re-renders only
  // this host component (it used to re-render the whole tree, twice).
  const toast = useSyncExternalStore(toastBus.subscribe, toastBus.get);
  const { hideToast } = useApp();
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: toast ? 1 : 0,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [toast]);
  if (!toast) return null;
  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0, right: 0, bottom: toast.bottom ?? 108,
        alignItems: 'center',
        zIndex: 9999,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
        opacity: anim,
      }}
    >
      <View style={[{ flexDirection: 'row', alignItems: 'stretch', backgroundColor: C.ink, maxWidth: '92%', overflow: 'hidden' }, BORDER(1)]}>
        <Pressable onPress={hideToast} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: SP.m, paddingVertical: 10, flex: 1 }}>
          <View style={{ width: 26, height: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white }}>
            <Feather name={(toast.icon as any) || 'check'} size={14} color={C.ink} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[T.bodyB, { color: C.white }]}>{toast.title}</Text>
            {toast.msg && <Text style={[T.micro, { color: C.white, opacity: 0.75, marginTop: 1 }]} numberOfLines={1}>{toast.msg}</Text>}
          </View>
          {!toast.action && <Feather name="x" size={14} color={C.white} />}
        </Pressable>
        {toast.action && (
          <Pressable
            onPress={() => { toast.action!.onPress(); hideToast(); }}
            style={{ paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white, borderLeftWidth: 1, borderColor: C.hairline }}
          >
            <Text style={[T.caption, { color: C.ink, fontFamily: HELV, fontWeight: '600' }]}>{toast.action.label}</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

// Hook used by brutalist cards/buttons to softly round when HER gender is active.
// Reads the shared curveProgress from AppState so dragging the gender switch
// updates every brutalist component in real time.
export function useGenderCurve(maxRadius = 14) {
  // Used by the REUSABLE cards/boxes (ProductCard, BrutalBox, BrutalButton, …) that repeat
  // dozens of times throughout the feed — almost all of them BELOW the fold while the
  // gender bar (which lives at the top) is being dragged. Animating their borderRadius live
  // meant ~40+ off-screen corners re-rasterising every frame for nothing → the drag lag.
  // They settle to the right radius the moment `gender` commits; by the time you scroll to
  // them they're already rounded, so you never see the difference. The on-screen rounding
  // (hero / search / categories, via HomeScreen's curveStyle) still animates live & smooth.
  //
  // The subscription is GONE on purpose. This hook subscribed to the theme store
  // and then returned the literal `{ borderRadius: 0 }` — a constant. Every
  // BrutalButton, BrutalIconBtn and BrutalBox in the tree therefore re-rendered
  // on every gender flip in order to receive a value that never changes. The
  // design settled on sharp corners everywhere, so there is nothing to subscribe
  // to; re-add the subscription if a non-zero radius ever comes back.
  return SHARP;
}

// One frozen object so the identity is stable too — returning a fresh literal
// would still invalidate any downstream memo comparing style props by reference.
const SHARP = Object.freeze({ borderRadius: 0 });

// ─── BRUTAL BOX — curve-aware bordered container ──────────────
// Drop-in replacement for `<View style={[{...}, BORDER(1)]}>`. Applies
// the shared HER-mode radius and clips children so inner borders don't
// poke past rounded corners.
type BrutalBoxProps = {
  children?: ReactNode;
  style?: any;
  maxRadius?: number;
  padded?: boolean;     // apply default SP.l padding
  solid?: boolean;      // black bg instead of white
  border?: number;      // border width (default 1, 0 disables)
  transparent?: boolean;// no background
};
export function BrutalBox({ children, style, maxRadius = 14, padded, solid, border = 1, transparent }: BrutalBoxProps) {
  const curve = useGenderCurve(maxRadius);
  return (
    <Reanimated.View
      style={[
        {
          backgroundColor: transparent ? 'transparent' : solid ? C.ink : C.white,
          overflow: 'hidden',
        },
        border > 0 && { borderWidth: border, borderColor: C.hairline },
        padded && { padding: SP.l },
        curve,
        style,
      ]}
    >
      {children}
    </Reanimated.View>
  );
}

// ─── BUTTON ────────────────────────────────────────────────
type BtnProps = {
  label: string;
  onPress?: () => void;
  variant?: 'solid' | 'outline' | 'ghost';
  icon?: keyof typeof Feather.glyphMap;
  iconRight?: keyof typeof Feather.glyphMap;
  block?: boolean;
  small?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
};
export function BrutalButton({ label, onPress, variant = 'solid', icon, iconRight, block, small, disabled, style }: BtnProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn = () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50 }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50 }).start();
  const isSolid = variant === 'solid';
  const bg = disabled ? C.faint : isSolid ? C.ink : variant === 'ghost' ? 'transparent' : C.white;
  const fg = isSolid ? C.white : C.ink;
  const curveStyle = useGenderCurve(small ? 10 : 14);
  return (
    <Animated.View style={[{ transform: [{ scale }] }, block && { alignSelf: 'stretch' }, style]}>
      <Reanimated.View style={[
        { backgroundColor: bg, overflow: 'hidden' },
        variant !== 'ghost' && BORDER(1),
        curveStyle,
      ]}>
        <Pressable
          disabled={disabled}
          onPressIn={onIn}
          onPressOut={onOut}
          onPress={onPress}
          style={{ paddingHorizontal: small ? SP.m : SP.l, paddingVertical: small ? SP.s : SP.m, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          {icon && <Feather name={icon} size={small ? 14 : 16} color={fg} />}
          <Text style={[small ? { fontFamily: HELV, fontWeight: '600', fontSize: rf(14) } : T.button, { color: fg }]}>
            {label}
          </Text>
          {iconRight && <Feather name={iconRight} size={small ? 14 : 16} color={fg} />}
        </Pressable>
      </Reanimated.View>
    </Animated.View>
  );
}

// ─── ICON BUTTON ───────────────────────────────────────────
export function BrutalIconBtn({ icon, onPress, size = 38, active }: { icon: keyof typeof Feather.glyphMap; onPress?: () => void; size?: number; active?: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;
  const curveStyle = useGenderCurve(size / 2);
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Reanimated.View style={[{ width: size, height: size, backgroundColor: active ? C.ink : C.white, overflow: 'hidden' }, BORDER(1), curveStyle]}>
        <Pressable
          onPressIn={() => Animated.spring(scale, { toValue: 0.92, useNativeDriver: true, speed: 50 }).start()}
          onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50 }).start()}
          onPress={onPress}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <Feather name={icon} size={size * 0.45} color={active ? C.white : C.ink} />
        </Pressable>
      </Reanimated.View>
    </Animated.View>
  );
}

// ─── CARD ──────────────────────────────────────────────────
export function BrutalCard({ children, style, padded = true }: { children: ReactNode; style?: ViewStyle; padded?: boolean }) {
  return <View style={[{ backgroundColor: C.white, padding: padded ? SP.l : 0 }, BORDER(1), style]}>{children}</View>;
}

// ─── INPUT ─────────────────────────────────────────────────
type InputProps = {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  label?: string;
  secureTextEntry?: boolean;
  icon?: keyof typeof Feather.glyphMap;
  keyboardType?: any;
  /** Modern keyboard hint — some Android OEM keyboards honour this over keyboardType. */
  inputMode?: any;
  /** OS autofill hints (Android / iOS respectively). */
  autoComplete?: any;
  textContentType?: any;
  autoCapitalize?: any;
  maxLength?: number;
  autoFocus?: boolean;
  editable?: boolean;
  returnKeyType?: any;
  onSubmitEditing?: () => void;
  error?: string;
  inputStyle?: TextStyle;
};
export function BrutalInput({ value, onChangeText, placeholder, label, secureTextEntry, icon, keyboardType, inputMode, autoComplete, textContentType, autoCapitalize, maxLength, autoFocus, editable = true, returnKeyType, onSubmitEditing, error, inputStyle }: InputProps) {
  return (
    <View style={{ marginBottom: SP.l }}>
      {label && <Text style={[T.caption, { color: C.dim, marginBottom: 6 }]}>{label}</Text>}
      <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: SP.m, paddingVertical: 14, opacity: editable ? 1 : 0.5 }, BORDER(error ? 2 : 1), error ? { borderColor: '#c1121f' } : null]}>
        {icon && <Feather name={icon} size={16} color={C.ink} />}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={C.dim}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          inputMode={inputMode}
          autoComplete={autoComplete}
          textContentType={textContentType}
          autoCapitalize={autoCapitalize}
          maxLength={maxLength}
          autoFocus={autoFocus}
          editable={editable}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          style={[{ flex: 1, fontFamily: HELV, fontWeight: '500', fontSize: rf(14), color: C.ink, padding: 0 }, inputStyle]}
        />
      </View>
      {error ? <Text style={[T.micro, { color: '#c1121f', marginTop: 5 }]}>{error}</Text> : null}
    </View>
  );
}

// ─── SECTION HEAD ─────────────────────────────────────────
export function SectionHead({ title, emphasis, sub, action, onAction, hideCaret, hideBottomDivider }: { title: string; emphasis?: string; sub?: string; action?: string; onAction?: () => void; hideCaret?: boolean; hideBottomDivider?: boolean }) {
  return (
    <View style={{ paddingHorizontal: SP.l, marginTop: SP.xl, marginBottom: SP.m }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={[T.h2, { flex: 1, textTransform: 'uppercase' }]} numberOfLines={1}>
          {title}
          {emphasis && <Text> {emphasis}</Text>}
        </Text>
        {action && (
          // Plain text link — matches Home's "View all ›" pattern, no box/bg.
          <Pressable onPress={onAction} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Text style={[T.caption, { color: C.ink, fontFamily: HELV, fontWeight: '600' }]}>{action}</Text>
            <Feather name="chevron-right" size={15} color={C.ink} />
          </Pressable>
        )}
      </View>
      {sub ? <Text style={[T.caption, { color: C.dim, marginTop: 4 }]}>{sub}</Text> : null}
    </View>
  );
}

// ─── SCREEN HEADER ─────────────────────────────────────────
export function ScreenHeader({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SP.l, paddingTop: HEADER_TOP, paddingBottom: SP.m, backgroundColor: C.white }}>
        {onBack ? <BrutalIconBtn icon="arrow-left" onPress={onBack} size={36} /> : <View style={{ width: 36 }} />}
        <Text style={[T.h3, { color: C.ink, textTransform: 'uppercase' }]}>{title}</Text>
        {right ?? <View style={{ width: 36 }} />}
      </View>
      {/* soft hairline rule (was a hard black brutalist line) */}
      <View style={{ height: 1, backgroundColor: C.hairline }} />
    </View>
  );
}

// ─── ANIMATED LIST ITEM ───────────────────────────────────
export function FadeInUp({ delay = 0, children, style }: { delay?: number; children: ReactNode; style?: ViewStyle }) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 18 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 380, delay }}
      style={style as any}
    >
      {children}
    </MotiView>
  );
}

// ─── GLOBAL PRODUCT CARD — THE one product card ───────────
// Single standard size everywhere a product is shown (home rails, new arrivals,
// category/brand grids, search, detail upsell/grid). Sized off the category
// 2-col grid: two cards + one SP.s gap fill the SP.l-padded screen width.
// Memoized: parents re-render freely (scroll state, filters, data loads)
// without touching dozens of mounted images — key for frame drops.
const CARD_SCREEN_W = Dimensions.get('window').width;
export const CARD = {
  w: Math.floor((CARD_SCREEN_W - SP.l * 2 - SP.s) / 2), // 2-col grid width — the ONE card width
  imgH: 220,                                            // fixed image box height — same for every card
};

/**
 * Shared, STABLE card-spacing styles.
 *
 * `<ProductCard style={{ marginBottom: SP.s }} />` looks harmless but mints a new
 * object every render, which is a new prop identity, which means the React.memo
 * on ProductCard can never skip a re-render. These are hoisted once.
 */
export const CARD_STYLES = StyleSheet.create({
  mb_s: { marginBottom: SP.s },
  mb_m: { marginBottom: SP.m },
  gridCell: { marginBottom: SP.s, width: CARD.w },
  railCell: { width: CARD.w * 0.86 },
});

export const ProductCard = React.memo(function ProductCard({
  p, onPress, brand, rank, zoomParams, onAdd, style, frameStyle, children,
}: {
  p: any;
  // Receives the product, so a call site can hoist ONE stable useCallback
  // instead of minting `() => go(p)` per item. That closure was the single most
  // common reason this React.memo never fired.
  onPress?: (p: any) => void;  // fallback when there's no image to zoom
  brand?: string;              // label override (e.g. store name on brand pages)
  rank?: number;               // 1-based → "#01" badge + giant ghost number (trending/top-rated)
  zoomParams?: any;            // extra route params for ProductDetail (e.g. { brand })
  onAdd?: (p: any) => void;    // renders the "+ ADD" button under the card (upsells)
  style?: any;                 // outer container overrides (margins etc.)
  frameStyle?: any;            // animated/extra styles for the image box (gender curve)
  children?: ReactNode;        // extra overlays inside the image box (stock notes etc.)
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const { ref: imgRef, open } = useZoomCard();
  // Tapping zooms the image into the product page (falls back to onPress if no image).
  // The press-in spring (0.97) is usually still mid-flight when the tap commits, and
  // measureInWindow returns the TRANSFORMED frame — so the zoom measured a shrunken,
  // shifted card and both the open start and the close landing were slightly off.
  // Snap the scale back to 1 first so the card is measured at its true position.
  const handlePress = () => {
    if (p?.img) { scale.stopAnimation(); scale.setValue(1); open(p.img, p, zoomParams); }
    else onPress?.(p);
  };
  const off = p?.original > p?.price ? Math.round((1 - p.price / p.original) * 100) : 0;
  return (
    <Animated.View style={[{ transform: [{ scale }], width: CARD.w }, style]}>
      <Pressable
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50 }).start()}
        onPress={handlePress}
      >
        {/* White canvas, not grey: product shots are photographed on white, so
            the contain-fit letterbox disappears — full image, no crop, no grey bars. */}
        <Reanimated.View ref={imgRef} collapsable={false} style={[{ height: CARD.imgH, overflow: 'hidden', backgroundColor: C.white }, BORDER(1), frameStyle]}>
          {rank != null && (
            <Text style={{ position: 'absolute', top: -15, left: -4, fontFamily: 'Inter_900Black', fontSize: rf(110), color: C.ink, opacity: 0.06 }}>{`0${rank}`}</Text>
          )}
          <CachedImage transition={0} source={{ uri: p.img }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          {/* No tag chips ("BRUNCH", "STREETWEAR", "DATE"…) over the photo —
              they covered every card's top corner. Rank badge stays: it is the
              point of a rating-sorted grid. */}
          {rank != null ? (
            <View style={{ position: 'absolute', top: 8, left: 0, backgroundColor: C.ink, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={[T.micro, { color: C.white, fontFamily: HELV, fontWeight: '700' }]}>{`#0${rank}`}</Text>
            </View>
          ) : null}
          {children}
        </Reanimated.View>
        <View style={{ marginTop: 6 }}>
          <Text style={[T.micro, { fontFamily: HELV, fontWeight: '600', color: C.ink }]} numberOfLines={1}>{(brand ?? p.brand ?? '').toUpperCase()}</Text>
          <Text style={[T.productName, { marginTop: 2 }]} numberOfLines={2}>{p.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 3 }}>
            <Text style={T.price}>₹{p.price}</Text>
            {p.original > p.price && (
              <Text style={T.mrp}>₹{p.original}</Text>
            )}
            {off > 0 && <Text style={T.discount}>{`${off}% OFF`}</Text>}
          </View>
        </View>
      </Pressable>
      {onAdd && (
        <Pressable onPress={() => onAdd(p)} style={[{ marginTop: 6, paddingVertical: 8, alignItems: 'center', backgroundColor: C.white }, BORDER(1)]}>
          <Text style={[T.caption, { color: C.ink, fontFamily: HELV, fontWeight: '600' }]}>+ Add</Text>
        </Pressable>
      )}
    </Animated.View>
  );
});

// ─── CHIP ──────────────────────────────────────────────────
export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={[{ paddingHorizontal: 14, paddingVertical: 8, backgroundColor: active ? C.ink : C.white }, BORDER(1)]}>
      <Text style={[T.caption, { color: active ? C.white : C.ink }]}>{label}</Text>
    </Pressable>
  );
}

// ─── OPTION SHEET — the app-standard bottom sheet ─────────────────────────
// Fade scrim + sheet sliding up (MotiView, 220ms). Two modes:
//  • list mode: pass `options`/`selected`/`onSelect` → single-select rows
//    (selected row = black bg, white bold text, check icon)
//  • custom mode: pass `children` → renders arbitrary content under the
//    header (size grids, comments, payment rows, address forms, …)
export function OptionSheet({ visible, title, options, selected, onSelect, onClose, children }: {
  visible: boolean;
  title: string;
  options?: readonly string[];
  selected?: string;
  onSelect?: (v: string) => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  /**
   * Android: an RN Modal's window doesn't resize for the keyboard and the KAV
   * can't see it — the comments input sat hidden behind the keyboard. Track
   * the keyboard height directly and pad the sheet by it: the sheet stays a
   * full-width white panel STUCK to the bottom (Instagram-style), its content
   * riding above the keyboard.
   */
  const [kb, setKb] = React.useState(0);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => setKb(e.endCoordinates?.height ?? 0));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKb(0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent onRequestClose={onClose}>
      {/* Keyboard-aware: when a sheet contains an input (comments, board name,
          coupon…), the whole sheet rides ABOVE the keyboard instead of the
          fields hiding behind it. */}
      {/* behavior MUST be set on Android too: `undefined` disables the KAV
          entirely, and an RN Modal's window does not reliably adjustResize on
          Android — so the comments input sat hidden behind the keyboard. */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
        {/* scrim — quick fade, tap anywhere to close */}
        <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: 'timing', duration: 180 }} style={StyleSheet.absoluteFillObject}>
          <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} />
        </MotiView>
        {/* sheet — slides UP from the bottom (shutter), never fades */}
        <MotiView
          from={{ translateY: 520 }}
          animate={{ translateY: 0 }}
          transition={{ type: 'timing', duration: 300 }}
        >
          {/* stop taps from falling through to the scrim */}
          <Pressable onPress={() => {}} style={[{ backgroundColor: C.bg, paddingBottom: Platform.OS === 'ios' ? 28 : 16 + kb }, BORDER(1)]}>
            {/* solid fill below the sheet — when the keyboard lifts it, the gap
                underneath stays sheet-white, never a transparent hole */}
            <View pointerEvents="none" style={{ position: 'absolute', top: '100%', left: -1, right: -1, height: 600, backgroundColor: C.bg }} />
            {/* header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SP.l, paddingVertical: SP.m, borderBottomWidth: 1, borderColor: C.hairline }}>
              <Text style={[T.h3, { textTransform: 'uppercase' }]}>{title}</Text>
              <Pressable onPress={onClose} hitSlop={10}>
                <Feather name="x" size={18} color={C.ink} />
              </Pressable>
            </View>
            {children ?? (options ?? []).map((o) => {
              const on = o === selected;
              return (
                <Pressable
                  key={o}
                  onPress={() => onSelect?.(o)}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SP.l, paddingVertical: 14, borderBottomWidth: 1, borderColor: C.hairline, backgroundColor: on ? C.ink : 'transparent' }}
                >
                  <Text style={[T.body, { color: on ? C.white : C.ink, fontFamily: HELV, fontWeight: on ? '700' : '400' }]}>{o}</Text>
                  {on && <Feather name="check" size={16} color={C.white} />}
                </Pressable>
              );
            })}
          </Pressable>
        </MotiView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export const styles = StyleSheet.create({});
