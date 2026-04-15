import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, Image, Dimensions } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MotiView } from 'moti';
import { C, T, SP, BORDER } from '../theme/brutal';
import { ScreenHeader, AsciiDivider, BrutalStatusBar, CachedImage, FadeInUp } from '../components/Brutal';
import { useApp } from '../state/AppState';
import { PRODUCTS } from '../data/mockData';

const { width: W } = Dimensions.get('window');
const FILTERS = ['ALL', 'NEW IN', 'TOPS', 'BOTTOMS', 'DRESSES', 'SHOES', 'BAGS'];
const SORTS = ['NEWEST', 'PRICE ↑', 'PRICE ↓', 'RATING'];

export default function CategoryScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const label = route.params?.label || 'Category';
  const { night } = useApp();
  const [filter, setFilter] = useState('ALL');
  const [sort, setSort] = useState('NEWEST');
  const [grid, setGrid] = useState<2 | 1>(2);

  // Inflate catalog & generate deterministic "random-ish" extras
  const data = useMemo(() => {
    return [...PRODUCTS, ...PRODUCTS, ...PRODUCTS].map((p, i) => ({
      ...p,
      id: p.id + '-' + i,
      rating: Number(((p.rating || 4.2) + ((i * 7) % 10) / 20).toFixed(1)),
      reviews: 42 + ((i * 13) % 800),
      discount: Math.round((1 - p.price / p.original) * 100),
      stock: 5 + ((i * 11) % 60),
    }));
  }, []);

  // Sort based on selected SORT
  const sorted = useMemo(() => {
    const arr = [...data];
    if (sort === 'PRICE ↑') arr.sort((a, b) => a.price - b.price);
    else if (sort === 'PRICE ↓') arr.sort((a, b) => b.price - a.price);
    else if (sort === 'RATING') arr.sort((a, b) => b.rating - a.rating);
    return arr;
  }, [sort, data]);

  const totalValue = data.reduce((s, p) => s + p.price, 0);
  const avgPrice = Math.round(totalValue / data.length);
  const newCount = data.filter(p => p.tag === 'NEW').length;
  const hotCount = data.filter(p => p.tag === 'HOT').length;

  return (
    <View key={night ? 'D' : 'L'} style={{ flex: 1, backgroundColor: night ? '#0a0a0a' : '#FFFFFF' }}>
      <BrutalStatusBar />
      <ScreenHeader
        title={label}
        onBack={() => nav.goBack()}
        right={
          <Pressable onPress={() => setGrid(grid === 2 ? 1 : 2)} hitSlop={10} style={[{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }, BORDER(1)]}>
            <Feather name={grid === 2 ? 'list' : 'grid'} size={16} color={C.ink} />
          </Pressable>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* ═══ HERO BANNER ═══ */}
        <View style={{ paddingHorizontal: SP.l, paddingTop: SP.m }}>
          <View style={[{ backgroundColor: C.ink, padding: SP.l, overflow: 'hidden' }, BORDER(1)]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'SpaceMono_700Bold', fontSize: 9, color: C.white, letterSpacing: 1, opacity: 0.7 }}>{`> CATALOG // ${new Date().getFullYear()}`}</Text>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: 44, color: C.white, letterSpacing: -2, lineHeight: 46, marginTop: 6 }}>
                  {label.toUpperCase()}<Text style={{ fontSize: 28, color: C.white, opacity: 0.5 }}>×</Text>
                </Text>
                <Text style={{ fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: C.white, opacity: 0.7, marginTop: 4 }}>{`${data.length} ITEMS · UPDATED HOURLY`}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Feather name="package" size={40} color={C.white} style={{ opacity: 0.4 }} />
              </View>
            </View>

            {/* Stats strip inside hero */}
            <View style={{ flexDirection: 'row', marginTop: SP.l, borderTopWidth: 1, borderColor: C.white, paddingTop: SP.s, gap: 0 }}>
              <Stat label="NEW" value={newCount} />
              <StatDivider />
              <Stat label="HOT" value={hotCount} />
              <StatDivider />
              <Stat label="AVG" value={`₹${avgPrice}`} />
              <StatDivider />
              <Stat label="MODE" value={grid === 2 ? 'GRID' : 'LIST'} />
            </View>
          </View>
        </View>

        {/* ═══ FILTER STRIP ═══ */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SP.l, paddingVertical: SP.m, gap: 6 }}>
          {FILTERS.map(f => {
            const on = filter === f;
            return (
              <Pressable key={f} onPress={() => setFilter(f)}>
                <View style={[{ paddingHorizontal: 14, paddingVertical: 8, backgroundColor: on ? C.ink : C.white }, BORDER(1)]}>
                  <Text style={[T.monoB, { fontSize: 10, color: on ? C.white : C.ink, letterSpacing: 1 }]}>{f}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ═══ SORT + COUNT BAR ═══ */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SP.l, paddingBottom: SP.m, justifyContent: 'space-between' }}>
          <Text style={[T.mono, { color: C.dim, fontSize: 10 }]}>{`> ${sorted.length} RESULTS`}</Text>
          <Pressable
            onPress={() => setSort(SORTS[(SORTS.indexOf(sort) + 1) % SORTS.length])}
            style={[{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6 }, BORDER(1)]}
          >
            <Feather name="sliders" size={11} color={C.ink} />
            <Text style={[T.monoB, { fontSize: 10 }]}>{`SORT · ${sort}`}</Text>
          </Pressable>
        </View>

        {/* ═══ PRODUCT GRID — uniform card heights ═══ */}
        <View style={{ paddingHorizontal: SP.l, gap: SP.m }}>
          {grid === 2 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.s }}>
              {sorted.map((p, i) => {
                return (
                  <FadeInUp key={p.id} delay={(i % 6) * 30}>
                    <Pressable onPress={() => nav.navigate('ProductDetail', { product: p })} style={{ width: (W - SP.l * 2 - SP.s) / 2 }}>
                      {/* Image box — fixed height, same for every card */}
                      <View style={[{ height: 220, overflow: 'hidden', backgroundColor: C.hairline }, BORDER(1)]}>
                        <CachedImage source={{ uri: p.img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                        {/* Rank # for top items when sorted by rating */}
                        {sort === 'RATING' && i < 3 && (
                          <View style={[{ position: 'absolute', top: 0, left: 0, backgroundColor: C.ink, paddingHorizontal: 8, paddingVertical: 4 }]}>
                            <Text style={{ fontFamily: 'Inter_900Black', fontSize: 10, color: C.white, letterSpacing: 1 }}>{`#0${i + 1}`}</Text>
                          </View>
                        )}
                        {/* Tag badge (NEW / HOT / TRENDING) */}
                        {p.tag && sort !== 'RATING' && (
                          <View style={[{ position: 'absolute', top: 8, left: 8, paddingHorizontal: 6, paddingVertical: 3, backgroundColor: C.ink }]}>
                            <Text style={{ fontFamily: 'Inter_900Black', fontSize: 8, color: C.white, letterSpacing: 1 }}>{p.tag}</Text>
                          </View>
                        )}
                        {/* Discount corner */}
                        {p.discount > 0 && (
                          <View style={[{ position: 'absolute', top: 0, right: 0, backgroundColor: C.white, paddingHorizontal: 6, paddingVertical: 3, borderBottomWidth: 1, borderLeftWidth: 1, borderColor: C.ink }]}>
                            <Text style={{ fontFamily: 'Inter_900Black', fontSize: 11 }}>{'-' + p.discount + '%'}</Text>
                          </View>
                        )}
                        {/* Low stock */}
                        {p.stock < 15 && (
                          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 6, paddingVertical: 3 }}>
                            <Text style={[T.monoB, { color: '#FFFFFF', fontSize: 8 }]}>{`◆ ONLY ${p.stock} LEFT`}</Text>
                          </View>
                        )}
                      </View>
                      {/* Text block below image */}
                      {/* Meta block — fixed height for perfectly uniform cards */}
                      <View style={{ marginTop: 6, height: 64, justifyContent: 'space-between' }}>
                        <View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Text style={[T.monoB, { fontSize: 9, color: C.ink }]} numberOfLines={1}>{p.brand}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                              <Ionicons name="star" size={9} color={C.ink} />
                              <Text style={[T.mono, { fontSize: 9, color: C.ink }]}>{p.rating}</Text>
                            </View>
                          </View>
                          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: C.ink, marginTop: 2 }} numberOfLines={1}>{p.name}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                          <Text style={{ fontFamily: 'Inter_900Black', fontSize: 14, color: C.ink }}>₹{p.price}</Text>
                          <Text style={{ fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: C.dim, textDecorationLine: 'line-through' }}>₹{p.original}</Text>
                        </View>
                      </View>
                    </Pressable>
                  </FadeInUp>
                );
              })}
            </View>
          ) : (
            /* LIST VIEW — horizontal rows */
            <View style={{ gap: SP.m }}>
              {sorted.map((p, i) => (
                <FadeInUp key={p.id} delay={(i % 6) * 30}>
                  <Pressable onPress={() => nav.navigate('ProductDetail', { product: p })} style={[{ flexDirection: 'row', backgroundColor: C.white, overflow: 'hidden' }, BORDER(1)]}>
                    <View style={{ width: 130, height: 160, backgroundColor: C.hairline, borderRightWidth: 1, borderColor: C.ink }}>
                      <CachedImage source={{ uri: p.img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                      {p.tag && (
                        <View style={[{ position: 'absolute', top: 0, left: 0, paddingHorizontal: 6, paddingVertical: 3, backgroundColor: C.ink }]}>
                          <Text style={{ fontFamily: 'Inter_900Black', fontSize: 8, color: C.white }}>{p.tag}</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ flex: 1, padding: SP.m, justifyContent: 'space-between' }}>
                      <View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={[T.monoB, { fontSize: 10, color: C.ink }]}>{p.brand}</Text>
                          <Text style={[T.mono, { fontSize: 9, color: C.dim }]}>{`${p.reviews} REVIEWS`}</Text>
                        </View>
                        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 14, color: C.ink, marginTop: 4 }} numberOfLines={2}>{p.name}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                          <Ionicons name="star" size={11} color={C.ink} />
                          <Text style={[T.monoB, { fontSize: 11, color: C.ink }]}>{p.rating}</Text>
                          <Text style={[T.mono, { fontSize: 9, color: C.dim }]}>· {p.stock} LEFT</Text>
                        </View>
                      </View>
                      <View>
                        <Text style={{ fontFamily: 'Inter_900Black', fontSize: 18, color: C.ink }}>₹{p.price}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                          <Text style={{ fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: C.dim, textDecorationLine: 'line-through' }}>₹{p.original}</Text>
                          <Text style={[T.monoB, { fontSize: 9, color: C.ink }]}>{'-' + p.discount + '%'}</Text>
                        </View>
                      </View>
                    </View>
                  </Pressable>
                </FadeInUp>
              ))}
            </View>
          )}
        </View>

        {/* ═══ END-OF-FEED CALLOUT ═══ */}
        <View style={{ marginHorizontal: SP.l, marginTop: SP.xl, padding: SP.l, alignItems: 'center' }}>
          <AsciiDivider />
          <Text style={[T.monoB, { color: C.dim, marginTop: 8 }]}>{'◆ END OF FEED ◆'}</Text>
          <Text style={[T.mono, { color: C.dim, fontSize: 9, marginTop: 4, textAlign: 'center' }]}>{'MORE DROPS INCOMING · CHECK BACK IN 60 MIN'}</Text>
          <AsciiDivider faint style={{ marginTop: 8 }} />
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Small helpers for the stats strip inside the hero ────────
function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontFamily: 'Inter_900Black', fontSize: 16, color: C.white }}>{value}</Text>
      <Text style={{ fontFamily: 'SpaceMono_700Bold', fontSize: 8, color: C.white, opacity: 0.5, marginTop: 2, letterSpacing: 1 }}>{label}</Text>
    </View>
  );
}
function StatDivider() {
  return <View style={{ width: 1, backgroundColor: C.white, opacity: 0.3, marginVertical: 4 }} />;
}
