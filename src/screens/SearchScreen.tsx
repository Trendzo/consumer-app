import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, StatusBar, StyleSheet, Image, Keyboard } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { MotiView } from 'moti';
import { C, T, SP, BORDER } from '../theme/brutal';
import { AsciiDivider, Chip } from '../components/Brutal';
import { PRODUCTS } from '../data/mockData';

const RECENT = ['oversized blazer', 'cropped cargo', 'silk dress', 'sneakers'];
const TRENDING = ['Y2K', 'wide leg', 'cargo', 'mesh', 'utility', 'denim', 'satin', 'preppy'];

export default function SearchScreen() {
  const nav = useNavigation<any>();
  const [q, setQ] = useState('');

  const results = useMemo(
    () => q ? PRODUCTS.filter(p => p.name.toLowerCase().includes(q.toLowerCase()) || p.brand.toLowerCase().includes(q.toLowerCase())) : [],
    [q]
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" />
      {/* HEADER */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SP.l, paddingTop: 56, paddingBottom: SP.m, gap: 10 }}>
        <View style={[{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: SP.m, paddingVertical: 12, gap: 10 }, BORDER(1)]}>
          <Feather name="search" size={16} color={C.ink} />
          <TextInput
            value={q}
            onChangeText={setQ}
            autoFocus
            placeholder="SEARCH FITS, BRANDS, VIBES..."
            placeholderTextColor={C.dim}
            style={{ flex: 1, fontFamily: 'SpaceMono_700Bold', fontSize: 11, color: C.ink, padding: 0, letterSpacing: 0.5 }}
          />
          {q.length > 0 && <Pressable onPress={() => setQ('')}><Feather name="x" size={14} color={C.ink} /></Pressable>}
        </View>
        <Pressable onPress={() => { Keyboard.dismiss(); nav.goBack(); }}>
          <Text style={[T.monoB, { fontSize: 11 }]}>{'[CANCEL]'}</Text>
        </Pressable>
      </View>
      <View style={{ height: 1, backgroundColor: C.ink }} />

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 60 }}>
        {q.length === 0 ? (
          <>
            <View style={{ paddingHorizontal: SP.l, paddingTop: SP.l }}>
              <Text style={[T.label]}>{'> RECENT'}</Text>
              <AsciiDivider faint style={{ marginTop: 4 }} />
              {RECENT.map(r => (
                <Pressable key={r} onPress={() => setQ(r)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10 }}>
                  <Feather name="clock" size={14} color={C.dim} />
                  <Text style={[T.body, { flex: 1 }]}>{r}</Text>
                  <Feather name="arrow-up-left" size={14} color={C.dim} />
                </Pressable>
              ))}
            </View>

            <View style={{ paddingHorizontal: SP.l, marginTop: SP.l }}>
              <Text style={[T.label]}>{'> TRENDING'}</Text>
              <AsciiDivider faint style={{ marginTop: 4 }} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {TRENDING.map((t, i) => <Chip key={t} label={`#${t}`} onPress={() => setQ(t)} />)}
              </View>
            </View>

            <View style={{ paddingHorizontal: SP.l, marginTop: SP.xl }}>
              <Text style={[T.label]}>{'> POPULAR DROPS'}</Text>
              <AsciiDivider faint style={{ marginTop: 4 }} />
              {PRODUCTS.slice(0, 4).map((p, i) => (
                <MotiView key={p.id} from={{ opacity: 0, translateX: -10 }} animate={{ opacity: 1, translateX: 0 }} transition={{ delay: i * 60 }}>
                  <Pressable onPress={() => nav.navigate('ProductDetail', { product: p })} style={s.row}>
                    <View style={[{ width: 50, height: 50, overflow: 'hidden' }, BORDER(1)]}>
                      <Image source={{ uri: p.img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[T.bodyB]} numberOfLines={1}>{p.name}</Text>
                      <Text style={[T.mono, { color: C.dim }]}>{p.brand} · ₹{p.price}</Text>
                    </View>
                    <Feather name="arrow-up-right" size={14} color={C.ink} />
                  </Pressable>
                </MotiView>
              ))}
            </View>
          </>
        ) : (
          <View style={{ paddingHorizontal: SP.l, paddingTop: SP.l }}>
            <Text style={[T.mono, { color: C.dim }]}>{`> ${results.length} RESULTS FOR "${q.toUpperCase()}"`}</Text>
            <AsciiDivider style={{ marginTop: 6 }} />
            {results.length === 0 && <Text style={[T.body, { color: C.dim, marginTop: SP.l }]}>No results. Try a broader term.</Text>}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.m, marginTop: SP.m }}>
              {results.map((p, i) => (
                <MotiView key={p.id} from={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 50 }} style={{ width: '47.5%' }}>
                  <Pressable onPress={() => nav.navigate('ProductDetail', { product: p })}>
                    <View style={[{ height: 200, overflow: 'hidden' }, BORDER(1)]}>
                      <Image source={{ uri: p.img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                    </View>
                    <Text style={[T.monoB, { fontSize: 9, marginTop: 6 }]}>{p.brand}</Text>
                    <Text style={[T.body]} numberOfLines={1}>{p.name}</Text>
                    <Text style={{ fontFamily: 'Inter_900Black', fontSize: 14, color: C.ink }}>₹{p.price}</Text>
                  </Pressable>
                </MotiView>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
});
