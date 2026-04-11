// HOME — Modern Brutalism / ASCII art / monochrome
import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, Pressable, Image, StyleSheet, StatusBar, Animated, Easing, RefreshControl } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { useNavigation } from '@react-navigation/native';
import { C, T, SP, BORDER, ASCII } from '../theme/brutal';
import { AsciiDivider, BrutalButton, BrutalIconBtn, Chip, FadeInUp, ProductCard, SectionHead } from '../components/Brutal';
import { PRODUCTS, CATEGORIES, GAMES, REELS, BRANDS, OCCASIONS, BUNDLES, COMMUNITY, HERO_IMG } from '../data/mockData';
import { useApp } from '../state/AppState';

const HOME_HERO = require('../../assets/home.jpeg');

export default function HomeScreen() {
  const nav = useNavigation<any>();
  const { user, cartCount, night, toggleNight } = useApp();
  const s = React.useMemo(() => makeS(), [night]);
  const [gender, setGender] = useState<'her' | 'him'>('her');
  const [refreshing, setRefreshing] = useState(false);
  const [time, setTime] = useState({ h: 2, m: 47, s: 19 });

  // Live countdown
  useEffect(() => {
    const t = setInterval(() => {
      setTime(prev => {
        let { h, m, s } = prev;
        s -= 1;
        if (s < 0) { s = 59; m -= 1; }
        if (m < 0) { m = 59; h -= 1; }
        if (h < 0) { h = 23; }
        return { h, m, s };
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 900);
  };

  const goToProduct = (p: any) => nav.navigate('ProductDetail', { product: p });

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={{ paddingTop: 56, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.ink} />}
      >
        {/* HEADER */}
        <View style={s.header}>
          <View>
            <Text style={[T.mono, { letterSpacing: 1 }]}>{`> CLOSET-X.SYS // v4.26`}</Text>
            <Text style={s.logo}>CLOSET×</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <BrutalIconBtn icon={night ? 'sun' : 'moon'} onPress={toggleNight} />
            <BrutalIconBtn icon="bell" onPress={() => nav.navigate('Notifications')} />
            <BrutalIconBtn icon="shopping-bag" onPress={() => nav.navigate('Cart')} />
          </View>
        </View>

        {/* USER STRIP */}
        <View style={s.userStrip}>
          <Text style={[T.monoB, { fontSize: 11 }]}>{`HELLO, ${user?.name?.toUpperCase() || 'GUEST'}`}</Text>
          <Text style={[T.mono, { color: C.dim, fontSize: 10 }]}>{cartCount > 0 ? `${cartCount} IN BAG` : 'BAG EMPTY'}</Text>
        </View>

        {/* SEARCH */}
        <Pressable onPress={() => nav.navigate('Search')} style={s.search}>
          <Feather name="search" size={16} color={C.ink} />
          <Text style={[T.mono, { flex: 1 }]}>SEARCH 60-MIN DROPS...</Text>
          <View style={s.searchKey}><Text style={[T.monoB, { fontSize: 9 }]}>{'⌘ K'}</Text></View>
        </Pressable>

        {/* GENDER */}
        <View style={{ paddingHorizontal: SP.l, marginTop: SP.m, flexDirection: 'row', alignItems: 'center', gap: 0 }}>
          <Pressable onPress={() => setGender('her')} style={[s.genderBtn, gender === 'her' && { backgroundColor: C.ink }]}>
            <Text style={[s.genderTxt, gender === 'her' && { color: C.white }]}>FOR HER</Text>
          </Pressable>
          <Pressable onPress={() => setGender('him')} style={[s.genderBtn, gender === 'him' && { backgroundColor: C.ink }, { borderLeftWidth: 0 }]}>
            <Text style={[s.genderTxt, gender === 'him' && { color: C.white }]}>FOR HIM</Text>
          </Pressable>
          <View style={{ flex: 1 }} />
          <Text style={[T.mono, { color: C.dim }]}>{`MODE: ${gender.toUpperCase()}`}</Text>
        </View>

        {/* HERO */}
        <FadeInUp delay={50}>
          <View style={[s.hero, BORDER(1)]}>
            <Image source={HOME_HERO} style={s.heroImg} resizeMode="contain" />
            <View style={s.heroOverlay}>
              <View style={[s.heroBadge, BORDER(1)]}>
                <Text style={[T.monoB, { fontSize: 10 }]}>⚡ 60-MIN ETA</Text>
              </View>
              <Text style={s.heroTitle}>FITS{'\n'}IN AN{'\n'}HOUR.</Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <Text style={[T.monoB, { color: C.white, fontSize: 10 }]}>{`// FROM YOUR BLOCK`}</Text>
                <Pressable onPress={() => nav.navigate('Category', { id: 'all', label: 'All Drops' })} style={[s.heroCta, BORDER(1)]}>
                  <Text style={{ fontFamily: 'Inter_900Black', color: C.white, fontSize: 12, letterSpacing: 0.5 }}>SHOP NOW ──▶</Text>
                </Pressable>
              </View>
            </View>
            <View style={[s.heroCorner, { top: -1, left: -1 }]}><Text style={[T.monoB, { fontSize: 14 }]}>┌</Text></View>
            <View style={[s.heroCorner, { top: -1, right: -1 }]}><Text style={[T.monoB, { fontSize: 14 }]}>┐</Text></View>
            <View style={[s.heroCorner, { bottom: -1, left: -1 }]}><Text style={[T.monoB, { fontSize: 14 }]}>└</Text></View>
            <View style={[s.heroCorner, { bottom: -1, right: -1 }]}><Text style={[T.monoB, { fontSize: 14 }]}>┘</Text></View>
          </View>
        </FadeInUp>

        {/* QUICK ACTIONS */}
        <View style={{ paddingHorizontal: SP.l, marginTop: SP.l, flexDirection: 'row', gap: SP.s }}>
          <QuickAction icon="zap" label="Flash" onPress={() => nav.navigate('Category', { id: 'flash', label: 'Flash Sale' })} />
          <QuickAction icon="trending-up" label="Trending" onPress={() => nav.navigate('Category', { id: 'trending', label: 'Trending' })} />
          <QuickAction icon="gift" label="Daily" onPress={() => nav.navigate('DailyReward')} />
          <QuickAction icon="camera" label="Try-on" onPress={() => nav.navigate('TryOn')} />
        </View>

        {/* CATEGORIES */}
        <SectionHead title="SHOP BY" emphasis="VIBE" action="ALL" onAction={() => nav.navigate('Category', { id: 'all', label: 'All Categories' })} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SP.l, gap: SP.m }}>
          {CATEGORIES.map((c, i) => (
            <Pressable key={c.id} onPress={() => nav.navigate('Category', { id: c.id, label: c.label })}>
              <FadeInUp delay={i * 30}>
                <View style={[s.catCard, BORDER(1)]}>
                  <Image source={{ uri: c.img }} style={s.catImg} resizeMode="contain" />
                  <View style={s.catFoot}>
                    <Text style={[T.monoB, { fontSize: 9 }]}>{`0${i + 1}`}</Text>
                    <Text style={s.catLbl}>{c.label.toUpperCase()}</Text>
                  </View>
                </View>
              </FadeInUp>
            </Pressable>
          ))}
        </ScrollView>

        {/* FLASH SALE */}
        <SectionHead title="FLASH" emphasis="SALE" action="ALL DEALS" onAction={() => nav.navigate('Category', { id: 'flash', label: 'Flash Sale' })} />
        <View style={{ paddingHorizontal: SP.l }}>
          <View style={[{ backgroundColor: C.ink, padding: SP.m, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
            <View>
              <Text style={[T.monoB, { color: C.white, fontSize: 10 }]}>{'// TIME-LOCKED'}</Text>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 18, color: C.white, marginTop: 2 }}>50% OFF · ENDS IN</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {[String(time.h).padStart(2, '0'), String(time.m).padStart(2, '0'), String(time.s).padStart(2, '0')].map((n, i) => (
                <View key={i} style={{ width: 32, paddingVertical: 6, alignItems: 'center', backgroundColor: C.white }}>
                  <Text style={{ fontFamily: 'SpaceMono_700Bold', fontSize: 14, color: C.ink }}>{n}</Text>
                  <Text style={{ fontFamily: 'SpaceMono_400Regular', fontSize: 7, color: C.dim, marginTop: -2 }}>{['HR', 'MN', 'SC'][i]}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SP.l, paddingTop: SP.m, gap: SP.m }}>
          {PRODUCTS.slice(0, 5).map((p, i) => (
            <View key={p.id}>
              <ProductCard p={p} onPress={() => goToProduct(p)} />
              <View style={{ marginTop: 6, height: 4, backgroundColor: C.hairline }}>
                <View style={{ width: `${60 + i * 8}%`, height: '100%', backgroundColor: C.ink }} />
              </View>
              <Text style={[T.mono, { fontSize: 9, color: C.dim, marginTop: 2 }]}>{60 + i * 8}% CLAIMED</Text>
            </View>
          ))}
        </ScrollView>

        {/* GAMIFICATION */}
        <SectionHead title="PLAY" emphasis="& WIN" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SP.l, gap: SP.m }}>
          {GAMES.map((g, i) => (
            <Pressable key={g.id} onPress={() => {
              if (g.id === 'g1') nav.navigate('DailyReward');
              else if (g.id === 'g2') nav.navigate('SpinWheel');
              else if (g.id === 'g4') nav.navigate('StyleQuiz');
              else nav.navigate('DailyReward');
            }}>
              <FadeInUp delay={i * 40}>
                <View style={[s.gameCard, BORDER(1)]}>
                  <View style={s.gameTopLine}>
                    <Text style={[T.monoB, { fontSize: 9 }]}>{`QUEST_0${i + 1}`}</Text>
                    <Text style={[T.monoB, { fontSize: 9 }]}>[+]</Text>
                  </View>
                  <Ionicons name={g.icon as any} size={32} color={C.ink} style={{ marginTop: 8 }} />
                  <Text style={{ fontFamily: 'Inter_900Black', fontSize: 13, color: C.ink, marginTop: 8, letterSpacing: 0.3 }}>{g.title.toUpperCase()}</Text>
                  <Text style={[T.body, { fontSize: 11, color: C.dim, marginTop: 2 }]}>{g.subtitle}</Text>
                  <View style={{ marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderColor: C.ink, paddingTop: 8 }}>
                    <Text style={[T.monoB, { fontSize: 10 }]}>{`▶ ${g.cta}`}</Text>
                    <Feather name="arrow-up-right" size={14} color={C.ink} />
                  </View>
                </View>
              </FadeInUp>
            </Pressable>
          ))}
        </ScrollView>

        {/* TRENDING */}
        <SectionHead title="TRENDING" emphasis="NOW" action="VIEW ALL" onAction={() => nav.navigate('Category', { id: 'trending', label: 'Trending Now' })} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SP.l, gap: SP.m }}>
          {PRODUCTS.slice(2, 8).map((p, i) => (
            <FadeInUp key={p.id} delay={i * 30}>
              <View>
                <Text style={[T.monoB, { fontSize: 9, marginBottom: 4 }]}>{`#0${i + 1} RANK`}</Text>
                <ProductCard p={p} onPress={() => goToProduct(p)} />
              </View>
            </FadeInUp>
          ))}
        </ScrollView>

        {/* REELS PREVIEW */}
        <SectionHead title="REELS" emphasis="LIVE" action="WATCH" onAction={() => nav.navigate('Tabs', { screen: 'ReelsTab' })} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SP.l, gap: SP.m }}>
          {REELS.map((r, i) => (
            <Pressable key={r.id} onPress={() => nav.navigate('Tabs', { screen: 'ReelsTab' })}>
              <FadeInUp delay={i * 30}>
                <View style={[s.reelCard, BORDER(1)]}>
                  <Image source={{ uri: r.img }} style={StyleSheet.absoluteFillObject as any} />
                  <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.35)' }]} />
                  <View style={s.reelTop}>
                    <View style={[s.liveDot, BORDER(1)]}><Text style={[T.monoB, { color: C.white, fontSize: 8 }]}>● LIVE</Text></View>
                  </View>
                  <View style={[s.reelPlay, BORDER(1)]}>
                    <Feather name="play" size={16} color={C.ink} />
                  </View>
                  <View style={{ position: 'absolute', bottom: 10, left: 10, right: 10 }}>
                    <Text style={[T.monoB, { color: C.white, fontSize: 10 }]}>{r.user}</Text>
                    <Text style={{ color: C.white, fontFamily: 'Inter_700Bold', fontSize: 11, marginTop: 1 }} numberOfLines={1}>{r.title}</Text>
                  </View>
                </View>
              </FadeInUp>
            </Pressable>
          ))}
        </ScrollView>

        {/* OUTFIT BUNDLES */}
        <SectionHead title="GET" emphasis="THE LOOK" />
        <View style={{ paddingHorizontal: SP.l, gap: SP.m }}>
          {BUNDLES.map((b, i) => (
            <FadeInUp key={b.id} delay={i * 40}>
              <Pressable onPress={() => nav.navigate('Category', { id: 'bundle-' + b.id, label: b.title })} style={[{ flexDirection: 'row', backgroundColor: C.white }, BORDER(1)]}>
                <View style={{ width: 130, height: 130, borderRightWidth: 1, borderColor: C.ink, overflow: 'hidden' }}>
                  <Image source={{ uri: b.img }} style={{ width: '100%', height: '100%' }} />
                </View>
                <View style={{ flex: 1, padding: SP.m, justifyContent: 'space-between' }}>
                  <View>
                    <Text style={[T.monoB, { fontSize: 9 }]}>{`LOOK_0${i + 1}`}</Text>
                    <Text style={{ fontFamily: 'Inter_900Black', fontSize: 16, color: C.ink, marginTop: 4, letterSpacing: -0.3 }}>{b.title.toUpperCase()}</Text>
                    <Text style={[T.body, { fontSize: 11, color: C.dim, marginTop: 2 }]}>{b.pieces} PIECES · CURATED</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontFamily: 'Inter_900Black', fontSize: 18, color: C.ink }}>₹{b.price}</Text>
                    <Text style={[T.monoB, { fontSize: 10 }]}>{'SHOP ──▶'}</Text>
                  </View>
                </View>
              </Pressable>
            </FadeInUp>
          ))}
        </View>

        {/* OCCASIONS */}
        <SectionHead title="THE" emphasis="OCCASION" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SP.l, gap: SP.m }}>
          {OCCASIONS.map((o, i) => (
            <Pressable key={o.id} onPress={() => nav.navigate('Category', { id: o.id, label: o.label })}>
              <FadeInUp delay={i * 30}>
                <View style={[s.occCard, BORDER(1)]}>
                  <Image source={{ uri: o.img }} style={StyleSheet.absoluteFillObject as any} />
                  <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.35)' }]} />
                  <View style={{ padding: 10, justifyContent: 'space-between', flex: 1 }}>
                    <Text style={[T.monoB, { color: C.white, fontSize: 9 }]}>{`MODE_0${i + 1}`}</Text>
                    <View>
                      <Text style={{ fontFamily: 'Inter_900Black', fontSize: 18, color: C.white, letterSpacing: 0.3 }}>{o.label.toUpperCase()}</Text>
                      <Text style={{ color: C.white, fontFamily: 'Inter_700Bold', fontSize: 18, marginTop: 4 }}>──▶</Text>
                    </View>
                  </View>
                </View>
              </FadeInUp>
            </Pressable>
          ))}
        </ScrollView>

        {/* BRANDS */}
        <SectionHead title="BRAND" emphasis="ARMY" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SP.l, gap: SP.s }}>
          {BRANDS.map((b, i) => (
            <Chip key={b.id} label={b.name} onPress={() => nav.navigate('Category', { id: 'brand-' + b.id, label: b.name })} />
          ))}
        </ScrollView>

        {/* COUPON */}
        <View style={{ paddingHorizontal: SP.l, marginTop: SP.xl }}>
          <View style={[{ padding: SP.l, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.white }, BORDER(1)]}>
            <View style={{ flex: 1 }}>
              <Text style={[T.monoB, { fontSize: 10 }]}>{'// FIRST.ORDER'}</Text>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 22, color: C.ink, marginTop: 4 }}>₹500 OFF</Text>
              <View style={[{ alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, marginTop: 8 }, BORDER(1)]}>
                <Text style={[T.monoB, { fontSize: 11 }]}>{'> NEWVIBE'}</Text>
              </View>
            </View>
            <Text style={{ fontFamily: 'Inter_900Black', fontSize: 50, color: C.ink, letterSpacing: -2 }}>50%</Text>
          </View>
        </View>

        {/* COMMUNITY */}
        <SectionHead title="THE" emphasis="FEED" action="POST" onAction={() => nav.navigate('Notifications')} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SP.l, gap: SP.m }}>
          {COMMUNITY.map(p => (
            <View key={p.id} style={{ width: 140 }}>
              <View style={[{ height: 180, overflow: 'hidden' }, BORDER(1)]}>
                <Image source={{ uri: p.img }} style={StyleSheet.absoluteFillObject as any} />
              </View>
              <Text style={[T.monoB, { fontSize: 10, marginTop: 6 }]}>{p.user}</Text>
              <Text style={[T.mono, { fontSize: 9, color: C.dim }]}>{`♥ ${p.likes}`}</Text>
            </View>
          ))}
        </ScrollView>

        {/* FOOTER */}
        <View style={{ paddingHorizontal: SP.l, marginTop: SP.huge }}>
          <AsciiDivider />
          <Text style={[T.mono, { color: C.dim, textAlign: 'center', marginTop: 8, fontSize: 9 }]}>// END.STREAM · CLOSET× · v4.26 //</Text>
          <Text style={[T.mono, { color: C.dim, textAlign: 'center', marginTop: 4, fontSize: 9 }]}>FROM YOUR BLOCK · IN 60 MINUTES</Text>
          <AsciiDivider faint style={{ marginTop: 8 }} />
        </View>
      </ScrollView>
    </View>
  );
}

function QuickAction({ icon, label, onPress }: { icon: any; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[{ flex: 1, paddingVertical: SP.m, alignItems: 'center', gap: 6, backgroundColor: C.white }, BORDER(1)]}>
      <Feather name={icon} size={18} color={C.ink} />
      <Text style={[T.monoB, { fontSize: 9 }]}>{label.toUpperCase()}</Text>
    </Pressable>
  );
}

const makeS = () => StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: SP.l, marginBottom: SP.m },
  logo: { fontFamily: 'Inter_900Black', fontSize: 26, color: C.ink, letterSpacing: -1, marginTop: 2 },
  userStrip: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: SP.l, paddingVertical: 6, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.ink, marginBottom: SP.m },
  search: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SP.m, paddingVertical: 12, gap: 10, marginHorizontal: SP.l, borderWidth: 1, borderColor: C.ink, backgroundColor: C.white },
  searchKey: { paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: C.ink },

  genderBtn: { paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: C.ink },
  genderTxt: { fontFamily: 'Inter_900Black', fontSize: 11, color: C.ink, letterSpacing: 0.5 },

  hero: { marginHorizontal: SP.l, marginTop: SP.l, height: 380, overflow: 'hidden', backgroundColor: C.white },
  heroImg: { position: 'absolute', left: 0, right: 0, top: -310, bottom: 310, width: '100%' },
  heroOverlay: { flex: 1, padding: 18, justifyContent: 'space-between', backgroundColor: 'rgba(0,0,0,0.25)' },
  heroBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, backgroundColor: C.white },
  heroTitle: { fontFamily: 'Inter_900Black', fontSize: 60, color: C.white, lineHeight: 58, letterSpacing: -2.5, textShadowColor: C.ink, textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 0 },
  heroCta: { paddingHorizontal: 14, paddingVertical: 10, backgroundColor: C.ink },
  heroCorner: { position: 'absolute', width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },

  catCard: { width: 120, height: 150, backgroundColor: '#f3f3f3', overflow: 'hidden' },
  catImg: { width: '100%', height: 100, padding: 10 },
  catFoot: { borderTopWidth: 1, borderColor: C.ink, padding: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flex: 1 },
  catLbl: { fontFamily: 'Inter_900Black', fontSize: 10, color: C.ink, letterSpacing: 0.3 },

  gameCard: { width: 170, padding: SP.m, backgroundColor: C.white, height: 210 },
  gameTopLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  reelCard: { width: 150, height: 230, overflow: 'hidden', backgroundColor: C.white },
  reelTop: { padding: 10 },
  liveDot: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 3, backgroundColor: C.ink },
  reelPlay: { position: 'absolute', top: '45%', left: '50%', marginLeft: -18, width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white },

  occCard: { width: 150, height: 200, overflow: 'hidden', backgroundColor: C.white },
});
