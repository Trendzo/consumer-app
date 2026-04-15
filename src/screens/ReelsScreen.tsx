// Vertical reels feed with snap-paging, brutalism overlay UI.
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, Image, Dimensions, Pressable, StyleSheet, StatusBar, Alert, DeviceEventEmitter, Modal, TextInput, Share, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { useNavigation } from '@react-navigation/native';
import { useVideoPlayer, VideoView } from 'expo-video';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSequence, withDelay, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import SearchScreen from './SearchScreen';
import { C, T, SP, BORDER, ASCII } from '../theme/brutal';
import { REELS, PRODUCTS } from '../data/mockData';
import { useApp } from '../state/AppState';
import { useGenderCurve } from '../components/Brutal';

const { height, width } = Dimensions.get('window');

// Fashion / clothing reels (Mixkit, royalty-free – verified URLs)
const FASHION_VIDEOS = [
  'https://assets.mixkit.co/videos/23327/23327-720.mp4',  // Hand selecting through clothes
  'https://assets.mixkit.co/videos/33167/33167-720.mp4',  // Sweaters on coat rack
  'https://assets.mixkit.co/videos/21326/21326-720.mp4',  // Woman viewing discounted clothes
  'https://assets.mixkit.co/videos/21330/21330-720.mp4',  // Walking through clothing store
  'https://assets.mixkit.co/videos/49382/49382-720.mp4',  // Woman posing in mirror, clothing store
  'https://assets.mixkit.co/videos/805/805-720.mp4',      // Woman modeling black dress
  'https://assets.mixkit.co/videos/50641/50641-720.mp4',  // Model posing for photographer in studio
  'https://assets.mixkit.co/videos/52270/52270-720.mp4',  // Catwalk model in white outfit
  'https://assets.mixkit.co/videos/44541/44541-720.mp4',  // Stylish woman fashion look
  'https://assets.mixkit.co/videos/42298/42298-720.mp4',  // Retro fashion style
];

// Build a page of reel data starting at a given offset
const buildPage = (offset: number, count: number) =>
  Array.from({ length: count }, (_, k) => {
    const i = offset + k;
    const base = REELS[i % REELS.length];
    return {
      ...base,
      id: `${base.id}-${i}`,
      video: FASHION_VIDEOS[i % FASHION_VIDEOS.length],
      product: PRODUCTS[i % PRODUCTS.length],
      likes: 1240 + i * 137,
      comments: 89 + i * 12,
    };
  });

const PAGE_SIZE = 12;

export default function ReelsScreen() {
  const nav = useNavigation<any>();
  const { addToCart, toggleFavorite, isFavorite, night, showToast } = useApp();
  const s = React.useMemo(() => makeS(), [night]);
  const [active, setActive] = useState(0);
  const [seed, setSeed] = useState(0);
  const [data, setData] = useState(() => buildPage(0, PAGE_SIZE * 2));
  const listRef = useRef<FlatList>(null);

  // Search drop-down (slides from top)
  const [searchMounted, setSearchMounted] = useState(false);
  const searchY = useSharedValue(-height);
  const openSearch = () => {
    setSearchMounted(true);
    searchY.value = withTiming(0, { duration: 320 });
  };
  const closeSearch = () => {
    searchY.value = withTiming(-height, { duration: 280 }, finished => {
      if (finished) runOnJS(setSearchMounted)(false);
    });
  };
  const searchStyle = useAnimatedStyle(() => ({ transform: [{ translateY: searchY.value }] }));

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('reelsReload', () => {
      const newSeed = Math.floor(Math.random() * 10000);
      setSeed(newSeed);
      setData(buildPage(newSeed, PAGE_SIZE * 2));
      setActive(0);
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    });
    return () => sub.remove();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar barStyle="light-content" />
      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={r => r.id}
        snapToInterval={height}
        snapToAlignment="start"
        disableIntervalMomentum
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onEndReachedThreshold={1.5}
        onEndReached={() => setData(prev => prev.concat(buildPage(prev.length, PAGE_SIZE)))}
        onViewableItemsChanged={({ viewableItems }) => {
          if (viewableItems[0]) setActive(viewableItems[0].index || 0);
        }}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        windowSize={5}
        removeClippedSubviews={false}
        renderItem={({ item, index }) => (
          <ReelItem
            reel={item}
            isActive={index === active}
            onLike={() => toggleFavorite(item.product)}
            isLiked={isFavorite(item.product.id)}
            onAdd={() => {
              addToCart(item.product);
              showToast('Added to bag', item.product.name, 'shopping-bag');
            }}
            onProduct={() => nav.navigate('ProductDetail', { product: item.product })}
          />
        )}
      />

      {/* TOP BAR */}
      <View style={s.topBar}>
        <Text style={[T.monoB, { color: '#fff', fontSize: 11 }]}>{'> CLOSET-X / REELS'}</Text>
        <Pressable onPress={openSearch} hitSlop={12}>
          <Feather name="search" size={20} color="#fff" />
        </Pressable>
      </View>

      {/* SEARCH DROP-DOWN (slides from top) */}
      {searchMounted && (
        <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: C.white, zIndex: 50 }, searchStyle]}>
          <SearchScreen />
          <SearchCloseButton onPress={closeSearch} />
        </Animated.View>
      )}
    </View>
  );
}

const SEED_COMMENTS = [
  { user: 'styleicon', text: 'this fit is everything 🔥' },
  { user: 'fashion_kid', text: 'where can I cop this?' },
  { user: 'moonlight', text: 'obsessed with the vibe' },
  { user: 'urban_threads', text: 'need this in my closet asap' },
];

function ReelItem({ reel, isActive, onLike, isLiked, onAdd, onProduct }: any) {
  const { night } = useApp();
  const s = React.useMemo(() => makeS(), [night]);
  const player = useVideoPlayer(reel.video, p => {
    p.loop = true;
    p.muted = true;
    p.preservesPitch = false;
    p.bufferOptions = {
      preferredForwardBufferDuration: 8,
      waitsToMinimizeStalling: false,
    } as any;
  });

  const [saved, setSaved] = useState(false);
  const [shareCount, setShareCount] = useState(102);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState(SEED_COMMENTS);
  const [draft, setDraft] = useState('');

  // HER-mode curves for all the overlay cards on the reel
  const prodCurve = useGenderCurve(14);
  const inputCurve = useGenderCurve(10);
  const sendCurve = useGenderCurve(21);
  const avatarCurve = useGenderCurve(16);

  // Double-tap heart pop — tracks the tap location so the heart blooms where the user hit
  const heartX = useSharedValue(width / 2);
  const heartY = useSharedValue(height / 2);
  const heartOpacity = useSharedValue(0);
  const heartScale = useSharedValue(0);
  const heartStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: heartX.value - 60,
    top: heartY.value - 60,
    opacity: heartOpacity.value,
    transform: [{ scale: heartScale.value }],
  }));

  const popHeart = () => {
    heartOpacity.value = withSequence(withTiming(1, { duration: 120 }), withDelay(260, withTiming(0, { duration: 240 })));
    heartScale.value = withSequence(withTiming(1.1, { duration: 160 }), withTiming(0.95, { duration: 140 }), withTiming(1.15, { duration: 200 }));
  };

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(260)
    .onEnd((e, success) => {
      if (!success) return;
      heartX.value = e.x;
      heartY.value = e.y;
      runOnJS(popHeart)();
      if (!isLiked) runOnJS(onLike)();
    });

  useEffect(() => {
    if (isActive) player.play();
    else player.pause();
  }, [isActive, player]);

  const handleShare = async () => {
    try {
      const r = await Share.share({
        message: `Check out ${reel.user} on CLOSET-X — ${reel.title}`,
      });
      if (r.action === Share.sharedAction) setShareCount(c => c + 1);
    } catch {}
  };

  const submitComment = () => {
    const t = draft.trim();
    if (!t) return;
    setComments(c => [{ user: 'you', text: t }, ...c]);
    setDraft('');
  };

  return (
    <View style={{ height, width, backgroundColor: '#000' }}>
      <GestureDetector gesture={doubleTap}>
        <View style={StyleSheet.absoluteFillObject}>
          <VideoView
            player={player}
            style={StyleSheet.absoluteFillObject as any}
            contentFit="cover"
            nativeControls={false}
          />
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.35)' }]} />
          {/* Double-tap heart — blooms at the tap position and fades */}
          <Animated.View style={[{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }, heartStyle]} pointerEvents="none">
            <Ionicons name="heart" size={120} color="#fff" style={{ textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 12 }} />
          </Animated.View>
        </View>
      </GestureDetector>

      {/* RIGHT ACTIONS */}
      <View style={s.actions}>
        <ReelAction icon={isLiked ? 'heart' : 'heart-outline'} iconSet="ion" count={reel.likes + (isLiked ? 1 : 0)} active={isLiked} onPress={onLike} />
        <ReelAction icon="message-circle" count={comments.length} onPress={() => setCommentsOpen(true)} />
        <ReelAction icon="share-2" count={shareCount} onPress={handleShare} />
        <ReelAction icon={saved ? 'bookmark' : 'bookmark-outline'} iconSet="ion" active={saved} onPress={() => setSaved(s => !s)} />
      </View>

      {/* COMMENTS MODAL */}
      <Modal visible={commentsOpen} animationType="slide" transparent onRequestClose={() => setCommentsOpen(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setCommentsOpen(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalSheet}>
          <View style={s.modalHandle} />
          <View style={s.modalHeader}>
            <Text style={{ fontFamily: 'Inter_900Black', fontSize: 16, color: C.ink }}>{comments.length} COMMENTS</Text>
            <Pressable onPress={() => setCommentsOpen(false)} hitSlop={10}>
              <Feather name="x" size={22} color={C.ink} />
            </Pressable>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 14 }}>
            {comments.map((c, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
                <Animated.View style={[s.avatar, avatarCurve]}>
                  <Text style={{ color: C.white, fontFamily: 'Inter_900Black', fontSize: 12 }}>{c.user[0].toUpperCase()}</Text>
                </Animated.View>
                <View style={{ flex: 1 }}>
                  <Text style={[T.monoB, { fontSize: 11, color: C.ink }]}>@{c.user}</Text>
                  <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: C.ink, marginTop: 2 }}>{c.text}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
          <View style={s.commentInputRow}>
            <Animated.View style={[{ flex: 1, overflow: 'hidden' }, inputCurve]}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="add a comment..."
                placeholderTextColor="#888"
                style={s.commentInput}
                onSubmitEditing={submitComment}
                returnKeyType="send"
              />
            </Animated.View>
            <Animated.View style={[s.sendBtn, sendCurve]}>
              <Pressable onPress={submitComment} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="send" size={18} color={C.white} />
              </Pressable>
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* BOTTOM INFO */}
      <View style={s.bottom}>
        <Text style={[T.monoB, { color: '#fff', fontSize: 10 }]}>{`> REEL_${reel.id.toUpperCase()}`}</Text>
        <Text style={{ fontFamily: 'Inter_900Black', color: '#fff', fontSize: 22, marginTop: 4 }}>{reel.user}</Text>
        <Text style={{ fontFamily: 'Inter_500Medium', color: '#fff', fontSize: 13, marginTop: 4 }}>{reel.title}</Text>
      </View>

      {/* PRODUCT TAG */}
      <Animated.View style={[s.prodTag, prodCurve]}>
        <Pressable onPress={onProduct} style={{ flex: 1, flexDirection: 'row' }}>
          <Image source={{ uri: reel.product.img }} style={s.prodTagImg} />
          <View style={{ flex: 1, paddingHorizontal: 10, justifyContent: 'center' }}>
            <Text style={[T.monoB, { fontSize: 9, color: C.ink }]}>{reel.product.brand}</Text>
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: C.ink }} numberOfLines={1}>{reel.product.name}</Text>
            <Text style={{ fontFamily: 'Inter_900Black', fontSize: 13, color: C.ink, marginTop: 2 }}>₹{reel.product.price}</Text>
          </View>
        </Pressable>
        <Pressable onPress={onAdd} style={s.prodAdd}>
          <Text style={{ fontFamily: 'Inter_900Black', fontSize: 11, color: C.white, letterSpacing: 0.5 }}>+ ADD</Text>
        </Pressable>
      </Animated.View>

    </View>
  );
}

function SearchCloseButton({ onPress }: { onPress: () => void }) {
  const curve = useGenderCurve(18);
  return (
    <Animated.View style={[{ position: 'absolute', top: 60, right: 16, width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white, borderWidth: 1, borderColor: C.ink, zIndex: 60, overflow: 'hidden' }, curve]}>
      <Pressable onPress={onPress} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%' }} hitSlop={12}>
        <Feather name="x" size={24} color={C.ink} />
      </Pressable>
    </Animated.View>
  );
}

function ReelAction({ icon, count, onPress, active, iconSet }: { icon: any; count?: number; onPress: () => void; active?: boolean; iconSet?: 'ion' | 'feather' }) {
  const Icon: any = iconSet === 'ion' ? Ionicons : Feather;
  const size = iconSet === 'ion' ? 34 : 30;
  return (
    <Pressable onPress={onPress} style={{ alignItems: 'center', gap: 4, paddingVertical: 6 }} hitSlop={8}>
      <Icon name={icon} size={size} color="#fff" />
      {count != null && <Text style={[T.monoB, { color: '#fff', fontSize: 10 }]}>{count > 999 ? `${(count / 1000).toFixed(1)}K` : count}</Text>}
    </Pressable>
  );
}

const makeS = () => StyleSheet.create({
  topBar: { position: 'absolute', top: 60, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actions: { position: 'absolute', right: 14, bottom: 220, gap: 18, alignItems: 'center' },
  bottom: { position: 'absolute', bottom: 200, left: 16, right: 90 },
  prodTag: { position: 'absolute', bottom: 110, left: 16, right: 16, height: 70, flexDirection: 'row', backgroundColor: C.white, borderWidth: 1, borderColor: C.ink, overflow: 'hidden' },
  prodTagImg: { width: 70, height: 70 },
  prodAdd: { paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: C.ink },
  cornerAscii: { position: 'absolute', fontFamily: 'SpaceMono_700Bold', fontSize: 14, color: C.white },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: { position: 'absolute', left: 0, right: 0, bottom: 0, height: height * 0.7, backgroundColor: C.white, borderTopWidth: 2, borderColor: C.ink },
  modalHandle: { alignSelf: 'center', width: 40, height: 4, backgroundColor: C.ink, marginTop: 8, borderRadius: 2 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderColor: C.ink },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderColor: C.ink, padding: 10, gap: 8 },
  commentInput: { width: '100%', height: 42, paddingHorizontal: 12, borderWidth: 1, borderColor: C.ink, fontFamily: 'Inter_500Medium', fontSize: 14, color: C.ink },
  sendBtn: { width: 42, height: 42, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  searchClose: { position: 'absolute', top: 60, right: 16, width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white, borderWidth: 1, borderColor: C.ink, zIndex: 60 },
});
