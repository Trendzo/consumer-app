// Feature screens — Image Search, Coupon Wallet, Community Feed, Mood Board,
// Lucky Draw, Invite Friends, App Challenges, New Arrivals, Discover Brands,
// For Her, For Him, Occasion Shopping, Flash Sale, Trending
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Image, StyleSheet, StatusBar, Alert, Animated, Easing, Modal, Share } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { MotiView } from 'moti';
import { C, T, SP, BORDER, ASCII } from '../theme/brutal';
import { ScreenHeader, AsciiDivider, BrutalButton, BrutalStatusBar, FadeInUp, ProductCard, Chip, SectionHead } from '../components/Brutal';
import { PRODUCTS, BRANDS, OCCASIONS, COMMUNITY, BUNDLES, CATEGORIES } from '../data/mockData';
import { useApp } from '../state/AppState';

// ─── IMAGE SEARCH ──────────────────────────────────────────
// Stubbed but feels real: the user picks a source, watches a fake scan on a
// stand-in product image, and lands on a grid of "similar" PRODUCTS.
const FAKE_SCAN_IMAGES = PRODUCTS.slice(0, 6).map(p => p.img);

export function ImageSearchScreen() {
  const nav = useNavigation<any>();
  const [pickerOpen, setPickerOpen] = useState(true);
  const [stage, setStage] = useState<'idle' | 'camera' | 'scanning' | 'results'>('idle');
  const [pickedImg, setPickedImg] = useState<string | null>(null);
  const scanAnim = useRef(new Animated.Value(0)).current;
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('back');

  const beginScan = (imgUri: string) => {
    setPickedImg(imgUri);
    setStage('scanning');
    scanAnim.setValue(0);
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(scanAnim, { toValue: 0, duration: 900, easing: Easing.linear, useNativeDriver: true }),
      ])
    ).start();
    setTimeout(() => setStage('results'), 1800);
  };

  const runScan = async (src: 'camera' | 'gallery') => {
    setPickerOpen(false);
    if (src === 'camera') {
      if (!permission?.granted) {
        const res = await requestPermission();
        if (!res.granted) {
          Alert.alert('Camera blocked', 'Enable camera access in Settings to snap a photo.');
          setPickerOpen(true);
          return;
        }
      }
      setStage('camera');
      return;
    }
    // Gallery — pick a real photo from the user's library
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Gallery blocked', 'Enable photo access in Settings to upload an image.');
      setPickerOpen(true);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]?.uri) {
      setPickerOpen(true);
      return;
    }
    beginScan(result.assets[0].uri);
  };

  const snapPhoto = async () => {
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.6, skipProcessing: true });
      const uri = photo?.uri || FAKE_SCAN_IMAGES[0];
      beginScan(uri);
    } catch {
      beginScan(FAKE_SCAN_IMAGES[0]);
    }
  };

  const reset = () => {
    setStage('idle');
    setPickedImg(null);
    setPickerOpen(true);
    scanAnim.stopAnimation();
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <BrutalStatusBar />
      <ScreenHeader title="Image Search" onBack={() => nav.goBack()} />

      {stage === 'idle' && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: SP.l }}>
          <FadeInUp>
            <View style={[{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white }, BORDER(1)]}>
              <Feather name="camera" size={48} color={C.ink} />
            </View>
          </FadeInUp>
          <FadeInUp delay={60}>
            <Text style={{ fontFamily: 'Inter_900Black', fontSize: 28, color: C.ink, marginTop: SP.xl, textAlign: 'center', letterSpacing: -1 }}>SNAP TO{'\n'}FIND.</Text>
            <Text style={[T.body, { color: C.dim, marginTop: SP.s, textAlign: 'center', maxWidth: 280 }]}>Take a photo or upload an image to find similar products instantly.</Text>
          </FadeInUp>
          <View style={{ marginTop: SP.xl }}>
            <BrutalButton label="Pick a source" icon="image" onPress={() => setPickerOpen(true)} />
          </View>
          <FadeInUp delay={120}>
            <Text style={[T.mono, { color: C.dim, marginTop: SP.xl, textAlign: 'center' }]}>{'// AI-POWERED · VISUAL SEARCH · 98% ACCURACY'}</Text>
          </FadeInUp>
        </View>
      )}

      {stage === 'camera' && (
        <View style={{ flex: 1, padding: SP.l }}>
          <View style={[{ flex: 1, backgroundColor: '#000', overflow: 'hidden' }, BORDER(1)]}>
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFillObject as any} facing={facing} />
            {/* HUD */}
            <View style={{ position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: C.ink }}>
                <Text style={[T.monoB, { color: C.white, fontSize: 9 }]}>◉ FRAME A FIT</Text>
              </View>
              <Pressable onPress={() => setFacing(f => (f === 'front' ? 'back' : 'front'))} hitSlop={8} style={[{ width: 30, height: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white }, BORDER(1)]}>
                <Feather name="refresh-cw" size={14} color={C.ink} />
              </Pressable>
            </View>
            {/* Corner ticks */}
            {['┌','┐','└','┘'].map((ch, i) => (
              <Text key={i} style={[T.monoB, { position: 'absolute', ...[{top:6,left:8},{top:6,right:8},{bottom:6,left:8},{bottom:6,right:8}][i], color: C.white, fontSize: 18 }]} pointerEvents="none">{ch}</Text>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: SP.s, marginTop: SP.m }}>
            <BrutalButton label="Cancel" icon="x" variant="outline" onPress={() => { setStage('idle'); setPickerOpen(true); }} style={{ flex: 1 }} />
            <BrutalButton label="Capture" icon="camera" onPress={snapPhoto} style={{ flex: 2 }} />
          </View>
        </View>
      )}

      {stage === 'scanning' && pickedImg && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: SP.l }}>
          <View style={[{ width: 260, height: 320, backgroundColor: C.hairline, overflow: 'hidden' }, BORDER(1)]}>
            <Image source={{ uri: pickedImg }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            {/* scanning laser line */}
            <Animated.View
              style={{
                position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: C.ink,
                transform: [{ translateY: scanAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 318] }) }],
              }}
            />
            {/* corner ticks */}
            {['┌','┐','└','┘'].map((ch, i) => (
              <Text key={i} style={[T.monoB, { position: 'absolute', ...[{top:4,left:6},{top:4,right:6},{bottom:4,left:6},{bottom:4,right:6}][i], color: C.ink, fontSize: 16 }]}>{ch}</Text>
            ))}
          </View>
          <Text style={{ fontFamily: 'Inter_900Black', fontSize: 22, color: C.ink, marginTop: SP.xl, letterSpacing: -0.5 }}>SCANNING...</Text>
          <Text style={[T.mono, { color: C.dim, marginTop: 4 }]}>{'// MATCHING COLOR · CUT · FABRIC'}</Text>
        </View>
      )}

      {stage === 'results' && pickedImg && (
        <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 60 }}>
          <View style={{ flexDirection: 'row', gap: SP.m, alignItems: 'center' }}>
            <View style={[{ width: 80, height: 100, backgroundColor: C.hairline, overflow: 'hidden' }, BORDER(1)]}>
              <Image source={{ uri: pickedImg }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[T.monoB, { fontSize: 10, color: C.dim }]}>{'> YOUR IMAGE'}</Text>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 18, color: C.ink, letterSpacing: -0.5, marginTop: 2 }}>12 MATCHES FOUND</Text>
              <Pressable onPress={reset} style={[{ marginTop: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, backgroundColor: C.white }, BORDER(1)]}>
                <Text style={[T.monoB, { fontSize: 9 }]}>⟲ TRY ANOTHER</Text>
              </Pressable>
            </View>
          </View>
          <AsciiDivider style={{ marginTop: SP.m }} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: SP.m }}>
            {PRODUCTS.slice(0, 8).map((p, i) => (
              <FadeInUp key={p.id} delay={i * 40}>
                <Pressable onPress={() => nav.navigate('ProductDetail', { product: p })} style={{ width: 160, marginBottom: SP.m }}>
                  <View style={[{ height: 180, backgroundColor: C.hairline, overflow: 'hidden' }, BORDER(1)]}>
                    <Image source={{ uri: p.img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                    <View style={{ position: 'absolute', top: 6, left: 6, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: C.ink }}>
                      <Text style={[T.monoB, { color: C.white, fontSize: 8 }]}>{`${98 - i * 3}% MATCH`}</Text>
                    </View>
                  </View>
                  <Text style={[T.monoB, { fontSize: 9, marginTop: 4 }]}>{p.brand}</Text>
                  <Text style={[T.body, { marginTop: 1 }]} numberOfLines={1}>{p.name}</Text>
                  <Text style={{ fontFamily: 'Inter_900Black', fontSize: 13, color: C.ink, marginTop: 2 }}>₹{p.price}</Text>
                </Pressable>
              </FadeInUp>
            ))}
          </View>
        </ScrollView>
      )}

      {/* SOURCE PICKER MODAL — matches brutalist sheet style */}
      <Modal transparent visible={pickerOpen} animationType="none" onRequestClose={() => setPickerOpen(false)}>
        <Pressable onPress={() => setPickerOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
          <MotiView
            from={{ translateY: 400 }}
            animate={{ translateY: 0 }}
            transition={{ type: 'timing', duration: 320 }}
            onStartShouldSetResponder={() => true}
            style={{ backgroundColor: C.white, paddingTop: SP.m, paddingHorizontal: SP.l, paddingBottom: 36, borderTopWidth: 2, borderColor: C.ink }}
          >
            <View style={{ alignSelf: 'center', width: 44, height: 4, backgroundColor: C.ink, marginBottom: SP.m }} />
            <Text style={[T.monoB, { fontSize: 10, color: C.dim }]}>{'> IMAGE_SOURCE'}</Text>
            <Text style={{ fontFamily: 'Inter_900Black', fontSize: 26, color: C.ink, letterSpacing: -1, marginTop: 4 }}>GRAB AN IMAGE</Text>
            <Text style={[T.mono, { color: C.dim, fontSize: 10, marginTop: 4 }]}>We'll scan it and find matches.</Text>

            <View style={{ marginTop: SP.l, gap: SP.s }}>
              {[
                { id: 'camera', icon: 'camera', title: 'TAKE PHOTO', desc: 'Snap a fit in the wild — we match it.' },
                { id: 'gallery', icon: 'upload', title: 'UPLOAD FROM GALLERY', desc: 'Pick any shot from your photos.' },
              ].map((opt, i) => (
                <MotiView key={opt.id} from={{ opacity: 0, translateX: -20 }} animate={{ opacity: 1, translateX: 0 }} transition={{ delay: 120 + i * 80, type: 'timing', duration: 280 }}>
                  <Pressable onPress={() => runScan(opt.id as any)} style={[{ padding: SP.m, backgroundColor: C.white }, BORDER(1)]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={{ width: 46, height: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: C.ink }}>
                        <Feather name={opt.icon as any} size={20} color={C.white} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: 'Inter_900Black', fontSize: 13, color: C.ink, letterSpacing: 0.5 }}>{opt.title}</Text>
                        <Text style={[T.mono, { fontSize: 9, color: C.dim, marginTop: 3 }]}>{opt.desc}</Text>
                      </View>
                      <Feather name="arrow-right" size={16} color={C.ink} />
                    </View>
                  </Pressable>
                </MotiView>
              ))}
            </View>

            <Pressable onPress={() => { setPickerOpen(false); if (stage === 'idle') nav.goBack(); }} style={{ marginTop: SP.m, alignSelf: 'center', paddingVertical: 8 }}>
              <Text style={[T.mono, { color: C.dim, textDecorationLine: 'underline' }]}>cancel</Text>
            </Pressable>
          </MotiView>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── COUPON WALLET ─────────────────────────────────────────
const COUPONS = [
  { id: '1', code: 'NEWVIBE', discount: '₹500 OFF', min: 'Min ₹999', expires: '30 Apr', active: true },
  { id: '2', code: 'FLASH50', discount: '50% OFF', min: 'Min ₹1,499', expires: '15 Apr', active: true },
  { id: '3', code: 'FREESHIP', discount: 'FREE DELIVERY', min: 'No minimum', expires: '31 May', active: true },
  { id: '4', code: 'LOYALTY10', discount: '10% OFF', min: 'Min ₹599', expires: '20 Apr', active: true },
  { id: '5', code: 'SUMMER25', discount: '25% OFF', min: 'Min ₹2,000', expires: '1 Jun', active: false },
];

export function CouponWalletScreen() {
  const nav = useNavigation<any>();
  const { showToast } = useApp();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <BrutalStatusBar />
      <ScreenHeader title="Coupons" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 60 }}>
        <FadeInUp>
          <Text style={[T.monoB, { fontSize: 11 }]}>{'> COUPON_WALLET'}</Text>
          <Text style={{ fontFamily: 'Inter_900Black', fontSize: 32, color: C.ink, letterSpacing: -1.2, marginTop: 4 }}>YOUR{'\n'}COUPONS.</Text>
        </FadeInUp>
        <AsciiDivider style={{ marginTop: SP.l }} />
        {COUPONS.map((c, i) => (
          <FadeInUp key={c.id} delay={i * 50}>
            <View style={[{ marginTop: SP.m, flexDirection: 'row', backgroundColor: C.white, overflow: 'hidden' }, BORDER(1), !c.active && { opacity: 0.5 }]}>
              <View style={{ width: 90, alignItems: 'center', justifyContent: 'center', backgroundColor: C.ink, padding: SP.s }}>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: 16, color: C.white, textAlign: 'center' }}>{c.discount}</Text>
              </View>
              <View style={{ flex: 1, padding: SP.m }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[T.monoB, { fontSize: 14 }]}>{c.code}</Text>
                  <Pressable onPress={() => showToast('Copied', `${c.code} copied to clipboard`, 'copy')}>
                    <Feather name="copy" size={14} color={C.ink} />
                  </Pressable>
                </View>
                <Text style={[T.mono, { color: C.dim, fontSize: 10, marginTop: 4 }]}>{c.min} · Expires {c.expires}</Text>
              </View>
            </View>
          </FadeInUp>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── COMMUNITY FEED ────────────────────────────────────────
const FEED_POSTS = [
  { id: '1', user: '@zara.fits', caption: 'Sunday brunch fit check', likes: 1240, comments: 89, img: 'https://images.unsplash.com/photo-1485518882345-15568b007407?w=500&q=80' },
  { id: '2', user: '@ren.style', caption: 'Office power look for Monday', likes: 892, comments: 45, img: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=500&q=80' },
  { id: '3', user: '@mia.x', caption: 'Date night vibes', likes: 2103, comments: 156, img: 'https://images.unsplash.com/photo-1581044777550-4cfa60707c03?w=500&q=80' },
  { id: '4', user: '@kio.drip', caption: 'Vintage thrift haul of the week', likes: 654, comments: 32, img: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=500&q=80' },
  { id: '5', user: '@nova.fit', caption: 'Festival season ready', likes: 1876, comments: 98, img: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=500&q=80' },
];

export function CommunityFeedScreen() {
  const nav = useNavigation<any>();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <BrutalStatusBar />
      <ScreenHeader title="Community" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 60 }}>
        <FadeInUp>
          <Text style={[T.monoB, { fontSize: 11 }]}>{'> THE_FEED'}</Text>
          <Text style={{ fontFamily: 'Inter_900Black', fontSize: 32, color: C.ink, letterSpacing: -1.2, marginTop: 4 }}>COMMUNITY{'\n'}FITS.</Text>
        </FadeInUp>
        <AsciiDivider style={{ marginTop: SP.l }} />
        {FEED_POSTS.map((p, i) => (
          <FadeInUp key={p.id} delay={i * 50}>
            <View style={[{ marginTop: SP.m, backgroundColor: C.white, overflow: 'hidden' }, BORDER(1)]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: SP.m, gap: 10 }}>
                <View style={[{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: C.ink }]}>
                  <Text style={{ fontFamily: 'Inter_900Black', color: C.white, fontSize: 12 }}>{p.user[1].toUpperCase()}</Text>
                </View>
                <Text style={[T.monoB, { fontSize: 11 }]}>{p.user}</Text>
              </View>
              <View style={{ height: 300, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.ink }}>
                <Image source={{ uri: p.img }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              </View>
              <View style={{ padding: SP.m }}>
                <View style={{ flexDirection: 'row', gap: SP.l }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Feather name="heart" size={16} color={C.ink} />
                    <Text style={[T.monoB, { fontSize: 11 }]}>{p.likes}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Feather name="message-square" size={16} color={C.ink} />
                    <Text style={[T.monoB, { fontSize: 11 }]}>{p.comments}</Text>
                  </View>
                  <View style={{ flex: 1 }} />
                  <Feather name="bookmark" size={16} color={C.ink} />
                </View>
                <Text style={[T.bodyB, { marginTop: 8 }]}>{p.caption}</Text>
              </View>
            </View>
          </FadeInUp>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── MOOD BOARD ────────────────────────────────────────────
export function MoodBoardScreen() {
  const nav = useNavigation<any>();
  const { showToast } = useApp();
  const boards = [
    { id: '1', name: 'SUMMER FITS', items: 6 },
    { id: '2', name: 'WORK OUTFITS', items: 4 },
    { id: '3', name: 'DATE NIGHT', items: 3 },
  ];
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <BrutalStatusBar />
      <ScreenHeader title="Mood Board" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 60 }}>
        <FadeInUp>
          <Text style={[T.monoB, { fontSize: 11 }]}>{'> SAVED_BOARDS'}</Text>
          <Text style={{ fontFamily: 'Inter_900Black', fontSize: 32, color: C.ink, letterSpacing: -1.2, marginTop: 4 }}>YOUR{'\n'}MOOD BOARDS.</Text>
          <Text style={[T.body, { color: C.dim, marginTop: SP.s }]}>Save and organize outfit combinations for any occasion.</Text>
        </FadeInUp>
        <AsciiDivider style={{ marginTop: SP.l }} />
        {boards.map((b, i) => (
          <FadeInUp key={b.id} delay={i * 50}>
            <Pressable style={[{ marginTop: SP.m, backgroundColor: C.white, overflow: 'hidden' }, BORDER(1)]}>
              <View style={{ flexDirection: 'row', height: 120 }}>
                {PRODUCTS.slice(i * 2, i * 2 + 3).map((p, j) => (
                  <View key={p.id} style={{ flex: 1, borderRightWidth: j < 2 ? 1 : 0, borderColor: C.ink, backgroundColor: C.hairline }}>
                    <Image source={{ uri: p.img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                  </View>
                ))}
              </View>
              <View style={{ padding: SP.m, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderColor: C.ink }}>
                <View>
                  <Text style={{ fontFamily: 'Inter_900Black', fontSize: 14, color: C.ink }}>{b.name}</Text>
                  <Text style={[T.mono, { color: C.dim, marginTop: 2 }]}>{b.items} ITEMS</Text>
                </View>
                <Feather name="chevron-right" size={18} color={C.ink} />
              </View>
            </Pressable>
          </FadeInUp>
        ))}
        <BrutalButton label="Create new board" icon="plus" variant="outline" block onPress={() => showToast('New Board', 'Coming soon', 'plus')} style={{ marginTop: SP.l }} />
      </ScrollView>
    </View>
  );
}

// ─── LUCKY DRAW — Scratch-card pick-one-of-three mini-game ──
const DRAW_PRIZES = [
  { label: '₹500 OFF', sub: 'Next order', icon: 'tag', rare: false },
  { label: '2× POINTS', sub: '48 hrs', icon: 'zap', rare: false },
  { label: 'FREE SHIP', sub: '10 orders', icon: 'truck', rare: false },
  { label: 'MYSTERY BOX', sub: '3 items', icon: 'package', rare: true },
  { label: 'iPHONE 17', sub: 'GRAND PRIZE', icon: 'smartphone', rare: true },
  { label: 'BETTER LUCK', sub: 'Try tomorrow', icon: 'clock', rare: false },
];
const RECENT_WINNERS = [
  { user: '@maya.s', prize: '₹500 OFF', mins: 3 },
  { user: '@kai.r', prize: '2× POINTS', mins: 12 },
  { user: '@aria_x', prize: 'FREE SHIP', mins: 27 },
  { user: '@neo_d', prize: 'MYSTERY BOX', mins: 45 },
];

export function LuckyDrawScreen() {
  const nav = useNavigation<any>();
  const { showToast } = useApp();
  const [cards] = useState(() => [...DRAW_PRIZES].sort(() => Math.random() - 0.5).slice(0, 3));
  const [revealed, setRevealed] = useState<number | null>(null);
  const [played, setPlayed] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;

  useRef(
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.04, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start()
  );

  const pick = (i: number) => {
    if (played) return;
    setRevealed(i);
    setPlayed(true);
    setTimeout(() => {
      const p = cards[i];
      showToast(p.rare ? 'RARE WIN!' : 'You got', `${p.label} — ${p.sub}`, p.rare ? 'award' : 'gift');
    }, 600);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <BrutalStatusBar />
      <ScreenHeader title="Lucky Draw" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 80 }}>
        {/* HERO — asymmetric split banner */}
        <FadeInUp>
          <View style={[{ flexDirection: 'row', height: 130, overflow: 'hidden' }, BORDER(1)]}>
            <View style={{ flex: 3, backgroundColor: C.ink, padding: SP.m, justifyContent: 'space-between' }}>
              <Text style={[T.monoB, { color: C.white, fontSize: 9 }]}>{'> DRAW_042 · LIVE'}</Text>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 32, color: C.white, letterSpacing: -1.5, lineHeight: 32 }}>PICK{'\n'}ONE.</Text>
              <Text style={[T.mono, { color: C.white, fontSize: 9 }]}>1 TAP · 1 REVEAL</Text>
            </View>
            <View style={{ flex: 2, backgroundColor: C.white, padding: SP.m, justifyContent: 'space-between', borderLeftWidth: 1, borderColor: C.ink }}>
              <Text style={[T.monoB, { fontSize: 9 }]}>{'▲ ODDS'}</Text>
              <View>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: 28, color: C.ink }}>1 in 3</Text>
                <Text style={[T.mono, { color: C.dim, fontSize: 9, marginTop: 2 }]}>OF A RARE DROP</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 2 }}>
                {[1,1,0].map((v,i) => <View key={i} style={{ flex: 1, height: 4, backgroundColor: v ? C.ink : C.hairline }} />)}
              </View>
            </View>
          </View>
        </FadeInUp>

        {/* ─── 3 scratch cards ─── */}
        <Text style={[T.monoB, { marginTop: SP.xl, fontSize: 11 }]}>{'> TAP_A_CARD_TO_REVEAL'}</Text>
        <AsciiDivider style={{ marginTop: 4 }} />
        <View style={{ flexDirection: 'row', gap: SP.s, marginTop: SP.m }}>
          {cards.map((card, i) => {
            const isOpen = revealed === i;
            return (
              <Pressable key={i} onPress={() => pick(i)} style={{ flex: 1 }} disabled={played}>
                <Animated.View style={{ transform: [{ scale: played && !isOpen ? 0.95 : isOpen ? 1 : played ? 1 : pulse }] }}>
                  {isOpen ? (
                    <MotiView from={{ rotateY: '180deg' }} animate={{ rotateY: '0deg' }} transition={{ type: 'timing', duration: 600 }} style={[{ height: 180, padding: SP.s, alignItems: 'center', justifyContent: 'space-between', backgroundColor: card.rare ? C.ink : C.white }, BORDER(1)]}>
                      <Text style={[T.monoB, { fontSize: 9, color: card.rare ? C.white : C.ink }]}>{'▲ OPENED'}</Text>
                      <Feather name={card.icon as any} size={40} color={card.rare ? C.white : C.ink} />
                      <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontFamily: 'Inter_900Black', fontSize: 14, color: card.rare ? C.white : C.ink, textAlign: 'center' }}>{card.label}</Text>
                        <Text style={[T.mono, { fontSize: 8, color: card.rare ? C.white : C.dim, marginTop: 2 }]}>{card.sub}</Text>
                      </View>
                    </MotiView>
                  ) : (
                    <View style={[{ height: 180, padding: SP.s, alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.white, opacity: played ? 0.3 : 1 }, BORDER(1)]}>
                      <Text style={[T.monoB, { fontSize: 9 }]}>{`CARD_0${i + 1}`}</Text>
                      {/* Hatching pattern */}
                      <View style={{ flex: 1, alignSelf: 'stretch', overflow: 'hidden', marginVertical: 8 }}>
                        {[...Array(14)].map((_, j) => (
                          <Text key={j} style={[T.mono, { color: C.ink, lineHeight: 13, letterSpacing: 1 }]} numberOfLines={1}>
                            {j % 2 === 0 ? '▓░▓░▓░▓░▓░' : '░▓░▓░▓░▓░▓'}
                          </Text>
                        ))}
                      </View>
                      <Text style={{ fontFamily: 'Inter_900Black', fontSize: 11, color: C.ink }}>{played ? '—' : 'TAP'}</Text>
                    </View>
                  )}
                </Animated.View>
              </Pressable>
            );
          })}
        </View>

        {played && (
          <FadeInUp delay={400}>
            <View style={[{ marginTop: SP.l, padding: SP.m, backgroundColor: C.white, alignItems: 'center' }, BORDER(1)]}>
              <Text style={[T.mono, { color: C.dim, fontSize: 9 }]}>NEXT DRAW IN</Text>
              <Text style={{ fontFamily: 'SpaceMono_700Bold', fontSize: 22, color: C.ink, letterSpacing: 3, marginTop: 4 }}>23:59:12</Text>
            </View>
          </FadeInUp>
        )}

        {/* ─── Grand prize banner ─── */}
        <Text style={[T.monoB, { marginTop: SP.xl, fontSize: 11 }]}>{'> MONTHLY_GRAND_PRIZE'}</Text>
        <AsciiDivider style={{ marginTop: 4 }} />
        <View style={[{ marginTop: SP.m, padding: SP.l, backgroundColor: C.ink }, BORDER(1)]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={[T.monoB, { color: C.white, fontSize: 9 }]}>{'◆ APR.2026'}</Text>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 26, color: C.white, marginTop: 6, letterSpacing: -0.8 }}>₹10,000{'\n'}GIFT CARD</Text>
              <Text style={[T.mono, { color: C.white, marginTop: 6, fontSize: 9 }]}>+ 5 RUNNER-UP SLOTS</Text>
            </View>
            <Ionicons name="trophy" size={56} color={C.white} />
          </View>
          <View style={{ marginTop: SP.m, height: 1, backgroundColor: C.white, opacity: 0.3 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: SP.s }}>
            <Text style={[T.mono, { color: C.white, fontSize: 9 }]}>DRAWS · 30 APR</Text>
            <Text style={[T.mono, { color: C.white, fontSize: 9 }]}>1,247 ENTRIES</Text>
          </View>
        </View>

        {/* ─── Live winners ticker ─── */}
        <Text style={[T.monoB, { marginTop: SP.xl, fontSize: 11 }]}>{'> RECENT_WINS'}</Text>
        <AsciiDivider style={{ marginTop: 4 }} />
        {RECENT_WINNERS.map((w, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderColor: C.hairline }}>
            <View style={[{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: C.ink }]}>
              <Text style={[T.monoB, { color: C.white, fontSize: 9 }]}>{`0${i + 1}`}</Text>
            </View>
            <Text style={[T.monoB, { marginLeft: 10, fontSize: 11, flex: 1 }]}>{w.user}</Text>
            <Text style={{ fontFamily: 'Inter_900Black', fontSize: 11, color: C.ink }}>{w.prize}</Text>
            <Text style={[T.mono, { color: C.dim, fontSize: 9, marginLeft: 10 }]}>{w.mins}m</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── INVITE FRIENDS — Tier progression + referral tree ──────
const INVITE_TIERS = [
  { name: 'BRONZE', need: 1, reward: '₹200', unlocked: true },
  { name: 'SILVER', need: 5, reward: '₹1,200', unlocked: true },
  { name: 'GOLD', need: 10, reward: '₹3,000', unlocked: false },
  { name: 'PLATINUM', need: 25, reward: '₹10,000', unlocked: false },
  { name: 'DIAMOND', need: 50, reward: 'MYSTERY', unlocked: false },
];
const INVITED = [
  { user: '@sahil.m', status: 'JOINED', earn: '₹200', date: '2d' },
  { user: '@kavya_r', status: 'JOINED', earn: '₹200', date: '5d' },
  { user: '@rohan.x', status: 'JOINED', earn: '₹200', date: '1w' },
  { user: '@nikita', status: 'PENDING', earn: '—', date: '3d' },
  { user: '@aditya_j', status: 'JOINED', earn: '₹200', date: '2w' },
];

export function InviteFriendsScreen() {
  const nav = useNavigation<any>();
  const { showToast } = useApp();
  const joined = INVITED.filter(i => i.status === 'JOINED').length;
  const currentTier = INVITE_TIERS.findIndex(t => joined < t.need);
  const activeTier = currentTier === -1 ? INVITE_TIERS.length - 1 : Math.max(0, currentTier - 1);
  const nextTier = INVITE_TIERS[currentTier] || INVITE_TIERS[INVITE_TIERS.length - 1];
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const shareLink = 'https://closetx.app/invite/CLOSETX42';
  const shareMessage = `Join me on CLOSET-X. Use my code CLOSETX42 and we both get ₹200. ${shareLink}`;

  const copyCode = () => {
    setCopied(true);
    showToast('Copied', 'CLOSETX42 copied to clipboard', 'copy');
    setTimeout(() => setCopied(false), 1800);
  };

  const copyLink = () => {
    showToast('Copied', 'Invite link copied', 'link');
    setShareOpen(false);
  };

  const openNativeShare = async () => {
    setShareOpen(false);
    try {
      await Share.share({ message: shareMessage, url: shareLink });
    } catch {}
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <BrutalStatusBar />
      <ScreenHeader title="Invite & Earn" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 80 }}>
        {/* HEADER STATS — three-column counter strip */}
        <FadeInUp>
          <View style={[{ flexDirection: 'row', overflow: 'hidden' }, BORDER(1)]}>
            {[
              { label: 'INVITES', val: INVITED.length, sub: 'SENT' },
              { label: 'JOINED', val: joined, sub: 'VERIFIED' },
              { label: 'EARNED', val: `₹${joined * 200}`, sub: 'CASHBACK' },
            ].map((s, i) => (
              <View key={i} style={{ flex: 1, padding: SP.m, borderRightWidth: i < 2 ? 1 : 0, borderColor: C.ink, backgroundColor: i === 1 ? C.ink : C.white }}>
                <Text style={[T.monoB, { fontSize: 8, color: i === 1 ? C.white : C.dim }]}>{s.label}</Text>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: 22, color: i === 1 ? C.white : C.ink, marginTop: 4 }}>{s.val}</Text>
                <Text style={[T.mono, { fontSize: 8, color: i === 1 ? C.white : C.dim, marginTop: 2 }]}>{s.sub}</Text>
              </View>
            ))}
          </View>
        </FadeInUp>

        {/* REFERRAL CODE — big brutalist block */}
        <Text style={[T.monoB, { marginTop: SP.xl, fontSize: 11 }]}>{'> YOUR_CODE'}</Text>
        <AsciiDivider style={{ marginTop: 4 }} />
        <FadeInUp delay={60}>
          <View style={[{ marginTop: SP.s, overflow: 'hidden' }, BORDER(1)]}>
            <View style={{ padding: SP.l, backgroundColor: C.ink, alignItems: 'center' }}>
              <Text style={[T.mono, { color: C.white, fontSize: 10, opacity: 0.6 }]}>{'TAP TO COPY'}</Text>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 40, color: C.white, letterSpacing: 5, marginTop: 8 }}>CLOSETX42</Text>
              <View style={{ flexDirection: 'row', gap: 4, marginTop: 10 }}>
                {'CLOSETX42'.split('').map((ch, i) => (
                  <View key={i} style={{ width: 6, height: 2, backgroundColor: C.white }} />
                ))}
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 0, marginTop: 0, borderTopWidth: 1, borderColor: C.ink }}>
              <Pressable onPress={copyCode} style={{ flex: 1, padding: SP.m, alignItems: 'center', backgroundColor: C.white }}>
                <Text style={[T.monoB, { fontSize: 11 }]}>{copied ? '✓ COPIED' : '⟡ COPY CODE'}</Text>
              </Pressable>
              <Pressable onPress={() => setShareOpen(true)} style={{ flex: 1, padding: SP.m, alignItems: 'center', backgroundColor: C.ink, borderLeftWidth: 1, borderColor: C.ink }}>
                <Text style={[T.monoB, { fontSize: 11, color: C.white }]}>◆ SHARE LINK</Text>
              </Pressable>
            </View>
          </View>
        </FadeInUp>

        {/* TIER PROGRESS BAR */}
        <Text style={[T.monoB, { marginTop: SP.xl, fontSize: 11 }]}>{'> TIER_PROGRESS'}</Text>
        <AsciiDivider style={{ marginTop: 4 }} />
        <View style={[{ marginTop: SP.s, padding: SP.m, backgroundColor: C.white }, BORDER(1)]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text style={{ fontFamily: 'Inter_900Black', fontSize: 18, color: C.ink, letterSpacing: -0.5 }}>{INVITE_TIERS[activeTier].name}</Text>
            <Text style={[T.mono, { color: C.dim, fontSize: 10 }]}>{joined}/{nextTier.need}</Text>
          </View>
          <View style={[{ marginTop: 8, height: 10, flexDirection: 'row', overflow: 'hidden' }, BORDER(1)]}>
            {[...Array(nextTier.need)].map((_, i) => (
              <View key={i} style={{ flex: 1, backgroundColor: i < joined ? C.ink : 'transparent', borderRightWidth: i < nextTier.need - 1 ? 1 : 0, borderColor: C.ink }} />
            ))}
          </View>
          <Text style={[T.mono, { color: C.dim, fontSize: 9, marginTop: 6 }]}>
            {currentTier === -1 ? '◆ MAX TIER REACHED' : `${nextTier.need - joined} MORE → ${nextTier.name} (${nextTier.reward})`}
          </Text>
        </View>

        {/* TIER LADDER */}
        <View style={{ marginTop: SP.m, gap: 6 }}>
          {INVITE_TIERS.map((t, i) => {
            const done = joined >= t.need;
            const isNext = i === currentTier;
            return (
              <View key={t.name} style={[{ flexDirection: 'row', alignItems: 'center', padding: SP.s, backgroundColor: done ? C.ink : isNext ? C.white : C.bg }, BORDER(1)]}>
                <View style={[{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? C.white : C.ink, marginRight: 10 }]}>
                  {done ? <Feather name="check" size={16} color={C.ink} /> : <Text style={[T.monoB, { color: C.white, fontSize: 10 }]}>{`L${i + 1}`}</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'Inter_900Black', fontSize: 12, color: done ? C.white : C.ink }}>{t.name}</Text>
                  <Text style={[T.mono, { fontSize: 9, color: done ? C.white : C.dim, marginTop: 2 }]}>{t.need} INVITES · {t.reward}</Text>
                </View>
                {isNext && <Text style={[T.monoB, { fontSize: 9, color: C.ink }]}>▶ NEXT</Text>}
              </View>
            );
          })}
        </View>

        {/* FRIENDS LIST */}
        <Text style={[T.monoB, { marginTop: SP.xl, fontSize: 11 }]}>{`> YOUR_INVITES (${INVITED.length})`}</Text>
        <AsciiDivider style={{ marginTop: 4 }} />
        <View style={{ marginTop: SP.s }}>
          {INVITED.map((f, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', padding: SP.s, borderBottomWidth: 1, borderColor: C.hairline }}>
              <View style={[{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: f.status === 'JOINED' ? C.ink : C.white }, BORDER(1)]}>
                <Text style={[T.monoB, { color: f.status === 'JOINED' ? C.white : C.ink, fontSize: 11 }]}>{f.user[1].toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[T.bodyB, { fontSize: 12 }]}>{f.user}</Text>
                <Text style={[T.mono, { color: C.dim, fontSize: 9 }]}>{f.date} AGO · {f.status}</Text>
              </View>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 12, color: f.status === 'JOINED' ? C.ink : C.dim }}>{f.earn}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* SHARE POPUP — brutalist sheet matching the rest of the app */}
      <Modal transparent visible={shareOpen} animationType="none" onRequestClose={() => setShareOpen(false)}>
        <Pressable onPress={() => setShareOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
          <MotiView
            from={{ translateY: 400 }}
            animate={{ translateY: 0 }}
            transition={{ type: 'timing', duration: 320 }}
            onStartShouldSetResponder={() => true}
            style={{ backgroundColor: C.white, paddingTop: SP.m, paddingHorizontal: SP.l, paddingBottom: 36, borderTopWidth: 2, borderColor: C.ink }}
          >
            <View style={{ alignSelf: 'center', width: 44, height: 4, backgroundColor: C.ink, marginBottom: SP.m }} />
            <Text style={[T.monoB, { fontSize: 10, color: C.dim }]}>{'> SHARE_INVITE'}</Text>
            <Text style={{ fontFamily: 'Inter_900Black', fontSize: 26, color: C.ink, letterSpacing: -1, marginTop: 4 }}>DROP YOUR CODE.</Text>
            <Text style={[T.mono, { color: C.dim, fontSize: 10, marginTop: 4 }]}>Every sign-up drops ₹200 in your pocket.</Text>

            {/* Link pill */}
            <View style={[{ marginTop: SP.l, padding: SP.m, flexDirection: 'row', alignItems: 'center', gap: 10 }, BORDER(1)]}>
              <Feather name="link" size={14} color={C.ink} />
              <Text style={[T.mono, { flex: 1, fontSize: 11 }]} numberOfLines={1}>{shareLink}</Text>
              <Pressable onPress={copyLink} hitSlop={8} style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: C.ink }}>
                <Text style={[T.monoB, { fontSize: 9, color: C.white }]}>COPY</Text>
              </Pressable>
            </View>

            <View style={{ marginTop: SP.l, gap: SP.s }}>
              {[
                { id: 'native', icon: 'share-2', title: 'SHARE VIA...', desc: 'WhatsApp, Messages, anywhere.', primary: true, onPress: openNativeShare },
                { id: 'copy', icon: 'copy', title: 'COPY MESSAGE + LINK', desc: 'Paste it anywhere you like.', onPress: () => { showToast('Copied', 'Invite message copied', 'copy'); setShareOpen(false); } },
              ].map((opt, i) => (
                <MotiView key={opt.id} from={{ opacity: 0, translateX: -20 }} animate={{ opacity: 1, translateX: 0 }} transition={{ delay: 120 + i * 80, type: 'timing', duration: 280 }}>
                  <Pressable onPress={opt.onPress} style={[{ padding: SP.m, backgroundColor: opt.primary ? C.ink : C.white }, BORDER(1)]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={{ width: 46, height: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: opt.primary ? C.white : C.ink }}>
                        <Feather name={opt.icon as any} size={20} color={opt.primary ? C.ink : C.white} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: 'Inter_900Black', fontSize: 13, color: opt.primary ? C.white : C.ink, letterSpacing: 0.5 }}>{opt.title}</Text>
                        <Text style={[T.mono, { fontSize: 9, color: opt.primary ? C.white : C.dim, marginTop: 3, opacity: 0.8 }]}>{opt.desc}</Text>
                      </View>
                      <Feather name="arrow-right" size={16} color={opt.primary ? C.white : C.ink} />
                    </View>
                  </Pressable>
                </MotiView>
              ))}
            </View>

            <Pressable onPress={() => setShareOpen(false)} style={{ marginTop: SP.m, alignSelf: 'center', paddingVertical: 8 }}>
              <Text style={[T.mono, { color: C.dim, textDecorationLine: 'underline' }]}>cancel</Text>
            </Pressable>
          </MotiView>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── APP CHALLENGES — Tabbed quest board + XP + claim ─────
type Challenge = { id: string; title: string; sub: string; progress: number; total: number; reward: string; xp: number; icon: string; done?: boolean };
const QUESTS: Record<'DAILY' | 'WEEKLY' | 'MONTHLY', Challenge[]> = {
  DAILY: [
    { id: 'd1', title: 'LOGIN STREAK', sub: 'Open app 1× today', progress: 1, total: 1, reward: '20 PTS', xp: 20, icon: 'sun', done: true },
    { id: 'd2', title: 'WISHLIST ADD', sub: 'Save 2 items you love', progress: 1, total: 2, reward: '30 PTS', xp: 30, icon: 'heart' },
    { id: 'd3', title: 'BROWSE BRANDS', sub: 'View 3 brand pages', progress: 2, total: 3, reward: '25 PTS', xp: 25, icon: 'search' },
  ],
  WEEKLY: [
    { id: 'w1', title: 'STYLE STREAK', sub: 'Post 3 outfit photos', progress: 2, total: 3, reward: '150 PTS', xp: 150, icon: 'camera' },
    { id: 'w2', title: 'REVIEW MASTER', sub: 'Write 5 product reviews', progress: 3, total: 5, reward: '250 PTS', xp: 250, icon: 'message-square' },
    { id: 'w3', title: 'CART CHAMPION', sub: 'Complete 2 orders', progress: 2, total: 2, reward: '100 PTS', xp: 100, icon: 'shopping-bag', done: true },
    { id: 'w4', title: 'EXPLORER', sub: 'Browse 10 categories', progress: 7, total: 10, reward: '80 PTS', xp: 80, icon: 'compass' },
  ],
  MONTHLY: [
    { id: 'm1', title: 'SOCIAL BUTTERFLY', sub: 'Refer 3 friends', progress: 1, total: 3, reward: '₹600', xp: 600, icon: 'users' },
    { id: 'm2', title: 'SPENDER', sub: 'Spend ₹5,000 total', progress: 3400, total: 5000, reward: '₹500 CREDIT', xp: 500, icon: 'credit-card' },
    { id: 'm3', title: 'COMMUNITY', sub: 'Like 50 community posts', progress: 23, total: 50, reward: '300 PTS', xp: 300, icon: 'thumbs-up' },
  ],
};

export function AppChallengesScreen() {
  const nav = useNavigation<any>();
  const { showToast } = useApp();
  const [tab, setTab] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('WEEKLY');
  const [claimed, setClaimed] = useState<Record<string, boolean>>({});
  const quests = QUESTS[tab];
  const totalXP = Object.values(QUESTS).flat().filter(q => q.done || claimed[q.id]).reduce((s, q) => s + q.xp, 0) + 1240;
  const level = Math.floor(totalXP / 500) + 1;
  const levelProg = (totalXP % 500) / 500;

  const claim = (q: Challenge) => {
    if (claimed[q.id]) return;
    setClaimed({ ...claimed, [q.id]: true });
    showToast(`+${q.xp} XP`, `${q.title} · ${q.reward} added`, 'award');
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <BrutalStatusBar />
      <ScreenHeader title="Quests" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 80 }}>
        {/* XP + LEVEL hero */}
        <FadeInUp>
          <View style={[{ padding: SP.l, backgroundColor: C.ink }, BORDER(1)]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View>
                <Text style={[T.monoB, { color: C.white, fontSize: 9 }]}>{'◆ LVL'}</Text>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: 56, color: C.white, letterSpacing: -2, lineHeight: 56 }}>{level}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[T.monoB, { color: C.white, fontSize: 9 }]}>{'> TOTAL_XP'}</Text>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: 28, color: C.white, marginTop: 2 }}>{totalXP.toLocaleString()}</Text>
                <Text style={[T.mono, { color: C.white, fontSize: 9, opacity: 0.6, marginTop: 2 }]}>{`NEXT LVL · ${500 - (totalXP % 500)} XP`}</Text>
              </View>
            </View>
            {/* Segmented level bar */}
            <View style={{ marginTop: SP.m, flexDirection: 'row', gap: 2 }}>
              {[...Array(20)].map((_, i) => (
                <View key={i} style={{ flex: 1, height: 8, backgroundColor: i < levelProg * 20 ? C.white : 'transparent', borderWidth: 1, borderColor: C.white }} />
              ))}
            </View>
          </View>
        </FadeInUp>

        {/* Tab switcher */}
        <View style={[{ flexDirection: 'row', marginTop: SP.l, overflow: 'hidden' }, BORDER(1)]}>
          {(['DAILY', 'WEEKLY', 'MONTHLY'] as const).map((t, i) => (
            <Pressable key={t} onPress={() => setTab(t)} style={[{ flex: 1, padding: SP.s, alignItems: 'center', backgroundColor: tab === t ? C.ink : C.white, borderRightWidth: i < 2 ? 1 : 0, borderColor: C.ink }]}>
              <Text style={[T.monoB, { fontSize: 10, color: tab === t ? C.white : C.ink }]}>{t}</Text>
              <Text style={[T.mono, { fontSize: 8, color: tab === t ? C.white : C.dim, marginTop: 2 }]}>{QUESTS[t].filter(q => q.done || claimed[q.id]).length}/{QUESTS[t].length}</Text>
            </Pressable>
          ))}
        </View>

        {/* Quest cards */}
        <View style={{ marginTop: SP.m, gap: SP.m }}>
          {quests.map((q, i) => {
            const complete = q.progress >= q.total || claimed[q.id];
            const canClaim = q.progress >= q.total && !claimed[q.id] && !q.done;
            const isDone = q.done || claimed[q.id];
            return (
              <MotiView key={q.id} from={{ opacity: 0, translateX: -8 }} animate={{ opacity: 1, translateX: 0 }} transition={{ delay: i * 60 }}>
                <View style={[{ padding: SP.m, backgroundColor: isDone ? C.ink : C.white }, BORDER(1)]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={[{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: isDone ? C.white : C.ink }]}>
                      <Feather name={q.icon as any} size={20} color={isDone ? C.ink : C.white} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: 'Inter_900Black', fontSize: 14, color: isDone ? C.white : C.ink }}>{q.title}</Text>
                      <Text style={[T.mono, { fontSize: 9, color: isDone ? C.white : C.dim, marginTop: 2, opacity: isDone ? 0.7 : 1 }]}>{q.sub}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <View style={[{ paddingHorizontal: 6, paddingVertical: 3, backgroundColor: isDone ? C.white : C.ink }]}>
                        <Text style={[T.monoB, { color: isDone ? C.ink : C.white, fontSize: 9 }]}>{q.reward}</Text>
                      </View>
                      <Text style={[T.mono, { color: isDone ? C.white : C.dim, fontSize: 8, marginTop: 4 }]}>+{q.xp} XP</Text>
                    </View>
                  </View>
                  {/* Progress */}
                  <View style={{ marginTop: SP.s, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ flex: 1, height: 6, backgroundColor: isDone ? 'rgba(255,255,255,0.2)' : C.hairline }}>
                      <View style={{ width: `${Math.min(100, (q.progress / q.total) * 100)}%`, height: '100%', backgroundColor: isDone ? C.white : C.ink }} />
                    </View>
                    <Text style={[T.mono, { color: isDone ? C.white : C.dim, fontSize: 9 }]}>{q.progress.toLocaleString()}/{q.total.toLocaleString()}</Text>
                  </View>
                  {/* Action */}
                  {canClaim && (
                    <Pressable onPress={() => claim(q)} style={[{ marginTop: SP.s, padding: SP.s, alignItems: 'center', backgroundColor: C.ink }]}>
                      <Text style={[T.monoB, { color: C.white, fontSize: 11 }]}>{'◆ CLAIM REWARD'}</Text>
                    </Pressable>
                  )}
                  {isDone && (
                    <View style={[{ marginTop: SP.s, padding: SP.s, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: C.white }]}>
                      <Text style={[T.monoB, { color: C.white, fontSize: 10 }]}>✓ CLAIMED</Text>
                    </View>
                  )}
                </View>
              </MotiView>
            );
          })}
        </View>

        {/* Streak callout */}
        <View style={[{ marginTop: SP.xl, padding: SP.m, backgroundColor: C.white, flexDirection: 'row', alignItems: 'center', gap: 12 }, BORDER(1)]}>
          <Feather name="zap" size={24} color={C.ink} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Inter_900Black', fontSize: 13, color: C.ink }}>7-DAY QUEST STREAK</Text>
            <Text style={[T.mono, { fontSize: 9, color: C.dim, marginTop: 2 }]}>Complete 1 quest/day for a bonus 500 XP at day 7</Text>
          </View>
          <Text style={{ fontFamily: 'Inter_900Black', fontSize: 18, color: C.ink }}>5/7</Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── NEW ARRIVALS ──────────────────────────────────────────
export function NewArrivalsScreen() {
  const nav = useNavigation<any>();
  const goToProduct = (p: any) => nav.navigate('ProductDetail', { product: p });
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <BrutalStatusBar />
      <ScreenHeader title="New Arrivals" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 60 }}>
        <FadeInUp>
          <Text style={[T.monoB, { fontSize: 11 }]}>{'> JUST_DROPPED'}</Text>
          <Text style={{ fontFamily: 'Inter_900Black', fontSize: 32, color: C.ink, letterSpacing: -1.2, marginTop: 4 }}>LATEST{'\n'}DROPS.</Text>
        </FadeInUp>
        <AsciiDivider style={{ marginTop: SP.l }} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.m, marginTop: SP.m }}>
          {PRODUCTS.map((p, i) => (
            <FadeInUp key={p.id} delay={i * 40}>
              <View style={{ width: '47%' }}>
                <ProductCard p={{ ...p, tag: 'NEW' }} onPress={() => goToProduct(p)} w={170} />
              </View>
            </FadeInUp>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── DISCOVER BRANDS ───────────────────────────────────────
export function DiscoverBrandsScreen() {
  const nav = useNavigation<any>();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <BrutalStatusBar />
      <ScreenHeader title="Brands" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 60 }}>
        <FadeInUp>
          <Text style={[T.monoB, { fontSize: 11 }]}>{'> BRAND_ARMY'}</Text>
          <Text style={{ fontFamily: 'Inter_900Black', fontSize: 32, color: C.ink, letterSpacing: -1.2, marginTop: 4 }}>DISCOVER{'\n'}BRANDS.</Text>
        </FadeInUp>
        <AsciiDivider style={{ marginTop: SP.l }} />
        <View style={{ gap: SP.m, marginTop: SP.m }}>
          {BRANDS.map((b, i) => (
            <FadeInUp key={b.id} delay={i * 50}>
              <Pressable onPress={() => nav.navigate('Category', { id: 'brand-' + b.id, label: b.name })} style={[{ flexDirection: 'row', alignItems: 'center', padding: SP.l, backgroundColor: C.white }, BORDER(1)]}>
                <View style={[{ width: 56, height: 56, alignItems: 'center', justifyContent: 'center', backgroundColor: C.ink }]}>
                  <Text style={{ fontFamily: 'Inter_900Black', fontSize: 20, color: C.white }}>{b.name[0]}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: SP.m }}>
                  <Text style={{ fontFamily: 'Inter_900Black', fontSize: 20, color: C.ink, letterSpacing: -0.5 }}>{b.name}</Text>
                  <Text style={[T.mono, { color: C.dim, marginTop: 2 }]}>{Math.floor(Math.random() * 200 + 50)} PRODUCTS</Text>
                </View>
                <Feather name="arrow-right" size={18} color={C.ink} />
              </Pressable>
            </FadeInUp>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── FOR HER ───────────────────────────────────────────────
// ─── FOR HER — PNG product images ──
const HER_BANNER = 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=900&q=80';
const HER_BANNER_2 = 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=900&q=80';
const pngUrl = (path: string) => `https://pngimg.com/uploads/${path}`;

const HER_PRODUCTS = [
  { id: 'her1', brand: 'GLOSSIER', name: 'Silk Slip Dress', price: 2799, original: 3999, rating: 4.7, img: pngUrl('dress/small/dress_PNG197.png'), category: 'Dresses', tag: 'NEW', colors: ['#ffafbd', '#ffc3a0'] as [string, string] },
  { id: 'her2', brand: 'AZUKI', name: 'Floral Maxi Dress', price: 3299, original: 4499, rating: 4.8, img: pngUrl('dress/small/dress_PNG196.png'), category: 'Dresses', tag: 'HOT', colors: ['#ff6b9d', '#feca57'] as [string, string] },
  { id: 'her3', brand: 'N99°', name: 'Designer Tote', price: 4299, original: 5499, rating: 4.9, img: pngUrl('women_bag/small/women_bag_PNG6428.png'), category: 'Bags', tag: 'TRENDING', colors: ['#5d4037', '#8d6e63'] as [string, string] },
  { id: 'her4', brand: 'NORTH.', name: 'Block Heel Sandal', price: 3199, original: 4299, rating: 4.6, img: pngUrl('women_shoes/small/women_shoes_PNG7473.png'), category: 'Shoes', colors: ['#a8e6cf', '#dcedc1'] as [string, string] },
  { id: 'her5', brand: 'KOH', name: 'Pleated Mini Skirt', price: 1799, original: 2499, rating: 4.5, img: pngUrl('dress/small/dress_PNG194.png'), category: 'Skirts', tag: 'NEW', colors: ['#f5e6d3', '#c9a87c'] as [string, string] },
  { id: 'her6', brand: 'RHODE', name: 'Crochet Crop Top', price: 1599, original: 2199, rating: 4.7, img: pngUrl('tshirt/small/tshirt_PNG5453.png'), category: 'Tops', colors: ['#ff6b9d', '#feca57'] as [string, string] },
  { id: 'her7', brand: 'YORK', name: 'Designer Handbag', price: 899, original: 1499, rating: 4.8, img: pngUrl('women_bag/small/women_bag_PNG6427.png'), category: 'Bags', tag: 'NEW', colors: ['#fff', '#f3f3f3'] as [string, string] },
  { id: 'her8', brand: 'GLOSSIER', name: 'Satin Midi Dress', price: 2999, original: 3999, rating: 4.7, img: pngUrl('dress/small/dress_PNG196.png'), category: 'Dresses', colors: ['#a78bfa', '#ff6b9d'] as [string, string] },
];

export function ForHerScreen() {
  const nav = useNavigation<any>();
  const goToProduct = (p: any) => nav.navigate('ProductDetail', { product: p });
  const herCategories = [
    { id: 'dresses', label: 'DRESSES', icon: 'gift' },
    { id: 'skirts', label: 'SKIRTS', icon: 'scissors' },
    { id: 'tops', label: 'TOPS', icon: 'shopping-bag' },
    { id: 'heels', label: 'HEELS', icon: 'arrow-up' },
    { id: 'bags', label: 'BAGS', icon: 'briefcase' },
    { id: 'jewelry', label: 'JEWELRY', icon: 'star' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <BrutalStatusBar />
      <ScreenHeader title="For Her" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Aesthetic Banner */}
        <FadeInUp>
          <View style={[{ marginHorizontal: SP.l, marginTop: SP.l, height: 320, overflow: 'hidden' }, BORDER(1)]}>
            <Image source={{ uri: HER_BANNER }} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" />
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.25)' }]} />
            <View style={{ flex: 1, padding: SP.l, justifyContent: 'space-between' }}>
              <View style={[{ alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, backgroundColor: C.white }, BORDER(1)]}>
                <Text style={[T.monoB, { fontSize: 10 }]}>♀ WOMEN_EDIT</Text>
              </View>
              <View>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: 48, color: C.white, lineHeight: 48, letterSpacing: -2 }}>HER{'\n'}STYLE.</Text>
                <Text style={[T.mono, { color: C.white, fontSize: 10, marginTop: 8 }]}>{'// BOLD · FEMININE · UNAPOLOGETIC'}</Text>
              </View>
            </View>
          </View>
        </FadeInUp>

        {/* Intro */}
        <View style={{ paddingHorizontal: SP.l, marginTop: SP.l }}>
          <FadeInUp>
            <Text style={[T.monoB, { fontSize: 11 }]}>{'> CURATED_FOR_HER'}</Text>
            <Text style={{ fontFamily: 'Inter_900Black', fontSize: 28, color: C.ink, letterSpacing: -1.2, marginTop: 4 }}>DRESSES, HEELS{'\n'}& EVERYTHING IN BETWEEN.</Text>
            <Text style={[T.body, { color: C.dim, marginTop: SP.s }]}>From silk slips to block heels — the women's edit handpicked for the modern queen.</Text>
          </FadeInUp>
        </View>

        {/* Category icon grid */}
        <SectionHead title="SHOP" emphasis="BY CATEGORY" />
        <View style={{ paddingHorizontal: SP.l, flexDirection: 'row', flexWrap: 'wrap', gap: SP.s }}>
          {herCategories.map((c, i) => (
            <FadeInUp key={c.id} delay={i * 40}>
              <Pressable onPress={() => nav.navigate('Category', { id: c.id, label: c.label })} style={[{ width: 100, height: 80, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white, gap: 6 }, BORDER(1)]}>
                <Feather name={c.icon as any} size={20} color={C.ink} />
                <Text style={[T.monoB, { fontSize: 9 }]}>{c.label}</Text>
              </Pressable>
            </FadeInUp>
          ))}
        </View>

        {/* Dresses highlight */}
        <SectionHead title="DRESS" emphasis="UP" action="ALL" onAction={() => nav.navigate('Category', { id: 'dresses', label: 'Dresses' })} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SP.l, gap: SP.m }}>
          {HER_PRODUCTS.filter(p => p.category === 'Dresses').map((p, i) => (
            <FadeInUp key={p.id} delay={i * 30}>
              <ProductCard p={p} onPress={() => goToProduct(p)} />
            </FadeInUp>
          ))}
        </ScrollView>

        {/* Bags & Accessories — full-width feature */}
        <SectionHead title="IT" emphasis="BAGS" action="VIEW" onAction={() => nav.navigate('Category', { id: 'bags', label: 'Bags' })} />
        <View style={{ paddingHorizontal: SP.l }}>
          <Pressable onPress={() => goToProduct(HER_PRODUCTS[2])} style={[{ flexDirection: 'row', backgroundColor: C.white, height: 160, overflow: 'hidden' }, BORDER(1)]}>
            <View style={{ width: 160, backgroundColor: '#f9f3ed', borderRightWidth: 1, borderColor: C.ink }}>
              <Image source={{ uri: HER_PRODUCTS[2].img }} style={{ width: '100%', height: '100%', padding: 12 }} resizeMode="contain" />
            </View>
            <View style={{ flex: 1, padding: SP.l, justifyContent: 'space-between' }}>
              <View>
                <Text style={[T.monoB, { fontSize: 9 }]}>{`BAG_EDIT_01`}</Text>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: 20, color: C.ink, marginTop: 6, letterSpacing: -0.5 }}>DESIGNER{'\n'}TOTES</Text>
                <Text style={[T.body, { fontSize: 11, color: C.dim, marginTop: 4 }]}>Hand-picked from Paris boutiques</Text>
              </View>
              <Text style={[T.monoB]}>{'SHOP ──▶'}</Text>
            </View>
          </Pressable>
        </View>

        {/* Second aesthetic banner */}
        <View style={{ paddingHorizontal: SP.l, marginTop: SP.xl }}>
          <View style={[{ height: 200, overflow: 'hidden' }, BORDER(1)]}>
            <Image source={{ uri: HER_BANNER_2 }} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" />
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: SP.l, backgroundColor: 'rgba(0,0,0,0.4)' }}>
              <Text style={[T.monoB, { color: C.white, fontSize: 9 }]}>{'// FEMININE_ESSENTIALS'}</Text>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 24, color: C.white, letterSpacing: -0.8 }}>SOFT POWER.</Text>
            </View>
          </View>
        </View>

        {/* Heels & Shoes — horizontal scroll with tall cards */}
        <SectionHead title="HEELS" emphasis="& SHOES" action="ALL" onAction={() => nav.navigate('Category', { id: 'shoes', label: 'Shoes' })} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SP.l, gap: SP.m }}>
          {HER_PRODUCTS.filter(p => p.category === 'Shoes' || p.category === 'Jewelry').map((p, i) => (
            <FadeInUp key={p.id} delay={i * 30}>
              <ProductCard p={p} onPress={() => goToProduct(p)} />
            </FadeInUp>
          ))}
        </ScrollView>

        {/* New Arrivals */}
        <SectionHead title="JUST" emphasis="IN" />
        <View style={{ paddingHorizontal: SP.l, flexDirection: 'row', flexWrap: 'wrap', gap: SP.m }}>
          {HER_PRODUCTS.filter(p => p.tag === 'NEW').map((p, i) => (
            <FadeInUp key={p.id} delay={i * 40}>
              <View style={{ width: '47%' }}>
                <ProductCard p={p} onPress={() => goToProduct(p)} w={170} />
              </View>
            </FadeInUp>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── FOR HIM — Unique men's fashion content ────────────────
const HIM_BANNER = 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=900&q=80';
const HIM_BANNER_2 = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=900&q=80';

const HIM_PRODUCTS = [
  { id: 'him1', brand: 'NORTH.', name: 'Oversized Wool Coat', price: 2499, original: 4999, rating: 4.8, img: pngUrl('coat/small/coat_PNG80.png'), category: 'Coats', tag: 'NEW', colors: ['#5d4037', '#8d6e63'] as [string, string] },
  { id: 'him2', brand: 'KOH', name: 'Slim Fit Denim', price: 1899, original: 2999, rating: 4.6, img: pngUrl('jeans/small/jeans_PNG5779.png'), category: 'Jeans', tag: 'HOT', colors: ['#1a1a1a', '#3a3a3a'] as [string, string] },
  { id: 'him3', brand: 'YORK', name: 'Court Sneaker', price: 3499, original: 5499, rating: 4.9, img: pngUrl('women_shoes/small/women_shoes_PNG7473.png'), category: 'Sneakers', tag: 'TRENDING', colors: ['#fff', '#f3f3f3'] as [string, string] },
  { id: 'him4', brand: 'RHODE', name: 'Bomber Jacket', price: 2199, original: 3299, rating: 4.6, img: pngUrl('jacket/small/jacket_PNG8059.png'), category: 'Jackets', colors: ['#111', '#444'] as [string, string] },
  { id: 'him5', brand: 'AZUKI', name: 'Cotton Tee', price: 1299, original: 1999, rating: 4.5, img: pngUrl('tshirt/small/tshirt_PNG5454.png'), category: 'Tees', colors: ['#000', '#222'] as [string, string] },
  { id: 'him6', brand: 'N99°', name: 'Polo Shirt', price: 1599, original: 2299, rating: 4.7, img: pngUrl('tshirt/small/tshirt_PNG5453.png'), category: 'Shirts', tag: 'NEW', colors: ['#2c3e50', '#34495e'] as [string, string] },
  { id: 'him7', brand: 'NORTH.', name: 'Light Jacket', price: 1899, original: 2799, rating: 4.7, img: pngUrl('jacket/small/jacket_PNG8058.png'), category: 'Jackets', colors: ['#5d4037', '#3e2723'] as [string, string] },
  { id: 'him8', brand: 'KOH', name: 'Wash Denim', price: 1599, original: 2499, rating: 4.4, img: pngUrl('jeans/small/jeans_PNG5778.png'), category: 'Jeans', tag: 'NEW', colors: ['#000', '#222'] as [string, string] },
];

export function ForHimScreen() {
  const nav = useNavigation<any>();
  const goToProduct = (p: any) => nav.navigate('ProductDetail', { product: p });
  const himCategories = [
    { id: 'tees', label: 'TEES', icon: 'square' },
    { id: 'jeans', label: 'JEANS', icon: 'minus' },
    { id: 'jackets', label: 'JACKETS', icon: 'shield' },
    { id: 'sneakers', label: 'SNEAKERS', icon: 'play' },
    { id: 'watches', label: 'WATCHES', icon: 'clock' },
    { id: 'caps', label: 'CAPS', icon: 'triangle' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <BrutalStatusBar />
      <ScreenHeader title="For Him" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Bold Banner */}
        <FadeInUp>
          <View style={[{ marginHorizontal: SP.l, marginTop: SP.l, height: 320, overflow: 'hidden' }, BORDER(1)]}>
            <Image source={{ uri: HIM_BANNER }} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" />
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.55)' }]} />
            <View style={{ flex: 1, padding: SP.l, justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <View style={[{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: C.ink, borderWidth: 1, borderColor: C.white }]}>
                <Text style={[T.monoB, { fontSize: 10, color: C.white }]}>♂ MEN_EDIT</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: 48, color: C.white, lineHeight: 48, letterSpacing: -2, textAlign: 'right' }}>HIS{'\n'}CODE.</Text>
                <Text style={[T.mono, { color: C.white, fontSize: 10, marginTop: 8 }]}>{'// RAW · RUGGED · REFINED //'}</Text>
              </View>
            </View>
          </View>
        </FadeInUp>

        {/* Intro */}
        <View style={{ paddingHorizontal: SP.l, marginTop: SP.l }}>
          <FadeInUp>
            <Text style={[T.monoB, { fontSize: 11 }]}>{'> CURATED_FOR_HIM'}</Text>
            <Text style={{ fontFamily: 'Inter_900Black', fontSize: 28, color: C.ink, letterSpacing: -1.2, marginTop: 4 }}>DENIM, SNEAKERS{'\n'}& STREET STAPLES.</Text>
            <Text style={[T.body, { color: C.dim, marginTop: SP.s }]}>Workwear to streetwear — gear that moves with you. No filler, no frills.</Text>
          </FadeInUp>
        </View>

        {/* Category icon grid */}
        <SectionHead title="SHOP" emphasis="BY CATEGORY" />
        <View style={{ paddingHorizontal: SP.l, flexDirection: 'row', flexWrap: 'wrap', gap: SP.s }}>
          {himCategories.map((c, i) => (
            <FadeInUp key={c.id} delay={i * 40}>
              <Pressable onPress={() => nav.navigate('Category', { id: c.id, label: c.label })} style={[{ width: 100, height: 80, alignItems: 'center', justifyContent: 'center', backgroundColor: C.ink, gap: 6 }, BORDER(1)]}>
                <Feather name={c.icon as any} size={20} color={C.white} />
                <Text style={[T.monoB, { fontSize: 9, color: C.white }]}>{c.label}</Text>
              </Pressable>
            </FadeInUp>
          ))}
        </View>

        {/* Denim highlight */}
        <SectionHead title="DENIM" emphasis="DROP" action="ALL" onAction={() => nav.navigate('Category', { id: 'jeans', label: 'Jeans' })} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SP.l, gap: SP.m }}>
          {HIM_PRODUCTS.filter(p => p.category === 'Jeans' || p.category === 'Jackets' || p.category === 'Coats').map((p, i) => (
            <FadeInUp key={p.id} delay={i * 30}>
              <ProductCard p={p} onPress={() => goToProduct(p)} />
            </FadeInUp>
          ))}
        </ScrollView>

        {/* Sneakers feature — full-width */}
        <SectionHead title="SNEAKER" emphasis="DROP" action="VIEW" onAction={() => nav.navigate('Category', { id: 'sneakers', label: 'Sneakers' })} />
        <View style={{ paddingHorizontal: SP.l }}>
          <Pressable onPress={() => goToProduct(HIM_PRODUCTS[2])} style={[{ flexDirection: 'row', backgroundColor: C.ink, height: 160, overflow: 'hidden' }, BORDER(1)]}>
            <View style={{ flex: 1, padding: SP.l, justifyContent: 'space-between' }}>
              <View>
                <Text style={[T.monoB, { fontSize: 9, color: C.white }]}>{`SNEAKER_DROP_01`}</Text>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: 20, color: C.white, marginTop: 6, letterSpacing: -0.5 }}>COURT{'\n'}CLASSICS</Text>
                <Text style={[T.body, { fontSize: 11, color: C.white, marginTop: 4 }]}>Low-tops. Clean lines. Undefeated.</Text>
              </View>
              <Text style={[T.monoB, { color: C.white }]}>{'COP ──▶'}</Text>
            </View>
            <View style={{ width: 160, backgroundColor: '#1a1a1a', borderLeftWidth: 1, borderColor: C.white }}>
              <Image source={{ uri: HIM_PRODUCTS[2].img }} style={{ width: '100%', height: '100%', padding: 12 }} resizeMode="contain" />
            </View>
          </Pressable>
        </View>

        {/* Second bold banner */}
        <View style={{ paddingHorizontal: SP.l, marginTop: SP.xl }}>
          <View style={[{ height: 200, overflow: 'hidden' }, BORDER(1)]}>
            <Image source={{ uri: HIM_BANNER_2 }} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" />
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.55)' }]} />
            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: SP.l }}>
              <Text style={[T.monoB, { color: C.white, fontSize: 9 }]}>{'// STREET_UNIFORM'}</Text>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 24, color: C.white, letterSpacing: -0.8 }}>BUILT DIFFERENT.</Text>
            </View>
          </View>
        </View>

        {/* Watches & Accessories */}
        <SectionHead title="TIME" emphasis="PIECES" action="ALL" onAction={() => nav.navigate('Category', { id: 'watches', label: 'Watches' })} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SP.l, gap: SP.m }}>
          {HIM_PRODUCTS.filter(p => p.category === 'Watches' || p.category === 'Accessories' || p.category === 'Caps').map((p, i) => (
            <FadeInUp key={p.id} delay={i * 30}>
              <ProductCard p={p} onPress={() => goToProduct(p)} />
            </FadeInUp>
          ))}
        </ScrollView>

        {/* New Arrivals */}
        <SectionHead title="FRESH" emphasis="DROPS" />
        <View style={{ paddingHorizontal: SP.l, flexDirection: 'row', flexWrap: 'wrap', gap: SP.m }}>
          {HIM_PRODUCTS.filter(p => p.tag === 'NEW').map((p, i) => (
            <FadeInUp key={p.id} delay={i * 40}>
              <View style={{ width: '47%' }}>
                <ProductCard p={p} onPress={() => goToProduct(p)} w={170} />
              </View>
            </FadeInUp>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── OCCASION SHOPPING ─────────────────────────────────────
export function OccasionShoppingScreen() {
  const nav = useNavigation<any>();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <BrutalStatusBar />
      <ScreenHeader title="Occasions" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 60 }}>
        <FadeInUp>
          <Text style={[T.monoB, { fontSize: 11 }]}>{'> SHOP_BY_OCCASION'}</Text>
          <Text style={{ fontFamily: 'Inter_900Black', fontSize: 32, color: C.ink, letterSpacing: -1.2, marginTop: 4 }}>DRESS FOR{'\n'}THE MOMENT.</Text>
        </FadeInUp>
        <AsciiDivider style={{ marginTop: SP.l }} />
        {OCCASIONS.map((o, i) => (
          <FadeInUp key={o.id} delay={i * 50}>
            <Pressable onPress={() => nav.navigate('Category', { id: o.id, label: o.label })} style={[{ marginTop: SP.m, height: 160, overflow: 'hidden', backgroundColor: C.white }, BORDER(1)]}>
              <Image source={{ uri: o.img }} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" />
              <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.4)' }]} />
              <View style={{ flex: 1, padding: SP.l, justifyContent: 'space-between' }}>
                <Text style={[T.monoB, { color: C.white, fontSize: 9 }]}>{`MODE_0${i + 1}`}</Text>
                <View>
                  <Text style={{ fontFamily: 'Inter_900Black', fontSize: 28, color: C.white, letterSpacing: -0.5 }}>{o.label.toUpperCase()}</Text>
                  <Text style={[T.mono, { color: C.white, marginTop: 4 }]}>{'SHOP NOW ──▶'}</Text>
                </View>
              </View>
            </Pressable>
          </FadeInUp>
        ))}
      </ScrollView>
    </View>
  );
}
