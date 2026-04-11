import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Image, StyleSheet, StatusBar, Dimensions, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MotiView } from 'moti';
import { C, T, SP, BORDER, ASCII } from '../theme/brutal';
import { AsciiDivider, BrutalButton, BrutalIconBtn, ProductCard, FadeInUp } from '../components/Brutal';
import { useApp } from '../state/AppState';
import { PRODUCTS } from '../data/mockData';

const { width } = Dimensions.get('window');

const SIZES = ['XS', 'S', 'M', 'L', 'XL'];
const COLORS = ['#000000', '#666666', '#bdbdbd', '#FFFFFF'];

export default function ProductDetailScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const product = route.params?.product || PRODUCTS[0];
  const { addToCart, toggleFavorite, isFavorite, night } = useApp();
  const s = React.useMemo(() => makeS(), [night]);
  const [size, setSize] = useState('M');
  const [colorIdx, setColorIdx] = useState(0);
  const [imgIdx, setImgIdx] = useState(0);
  const [tab, setTab] = useState<'details' | 'reviews' | 'care'>('details');

  const liked = isFavorite(product.id);
  const discount = Math.round((1 - product.price / product.original) * 100);

  const handleAdd = () => {
    addToCart(product, size);
    Alert.alert('Added to bag', `${product.name} · Size ${size}`);
  };
  const handleBuy = () => {
    addToCart(product, size);
    nav.navigate('Checkout', { total: product.price });
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" />

      {/* TOP BAR */}
      <View style={s.topBar}>
        <BrutalIconBtn icon="arrow-left" onPress={() => nav.goBack()} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <BrutalIconBtn icon="share-2" onPress={() => Alert.alert('Shared', 'Link copied')} />
          <BrutalIconBtn icon={liked ? 'heart' : 'heart'} active={liked} onPress={() => toggleFavorite(product)} />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* IMAGE GALLERY */}
        <View style={[{ width, height: width * 1.2, backgroundColor: '#f3f3f3', borderBottomWidth: 1, borderColor: C.ink }]}>
          <Image source={{ uri: product.img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
          <View style={s.imgIdx}>
            <Text style={[T.monoB, { fontSize: 10 }]}>{`${imgIdx + 1} / 4`}</Text>
          </View>
          <View style={s.imgDots}>
            {[0, 1, 2, 3].map(i => (
              <Pressable key={i} onPress={() => setImgIdx(i)} style={[{ width: i === imgIdx ? 24 : 10, height: 6, backgroundColor: i === imgIdx ? C.ink : C.white }, BORDER(1)]} />
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
              <Pressable key={i} onPress={() => setColorIdx(i)} style={[{ width: 36, height: 36, backgroundColor: c, padding: 3 }, BORDER(1), i === colorIdx && { borderWidth: 2 }]}>
                {i === colorIdx && <View style={{ flex: 1, borderWidth: 1, borderColor: c === '#000000' ? C.white : C.ink }} />}
              </Pressable>
            ))}
          </View>

          {/* SIZE */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: SP.l }}>
            <Text style={T.label}>{'> SIZE'}</Text>
            <Pressable onPress={() => Alert.alert('Size guide', 'XS · 32 in chest\nS · 34 in chest\nM · 36 in chest\nL · 38 in chest\nXL · 40 in chest')}>
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

      {/* BOTTOM BAR */}
      <View style={s.bottomBar}>
        <View style={{ height: 1, backgroundColor: C.ink }} />
        <View style={{ flexDirection: 'row', padding: SP.m, paddingBottom: 28, gap: SP.s }}>
          <BrutalButton label="Add to bag" icon="shopping-bag" variant="outline" onPress={handleAdd} style={{ flex: 1 }} />
          <BrutalButton label="Buy now" iconRight="arrow-right" onPress={handleBuy} style={{ flex: 1 }} />
        </View>
      </View>
    </View>
  );
}

const makeS = () => StyleSheet.create({
  topBar: { position: 'absolute', top: 56, left: SP.l, right: SP.l, zIndex: 10, flexDirection: 'row', justifyContent: 'space-between' },
  imgIdx: { position: 'absolute', top: 110, right: 16, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: C.white, borderWidth: 1, borderColor: C.ink },
  imgDots: { position: 'absolute', bottom: 16, alignSelf: 'center', flexDirection: 'row', gap: 6, left: 0, right: 0, justifyContent: 'center' },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.bg },
});
