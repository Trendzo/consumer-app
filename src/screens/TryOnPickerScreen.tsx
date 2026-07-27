import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { C, T, SP, BORDER } from '../theme/brutal';
import { BrutalStatusBar, CachedImage, CARD } from '../components/Brutal';
import { PRODUCTS } from '../data/mockData';

const CATS = ['All', 'Tops', 'Dresses', 'Outerwear', 'Bottoms'];

// Pick what to try on FIRST — search / explore products, tap one to try it on.
export default function TryOnPickerScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const mode: 'ar' | 'photo' = route.params?.mode || 'ar';
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    let list = PRODUCTS;
    if (t) list = list.filter((p) => (p.name + ' ' + p.brand).toLowerCase().includes(t));
    return list;
  }, [q, cat]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <BrutalStatusBar />

      {/* HEADER */}
      <View style={{ paddingTop: 56, paddingHorizontal: SP.l, paddingBottom: SP.m, backgroundColor: C.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.m }}>
          <Pressable onPress={() => nav.goBack()} hitSlop={10}><Feather name="arrow-left" size={22} color={C.ink} /></Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[T.h1, { textTransform: 'uppercase' }]}>What to try on?</Text>
            <Text style={[T.caption, { color: C.dim, marginTop: 2 }]}>{mode === 'ar' ? 'AR · Live camera' : 'Photo · Upload'} · pick an item below</Text>
          </View>
        </View>

        {/* SEARCH */}
        <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: SP.m, paddingVertical: 10, marginTop: SP.m }, BORDER(1)]}>
          <Feather name="search" size={16} color={C.dim} />
          <TextInput value={q} onChangeText={setQ} placeholder="Search products to try on..." placeholderTextColor={C.dim} style={[T.body, { flex: 1, padding: 0 }]} />
          {q.length > 0 && <Pressable onPress={() => setQ('')} hitSlop={8}><Feather name="x" size={16} color={C.dim} /></Pressable>}
        </View>

        {/* CATEGORY CHIPS */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SP.s, marginTop: SP.m }}>
          {CATS.map((c) => (
            <Pressable key={c} onPress={() => setCat(c)} style={[{ paddingHorizontal: 14, paddingVertical: 7, backgroundColor: cat === c ? C.ink : C.white }, BORDER(1)]}>
              <Text style={[T.caption, { color: cat === c ? C.white : C.ink }]}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <View style={{ height: 1, backgroundColor: C.hairline }} />

      {/* GRID — tap a product to try it on */}
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={[T.caption, { marginBottom: SP.m }]}>{`${results.length} items`}</Text>
        {results.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: SP.huge }}>
            <Feather name="search" size={36} color={C.dim} />
            <Text style={[T.body, { color: C.dim, marginTop: SP.m }]}>No items match "{q}".</Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {results.map((p) => (
              <Pressable key={p.id} onPress={() => nav.navigate('TryOn', { mode, product: p })} style={{ width: CARD.w, marginBottom: SP.m }}>
                <View style={[{ height: CARD.imgH, overflow: 'hidden', backgroundColor: C.hairline }, BORDER(1)]}>
                  <CachedImage source={{ uri: p.img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                  {/* CTA overlay — black is allowed for call-to-action */}
                  <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 7, backgroundColor: C.ink }}>
                    <Feather name="camera" size={12} color={C.white} />
                    <Text style={[T.caption, { color: C.white }]}>Try this on</Text>
                  </View>
                </View>
                <Text style={[T.micro, { fontFamily: 'Helvetica Neue', fontWeight: '600', color: C.ink, marginTop: 6 }]} numberOfLines={1}>{(p.brand ?? '').toUpperCase()}</Text>
                <Text style={[T.productName, { marginTop: 2 }]} numberOfLines={2}>{p.name}</Text>
                <Text style={[T.price, { marginTop: 3 }]}>₹{p.price}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
