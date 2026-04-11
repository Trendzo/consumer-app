import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Image, StyleSheet, StatusBar } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MotiView } from 'moti';
import { C, T, SP, BORDER } from '../theme/brutal';
import { ScreenHeader, AsciiDivider, Chip } from '../components/Brutal';
import { useApp } from '../state/AppState';
import { PRODUCTS } from '../data/mockData';

const FILTERS = ['ALL', 'NEW IN', 'TOPS', 'BOTTOMS', 'DRESSES', 'SHOES', 'BAGS'];
const SORTS = ['NEWEST', 'PRICE ↑', 'PRICE ↓', 'RATING'];

export default function CategoryScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const label = route.params?.label || 'Category';
  const { toggleFavorite, isFavorite } = useApp();
  const [filter, setFilter] = useState('ALL');
  const [sort, setSort] = useState('NEWEST');
  const [grid, setGrid] = useState<2 | 1>(2);

  // Repeat the catalog so the grid feels populated
  const data = [...PRODUCTS, ...PRODUCTS].map((p, i) => ({ ...p, id: p.id + '-' + i }));

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" />
      <ScreenHeader
        title={label}
        onBack={() => nav.goBack()}
        right={
          <Pressable onPress={() => setGrid(grid === 2 ? 1 : 2)}>
            <Feather name={grid === 2 ? 'square' : 'grid'} size={18} color={C.ink} />
          </Pressable>
        }
      />

      {/* FILTER STRIP */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SP.l, paddingVertical: SP.m, gap: SP.s }}>
        {FILTERS.map(f => <Chip key={f} label={f} active={filter === f} onPress={() => setFilter(f)} />)}
      </ScrollView>
      <View style={{ height: 1, backgroundColor: C.hairline, marginHorizontal: SP.l }} />

      {/* SORT BAR */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SP.l, paddingVertical: SP.m, justifyContent: 'space-between' }}>
        <Text style={[T.mono, { color: C.dim }]}>{`> ${data.length} ITEMS · SORT BY ${sort}`}</Text>
        <Pressable onPress={() => {
          const next = SORTS[(SORTS.indexOf(sort) + 1) % SORTS.length];
          setSort(next);
        }}>
          <Text style={[T.monoB, { fontSize: 10 }]}>{'[ ⇅ ]'}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: SP.l, paddingBottom: 60 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.m }}>
          {data.map((p, i) => (
            <MotiView
              key={p.id}
              from={{ opacity: 0, translateY: 12 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ delay: (i % 8) * 30, type: 'timing', duration: 280 }}
              style={{ width: grid === 2 ? '47.5%' : '100%' }}
            >
              <Pressable onPress={() => nav.navigate('ProductDetail', { product: p })}>
                <View style={[{ height: grid === 2 ? 220 : 380, overflow: 'hidden', backgroundColor: '#f3f3f3' }, BORDER(1)]}>
                  <Image source={{ uri: p.img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                  {p.tag && (
                    <View style={[{ position: 'absolute', top: 8, left: 8, paddingHorizontal: 6, paddingVertical: 3, backgroundColor: C.white }, BORDER(1)]}>
                      <Text style={{ fontFamily: 'Inter_900Black', fontSize: 9 }}>{p.tag}</Text>
                    </View>
                  )}
                  <Pressable
                    onPress={() => toggleFavorite(p)}
                    style={[{ position: 'absolute', top: 8, right: 8, width: 30, height: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: isFavorite(p.id) ? C.ink : C.white }, BORDER(1)]}
                  >
                    <Feather name="heart" size={13} color={isFavorite(p.id) ? C.white : C.ink} />
                  </Pressable>
                </View>
                <Text style={[T.monoB, { fontSize: 9, marginTop: 6 }]}>{p.brand}</Text>
                <Text style={[T.body]} numberOfLines={1}>{p.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                  <Text style={{ fontFamily: 'Inter_900Black', fontSize: 14, color: C.ink }}>₹{p.price}</Text>
                  <Text style={[T.caption, { textDecorationLine: 'line-through' }]}>₹{p.original}</Text>
                </View>
              </Pressable>
            </MotiView>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
