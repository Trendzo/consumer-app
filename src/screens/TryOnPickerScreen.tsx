import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { C, T, SP, BORDER, rf } from '../theme/brutal';
import { BrutalStatusBar, CachedImage } from '../components/Brutal';
import { PRODUCTS } from '../data/mockData';

const { width: W } = Dimensions.get('window');
const CATS = ['ALL', 'TOPS', 'DRESSES', 'OUTERWEAR', 'BOTTOMS'];

// Pick what to try on FIRST — search / explore products, tap one to try it on.
export default function TryOnPickerScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const mode: 'ar' | 'photo' = route.params?.mode || 'ar';
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('ALL');

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    let list = PRODUCTS;
    if (t) list = list.filter((p) => (p.name + ' ' + p.brand).toLowerCase().includes(t));
    return list;
  }, [q, cat]);

  const cardW = (W - SP.l * 2 - SP.s) / 2;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <BrutalStatusBar />

      {/* HEADER */}
      <View style={{ paddingTop: 56, paddingHorizontal: SP.l, paddingBottom: SP.m, backgroundColor: C.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.m }}>
          <Pressable onPress={() => nav.goBack()} hitSlop={10}><Feather name="arrow-left" size={22} color={C.ink} /></Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(20), color: C.ink, letterSpacing: -0.5 }}>WHAT TO TRY ON?</Text>
            <Text style={[T.mono, { color: C.dim, fontSize: 10, marginTop: 2 }]}>{mode === 'ar' ? 'AR · LIVE CAMERA' : 'PHOTO · UPLOAD'} · pick an item below</Text>
          </View>
        </View>

        {/* SEARCH */}
        <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: SP.m, paddingVertical: 10, marginTop: SP.m }, BORDER(1)]}>
          <Feather name="search" size={16} color={C.dim} />
          <TextInput value={q} onChangeText={setQ} placeholder="Search products to try on..." placeholderTextColor={C.dim} style={{ flex: 1, fontFamily: 'SpaceMono_400Regular', fontSize: 12, color: C.ink, padding: 0 }} />
          {q.length > 0 && <Pressable onPress={() => setQ('')} hitSlop={8}><Feather name="x" size={16} color={C.dim} /></Pressable>}
        </View>

        {/* CATEGORY CHIPS */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SP.s, marginTop: SP.m }}>
          {CATS.map((c) => (
            <Pressable key={c} onPress={() => setCat(c)} style={[{ paddingHorizontal: 14, paddingVertical: 7, backgroundColor: cat === c ? C.ink : C.white }, BORDER(1)]}>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 10, color: cat === c ? C.white : C.ink, letterSpacing: 0.5 }}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <View style={{ height: 1, backgroundColor: C.ink }} />

      {/* GRID — tap a product to try it on */}
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={[T.label, { marginBottom: SP.m }]}>{`${results.length} ITEMS`}</Text>
        {results.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: SP.huge }}>
            <Feather name="search" size={36} color={C.dim} />
            <Text style={[T.body, { color: C.dim, marginTop: SP.m }]}>No items match "{q}".</Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {results.map((p) => (
              <Pressable key={p.id} onPress={() => nav.navigate('TryOn', { mode, product: p })} style={{ width: cardW, marginBottom: SP.m }}>
                <View style={[{ height: 200, overflow: 'hidden', backgroundColor: C.hairline }, BORDER(1)]}>
                  <CachedImage source={{ uri: p.img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                  <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 7, backgroundColor: C.ink }}>
                    <Feather name="camera" size={12} color={C.white} />
                    <Text style={{ fontFamily: 'Inter_900Black', fontSize: 10, color: C.white, letterSpacing: 0.5 }}>TRY THIS ON</Text>
                  </View>
                </View>
                <Text style={[T.monoB, { fontSize: 9, marginTop: 6 }]} numberOfLines={1}>{p.brand}</Text>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: C.ink, marginTop: 1 }} numberOfLines={1}>{p.name}</Text>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: 13, color: C.ink, marginTop: 2 }}>₹{p.price}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
