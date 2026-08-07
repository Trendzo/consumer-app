/**
 * The three things a catalog surface can be, now that nothing is faked.
 *
 * Every product rail and grid in the app used to fall back to a bundled demo
 * catalogue when the backend returned nothing — so "loading", "empty" and
 * "offline" all looked identical to "here are eight products", and the shopper
 * could open, price and try on items that do not exist. These are what those
 * surfaces render instead.
 *
 * Shapes match `ProductCard` (CARD.w / CARD.imgH) so a grid does not reflow when
 * the real rows land.
 */
import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { MotiView } from 'moti';
import { Feather } from '@expo/vector-icons';
import { C, T, SP, BORDER, HELV } from '../theme/brutal';
import { CARD } from './Brutal';

/**
 * One pulsing grey block. The pulse is the only signal that this is a wait, not a result.
 *
 * Exported because the Home CMS needs the same distinction this file was written for: its
 * sections must not render bundled content while the published content is still in flight, so
 * the gap has to look like a wait rather than like an answer.
 */
export function Shimmer({ w, h, style, animated = true }: { w?: number | string; h: number; style?: any; animated?: boolean }) {
  // animated=false renders a static block with the same footprint — used while
  // a screen-transition animation is in flight so a dozen looping shimmers
  // don't compete with it for frames.
  if (!animated) {
    return <MotiView style={[{ width: (w ?? '100%') as any, height: h, backgroundColor: C.hairline, opacity: 0.6 }, style]} />;
  }
  return (
    <MotiView
      from={{ opacity: 0.45 }}
      animate={{ opacity: 0.85 }}
      transition={{ type: 'timing', duration: 750, loop: true, repeatReverse: true }}
      style={[{ width: (w ?? '100%') as any, height: h, backgroundColor: C.hairline }, style]}
    />
  );
}

/** Card-shaped placeholder: image box + the two text lines under it. */
function CardSkeleton({ w = CARD.w, imgH = CARD.imgH, animated = true }: { w?: number; imgH?: number; animated?: boolean }) {
  return (
    <View style={{ width: w }}>
      <Shimmer h={imgH} style={BORDER(1)} animated={animated} />
      <Shimmer w={'55%'} h={9} style={{ marginTop: 8 }} animated={animated} />
      <Shimmer w={'85%'} h={12} style={{ marginTop: 6 }} animated={animated} />
      <Shimmer w={'35%'} h={12} style={{ marginTop: 6 }} animated={animated} />
    </View>
  );
}

/** 2-column grid placeholder. `count` should match the page size being fetched. */
export function ProductGridSkeleton({ count = 4, cardW = CARD.w, imgH = CARD.imgH, animated = true }: {
  count?: number; cardW?: number; imgH?: number; animated?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ marginBottom: SP.m }}>
          <CardSkeleton w={cardW} imgH={imgH} />
        </View>
      ))}
    </View>
  );
}

/** Horizontal rail placeholder — same card, laid out the way a rail lays out. */
export function ProductRailSkeleton({ count = 3, cardW = CARD.w * 0.86, imgH = CARD.imgH, animated = true }: {
  count?: number; cardW?: number; imgH?: number; animated?: boolean;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} scrollEnabled={false} contentContainerStyle={{ gap: SP.s, paddingHorizontal: SP.l }}>
      {Array.from({ length: count }, (_, i) => <CardSkeleton key={i} w={cardW} imgH={imgH} animated={animated} />)}
    </ScrollView>
  );
}

/**
 * Nothing came back, and that is the truth — not a bug.
 *
 * Deliberately plain: an empty category is a normal state (a store with no stock
 * in that rail yet), so it gets a quiet line, not an error treatment.
 */
export function CatalogEmpty({
  title = 'Nothing here yet',
  sub,
  icon = 'inbox',
  actionLabel,
  onAction,
  compact,
}: {
  title?: string;
  sub?: string;
  icon?: keyof typeof Feather.glyphMap;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: compact ? SP.l : SP.xl, paddingHorizontal: SP.l }}>
      <View style={[{ width: 54, height: 54, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F4F4' }, BORDER(1)]}>
        <Feather name={icon} size={22} color={C.dim} />
      </View>
      <Text style={[T.h3, { marginTop: SP.m, textAlign: 'center', textTransform: 'uppercase' }]}>{title}</Text>
      {!!sub && <Text style={[T.caption, { color: C.dim, marginTop: 6, textAlign: 'center' }]}>{sub}</Text>}
      {!!actionLabel && !!onAction && (
        <Pressable onPress={onAction} style={[{ marginTop: SP.m, paddingHorizontal: SP.l, paddingVertical: 10, backgroundColor: C.ink }, BORDER(1)]}>
          <Text style={[T.caption, { color: C.white, fontFamily: HELV, fontWeight: '700' }]}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

/** The request failed. Separate from empty because this one is retryable. */
export function CatalogError({
  title = "Couldn't load",
  sub = 'Check your connection and try again.',
  onRetry,
  compact,
}: { title?: string; sub?: string; onRetry?: () => void; compact?: boolean }) {
  return (
    <CatalogEmpty
      title={title}
      sub={sub}
      icon="wifi-off"
      {...(onRetry ? { actionLabel: 'Retry', onAction: onRetry } : {})}
      {...(compact ? { compact } : {})}
    />
  );
}

/**
 * One switch for the whole load → error → empty → data sequence.
 *
 * Call sites kept getting this wrong in the same way: `list.length ? grid :
 * empty` renders "no products" for the entire first second of every visit.
 * Passing an explicit `status` makes the loading case impossible to forget.
 */
export type LoadStatus = 'loading' | 'error' | 'ready';

export function CatalogSection({
  status,
  count,
  skeleton,
  empty,
  onRetry,
  children,
}: {
  status: LoadStatus;
  count: number;
  skeleton?: React.ReactNode;
  empty?: React.ReactNode;
  onRetry?: () => void;
  children: React.ReactNode;
}) {
  if (status === 'loading') return <>{skeleton ?? <ProductGridSkeleton />}</>;
  if (status === 'error') return <CatalogError {...(onRetry ? { onRetry } : {})} />;
  if (count === 0) return <>{empty ?? <CatalogEmpty />}</>;
  return <>{children}</>;
}
