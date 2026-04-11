// Reusable brutalism primitives
import React, { ReactNode, useRef } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, ViewStyle, TextStyle, Animated, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { C, T, BORDER, SP, ASCII, HAIRLINE } from '../theme/brutal';

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
  return (
    <Animated.View style={[{ transform: [{ scale }] }, block && { alignSelf: 'stretch' }, style]}>
      <Pressable
        disabled={disabled}
        onPressIn={onIn}
        onPressOut={onOut}
        onPress={onPress}
        style={[
          { backgroundColor: bg, paddingHorizontal: small ? SP.m : SP.l, paddingVertical: small ? SP.s : SP.m, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
          variant !== 'ghost' && BORDER(1),
        ]}
      >
        {icon && <Feather name={icon} size={small ? 14 : 16} color={fg} />}
        <Text style={{ fontFamily: 'Inter_900Black', fontSize: small ? 11 : 13, color: fg, letterSpacing: 0.5 }}>
          {label.toUpperCase()}
        </Text>
        {iconRight && <Feather name={iconRight} size={small ? 14 : 16} color={fg} />}
      </Pressable>
    </Animated.View>
  );
}

// ─── ICON BUTTON ───────────────────────────────────────────
export function BrutalIconBtn({ icon, onPress, size = 38, active }: { icon: keyof typeof Feather.glyphMap; onPress?: () => void; size?: number; active?: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPressIn={() => Animated.spring(scale, { toValue: 0.92, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50 }).start()}
        onPress={onPress}
        style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? C.ink : C.white }, BORDER(1)]}
      >
        <Feather name={icon} size={size * 0.45} color={active ? C.white : C.ink} />
      </Pressable>
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
          <View style={[{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white }, BORDER(1)]}>
            <Feather name="heart" size={13} color={C.ink} />
          </View>
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
