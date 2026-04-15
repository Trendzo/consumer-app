// Reusable brutalism primitives
import React, { ReactNode, useRef, useEffect } from 'react';
import { View, Text, Pressable, TextInput, StatusBar, StyleSheet, ViewStyle, TextStyle, Animated, Image, Modal } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { MotiView } from 'moti';
import Reanimated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { C, T, BORDER, SP, ASCII, HAIRLINE } from '../theme/brutal';
import { useApp } from '../state/AppState';

// CachedImage — drop-in `<Image>` replacement backed by expo-image.
// Aggressively caches to memory + disk so product PNGs load once over the
// network, then stay instant for the rest of the session.
export function CachedImage({ source, style, resizeMode = 'contain', ...rest }: any) {
  const uri = typeof source === 'string' ? source : source?.uri;
  return (
    <ExpoImage
      source={uri ? { uri } : source}
      style={style}
      contentFit={resizeMode === 'cover' ? 'cover' : resizeMode === 'stretch' ? 'fill' : 'contain'}
      cachePolicy="memory-disk"
      transition={200}
      {...rest}
    />
  );
}

// Theme-aware status bar — flips barStyle when night mode toggles.
export function BrutalStatusBar() {
  const { night } = useApp();
  return <StatusBar barStyle={night ? 'light-content' : 'dark-content'} />;
}

// ─── BRUTAL CONFIRM — full brand-matching alert modal ─────────
// Replaces native Alert.alert. Centered card with title, optional message,
// and Confirm/Cancel buttons. Slides in from bottom with a soft scale.
export function BrutalConfirm() {
  const { confirm, hideConfirm, night } = useApp();
  if (!confirm) return null;
  const danger = !!confirm.danger;
  return (
    <Modal transparent visible={!!confirm} animationType="none" onRequestClose={hideConfirm}>
      <Pressable onPress={hideConfirm} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: SP.l }}>
        <MotiView
          from={{ opacity: 0, translateY: 30, scale: 0.94 }}
          animate={{ opacity: 1, translateY: 0, scale: 1 }}
          transition={{ type: 'timing', duration: 240 }}
          onStartShouldSetResponder={() => true}
          style={[{ width: '100%', maxWidth: 400, backgroundColor: night ? '#0a0a0a' : '#FFFFFF', overflow: 'hidden' }, BORDER(2)]}
        >
          {/* Header strip */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: SP.m, backgroundColor: C.ink }}>
            <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white }}>
              <Feather name={(confirm.icon as any) || (danger ? 'alert-triangle' : 'info')} size={14} color={C.ink} />
            </View>
            <Text style={{ fontFamily: 'Inter_900Black', fontSize: 12, color: C.white, letterSpacing: 1, flex: 1 }}>{confirm.title.toUpperCase()}</Text>
            <Pressable onPress={hideConfirm} hitSlop={10}>
              <Feather name="x" size={16} color={C.white} />
            </Pressable>
          </View>
          {/* Body */}
          {confirm.msg && (
            <View style={{ padding: SP.l }}>
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: C.ink, lineHeight: 19 }}>{confirm.msg}</Text>
            </View>
          )}
          {/* Action bar */}
          <View style={{ flexDirection: 'row', borderTopWidth: 1, borderColor: C.ink }}>
            <Pressable
              onPress={hideConfirm}
              style={{ flex: 1, padding: SP.m, alignItems: 'center', backgroundColor: night ? '#0a0a0a' : C.white, borderRightWidth: 1, borderColor: C.ink }}
            >
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 12, color: C.ink, letterSpacing: 0.5 }}>{(confirm.cancelLabel || 'CANCEL').toUpperCase()}</Text>
            </Pressable>
            <Pressable
              onPress={() => { confirm.onConfirm?.(); hideConfirm(); }}
              style={{ flex: 1, padding: SP.m, alignItems: 'center', backgroundColor: C.ink }}
            >
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 12, color: C.white, letterSpacing: 0.5 }}>{(confirm.confirmLabel || (danger ? 'CONFIRM' : 'OK')).toUpperCase()}</Text>
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
  const { toast, hideToast } = useApp();
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
        left: 0, right: 0, bottom: 108,
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
            <Text style={{ fontFamily: 'Inter_900Black', fontSize: 12, color: C.white, letterSpacing: 0.5 }}>{toast.title.toUpperCase()}</Text>
            {toast.msg && <Text style={{ fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: C.white, opacity: 0.75, marginTop: 1 }} numberOfLines={1}>{toast.msg}</Text>}
          </View>
          {!toast.action && <Feather name="x" size={14} color={C.white} />}
        </Pressable>
        {toast.action && (
          <Pressable
            onPress={() => { toast.action!.onPress(); hideToast(); }}
            style={{ paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white, borderLeftWidth: 1, borderColor: C.ink }}
          >
            <Text style={{ fontFamily: 'Inter_900Black', fontSize: 11, color: C.ink, letterSpacing: 0.6 }}>{toast.action.label.toUpperCase()}</Text>
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
  const { curveProgress } = useApp();
  return useAnimatedStyle(() => ({ borderRadius: curveProgress.value * maxRadius }));
}

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
        border > 0 && { borderWidth: border, borderColor: C.ink },
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
          <Text style={{ fontFamily: 'Inter_900Black', fontSize: small ? 11 : 13, color: fg, letterSpacing: 0.5 }}>
            {label.toUpperCase()}
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
  autoCapitalize?: any;
};
export function BrutalInput({ value, onChangeText, placeholder, label, secureTextEntry, icon, keyboardType, autoCapitalize }: InputProps) {
  return (
    <View style={{ marginBottom: SP.l }}>
      {label && <Text style={[T.label, { marginBottom: 6 }]}>{`> ${label.toUpperCase()}`}</Text>}
      <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: SP.m, paddingVertical: 14 }, BORDER(1)]}>
        {icon && <Feather name={icon} size={16} color={C.ink} />}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={C.dim}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          style={{ flex: 1, fontFamily: 'Inter_500Medium', fontSize: 14, color: C.ink, padding: 0 }}
        />
      </View>
    </View>
  );
}

// ─── ASCII DIVIDER ────────────────────────────────────────
export function AsciiDivider({ faint, style }: { faint?: boolean; style?: TextStyle }) {
  return <Text numberOfLines={1} style={[{ fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: faint ? C.dim : C.ink }, style]}>{faint ? ASCII.hrFaint : ASCII.hr}</Text>;
}

// ─── SECTION HEAD ─────────────────────────────────────────
export function SectionHead({ title, emphasis, action, onAction }: { title: string; emphasis?: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ paddingHorizontal: SP.l, marginTop: SP.xl, marginBottom: SP.m }}>
      <AsciiDivider />
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 6 }}>
        <Text style={{ fontFamily: 'Inter_900Black', fontSize: 22, color: C.ink, letterSpacing: -0.5 }}>
          {ASCII.caret} {title}
          {emphasis && <Text style={{ fontStyle: 'italic' }}> {emphasis}</Text>}
        </Text>
        {action && (
          <Pressable onPress={onAction}>
            <Text style={[T.monoB, { fontSize: 11 }]}>{`[ ${action} ]`}</Text>
          </Pressable>
        )}
      </View>
      <AsciiDivider faint style={{ marginTop: 4 }} />
    </View>
  );
}

// ─── SCREEN HEADER ─────────────────────────────────────────
export function ScreenHeader({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SP.l, paddingTop: 56, paddingBottom: SP.m, backgroundColor: C.white }}>
        {onBack ? <BrutalIconBtn icon="arrow-left" onPress={onBack} size={36} /> : <View style={{ width: 36 }} />}
        <Text style={{ fontFamily: 'Inter_900Black', fontSize: 16, color: C.ink, letterSpacing: 1 }}>{title.toUpperCase()}</Text>
        {right ?? <View style={{ width: 36 }} />}
      </View>
      <View style={{ height: 1, backgroundColor: C.ink }} />
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

// ─── PRODUCT MINI CARD ────────────────────────────────────
export function ProductCard({ p, onPress, w = 160 }: { p: any; onPress?: () => void; w?: number }) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ transform: [{ scale }], width: w }}>
      <Pressable
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50 }).start()}
        onPress={onPress}
      >
        <View style={[{ height: w * 1.25, overflow: 'hidden', backgroundColor: '#f3f3f3' }, BORDER(1)]}>
          <Image source={{ uri: p.img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
          {p.tag && (
            <View style={[{ position: 'absolute', top: 8, left: 8, paddingHorizontal: 6, paddingVertical: 3, backgroundColor: C.white }, BORDER(1)]}>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 9, letterSpacing: 0.5 }}>{p.tag}</Text>
            </View>
          )}
        </View>
        <Text style={[T.monoB, { marginTop: 6, fontSize: 9 }]}>{p.brand}</Text>
        <Text style={[T.body, { marginTop: 1 }]} numberOfLines={1}>{p.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
          <Text style={{ fontFamily: 'Inter_900Black', fontSize: 14, color: C.ink }}>₹{p.price}</Text>
          <Text style={[T.caption, { textDecorationLine: 'line-through', fontSize: 10 }]}>₹{p.original}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── CHIP ──────────────────────────────────────────────────
export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={[{ paddingHorizontal: 14, paddingVertical: 8, backgroundColor: active ? C.ink : C.white }, BORDER(1)]}>
      <Text style={{ fontFamily: 'Inter_900Black', fontSize: 11, color: active ? C.white : C.ink, letterSpacing: 0.5 }}>{label.toUpperCase()}</Text>
    </Pressable>
  );
}

// ─── DOTTED LINE ──────────────────────────────────────────
export function DottedRule() {
  return <Text numberOfLines={1} style={{ fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: C.dim }}>{ASCII.hrDot}</Text>;
}

export const styles = StyleSheet.create({});
