import React, { useState, useRef } from 'react';
import { View, Text, ScrollView, Pressable, Image, StyleSheet, StatusBar, Dimensions, Alert, Modal } from 'react-native';
import { MotiView as MV } from 'moti';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MotiView } from 'moti';
import { C, T, SP, BORDER, ASCII } from '../theme/brutal';
import { AsciiDivider, BrutalButton, BrutalIconBtn, CachedImage, ProductCard, FadeInUp } from '../components/Brutal';
import { useApp } from '../state/AppState';
import { PRODUCTS } from '../data/mockData';

const { width } = Dimensions.get('window');

const SIZES = ['XS', 'S', 'M', 'L', 'XL'];
const COLORS = ['#000000', '#666666', '#bdbdbd', '#FFFFFF'];

export default function ProductDetailScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const product = route.params?.product || PRODUCTS[0];
  const { addToCart, night, theme, showToast, showConfirm } = useApp();
  const s = React.useMemo(() => makeS(), [night]);
  const [size, setSize] = useState('M');
  const [colorIdx, setColorIdx] = useState(0);
  const [imgIdx, setImgIdx] = useState(0);
  const galleryRef = useRef<ScrollView>(null);
  const [tab, setTab] = useState<'details' | 'reviews' | 'care'>('details');
  const [buyModal, setBuyModal] = useState(false);

  const discount = Math.round((1 - product.price / product.original) * 100);

  const handleAdd = () => {
    addToCart(product, size);
    showToast('Added to bag', `${product.name} · Size ${size}`, 'shopping-bag', {
      label: 'View bag',
      onPress: () => nav.navigate('Tabs', { screen: 'CartTab' }),
    });
  };
  const handleBuy = () => setBuyModal(true);
  const pickMethod = (m: 'standard' | 'express' | 'pickup') => {
    addToCart(product, size, m);
    setBuyModal(false);
    // Small delay so the modal-exit animation plays before navigating
    setTimeout(() => {
      nav.navigate('Checkout', { total: product.price, preMethod: m });
    }, 220);
  };

  return (
    <View key={night ? 'D' : 'L'} style={{ flex: 1, backgroundColor: night ? '#000000' : '#FFFFFF' }}>
      <StatusBar barStyle={night ? 'light-content' : 'dark-content'} />

      {/* TOP BAR */}
      <View style={s.topBar}>
        <BrutalIconBtn icon="arrow-left" onPress={() => nav.goBack()} />
        <BrutalIconBtn icon="share-2" onPress={() => showToast('Shared', 'Link copied to clipboard', 'share-2')} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* IMAGE GALLERY — horizontally swipable with paging */}
        <View style={{ width, height: width * 1.2, backgroundColor: C.hairline, borderBottomWidth: 1, borderColor: C.ink }}>
          <ScrollView
            ref={galleryRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / width);
              setImgIdx(idx);
            }}
          >
            {[0, 1, 2, 3].map(i => (
              <View key={i} style={{ width, height: width * 1.2, alignItems: 'center', justifyContent: 'center' }}>
                <CachedImage source={{ uri: product.img }} style={{ width: '100%', height: '100%', transform: [{ scale: i === 0 ? 1 : i === 1 ? 1.1 : i === 2 ? 0.95 : 1.05 }] }} resizeMode="contain" />
                {/* Subtle angle label so user sees it's a different shot */}
                <View style={[{ position: 'absolute', top: 14, left: 14, paddingHorizontal: 6, paddingVertical: 3, backgroundColor: C.ink }]}>
                  <Text style={[T.monoB, { color: C.white, fontSize: 8, letterSpacing: 1 }]}>{['FRONT', 'BACK', 'DETAIL', 'FIT'][i]}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
          <View style={[s.imgIdx, BORDER(1)]} pointerEvents="none">
            <Text style={[T.monoB, { fontSize: 10 }]}>{`${imgIdx + 1} / 4`}</Text>
          </View>
          <View style={s.imgDots}>
            {[0, 1, 2, 3].map(i => (
              <Pressable
                key={i}
                onPress={() => {
                  setImgIdx(i);
                  galleryRef.current?.scrollTo({ x: i * width, animated: true });
                }}
                style={[{ width: i === imgIdx ? 24 : 10, height: 6, backgroundColor: i === imgIdx ? C.ink : C.white }, BORDER(1)]}
              />
            ))}
          </View>
        </View>

        {/* INFO */}
        <View style={{ padding: SP.l }}>
          <Text style={[T.monoB, { fontSize: 10 }]}>{`> ID:${product.id.toUpperCase()} · IN-STOCK`}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 6 }}>
            <View style={{ flex: 1 }}>
              <Text style={[T.monoB, { fontSize: 11, marginTop: 6 }]}>{product.brand}</Text>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 26, color: C.ink, marginTop: 4, letterSpacing: -0.5, lineHeight: 30 }}>{product.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: 28, color: C.ink }}>₹{product.price}</Text>
                <Text style={[T.body, { color: C.dim, textDecorationLine: 'line-through', fontSize: 14 }]}>₹{product.original}</Text>
                <Text style={[T.monoB, { fontSize: 11 }]}>{`-${discount}%`}</Text>
              </View>
            </View>
            <View style={[{ alignItems: 'center', padding: 8 }, BORDER(1)]}>
              <Feather name="star" size={14} color={C.ink} />
              <Text style={[T.monoB, { fontSize: 11, marginTop: 2 }]}>{product.rating}</Text>
            </View>
          </View>

          <AsciiDivider style={{ marginTop: SP.l }} />

          {/* COLOR */}
          <Text style={[T.label, { marginTop: SP.l }]}>{'> COLOR'}</Text>
          <View style={{ flexDirection: 'row', gap: SP.s, marginTop: 8 }}>
            {COLORS.map((c, i) => (
              <Pressable key={i} onPress={() => setColorIdx(i)} style={[{ width: 36, height: 36, backgroundColor: c, padding: 3 }, i === colorIdx ? BORDER(2) : BORDER(1)]}>
                {i === colorIdx && <View style={{ flex: 1, borderWidth: 1, borderColor: c === '#000000' ? C.white : C.ink }} />}
              </Pressable>
            ))}
          </View>

          {/* SIZE */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: SP.l }}>
            <Text style={T.label}>{'> SIZE'}</Text>
            <Pressable onPress={() => showConfirm({ title: 'Size guide', msg: 'XS · 32 in chest\nS · 34 in chest\nM · 36 in chest\nL · 38 in chest\nXL · 40 in chest', confirmLabel: 'Got it', cancelLabel: 'Close', icon: 'ruler' })}>
              <Text style={[T.monoB, { fontSize: 10 }]}>{'[ SIZE GUIDE ]'}</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', gap: SP.s, marginTop: 8 }}>
            {SIZES.map(sz => (
              <Pressable key={sz} onPress={() => setSize(sz)} style={[{ width: 48, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: size === sz ? C.ink : C.white }, BORDER(1)]}>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: 12, color: size === sz ? C.white : C.ink, letterSpacing: 0.5 }}>{sz}</Text>
              </Pressable>
            ))}
          </View>

          {/* DELIVERY */}
          <View style={[{ marginTop: SP.l, padding: SP.m, flexDirection: 'row', alignItems: 'center', gap: 12 }, BORDER(1)]}>
            <Feather name="zap" size={18} color={C.ink} />
            <View style={{ flex: 1 }}>
              <Text style={[T.bodyB, { fontSize: 12 }]}>60-MIN DELIVERY</Text>
              <Text style={[T.mono, { color: C.dim, fontSize: 10 }]}>FROM NORTH. STORE · 2.4 KM AWAY</Text>
            </View>
            <Text style={[T.monoB, { fontSize: 11 }]}>FREE</Text>
          </View>

          {/* TABS */}
          <View style={{ flexDirection: 'row', marginTop: SP.xl }}>
            {(['details', 'reviews', 'care'] as const).map(t => (
              <Pressable key={t} onPress={() => setTab(t)} style={[{ flex: 1, paddingVertical: SP.m, alignItems: 'center', backgroundColor: tab === t ? C.ink : C.white }, BORDER(1)]}>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: 11, color: tab === t ? C.white : C.ink, letterSpacing: 0.5 }}>{t.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>

          <MotiView key={tab} from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280 }} style={{ marginTop: SP.l }}>
            {tab === 'details' && (
              <Text style={[T.body, { color: C.inkSoft, lineHeight: 20 }]}>
                Premium fabric construction. Cut for an oversized, tailored fit. Featured in our Spring/Summer 26 lookbook. Designed in studio, sewn locally, delivered in 60 minutes.
                {'\n\n'}MATERIAL: 100% pure wool · LINING: Cupro
                {'\n'}MADE IN: India · CARE: Dry clean only
              </Text>
            )}
            {tab === 'reviews' && (
              <View>
                {[1, 2, 3].map(i => (
                  <View key={i} style={{ marginBottom: SP.m }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={[T.monoB, { fontSize: 11 }]}>@user_0{i}</Text>
                      <Text style={[T.mono, { color: C.dim }]}>★ {5 - i * 0.1}</Text>
                    </View>
                    <Text style={[T.body, { marginTop: 4 }]}>"Fits perfect, exactly as shown. Delivery was crazy fast — 47 minutes."</Text>
                    <AsciiDivider faint style={{ marginTop: 8 }} />
                  </View>
                ))}
              </View>
            )}
            {tab === 'care' && (
              <Text style={[T.body, { color: C.inkSoft, lineHeight: 20 }]}>
                · DRY CLEAN ONLY{'\n'}
                · DO NOT BLEACH{'\n'}
                · COOL IRON IF NEEDED{'\n'}
                · STORE ON HANGER{'\n'}
                · KEEP AWAY FROM DIRECT SUNLIGHT
              </Text>
            )}
          </MotiView>

          {/* SIMILAR */}
          <Text style={[T.h2, { marginTop: SP.xl }]}>{`▌ YOU MAY ALSO LIKE`}</Text>
          <AsciiDivider faint style={{ marginTop: 4 }} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SP.m, marginTop: SP.m }}>
            {PRODUCTS.filter(p => p.id !== product.id).slice(0, 5).map(p => (
              <ProductCard key={p.id} p={p} onPress={() => nav.push('ProductDetail', { product: p })} />
            ))}
          </ScrollView>
        </View>
      </ScrollView>

      {/* FLOATING TRY-ON FAB — chat-bot style circle, sits above the bottom bar */}
      <Pressable
        onPress={() => nav.navigate('TryOn', { product })}
        style={{
          position: 'absolute',
          right: SP.l,
          bottom: 110,
          zIndex: 50,
        }}
      >
        <MV
          from={{ scale: 1 }}
          animate={{ scale: 1.06 }}
          transition={{ type: 'timing', duration: 1100, loop: true, repeatReverse: true }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {/* Pill label that pokes out from the circle */}
            <View style={[{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: C.ink }, BORDER(1)]}>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 10, color: C.white, letterSpacing: 0.5 }}>TRY ON</Text>
            </View>
            {/* The circular FAB */}
            <View style={{
              width: 60, height: 60, borderRadius: 30,
              backgroundColor: C.ink, borderWidth: 2, borderColor: C.ink,
              alignItems: 'center', justifyContent: 'center',
              shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6,
              elevation: 8,
            }}>
              {/* Inner ring + icon — gives it a "smart camera" / chat-bot look */}
              <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="camera" size={22} color={C.ink} />
                {/* Tiny green status dot at the corner like an online indicator */}
                <View style={{ position: 'absolute', top: 2, right: 2, width: 10, height: 10, borderRadius: 5, backgroundColor: C.ink, borderWidth: 2, borderColor: C.white }} />
              </View>
            </View>
          </View>
        </MV>
      </Pressable>

      {/* BOTTOM BAR */}
      <View style={s.bottomBar}>
        <View style={{ height: 1, backgroundColor: C.ink }} />
        <View style={{ flexDirection: 'row', padding: SP.m, paddingBottom: 28, gap: SP.s }}>
          <BrutalButton label="Add to bag" icon="shopping-bag" variant="outline" onPress={handleAdd} style={{ flex: 1 }} />
          <BrutalButton label="Buy now" iconRight="arrow-right" onPress={handleBuy} style={{ flex: 1 }} />
        </View>
      </View>

      {/* ═══ DELIVERY PICKER MODAL — 3 options, animated ═══ */}
      <Modal transparent visible={buyModal} animationType="none" onRequestClose={() => setBuyModal(false)}>
        <Pressable onPress={() => setBuyModal(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
          <MV
            from={{ translateY: 500 }}
            animate={{ translateY: 0 }}
            exit={{ translateY: 500 }}
            transition={{ type: 'timing', duration: 320 }}
            onStartShouldSetResponder={() => true}
            style={{ backgroundColor: night ? '#0a0a0a' : '#FFFFFF', paddingTop: SP.m, paddingHorizontal: SP.l, paddingBottom: 36, borderTopWidth: 2, borderColor: C.ink }}
          >
            {/* Handle */}
            <View style={{ alignSelf: 'center', width: 44, height: 4, backgroundColor: C.ink, marginBottom: SP.m }} />
            <Text style={[T.monoB, { fontSize: 10, color: C.dim }]}>{'> CHOOSE_DELIVERY'}</Text>
            <Text style={{ fontFamily: 'Inter_900Black', fontSize: 28, color: C.ink, letterSpacing: -1, marginTop: 4 }}>HOW YOU GETTING IT?</Text>
            <Text style={[T.mono, { color: C.dim, fontSize: 10, marginTop: 4 }]}>Same item. Three speeds. Pick one.</Text>

            <View style={{ marginTop: SP.l, gap: SP.s }}>
              {[
                { id: 'express', icon: 'zap', title: 'EXPRESS · 60 MIN', desc: 'In your hands in under an hour. From your block.', tag: '₹99', tagBg: true },
                { id: 'standard', icon: 'package', title: 'STANDARD · 2-3 DAYS', desc: 'Regular shipping. Tracked door-to-door.', tag: '₹49' },
                { id: 'pickup', icon: 'map-pin', title: 'INSTORE PICKUP', desc: 'Ready at your nearest store in ~45 min. No delivery fee.', tag: 'FREE', tagBg: true },
              ].map((opt, i) => (
                <MV
                  key={opt.id}
                  from={{ opacity: 0, translateX: -20 }}
                  animate={{ opacity: 1, translateX: 0 }}
                  transition={{ delay: 120 + i * 80, type: 'timing', duration: 280 }}
                >
                  <Pressable onPress={() => pickMethod(opt.id as any)} style={[{ padding: SP.m, backgroundColor: C.white }, BORDER(1)]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={[{ width: 46, height: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: C.ink }]}>
                        <Feather name={opt.icon as any} size={20} color={C.white} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ fontFamily: 'Inter_900Black', fontSize: 13, color: C.ink, letterSpacing: 0.5 }}>{opt.title}</Text>
                          <View style={[{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: opt.tagBg ? C.ink : 'transparent' }, BORDER(1)]}>
                            <Text style={{ fontFamily: 'Inter_900Black', fontSize: 10, color: opt.tagBg ? C.white : C.ink }}>{opt.tag}</Text>
                          </View>
                        </View>
                        <Text style={[T.mono, { fontSize: 9, color: C.dim, marginTop: 3 }]}>{opt.desc}</Text>
                      </View>
                      <Feather name="arrow-right" size={16} color={C.ink} />
                    </View>
                  </Pressable>
                </MV>
              ))}
            </View>

            <Pressable onPress={() => setBuyModal(false)} style={{ marginTop: SP.m, alignSelf: 'center', paddingVertical: 8 }}>
              <Text style={[T.mono, { color: C.dim, textDecorationLine: 'underline' }]}>cancel</Text>
            </Pressable>
          </MV>
        </Pressable>
      </Modal>
    </View>
  );
}

const makeS = () => StyleSheet.create({
  topBar: { position: 'absolute', top: 56, left: SP.l, right: SP.l, zIndex: 10, flexDirection: 'row', justifyContent: 'space-between' },
  imgIdx: { position: 'absolute', top: 110, right: 16, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: C.white },
  imgDots: { position: 'absolute', bottom: 16, alignSelf: 'center', flexDirection: 'row', gap: 6, left: 0, right: 0, justifyContent: 'center' },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.bg },
});
