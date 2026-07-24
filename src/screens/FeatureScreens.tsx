// Feature screens — Image Search, Coupon Wallet, Community Feed, Mood Board,
// Lucky Draw, Invite Friends, App Challenges, New Arrivals, Discover Brands,
// For Her, For Him, Occasion Shopping, Flash Sale, Trending
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Image, StyleSheet, StatusBar, Alert, Animated, Easing, Modal, Share, TextInput } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { MotiView } from 'moti';
import { C, T, SP, BORDER, rf } from '../theme/brutal';
import { ScreenHeader, BrutalButton, BrutalStatusBar, FadeInUp, ProductCard, Chip, SectionHead, CachedImage, OptionSheet } from '../components/Brutal';
import { PRODUCTS, BRANDS, OCCASIONS, COMMUNITY, BUNDLES, CATEGORIES } from '../data/mockData';
import { useApp } from '../state/AppState';
import { useZoom } from '../navigation/ZoomTransition';
import { listCoupons } from '../services/promotions';

// ─── IMAGE SEARCH ──────────────────────────────────────────
// Stubbed but feels real: the user picks a source, watches a fake scan on a
// stand-in product image, and lands on a grid of "similar" PRODUCTS.
const FAKE_SCAN_IMAGES = PRODUCTS.slice(0, 6).map(p => p.img);

export function ImageSearchScreen() {
  const nav = useNavigation<any>();
  const { openZoom } = useZoom();
  const zoomRefs = useRef<{ [k: string]: any }>({});
  const [pickerOpen, setPickerOpen] = useState(true);
  const [stage, setStage] = useState<'idle' | 'camera' | 'scanning' | 'results'>('idle');
  const [pickedImg, setPickedImg] = useState<string | null>(null);
  const scanAnim = useRef(new Animated.Value(0)).current;
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('back');

  // Scan-line loop lives in a ref so it can be STOPPED — before, the loop kept
  // running (native-driven) long after the scan finished.
  const scanLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const beginScan = (imgUri: string) => {
    setPickedImg(imgUri);
    setStage('scanning');
    scanAnim.setValue(0);
    scanLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(scanAnim, { toValue: 0, duration: 900, easing: Easing.linear, useNativeDriver: true }),
      ])
    );
    scanLoopRef.current.start();
    setTimeout(() => setStage('results'), 1800);
  };
  useEffect(() => {
    if (stage !== 'scanning') scanLoopRef.current?.stop();
    return () => scanLoopRef.current?.stop();
  }, [stage]);

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
            <Text style={[T.h1, { marginTop: SP.xl, textAlign: 'center', textTransform: 'uppercase' }]}>Snap to find.</Text>
            <Text style={[T.body, { color: C.dim, marginTop: SP.s, textAlign: 'center', maxWidth: 280 }]}>Take a photo or upload an image to find similar products instantly.</Text>
          </FadeInUp>
          <View style={{ marginTop: SP.xl }}>
            <BrutalButton label="Pick a source" icon="image" onPress={() => setPickerOpen(true)} />
          </View>
          <FadeInUp delay={120}>
            <Text style={[T.micro, { marginTop: SP.xl, textAlign: 'center' }]}>{'AI-powered · visual search'}</Text>
          </FadeInUp>
        </View>
      )}

      {stage === 'camera' && (
        <View style={{ flex: 1, padding: SP.l }}>
          <View style={[{ flex: 1, backgroundColor: '#000', overflow: 'hidden' }, BORDER(1)]}>
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFillObject as any} facing={facing} />
            {/* HUD */}
            <View style={{ position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={[{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: C.white }, BORDER(1)]}>
                <Text style={[T.micro, { color: C.ink }]}>Frame a fit</Text>
              </View>
              <Pressable onPress={() => setFacing(f => (f === 'front' ? 'back' : 'front'))} hitSlop={8} style={[{ width: 30, height: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white }, BORDER(1)]}>
                <Feather name="refresh-cw" size={14} color={C.ink} />
              </Pressable>
            </View>
            {/* Corner frame — thin hairline ticks */}
            {[{top:8,left:8},{top:8,right:8},{bottom:8,left:8},{bottom:8,right:8}].map((pos, i) => (
              <View key={i} pointerEvents="none" style={{ position: 'absolute', ...pos, width: 14, height: 14, borderColor: C.white, borderTopWidth: i < 2 ? 2 : 0, borderBottomWidth: i >= 2 ? 2 : 0, borderLeftWidth: i % 2 === 0 ? 2 : 0, borderRightWidth: i % 2 === 1 ? 2 : 0 }} />
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
            <CachedImage source={{ uri: pickedImg }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            {/* scanning laser line */}
            <Animated.View
              style={{
                position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: C.ink,
                transform: [{ translateY: scanAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 318] }) }],
              }}
            />
            {/* corner frame — thin hairline ticks */}
            {[{top:6,left:6},{top:6,right:6},{bottom:6,left:6},{bottom:6,right:6}].map((pos, i) => (
              <View key={i} pointerEvents="none" style={{ position: 'absolute', ...pos, width: 14, height: 14, borderColor: C.ink, borderTopWidth: i < 2 ? 2 : 0, borderBottomWidth: i >= 2 ? 2 : 0, borderLeftWidth: i % 2 === 0 ? 2 : 0, borderRightWidth: i % 2 === 1 ? 2 : 0 }} />
            ))}
          </View>
          <Text style={[T.h1, { marginTop: SP.xl, textTransform: 'uppercase' }]}>Scanning...</Text>
          <Text style={[T.micro, { marginTop: 4 }]}>{'Matching color · cut · fabric'}</Text>
        </View>
      )}

      {stage === 'results' && pickedImg && (
        <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 60 }}>
          <View style={{ flexDirection: 'row', gap: SP.m, alignItems: 'center' }}>
            <View style={[{ width: 80, height: 100, backgroundColor: C.hairline, overflow: 'hidden' }, BORDER(1)]}>
              <CachedImage source={{ uri: pickedImg }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[T.micro]}>{'Your image'}</Text>
              <Text style={[T.h3, { marginTop: 2 }]}>12 matches found</Text>
              <Pressable onPress={reset} style={[{ marginTop: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, backgroundColor: C.white }, BORDER(1)]}>
                <Text style={[T.caption, { color: C.ink }]}>Try another</Text>
              </Pressable>
            </View>
          </View>          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: SP.m }}>
            {PRODUCTS.slice(0, 8).map((p, i) => (
              <FadeInUp key={p.id} delay={i * 40}>
                <ProductCard p={p} style={{ marginBottom: SP.m }}>
                  <View style={{ position: 'absolute', top: 6, left: 6, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: C.ink }}>
                    <Text style={[T.micro, { color: C.white }]}>{`${98 - i * 3}% match`}</Text>
                  </View>
                </ProductCard>
              </FadeInUp>
            ))}
          </View>
        </ScrollView>
      )}

      {/* SOURCE PICKER — shared OptionSheet, custom content */}
      <OptionSheet
        visible={pickerOpen}
        title="Grab an image"
        onClose={() => { setPickerOpen(false); if (stage === 'idle') nav.goBack(); }}
      >
        <View style={{ paddingHorizontal: SP.l, paddingTop: SP.m }}>
          <Text style={[T.caption, { color: C.dim }]}>We'll scan it and find matches.</Text>
          <View style={{ marginTop: SP.l, gap: SP.s }}>
            {[
              { id: 'camera', icon: 'camera', title: 'Take photo', desc: 'Snap a fit in the wild — we match it.' },
              { id: 'gallery', icon: 'upload', title: 'Upload from gallery', desc: 'Pick any shot from your photos.' },
            ].map((opt, i) => (
              <MotiView key={opt.id} from={{ opacity: 0, translateX: -20 }} animate={{ opacity: 1, translateX: 0 }} transition={{ delay: 120 + i * 80, type: 'timing', duration: 280 }}>
                <Pressable onPress={() => runScan(opt.id as any)} style={[{ padding: SP.m, backgroundColor: C.white }, BORDER(1)]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={[{ width: 46, height: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F4F4' }, BORDER(1)]}>
                      <Feather name={opt.icon as any} size={20} color={C.ink} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[T.h3]}>{opt.title}</Text>
                      <Text style={[T.micro, { marginTop: 3 }]}>{opt.desc}</Text>
                    </View>
                    <Feather name="arrow-right" size={16} color={C.ink} />
                  </View>
                </Pressable>
              </MotiView>
            ))}
          </View>
        </View>
      </OptionSheet>
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
  // Live coupons from the public /promotions/active; mock as the initial/fallback set.
  const [coupons, setCoupons] = useState(COUPONS);
  useEffect(() => {
    let cancelled = false;
    listCoupons().then((c) => { if (!cancelled && c.length) setCoupons(c); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <BrutalStatusBar />
      <ScreenHeader title="Coupons" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 60 }}>
        <FadeInUp>
          <Text style={[T.caption, { color: C.dim }]}>{'Coupon wallet'}</Text>
          <Text style={[T.h1, { marginTop: 4, textTransform: 'uppercase' }]}>Your coupons.</Text>
        </FadeInUp>
        {coupons.map((c, i) => (
          <FadeInUp key={c.id} delay={i * 50}>
            <View style={[{ marginTop: SP.m, flexDirection: 'row', backgroundColor: C.white, overflow: 'hidden' }, BORDER(1), !c.active && { opacity: 0.5 }]}>
              <View style={{ width: 90, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F4F4', padding: SP.s, borderRightWidth: 1, borderColor: C.hairline }}>
                <Text numberOfLines={2} adjustsFontSizeToFit style={[T.h3, { color: C.ink, textAlign: 'center' }]}>{c.discount}</Text>
              </View>
              <View style={{ flex: 1, padding: SP.m }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[T.monoB]}>{c.code}</Text>
                  <Pressable onPress={() => showToast('Copied', `${c.code} copied to clipboard`, 'copy')}>
                    <Feather name="copy" size={14} color={C.ink} />
                  </Pressable>
                </View>
                <Text style={[T.micro, { marginTop: 4 }]}>{c.min} · Expires {c.expires}</Text>
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
  { id: '1', user: '@zara.fits', caption: 'Sunday brunch fit check', likes: 1240, comments: 89, saves: 214, city: 'Bandra', time: '12m', fit: 'BRUNCH', heat: 96, tags: ['brunch', 'dress'], img: 'https://images.unsplash.com/photo-1485518882345-15568b007407?w=900&q=80' },
  { id: '2', user: '@ren.style', caption: 'Office power look for Monday', likes: 892, comments: 45, saves: 141, city: 'Lower Parel', time: '28m', fit: 'WORK', heat: 88, tags: ['work', 'minimal'], img: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=900&q=80' },
  { id: '3', user: '@mia.x', caption: 'Date night textures with a clean heel.', likes: 2103, comments: 156, saves: 438, city: 'Colaba', time: '43m', fit: 'DATE', heat: 99, tags: ['date', 'night'], img: 'https://images.unsplash.com/photo-1581044777550-4cfa60707c03?w=900&q=80' },
  { id: '4', user: '@kio.drip', caption: 'Vintage thrift haul of the week', likes: 654, comments: 32, saves: 87, city: 'Kala Ghoda', time: '1h', fit: 'VINTAGE', heat: 81, tags: ['street', 'vintage'], img: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=900&q=80' },
  { id: '5', user: '@nova.fit', caption: 'Festival season ready', likes: 1876, comments: 98, saves: 302, city: 'Juhu', time: '2h', fit: 'FEST', heat: 94, tags: ['festival', 'color'], img: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=900&q=80' },
];

const FEED_FILTERS = [
  { id: 'all', label: 'For you' },
  { id: 'street', label: 'Street' },
  { id: 'work', label: 'Work' },
  { id: 'date', label: 'Date' },
  { id: 'brunch', label: 'Brunch' },
];

export function CommunityFeedScreen() {
  const nav = useNavigation<any>();
  const { showToast } = useApp();
  const [filter, setFilter] = useState('all');
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const visiblePosts = filter === 'all' ? FEED_POSTS : FEED_POSTS.filter(p => p.tags.includes(filter));
  const lead = visiblePosts[0] || FEED_POSTS[0];
  const rest = visiblePosts.slice(1);
  const toggleLike = (id: string) => setLiked(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleSave = (id: string) => {
    setSaved(prev => ({ ...prev, [id]: !prev[id] }));
    showToast('Saved', 'Added to your mood board', 'bookmark');
  };
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <BrutalStatusBar />
      <ScreenHeader
        title="Community"
        onBack={() => nav.goBack()}
        right={
          <Pressable onPress={() => showToast('Post a fit', 'Creator upload coming next', 'camera')} style={[{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white }, BORDER(1)]}>
            <Feather name="camera" size={16} color={C.ink} />
          </Pressable>
        }
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
        <FadeInUp style={{ paddingHorizontal: SP.l, paddingTop: SP.l }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: SP.m }}>
            <View style={{ flex: 1 }}>
              <Text style={[T.caption, { color: C.dim }]}>The feed</Text>
              <Text style={[T.h1, { marginTop: 4, textTransform: 'uppercase' }]}>Community fits.</Text>
            </View>
            <View style={[{ width: 84, backgroundColor: C.white, padding: SP.s }, BORDER(1)]}>
              <Text style={[T.micro, { color: C.dim }]}>Live</Text>
              <Text style={[T.h1, { color: C.ink, marginTop: 2 }]}>{FEED_POSTS.length}</Text>
              <Text style={[T.micro, { color: C.dim }]}>Fits now</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: SP.s, marginTop: SP.l }}>
            <CommunityStat value="12.8K" label="Likes" />
            <CommunityStat value="343" label="Saved" />
            <CommunityStat value="41" label="Areas" />
          </View>
        </FadeInUp>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SP.l, gap: SP.s, marginTop: SP.l }}>
          {FEED_FILTERS.map(f => (
            <Pressable key={f.id} onPress={() => setFilter(f.id)} style={[{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, paddingVertical: 9, backgroundColor: filter === f.id ? C.ink : C.white }, BORDER(1)]}>
              {filter === f.id && <Feather name="check" size={11} color={C.white} />}
              <Text style={[T.caption, { color: filter === f.id ? C.white : C.ink }]}>{f.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <FadeInUp delay={50} style={{ paddingHorizontal: SP.l, marginTop: SP.l }}>
          <Pressable onPress={() => showToast('Featured fit', lead.caption, 'zap')} style={[{ backgroundColor: C.white, overflow: 'hidden' }, BORDER(1)]}>
            <View style={{ height: 420, backgroundColor: C.hairline }}>
              <CachedImage source={{ uri: lead.img }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.20)' }]} />
              <View style={{ position: 'absolute', top: SP.m, left: SP.m, right: SP.m, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.white, paddingHorizontal: 8, paddingVertical: 7 }, BORDER(1)]}>
                  <Avatar user={lead.user} />
                  <View>
                    <Text style={[T.caption, { color: C.ink }]}>{lead.user}</Text>
                    <Text style={[T.micro]}>{`${lead.city} · ${lead.time}`}</Text>
                  </View>
                </View>
                <View style={[{ backgroundColor: C.white, paddingHorizontal: 10, paddingVertical: 7 }, BORDER(1)]}>
                  <Text style={[T.micro, { color: C.ink }]}>{`${lead.heat}% hot`}</Text>
                </View>
              </View>
              <View style={{ position: 'absolute', left: SP.m, right: SP.m, bottom: SP.m }}>
                <Text style={[T.h1, { color: '#FFFFFF', textTransform: 'uppercase', textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }]}>{lead.fit} Fit check</Text>
                <Text style={[T.caption, { color: '#FFFFFF', marginTop: 6 }]}>{lead.caption}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', borderTopWidth: 1, borderColor: C.hairline }}>
              <CommunityAction icon={liked[lead.id] ? 'heart' : 'heart'} label={`${lead.likes + (liked[lead.id] ? 1 : 0)}`} active={!!liked[lead.id]} onPress={() => toggleLike(lead.id)} />
              <CommunityAction icon="message-square" label={`${lead.comments}`} />
              <CommunityAction icon="bookmark" label={`${lead.saves}`} active={!!saved[lead.id]} onPress={() => toggleSave(lead.id)} />
              <CommunityAction icon="send" label="Share" onPress={() => showToast('Shared', 'Fit link copied', 'send')} />
            </View>
          </Pressable>
        </FadeInUp>

        <View style={{ paddingHorizontal: SP.l, marginTop: SP.xl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[T.h2, { textTransform: 'uppercase' }]}>Today's fits</Text>
            <Text style={[T.micro]}>{`${visiblePosts.length} posts`}</Text>
          </View>
        </View>

        {rest.map((p, i) => (
          <FadeInUp key={p.id} delay={i * 50}>
            <CommunityPostCard
              post={p}
              index={i}
              liked={!!liked[p.id]}
              saved={!!saved[p.id]}
              onLike={() => toggleLike(p.id)}
              onSave={() => toggleSave(p.id)}
              onShare={() => showToast('Shared', p.user, 'send')}
            />
          </FadeInUp>
        ))}

        <View style={{ marginTop: SP.xl }}>
          <View style={{ paddingHorizontal: SP.l }}>
            <Text style={[T.h2, { textTransform: 'uppercase' }]}>Rising creators</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SP.l, gap: SP.m, marginTop: SP.m }}>
            {FEED_POSTS.map((p, i) => (
              <Pressable key={p.id} onPress={() => showToast('Creator', p.user, 'user-plus')} style={[{ width: 118, backgroundColor: C.white, overflow: 'hidden' }, BORDER(1)]}>
                <View style={{ height: 112, backgroundColor: C.hairline }}>
                  <CachedImage source={{ uri: p.img }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                </View>
                <View style={{ padding: SP.s, borderTopWidth: 1, borderColor: C.hairline }}>
                  <Text style={[T.caption, { color: C.ink }]} numberOfLines={1}>{p.user}</Text>
                  <Text style={[T.micro, { marginTop: 2 }]}>{`#${i + 1} · ${p.city}`}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

function Avatar({ user, size = 30 }: { user: string; size?: number }) {
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F4F4' }, BORDER(1)]}>
      <Text style={[T.h2, { color: C.ink, fontSize: Math.max(11, size * 0.36) }]}>{user[1]?.toUpperCase()}</Text>
    </View>
  );
}

function CommunityStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={[{ flex: 1, backgroundColor: C.white, padding: SP.s }, BORDER(1)]}>
      <Text style={[T.h2]}>{value}</Text>
      <Text style={[T.micro, { marginTop: 2 }]}>{label}</Text>
    </View>
  );
}

function CommunityAction({ icon, label, active, onPress }: { icon: keyof typeof Feather.glyphMap; label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderColor: C.hairline, backgroundColor: active ? C.ink : C.white, gap: 3 }}>
      <Feather name={icon} size={15} color={active ? C.white : C.ink} />
      <Text style={[T.micro, { color: active ? C.white : C.ink }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

function CommunityPostCard({ post, index, liked, saved, onLike, onSave, onShare }: { post: typeof FEED_POSTS[number]; index: number; liked: boolean; saved: boolean; onLike: () => void; onSave: () => void; onShare: () => void }) {
  return (
    <View style={{ paddingHorizontal: SP.l, marginTop: SP.m }}>
      <View style={[{ backgroundColor: C.white, overflow: 'hidden' }, BORDER(1)]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: SP.m, gap: 10 }}>
          <Avatar user={post.user} />
          <View style={{ flex: 1 }}>
            <Text style={[T.caption, { color: C.ink }]}>{post.user}</Text>
            <Text style={[T.micro, { marginTop: 2 }]}>{`${post.city} · ${post.time} · ${post.fit}`}</Text>
          </View>
          <View style={[{ paddingHorizontal: 8, paddingVertical: 5, backgroundColor: C.white }, BORDER(1)]}>
            <Text style={[T.micro, { color: C.ink }]}>{`#0${index + 2}`}</Text>
          </View>
        </View>

        <View style={{ height: index % 2 === 0 ? 340 : 290, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.hairline, backgroundColor: C.hairline }}>
          <CachedImage source={{ uri: post.img }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          <View style={{ position: 'absolute', top: SP.s, left: SP.s, flexDirection: 'row', gap: 6 }}>
            {post.tags.slice(0, 2).map(tag => (
              <View key={tag} style={[{ backgroundColor: C.white, paddingHorizontal: 8, paddingVertical: 4 }, BORDER(1)]}>
                <Text style={[T.micro, { color: C.ink }]}>{tag}</Text>
              </View>
            ))}
          </View>
          <View style={[{ position: 'absolute', right: SP.s, bottom: SP.s, backgroundColor: C.white, paddingHorizontal: 10, paddingVertical: 6 }, BORDER(1)]}>
            <Text style={[T.micro, { color: C.ink }]}>{`${post.heat}% fit score`}</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: C.hairline }}>
          <CommunityAction icon="heart" label={`${post.likes + (liked ? 1 : 0)}`} active={liked} onPress={onLike} />
          <CommunityAction icon="message-square" label={`${post.comments}`} />
          <CommunityAction icon="bookmark" label={`${post.saves}`} active={saved} onPress={onSave} />
          <CommunityAction icon="send" label="Send" onPress={onShare} />
        </View>

        <View style={{ padding: SP.m }}>
          <Text style={[T.bodyB]}>{post.caption}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.s, marginTop: SP.m }}>
            <View style={{ flex: 1, height: 1, backgroundColor: C.hairline }} />
            <Text style={[T.micro]}>Shop similar</Text>
            <Feather name="arrow-right" size={12} color={C.dim} />
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── MOOD BOARD ────────────────────────────────────────────
const MOOD_PINS = [
  ...PRODUCTS.map((p, i) => ({
    id: `prod-${p.id}`,
    title: p.name,
    source: p.brand,
    img: p.img,
    type: 'Product',
    fit: i % 2 === 0 ? 'contain' : 'cover',
  })),
  ...COMMUNITY.map((p, i) => ({
    id: `feed-${p.id}`,
    title: ['Street texture', 'Soft color story', 'Date-night lines', 'Layered casual'][i] || 'Community fit',
    source: p.user,
    img: p.img,
    type: 'Fit',
    fit: 'cover',
  })),
];

const INITIAL_MOOD_BOARDS = [
  { id: 'summer', name: 'Summer fits', pins: ['feed-cp1', 'prod-p5', 'prod-p6', 'feed-cp2', 'prod-p4', 'prod-p3'] },
  { id: 'work', name: 'Work outfits', pins: ['prod-p1', 'feed-cp4', 'prod-p2', 'prod-p7'] },
  { id: 'date', name: 'Date night', pins: ['feed-cp3', 'prod-p5', 'prod-p6'] },
];

export function MoodBoardScreen() {
  const nav = useNavigation<any>();
  const { showToast } = useApp();
  const [boards, setBoards] = useState(INITIAL_MOOD_BOARDS);
  const [activeId, setActiveId] = useState(INITIAL_MOOD_BOARDS[0].id);
  const [createOpen, setCreateOpen] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const activeBoard = boards.find(b => b.id === activeId) || boards[0];
  const activePins = activeBoard.pins.map(id => MOOD_PINS.find(p => p.id === id)).filter(Boolean) as typeof MOOD_PINS;
  const suggestions = MOOD_PINS.filter(p => !activeBoard.pins.includes(p.id)).slice(0, 8);
  const isSaved = (pinId: string) => activeBoard.pins.includes(pinId);
  const updateActivePins = (nextPins: string[]) => {
    setBoards(prev => prev.map(b => b.id === activeBoard.id ? { ...b, pins: nextPins } : b));
  };
  const addPin = (pinId: string) => {
    if (isSaved(pinId)) return;
    updateActivePins([pinId, ...activeBoard.pins]);
    showToast('Pinned', `${activeBoard.name}`, 'bookmark');
  };
  const removePin = (pinId: string) => {
    updateActivePins(activeBoard.pins.filter(id => id !== pinId));
    showToast('Removed', `${activeBoard.name}`, 'x');
  };
  const createBoard = () => {
    const name = newBoardName.trim() || `Board ${boards.length + 1}`;
    const id = `board-${Date.now()}`;
    setBoards(prev => [{ id, name, pins: [] }, ...prev]);
    setActiveId(id);
    setNewBoardName('');
    setCreateOpen(false);
    showToast('Board created', name, 'plus');
  };
  const quickAdd = () => {
    const next = suggestions[0];
    if (!next) {
      showToast('All set', 'This board has every available pin', 'check');
      return;
    }
    addPin(next.id);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <BrutalStatusBar />
      <ScreenHeader
        title="Mood Board"
        onBack={() => nav.goBack()}
        right={
          <Pressable onPress={() => setCreateOpen(true)} style={[{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white }, BORDER(1)]}>
            <Feather name="plus" size={17} color={C.ink} />
          </Pressable>
        }
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>
        <FadeInUp style={{ paddingHorizontal: SP.l, paddingTop: SP.l }}>
          <Text style={[T.caption, { color: C.dim }]}>{'Saved boards'}</Text>
          <Text style={[T.h1, { marginTop: 4, textTransform: 'uppercase' }]}>Your mood boards.</Text>
          <View style={{ flexDirection: 'row', gap: SP.s, marginTop: SP.l }}>
            <MoodStat value={`${boards.length}`} label="Boards" />
            <MoodStat value={`${activeBoard.pins.length}`} label="Pins" />
            <MoodStat value={`${suggestions.length}`} label="Ideas" />
          </View>
        </FadeInUp>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SP.l, gap: SP.s, marginTop: SP.l }}>
          {boards.map((b) => (
            <Pressable key={b.id} onPress={() => setActiveId(b.id)} style={[{ width: 154, backgroundColor: activeId === b.id ? C.ink : C.white, overflow: 'hidden' }, BORDER(1)]}>
              <View style={{ height: 88, flexDirection: 'row', backgroundColor: C.hairline }}>
                {b.pins.slice(0, 3).map((pinId, i) => {
                  const pin = MOOD_PINS.find(p => p.id === pinId);
                  return (
                    <View key={`${pinId}-${i}`} style={{ flex: 1, borderRightWidth: i < 2 ? 1 : 0, borderColor: activeId === b.id ? C.white : C.ink }}>
                      {pin && <CachedImage source={{ uri: pin.img }} style={{ width: '100%', height: '100%' }} resizeMode={pin.fit as any} />}
                    </View>
                  );
                })}
                {!b.pins.length && (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Feather name="plus" size={18} color={activeId === b.id ? C.white : C.ink} />
                  </View>
                )}
              </View>
              <View style={{ padding: SP.s, borderTopWidth: 1, borderColor: activeId === b.id ? C.white : C.ink }}>
                <Text style={[T.caption, { color: activeId === b.id ? C.white : C.ink }]} numberOfLines={1}>{b.name}</Text>
                <Text style={[T.micro, { color: activeId === b.id ? C.white : C.dim, opacity: activeId === b.id ? 0.75 : 1, marginTop: 2 }]}>{`${b.pins.length} pins`}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>

        <View style={{ paddingHorizontal: SP.l, marginTop: SP.xl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={[T.h2, { textTransform: 'uppercase' }]} numberOfLines={1}>{activeBoard.name}</Text>
              <Text style={[T.micro, { marginTop: 2 }]}>{`${activeBoard.pins.length} saved pins`}</Text>
            </View>
            <Pressable onPress={quickAdd} style={[{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: C.ink }, BORDER(1)]}>
              <Feather name="plus" size={12} color={C.white} />
              <Text style={[T.caption, { color: C.white }]}>Pin idea</Text>
            </Pressable>
          </View>
        </View>

        {activePins.length ? (
          <View style={{ flexDirection: 'row', gap: SP.s, paddingHorizontal: SP.l, marginTop: SP.m, alignItems: 'flex-start' }}>
            {[0, 1].map(col => (
              <View key={col} style={{ flex: 1, gap: SP.s }}>
                {activePins.filter((_, i) => i % 2 === col).map((pin, i) => (
                  <MoodPin key={pin.id} pin={pin} tall={(i + col) % 2 === 0} saved onPress={() => removePin(pin.id)} />
                ))}
              </View>
            ))}
          </View>
        ) : (
          <View style={{ paddingHorizontal: SP.l, marginTop: SP.m }}>
            <View style={[{ height: 190, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white, padding: SP.l }, BORDER(1)]}>
              <Feather name="image" size={30} color={C.ink} />
              <Text style={[T.h3, { marginTop: SP.m }]}>Empty board</Text>
              <Text style={[T.micro, { textAlign: 'center', marginTop: 4 }]}>Pin ideas below to build this mood.</Text>
            </View>
          </View>
        )}

        <View style={{ paddingHorizontal: SP.l, marginTop: SP.xl }}>
          <Text style={[T.h2, { textTransform: 'uppercase' }]}>More ideas</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: SP.s, paddingHorizontal: SP.l, marginTop: SP.m, alignItems: 'flex-start' }}>
          {[0, 1].map(col => (
            <View key={col} style={{ flex: 1, gap: SP.s }}>
              {suggestions.filter((_, i) => i % 2 === col).map((pin, i) => (
                <MoodPin key={pin.id} pin={pin} tall={(i + col) % 2 === 1} saved={false} onPress={() => addPin(pin.id)} />
              ))}
            </View>
          ))}
        </View>
      </ScrollView>

      <OptionSheet visible={createOpen} title="Create a board" onClose={() => setCreateOpen(false)}>
        <View style={{ paddingHorizontal: SP.l, paddingTop: SP.m }}>
          <Text style={[T.caption, { color: C.dim }]}>New board</Text>
          <View style={[{ marginTop: SP.m, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: SP.m, paddingVertical: 12, backgroundColor: '#F4F4F4' }, BORDER(1)]}>
            <Feather name="edit-3" size={16} color={C.ink} />
            <TextInput
              value={newBoardName}
              onChangeText={setNewBoardName}
              placeholder="Board name"
              placeholderTextColor={C.dim}
              autoCapitalize="words"
              style={[T.bodyB, { flex: 1, padding: 0 }]}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: SP.s, marginTop: SP.l }}>
            <BrutalButton label="Cancel" icon="x" variant="outline" onPress={() => setCreateOpen(false)} style={{ flex: 1 }} />
            <BrutalButton label="Create" iconRight="arrow-right" onPress={createBoard} style={{ flex: 1 }} />
          </View>
        </View>
      </OptionSheet>
    </View>
  );
}

function MoodStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={[{ flex: 1, backgroundColor: C.white, padding: SP.s }, BORDER(1)]}>
      <Text style={[T.h2]}>{value}</Text>
      <Text style={[T.micro, { marginTop: 2 }]}>{label}</Text>
    </View>
  );
}

function MoodPin({ pin, tall, saved, onPress }: { pin: typeof MOOD_PINS[number]; tall: boolean; saved: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[{ backgroundColor: C.white, overflow: 'hidden' }, BORDER(1)]}>
      <View style={{ height: tall ? 235 : 178, backgroundColor: C.hairline }}>
        <CachedImage source={{ uri: pin.img }} style={{ width: '100%', height: '100%' }} resizeMode={pin.fit as any} />
        <View style={{ position: 'absolute', top: 7, left: 7, backgroundColor: C.white, paddingHorizontal: 7, paddingVertical: 4, borderWidth: 1, borderColor: C.hairline }}>
          <Text style={[T.micro, { color: C.ink }]}>{pin.type}</Text>
        </View>
        <View style={{ position: 'absolute', right: 7, bottom: 7, backgroundColor: saved ? C.ink : C.white, paddingHorizontal: 9, paddingVertical: 6, borderWidth: 1, borderColor: C.hairline }}>
          <Text style={[T.micro, { color: saved ? C.white : C.ink }]}>{saved ? 'Remove' : 'Pin'}</Text>
        </View>
      </View>
      <View style={{ padding: SP.s, borderTopWidth: 1, borderColor: C.hairline }}>
        <Text style={[T.productName]} numberOfLines={2}>{pin.title}</Text>
        <Text style={[T.micro, { marginTop: 3 }]} numberOfLines={1}>{pin.source}</Text>
      </View>
    </Pressable>
  );
}

// ─── LUCKY DRAW — Scratch-card pick-one-of-three mini-game ──
const DRAW_PRIZES = [
  { label: '₹500 off', sub: 'Next order', icon: 'tag', rare: false },
  { label: '2× points', sub: '48 hrs', icon: 'zap', rare: false },
  { label: 'Free ship', sub: '10 orders', icon: 'truck', rare: false },
  { label: 'Mystery box', sub: '3 items', icon: 'package', rare: true },
  { label: 'iPhone 17', sub: 'Grand prize', icon: 'smartphone', rare: true },
  { label: 'Better luck', sub: 'Try tomorrow', icon: 'clock', rare: false },
];
const RECENT_WINNERS = [
  { user: '@maya.s', prize: '₹500 off', mins: 3 },
  { user: '@kai.r', prize: '2× points', mins: 12 },
  { user: '@aria_x', prize: 'Free ship', mins: 27 },
  { user: '@neo_d', prize: 'Mystery box', mins: 45 },
];

export function LuckyDrawScreen() {
  const nav = useNavigation<any>();
  const { showToast } = useApp();
  const [cards] = useState(() => [...DRAW_PRIZES].sort(() => Math.random() - 0.5).slice(0, 3));
  const [revealed, setRevealed] = useState<number | null>(null);
  const [played, setPlayed] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;

  // The old `useRef(Animated.loop(...).start())` re-ran its initializer on
  // EVERY render, spawning a new never-stopped infinite loop each time (leak).
  // One loop, started once, stopped on unmount — same visible pulse.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.04, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

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
        {/* HERO — clean, centered */}
        <FadeInUp>
          <View style={[{ padding: SP.l, backgroundColor: '#F4F4F4', alignItems: 'center' }, BORDER(1)]}>
            <Ionicons name="gift" size={40} color={C.ink} />
            <Text style={[T.h1, { color: C.ink, marginTop: 8, textTransform: 'uppercase' }]}>Pick a card</Text>
            <Text style={[T.caption, { color: C.dim, marginTop: 4, textAlign: 'center' }]}>1 free pick today · 1 in 3 chance to win big</Text>
          </View>
        </FadeInUp>

        {/* ─── 3 cards ─── */}
        <Text style={[T.caption, { marginTop: SP.xl, marginBottom: SP.s }]}>{played ? 'Your pick' : 'Tap a card to reveal'}</Text>
        <View style={{ flexDirection: 'row', gap: SP.s, marginTop: SP.m }}>
          {cards.map((card, i) => {
            const isOpen = revealed === i;
            return (
              <Pressable key={i} onPress={() => pick(i)} style={{ flex: 1 }} disabled={played}>
                <Animated.View style={{ transform: [{ scale: played && !isOpen ? 0.95 : isOpen ? 1 : played ? 1 : pulse }] }}>
                  {isOpen ? (
                    <MotiView from={{ rotateY: '180deg' }} animate={{ rotateY: '0deg' }} transition={{ type: 'timing', duration: 600 }} style={[{ height: 180, padding: SP.s, alignItems: 'center', justifyContent: 'space-between', backgroundColor: card.rare ? C.ink : C.white }, BORDER(1)]}>
                      <Text style={[T.micro, { color: card.rare ? C.white : C.ink }]}>{'Opened'}</Text>
                      <Feather name={card.icon as any} size={40} color={card.rare ? C.white : C.ink} />
                      <View style={{ alignItems: 'center' }}>
                        <Text style={[T.h3, { color: card.rare ? C.white : C.ink, textAlign: 'center' }]}>{card.label}</Text>
                        <Text style={[T.micro, { color: card.rare ? C.white : C.dim, marginTop: 2 }]}>{card.sub}</Text>
                      </View>
                    </MotiView>
                  ) : (
                    <View style={[{ height: 180, padding: SP.s, alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.white, opacity: played ? 0.3 : 1 }, BORDER(1)]}>
                      <Text style={[T.h3]}>?</Text>
                      {/* Covered tile — plain solid fill (was an ascii hatching pattern). */}
                      <View style={{ flex: 1, alignSelf: 'stretch', overflow: 'hidden', marginVertical: 8, backgroundColor: C.hairline }} />
                      <Text style={[T.caption, { color: C.ink }]}>{played ? '—' : 'Tap'}</Text>
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
              <Text style={[T.micro]}>Next draw in</Text>
              <Text style={[T.monoB, { fontSize: rf(22), letterSpacing: 3, marginTop: 4 }]}>23:59:12</Text>
            </View>
          </FadeInUp>
        )}

        {/* ─── Grand prize banner ─── */}
        <Text style={[T.caption, { marginTop: SP.xl, marginBottom: SP.s }]}>Grand prize</Text>
        <View style={[{ marginTop: SP.m, padding: SP.l, backgroundColor: '#F4F4F4' }, BORDER(1)]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={[T.micro, { color: C.dim }]}>{'April 2026'}</Text>
              <Text style={[T.h1, { color: C.ink, marginTop: 6, textTransform: 'uppercase' }]}>₹10,000{'\n'}Gift card</Text>
              <Text style={[T.micro, { color: C.dim, marginTop: 6 }]}>+ 5 runner-up slots</Text>
            </View>
            <Ionicons name="trophy" size={56} color={C.ink} />
          </View>
          <View style={{ marginTop: SP.m, height: 1, backgroundColor: C.hairline }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: SP.s }}>
            <Text style={[T.micro, { color: C.dim }]}>Draws · 30 Apr</Text>
            <Text style={[T.micro, { color: C.dim }]}>1,247 entries</Text>
          </View>
        </View>

        {/* ─── Live winners ticker ─── */}
        <Text style={[T.caption, { marginTop: SP.xl, marginBottom: SP.s }]}>Recent winners</Text>
        {RECENT_WINNERS.map((w, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderColor: C.hairline }}>
            <View style={[{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F4F4' }, BORDER(1)]}>
              <Text style={[T.micro, { color: C.ink }]}>{`0${i + 1}`}</Text>
            </View>
            <Text style={[T.caption, { color: C.ink, marginLeft: 10, flex: 1 }]}>{w.user}</Text>
            <Text style={[T.caption, { color: C.ink }]}>{w.prize}</Text>
            <Text style={[T.micro, { marginLeft: 10 }]}>{w.mins}m</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── INVITE FRIENDS — Tier progression + referral tree ──────
const INVITE_TIERS = [
  { name: 'Bronze', need: 1, reward: '₹200', unlocked: true },
  { name: 'Silver', need: 5, reward: '₹1,200', unlocked: true },
  { name: 'Gold', need: 10, reward: '₹3,000', unlocked: false },
  { name: 'Platinum', need: 25, reward: '₹10,000', unlocked: false },
  { name: 'Diamond', need: 50, reward: 'Mystery', unlocked: false },
];
const INVITED = [
  { user: 'Sahil M', status: 'JOINED', earn: '₹200', date: '2d' },
  { user: 'Kavya R', status: 'JOINED', earn: '₹200', date: '5d' },
  { user: 'Rohan X', status: 'JOINED', earn: '₹200', date: '1w' },
  { user: 'Nikita', status: 'PENDING', earn: '—', date: '3d' },
  { user: 'Aditya J', status: 'JOINED', earn: '₹200', date: '2w' },
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

  const shareLink = 'https://trendzo.app/invite/TRENDZO42';
  const shareMessage = `Join me on TRENDZO. Use my code TRENDZO42 and we both get ₹200. ${shareLink}`;

  const copyCode = () => {
    setCopied(true);
    showToast('Copied', 'TRENDZO42 copied to clipboard', 'copy');
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
              { label: 'Invites', val: INVITED.length, sub: 'Sent' },
              { label: 'Joined', val: joined, sub: 'Verified' },
              { label: 'Earned', val: `₹${joined * 200}`, sub: 'Cashback' },
            ].map((s, i) => (
              <View key={i} style={{ flex: 1, padding: SP.m, borderRightWidth: i < 2 ? 1 : 0, borderColor: C.hairline, backgroundColor: i === 1 ? '#F4F4F4' : C.white }}>
                <Text style={[T.micro, { color: C.dim }]}>{s.label}</Text>
                <Text style={[T.h1, { color: C.ink, marginTop: 4 }]}>{s.val}</Text>
                <Text style={[T.micro, { color: C.dim, marginTop: 2 }]}>{s.sub}</Text>
              </View>
            ))}
          </View>
        </FadeInUp>

        {/* REFERRAL CODE — big code block */}
        <Text style={[T.caption, { marginTop: SP.xl, color: C.dim }]}>{'Your code'}</Text>
        <FadeInUp delay={60}>
          <View style={[{ marginTop: SP.s, overflow: 'hidden' }, BORDER(1)]}>
            <View style={{ padding: SP.l, backgroundColor: '#F4F4F4', alignItems: 'center' }}>
              <Text style={[T.micro, { color: C.dim }]}>{'Tap to copy'}</Text>
              <Text style={[T.monoB, { color: C.ink, fontSize: rf(22), letterSpacing: 5, marginTop: 8 }]}>TRENDZO42</Text>
              <View style={{ flexDirection: 'row', gap: 4, marginTop: 10 }}>
                {'TRENDZO42'.split('').map((ch, i) => (
                  <View key={i} style={{ width: 6, height: 2, backgroundColor: C.ink }} />
                ))}
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 0, marginTop: 0, borderTopWidth: 1, borderColor: C.hairline }}>
              <Pressable onPress={copyCode} style={{ flex: 1, padding: SP.m, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.white }}>
                {copied && <Feather name="check" size={13} color={C.ink} />}
                <Text style={[T.caption, { color: C.ink }]}>{copied ? 'Copied' : 'Copy code'}</Text>
              </Pressable>
              <Pressable onPress={() => setShareOpen(true)} style={{ flex: 1, padding: SP.m, alignItems: 'center', backgroundColor: C.ink, borderLeftWidth: 1, borderColor: C.hairline }}>
                <Text style={[T.caption, { color: C.white }]}>Share link</Text>
              </Pressable>
            </View>
          </View>
        </FadeInUp>

        {/* TIER PROGRESS BAR */}
        <Text style={[T.caption, { marginTop: SP.xl, color: C.dim }]}>{'Tier progress'}</Text>
        <View style={[{ marginTop: SP.s, padding: SP.m, backgroundColor: C.white }, BORDER(1)]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text style={[T.h3]}>{INVITE_TIERS[activeTier].name}</Text>
            <Text style={[T.micro]}>{joined}/{nextTier.need}</Text>
          </View>
          <View style={[{ marginTop: 8, height: 10, flexDirection: 'row', overflow: 'hidden' }, BORDER(1)]}>
            {[...Array(nextTier.need)].map((_, i) => (
              <View key={i} style={{ flex: 1, backgroundColor: i < joined ? C.ink : 'transparent', borderRightWidth: i < nextTier.need - 1 ? 1 : 0, borderColor: C.hairline }} />
            ))}
          </View>
          <Text style={[T.micro, { marginTop: 6 }]}>
            {currentTier === -1 ? 'Max tier reached' : `${nextTier.need - joined} more → ${nextTier.name} (${nextTier.reward})`}
          </Text>
        </View>

        {/* TIER LADDER */}
        <View style={{ marginTop: SP.m, gap: 6 }}>
          {INVITE_TIERS.map((t, i) => {
            const done = joined >= t.need;
            const isNext = i === currentTier;
            return (
              <View key={t.name} style={[{ flexDirection: 'row', alignItems: 'center', padding: SP.s, backgroundColor: done ? '#F4F4F4' : C.white }, BORDER(1)]}>
                <View style={[{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: C.ink, marginRight: 10 }]}>
                  {done ? <Feather name="check" size={16} color={C.white} /> : <Text style={[T.micro, { color: C.white }]}>{`L${i + 1}`}</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[T.caption, { color: C.ink }]}>{t.name}</Text>
                  <Text style={[T.micro, { color: C.dim, marginTop: 2 }]}>{t.need} invites · {t.reward}</Text>
                </View>
                {isNext && <Text style={[T.micro, { color: C.ink }]}>Next</Text>}
              </View>
            );
          })}
        </View>

        {/* FRIENDS LIST */}
        <Text style={[T.caption, { marginTop: SP.xl, color: C.dim }]}>{`Your invites (${INVITED.length})`}</Text>
        <View style={{ marginTop: SP.s }}>
          {INVITED.map((f, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', padding: SP.s, borderBottomWidth: 1, borderColor: C.hairline }}>
              <View style={[{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: f.status === 'JOINED' ? C.ink : C.white }, BORDER(1)]}>
                <Text style={[T.caption, { color: f.status === 'JOINED' ? C.white : C.ink }]}>{f.user[0].toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[T.bodyB]}>{f.user}</Text>
                <Text style={[T.micro]}>{f.date} ago · {f.status}</Text>
              </View>
              <Text style={[T.bodyB, { color: f.status === 'JOINED' ? C.ink : C.dim }]}>{f.earn}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* SHARE POPUP — shared OptionSheet, custom content */}
      <OptionSheet visible={shareOpen} title="Drop your code." onClose={() => setShareOpen(false)}>
        <View style={{ paddingHorizontal: SP.l, paddingTop: SP.m }}>
          <Text style={[T.caption, { color: C.dim }]}>Every sign-up drops ₹200 in your pocket.</Text>

          {/* Link pill */}
          <View style={[{ marginTop: SP.l, padding: SP.m, flexDirection: 'row', alignItems: 'center', gap: 10 }, BORDER(1)]}>
            <Feather name="link" size={14} color={C.ink} />
            <Text style={[T.micro, { flex: 1 }]} numberOfLines={1}>{shareLink}</Text>
            <Pressable onPress={copyLink} hitSlop={8} style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: C.ink }}>
              <Text style={[T.micro, { color: C.white }]}>Copy</Text>
            </Pressable>
          </View>

          <View style={{ marginTop: SP.l, gap: SP.s }}>
            {[
              { id: 'native', icon: 'share-2', title: 'Share via...', desc: 'WhatsApp, Messages, anywhere.', primary: true, onPress: openNativeShare },
              { id: 'copy', icon: 'copy', title: 'Copy message + link', desc: 'Paste it anywhere you like.', primary: false, onPress: () => { showToast('Copied', 'Invite message copied', 'copy'); setShareOpen(false); } },
            ].map((opt, i) => (
              <MotiView key={opt.id} from={{ opacity: 0, translateX: -20 }} animate={{ opacity: 1, translateX: 0 }} transition={{ delay: 120 + i * 80, type: 'timing', duration: 280 }}>
                <Pressable onPress={opt.onPress} style={[{ padding: SP.m, backgroundColor: opt.primary ? C.ink : C.white }, BORDER(1)]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={[{ width: 46, height: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: opt.primary ? C.white : '#F4F4F4' }, !opt.primary && BORDER(1)]}>
                      <Feather name={opt.icon as any} size={20} color={C.ink} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[T.h3, { color: opt.primary ? C.white : C.ink }]}>{opt.title}</Text>
                      <Text style={[T.micro, { color: opt.primary ? C.white : C.dim, marginTop: 3, opacity: 0.8 }]}>{opt.desc}</Text>
                    </View>
                    <Feather name="arrow-right" size={16} color={opt.primary ? C.white : C.ink} />
                  </View>
                </Pressable>
              </MotiView>
            ))}
          </View>
        </View>
      </OptionSheet>
    </View>
  );
}

// ─── APP CHALLENGES — Tabbed quest board + XP + claim ─────
type Challenge = { id: string; title: string; sub: string; progress: number; total: number; reward: string; xp: number; icon: string; done?: boolean };
const QUESTS: Record<'DAILY' | 'WEEKLY' | 'MONTHLY', Challenge[]> = {
  DAILY: [
    { id: 'd1', title: 'Login streak', sub: 'Open app 1× today', progress: 1, total: 1, reward: '20 PTS', xp: 20, icon: 'sun', done: true },
    { id: 'd2', title: 'Wishlist add', sub: 'Save 2 items you love', progress: 1, total: 2, reward: '30 PTS', xp: 30, icon: 'heart' },
    { id: 'd3', title: 'Browse brands', sub: 'View 3 brand pages', progress: 2, total: 3, reward: '25 PTS', xp: 25, icon: 'search' },
  ],
  WEEKLY: [
    { id: 'w1', title: 'Style streak', sub: 'Post 3 outfit photos', progress: 2, total: 3, reward: '150 PTS', xp: 150, icon: 'camera' },
    { id: 'w2', title: 'Review master', sub: 'Write 5 product reviews', progress: 3, total: 5, reward: '250 PTS', xp: 250, icon: 'message-square' },
    { id: 'w3', title: 'Cart champion', sub: 'Complete 2 orders', progress: 2, total: 2, reward: '100 PTS', xp: 100, icon: 'shopping-bag', done: true },
    { id: 'w4', title: 'Explorer', sub: 'Browse 10 categories', progress: 7, total: 10, reward: '80 PTS', xp: 80, icon: 'compass' },
  ],
  MONTHLY: [
    { id: 'm1', title: 'Social butterfly', sub: 'Refer 3 friends', progress: 1, total: 3, reward: '₹600', xp: 600, icon: 'users' },
    { id: 'm2', title: 'Spender', sub: 'Spend ₹5,000 total', progress: 3400, total: 5000, reward: '₹500 CREDIT', xp: 500, icon: 'credit-card' },
    { id: 'm3', title: 'Community', sub: 'Like 50 community posts', progress: 23, total: 50, reward: '300 PTS', xp: 300, icon: 'thumbs-up' },
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
        {/* LEVEL hero — clean badge + single progress bar */}
        <FadeInUp>
          <View style={[{ padding: SP.l, backgroundColor: '#F4F4F4' }, BORDER(1)]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.m }}>
              <View style={[{ width: 60, height: 60, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white }, BORDER(1)]}>
                <Text style={[T.h1]}>{level}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[T.h2, { color: C.ink, textTransform: 'uppercase' }]}>Level {level}</Text>
                <Text style={[T.micro, { color: C.dim, marginTop: 2 }]}>{`${500 - (totalXP % 500)} XP to level ${level + 1}`}</Text>
                <View style={[{ marginTop: 8, height: 8, flexDirection: 'row', backgroundColor: C.white }, BORDER(1)]}>
                  <View style={{ flex: Math.max(0.001, levelProg), backgroundColor: C.ink }} />
                  <View style={{ flex: Math.max(0.001, 1 - levelProg) }} />
                </View>
              </View>
            </View>
          </View>
        </FadeInUp>

        {/* Tab switcher */}
        <View style={[{ flexDirection: 'row', marginTop: SP.l, overflow: 'hidden' }, BORDER(1)]}>
          {(['DAILY', 'WEEKLY', 'MONTHLY'] as const).map((t, i) => (
            <Pressable key={t} onPress={() => setTab(t)} style={[{ flex: 1, padding: SP.s, alignItems: 'center', backgroundColor: tab === t ? C.ink : C.white, borderRightWidth: i < 2 ? 1 : 0, borderColor: C.hairline }]}>
              <Text style={[T.caption, { color: tab === t ? C.white : C.ink }]}>{t}</Text>
              <Text style={[T.micro, { color: tab === t ? C.white : C.dim, marginTop: 2 }]}>{QUESTS[t].filter(q => q.done || claimed[q.id]).length}/{QUESTS[t].length}</Text>
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
                <View style={[{ padding: SP.m, backgroundColor: isDone ? '#F4F4F4' : C.white }, BORDER(1)]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={[{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: C.ink }]}>
                      <Feather name={q.icon as any} size={20} color={C.white} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[T.h3, { color: C.ink }]}>{q.title}</Text>
                      <Text style={[T.micro, { color: C.dim, marginTop: 2 }]}>{q.sub}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <View style={[{ paddingHorizontal: 6, paddingVertical: 3, backgroundColor: C.ink }]}>
                        <Text style={[T.micro, { color: C.white }]}>{q.reward}</Text>
                      </View>
                      <Text style={[T.micro, { color: C.dim, marginTop: 4 }]}>+{q.xp} XP</Text>
                    </View>
                  </View>
                  {/* Progress */}
                  <View style={{ marginTop: SP.s, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ flex: 1, height: 6, backgroundColor: C.hairline }}>
                      <View style={{ width: `${Math.min(100, (q.progress / q.total) * 100)}%`, height: '100%', backgroundColor: C.ink }} />
                    </View>
                    <Text style={[T.micro, { color: C.dim }]}>{q.progress.toLocaleString()}/{q.total.toLocaleString()}</Text>
                  </View>
                  {/* Action */}
                  {canClaim && (
                    <Pressable onPress={() => claim(q)} style={[{ marginTop: SP.s, padding: SP.s, alignItems: 'center', backgroundColor: C.ink }]}>
                      <Text style={[T.caption, { color: C.white }]}>{'Claim reward'}</Text>
                    </Pressable>
                  )}
                  {isDone && (
                    <View style={[{ marginTop: SP.s, padding: SP.s, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.white }, BORDER(1)]}>
                      <Feather name="check" size={13} color={C.ink} />
                      <Text style={[T.caption, { color: C.ink }]}>Claimed</Text>
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
            <Text style={[T.h3]}>7-day quest streak</Text>
            <Text style={[T.micro, { marginTop: 2 }]}>Complete 1 quest/day for a bonus 500 XP at day 7</Text>
          </View>
          <Text style={[T.h2]}>5/7</Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── NEW ARRIVALS ──────────────────────────────────────────
export function NewArrivalsScreen() {
  const nav = useNavigation<any>();
  const { openZoom } = useZoom();
  const zoomRefs = useRef<{ [k: string]: any }>({});
  const goToProduct = (p: any) => nav.navigate('ProductDetail', { product: p });
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <BrutalStatusBar />
      <ScreenHeader title="New Arrivals" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 60 }}>
        <FadeInUp>
          <Text style={[T.caption, { color: C.dim }]}>{'Just dropped'}</Text>
          <Text style={[T.h1, { marginTop: 4, textTransform: 'uppercase' }]}>Latest drops.</Text>
        </FadeInUp>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.s, marginTop: SP.l }}>
          {PRODUCTS.map((p, i) => (
            <FadeInUp key={p.id} delay={i * 40}>
              <ProductCard p={p} onPress={() => goToProduct(p)} style={{ marginBottom: SP.s }}>
                <View style={{ position: 'absolute', top: 0, right: 0, backgroundColor: C.ink, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={[T.micro, { color: C.white }]}>New</Text>
                </View>
              </ProductCard>
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
          <Text style={[T.caption, { color: C.dim }]}>{'Brand army'}</Text>
          <Text style={[T.h1, { marginTop: 4, textTransform: 'uppercase' }]}>Discover brands.</Text>
        </FadeInUp>
        <View style={{ gap: SP.m, marginTop: SP.l }}>
          {BRANDS.map((b, i) => (
            <FadeInUp key={b.id} delay={i * 50}>
              <Pressable onPress={() => nav.navigate('Category', { id: 'brand-' + b.id, label: b.name })} style={[{ flexDirection: 'row', alignItems: 'center', padding: SP.l, backgroundColor: C.white }, BORDER(1)]}>
                <View style={[{ width: 56, height: 56, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F4F4' }, BORDER(1)]}>
                  <Text style={[T.h2, { color: C.ink }]}>{b.name[0]}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: SP.m }}>
                  <Text style={[T.h2, { textTransform: 'uppercase' }]}>{b.name}</Text>
                  <Text style={[T.micro, { marginTop: 2 }]}>{Math.floor(Math.random() * 200 + 50)} products</Text>
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
            <CachedImage source={{ uri: HER_BANNER }} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" />
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.25)' }]} />
            <View style={{ flex: 1, padding: SP.l, justifyContent: 'space-between' }}>
              <View style={[{ alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, backgroundColor: C.white }, BORDER(1)]}>
                <Text style={[T.micro, { color: C.ink }]}>Women edit</Text>
              </View>
              <View>
                <Text style={[T.h1, { fontSize: rf(40), lineHeight: rf(42), color: C.white, textTransform: 'uppercase' }]}>Her{'\n'}style.</Text>
                <Text style={[T.micro, { color: C.white, marginTop: 8 }]}>{'Bold · Feminine · Unapologetic'}</Text>
              </View>
            </View>
          </View>
        </FadeInUp>

        {/* Intro */}
        <View style={{ paddingHorizontal: SP.l, marginTop: SP.l }}>
          <FadeInUp>
            <Text style={[T.caption, { color: C.dim }]}>{'Curated for her'}</Text>
            <Text style={[T.h2, { marginTop: 4, textTransform: 'uppercase' }]}>Dresses, heels & everything in between.</Text>
            <Text style={[T.body, { color: C.dim, marginTop: SP.s }]}>From silk slips to block heels — the women's edit handpicked for the modern queen.</Text>
          </FadeInUp>
        </View>

        {/* Category icon grid */}
        <SectionHead title="SHOP" emphasis="BY CATEGORY" />
        <View style={{ paddingHorizontal: SP.l, flexDirection: 'row', flexWrap: 'wrap', gap: SP.s }}>
          {herCategories.map((c, i) => (
            <FadeInUp key={c.id} delay={i * 40}>
              <Pressable onPress={() => nav.navigate('Category', { id: c.id, label: c.label })} style={[{ width: 100, height: 80, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FBDCE9', gap: 6 }, BORDER(1)]}>
                <Feather name={c.icon as any} size={20} color={C.ink} />
                <Text style={[T.caption, { color: C.ink }]}>{c.label}</Text>
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
            <View style={{ width: 160, backgroundColor: '#f9f3ed', borderRightWidth: 1, borderColor: C.hairline }}>
              <CachedImage source={{ uri: HER_PRODUCTS[2].img }} style={{ width: '100%', height: '100%', padding: 12 }} resizeMode="contain" />
            </View>
            <View style={{ flex: 1, padding: SP.l, justifyContent: 'space-between' }}>
              <View>
                <Text style={[T.micro, { color: C.dim }]}>{`Bag edit 01`}</Text>
                <Text style={[T.h2, { marginTop: 6, textTransform: 'uppercase' }]}>Designer{'\n'}totes</Text>
                <Text style={[T.micro, { marginTop: 4 }]}>Hand-picked from Paris boutiques</Text>
              </View>
              <Text style={[T.caption, { color: C.ink }]}>{'Shop'}</Text>
            </View>
          </Pressable>
        </View>

        {/* Second aesthetic banner */}
        <View style={{ paddingHorizontal: SP.l, marginTop: SP.xl }}>
          <View style={[{ height: 200, overflow: 'hidden' }, BORDER(1)]}>
            <CachedImage source={{ uri: HER_BANNER_2 }} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" />
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: SP.l, backgroundColor: 'rgba(0,0,0,0.4)' }}>
              <Text style={[T.micro, { color: C.white }]}>{'Feminine essentials'}</Text>
              <Text style={[T.h1, { color: C.white, textTransform: 'uppercase' }]}>Soft power.</Text>
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
              <ProductCard p={p} onPress={() => goToProduct(p)} style={{ marginBottom: SP.s }} />
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
            <CachedImage source={{ uri: HIM_BANNER }} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" />
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.4)' }]} />
            <View style={{ flex: 1, padding: SP.l, justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <View style={[{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: C.white }, BORDER(1)]}>
                <Text style={[T.micro, { color: C.ink }]}>Men edit</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[T.h1, { fontSize: rf(40), lineHeight: rf(42), color: C.white, textTransform: 'uppercase', textAlign: 'right' }]}>His{'\n'}code.</Text>
                <Text style={[T.micro, { color: C.white, marginTop: 8 }]}>{'Raw · Rugged · Refined'}</Text>
              </View>
            </View>
          </View>
        </FadeInUp>

        {/* Intro */}
        <View style={{ paddingHorizontal: SP.l, marginTop: SP.l }}>
          <FadeInUp>
            <Text style={[T.caption, { color: C.dim }]}>{'Curated for him'}</Text>
            <Text style={[T.h2, { marginTop: 4, textTransform: 'uppercase' }]}>Denim, sneakers & street staples.</Text>
            <Text style={[T.body, { color: C.dim, marginTop: SP.s }]}>Workwear to streetwear — gear that moves with you. No filler, no frills.</Text>
          </FadeInUp>
        </View>

        {/* Category icon grid */}
        <SectionHead title="SHOP" emphasis="BY CATEGORY" />
        <View style={{ paddingHorizontal: SP.l, flexDirection: 'row', flexWrap: 'wrap', gap: SP.s }}>
          {himCategories.map((c, i) => (
            <FadeInUp key={c.id} delay={i * 40}>
              <Pressable onPress={() => nav.navigate('Category', { id: c.id, label: c.label })} style={[{ width: 100, height: 80, alignItems: 'center', justifyContent: 'center', backgroundColor: '#DCE9FB', gap: 6 }, BORDER(1)]}>
                <Feather name={c.icon as any} size={20} color={C.ink} />
                <Text style={[T.caption, { color: C.ink }]}>{c.label}</Text>
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
          <Pressable onPress={() => goToProduct(HIM_PRODUCTS[2])} style={[{ flexDirection: 'row', backgroundColor: C.white, height: 160, overflow: 'hidden' }, BORDER(1)]}>
            <View style={{ flex: 1, padding: SP.l, justifyContent: 'space-between' }}>
              <View>
                <Text style={[T.micro, { color: C.ink }]}>{`Sneaker drop 01`}</Text>
                <Text style={[T.h2, { color: C.ink, marginTop: 6, textTransform: 'uppercase' }]}>Court{'\n'}classics</Text>
                <Text style={[T.micro, { color: C.dim, marginTop: 4 }]}>Low-tops. Clean lines. Undefeated.</Text>
              </View>
              <Text style={[T.caption, { color: C.ink }]}>{'Cop'}</Text>
            </View>
            <View style={{ width: 160, backgroundColor: '#DCE9FB', borderLeftWidth: 1, borderColor: C.hairline }}>
              <CachedImage source={{ uri: HIM_PRODUCTS[2].img }} style={{ width: '100%', height: '100%', padding: 12 }} resizeMode="contain" />
            </View>
          </Pressable>
        </View>

        {/* Second bold banner */}
        <View style={{ paddingHorizontal: SP.l, marginTop: SP.xl }}>
          <View style={[{ height: 200, overflow: 'hidden' }, BORDER(1)]}>
            <CachedImage source={{ uri: HIM_BANNER_2 }} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" />
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.4)' }]} />
            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: SP.l }}>
              <Text style={[T.micro, { color: C.white }]}>{'Street uniform'}</Text>
              <Text style={[T.h1, { color: C.white, textTransform: 'uppercase' }]}>Built different.</Text>
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
              <ProductCard p={p} onPress={() => goToProduct(p)} style={{ marginBottom: SP.s }} />
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
          <Text style={[T.caption, { color: C.dim }]}>{'Shop by occasion'}</Text>
          <Text style={[T.h1, { marginTop: 4, textTransform: 'uppercase' }]}>Dress for the moment.</Text>
        </FadeInUp>
        {OCCASIONS.map((o, i) => (
          <FadeInUp key={o.id} delay={i * 50}>
            <Pressable onPress={() => nav.navigate('Category', { id: o.id, label: o.label })} style={[{ marginTop: SP.m, height: 160, overflow: 'hidden', backgroundColor: C.white }, BORDER(1)]}>
              <CachedImage source={{ uri: o.img }} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" />
              <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.35)' }]} />
              <View style={{ flex: 1, padding: SP.l, justifyContent: 'space-between' }}>
                <Text style={[T.micro, { color: C.white }]}>{`Mode 0${i + 1}`}</Text>
                <View>
                  <Text style={[T.h2, { color: C.white, textTransform: 'uppercase' }]}>{o.label}</Text>
                  <Text style={[T.caption, { color: C.white, marginTop: 4 }]}>{'Shop now'}</Text>
                </View>
              </View>
            </Pressable>
          </FadeInUp>
        ))}
      </ScrollView>
    </View>
  );
}
