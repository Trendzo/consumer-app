// Vertical reels feed with snap-paging, brutalism overlay UI.
// Feed + social layer are backend-driven (services/reels); when the backend has no reels
// yet (e.g. before the record/upload flow ships) it falls back to a local demo feed so the
// screen still has content. Demo reels carry `backendId: null` and use the old mock actions.
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, FlatList, Image, Dimensions, Pressable, StyleSheet, StatusBar, Alert, DeviceEventEmitter, Modal, TextInput, Share, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { useNavigation } from '@react-navigation/native';
import { useVideoPlayer, VideoView } from 'expo-video';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSequence, withDelay, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import SearchScreen from './SearchScreen';
import { C, T, SP, BORDER, ASCII, rf } from '../theme/brutal';
import { REELS, PRODUCTS } from '../data/mockData';
import { useApp } from '../state/AppState';
import { useGenderCurve } from '../components/Brutal';
import { useZoomCard } from '../navigation/ZoomTransition';
import * as reelsApi from '../services/reels';
import { getProduct } from '../services/catalog';

const { height, width } = Dimensions.get('window');

// Unified shape the UI renders — sourced either from the backend or the demo builder.
type UIReel = {
  id: string;                 // FlatList key (unique across pages)
  backendId: string | null;   // null → demo reel (mock, local-only interactions)
  video: string;
  user: string;
  title: string;
  product: { id: string; name: string; img: string | null; brand?: string; price?: number } | null;
  // Demo reels carry the full mock Product so favorite/add-to-bag work locally; backend
  // reels leave this undefined and fetch the real listing on demand.
  mockProduct?: any;
  likes: number;
  comments: number;
  viewerHasLiked: boolean;
  viewerHasSaved: boolean;
};

const mapReel = (r: reelsApi.Reel): UIReel => ({
  id: r.id,
  backendId: r.id,
  video: r.videoUrl,
  user: r.author?.name || 'closetx',
  title: r.caption || '',
  product: r.product ? { id: r.product.id, name: r.product.name, img: r.product.image } : null,
  likes: r.likeCount,
  comments: r.commentCount,
  viewerHasLiked: r.viewerHasLiked,
  viewerHasSaved: r.viewerHasSaved,
});

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

// Demo fallback — a local page built from mock reels/products (backendId: null).
const buildDemo = (offset: number, count: number): UIReel[] =>
  Array.from({ length: count }, (_, k) => {
    const i = offset + k;
    const base = REELS[i % REELS.length];
    const p = PRODUCTS[i % PRODUCTS.length];
    return {
      id: `demo-${base.id}-${i}`,
      backendId: null,
      video: FASHION_VIDEOS[i % FASHION_VIDEOS.length],
      user: base.user,
      title: base.title,
      product: { id: p.id, name: p.name, img: p.img, brand: p.brand, price: p.price },
      mockProduct: p,
      likes: 1240 + i * 137,
      comments: 89 + i * 12,
      viewerHasLiked: false,
      viewerHasSaved: false,
    };
  });

const PAGE_SIZE = 12;

export default function ReelsScreen() {
  const nav = useNavigation<any>();
  const { night } = useApp();
  const s = React.useMemo(() => makeS(), [night]);
  const [active, setActive] = useState(0);
  const [data, setData] = useState<UIReel[]>([]);
  const [mode, setMode] = useState<'loading' | 'real' | 'demo'>('loading');
  const cursorRef = useRef<string | null>(null);
  const loadingMore = useRef(false);
  const listRef = useRef<FlatList>(null);

  // Load the first page. A successful response (even an empty one) is the source of truth:
  // an empty feed shows the real empty state. Only a genuine network/backend failure falls
  // back to the local demo feed, so a broken connection doesn't leave the tab blank.
  const loadInitial = useCallback(async () => {
    setMode('loading');
    setActive(0);
    try {
      const page = await reelsApi.getFeed({ limit: 10 });
      setData(page.items.map(mapReel));
      cursorRef.current = page.nextCursor;
      setMode('real');
    } catch {
      setData(buildDemo(0, PAGE_SIZE * 2));
      cursorRef.current = null;
      setMode('demo');
    }
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore.current) return;
    if (mode === 'demo') {
      setData(prev => prev.concat(buildDemo(prev.length, PAGE_SIZE)));
      return;
    }
    if (mode !== 'real' || !cursorRef.current) return;
    loadingMore.current = true;
    try {
      const page = await reelsApi.getFeed({ cursor: cursorRef.current, limit: 10 });
      setData(prev => [...prev, ...page.items.map(mapReel)]);
      cursorRef.current = page.nextCursor;
    } catch {
      /* keep what we have */
    } finally {
      loadingMore.current = false;
    }
  }, [mode]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

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
      loadInitial();
    });
    return () => sub.remove();
  }, [loadInitial]);

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
        onEndReached={loadMore}
        onViewableItemsChanged={({ viewableItems }) => {
          if (viewableItems[0]) setActive(viewableItems[0].index || 0);
        }}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        windowSize={5}
        removeClippedSubviews={false}
        ListEmptyComponent={mode === 'loading' ? null : <ReelsEmpty />}
        renderItem={({ item, index }) => (
          <ReelItem
            reel={item}
            isActive={index === active}
            onOpenProduct={async () => {
              if (!item.product) return;
              // Demo reels carry a full mock product; backend reels carry only id/name/img,
              // so fetch the full listing before opening the detail screen.
              if (item.backendId) {
                try {
                  const full = await getProduct(item.product.id);
                  nav.navigate('ProductDetail', { product: full });
                  return;
                } catch {
                  /* fall through to the thin tag */
                }
              }
              nav.navigate('ProductDetail', { product: item.product });
            }}
          />
        )}
      />

      {/* TOP BAR — search only */}
      <View style={[s.topBar, { justifyContent: 'flex-end' }]}>
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

function ReelsEmpty() {
  return (
    <View style={{ height, width, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000', padding: 32 }}>
      <Feather name="film" size={40} color="#fff" />
      <Text style={{ fontFamily: 'Inter_900Black', color: '#fff', fontSize: 18, marginTop: 12 }}>NO REELS YET</Text>
      <Text style={{ fontFamily: 'Inter_500Medium', color: '#aaa', fontSize: 13, marginTop: 6, textAlign: 'center' }}>
        Reels from products you buy will show up here.
      </Text>
    </View>
  );
}

const SEED_COMMENTS = [
  { user: 'styleicon', text: 'this fit is everything 🔥' },
  { user: 'fashion_kid', text: 'where can I cop this?' },
  { user: 'moonlight', text: 'obsessed with the vibe' },
  { user: 'urban_threads', text: 'need this in my closet asap' },
];

// ── Isolated video component — only mounts when the reel is active so we
//    never create multiple AVPlayer instances simultaneously (fixes TestFlight crash).
function ReelVideo({ url, isActive }: { url: string; isActive: boolean }) {
  const player = useVideoPlayer(url, p => {
    p.loop = true;
    p.muted = true;
    try { (p as any).preservesPitch = false; } catch {}
    try {
      (p as any).bufferOptions = {
        preferredForwardBufferDuration: 8,
        waitsToMinimizeStalling: false,
      };
    } catch {}
  });

  useEffect(() => {
    try {
      if (isActive) player.play();
      else player.pause();
    } catch {}
  }, [isActive, player]);

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFillObject as any}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

function ReelItem({ reel, isActive, onOpenProduct }: { reel: UIReel; isActive: boolean; onOpenProduct: () => void }) {
  const { night, addToCart, toggleFavorite, isFavorite, showToast } = useApp();
  const s = React.useMemo(() => makeS(), [night]);
  const { ref: prodRef, open: openProd } = useZoomCard();
  const backed = !!reel.backendId;

  // Backend reels seed from the server's viewer flag; demo reels reuse the local
  // product-favorite state (there's no reel-level like store for them).
  const [liked, setLiked] = useState(backed ? reel.viewerHasLiked : reel.product ? isFavorite(reel.product.id) : false);
  const [likeCount, setLikeCount] = useState(reel.likes);
  const [saved, setSaved] = useState(reel.viewerHasSaved);
  const [shareCount, setShareCount] = useState(102);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<{ user: string; text: string }[]>(backed ? [] : SEED_COMMENTS);
  const [commentCount, setCommentCount] = useState(reel.comments);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [draft, setDraft] = useState('');
  // Track if this reel has ever been active so we mount the video player once
  // and keep it alive (avoids re-buffering on quick swipes back).
  const [wasActive, setWasActive] = useState(isActive);
  useEffect(() => { if (isActive) setWasActive(true); }, [isActive]);

  // Fire a single view ping the first time this reel becomes active (backend reels only).
  const viewedRef = useRef(false);
  useEffect(() => {
    if (isActive && backed && !viewedRef.current) {
      viewedRef.current = true;
      reelsApi.recordView(reel.backendId!).catch(() => {});
    }
  }, [isActive, backed, reel.backendId]);

  const toggleLike = useCallback(async () => {
    const next = !liked;
    setLiked(next);
    setLikeCount(c => Math.max(0, c + (next ? 1 : -1)));
    if (backed) {
      try {
        const res = next ? await reelsApi.like(reel.backendId!) : await reelsApi.unlike(reel.backendId!);
        setLiked(res.liked);
        setLikeCount(res.likeCount);
      } catch {
        setLiked(!next); // revert
        setLikeCount(c => Math.max(0, c + (next ? -1 : 1)));
      }
    } else if (reel.mockProduct) {
      toggleFavorite(reel.mockProduct);
    }
  }, [liked, backed, reel.backendId, reel.mockProduct, toggleFavorite]);

  const likeFromDoubleTap = useCallback(async () => {
    if (liked) return;
    await toggleLike();
  }, [liked, toggleLike]);

  const toggleSave = useCallback(async () => {
    const next = !saved;
    setSaved(next);
    if (backed) {
      try {
        const res = next ? await reelsApi.save(reel.backendId!) : await reelsApi.unsave(reel.backendId!);
        setSaved(res.saved);
      } catch {
        setSaved(!next); // revert
      }
    }
  }, [saved, backed, reel.backendId]);

  const openComments = useCallback(async () => {
    setCommentsOpen(true);
    if (backed && !commentsLoaded) {
      try {
        const page = await reelsApi.listComments(reel.backendId!, { limit: 50 });
        setComments(page.items.map(c => ({ user: c.author?.name || 'user', text: c.body })));
        setCommentsLoaded(true);
      } catch {
        /* leave empty */
      }
    }
  }, [backed, commentsLoaded, reel.backendId]);

  const onAdd = useCallback(async () => {
    if (!reel.product) return;
    if (!backed && reel.mockProduct) {
      addToCart(reel.mockProduct);
      showToast('Added to bag', reel.mockProduct.name, 'shopping-bag');
      return;
    }
    try {
      const full = await getProduct(reel.product.id);
      addToCart(full);
      showToast('Added to bag', full.name, 'shopping-bag');
    } catch {
      onOpenProduct();
    }
  }, [reel.product, reel.mockProduct, backed, addToCart, showToast, onOpenProduct]);

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
      runOnJS(likeFromDoubleTap)();
    });

  const handleShare = async () => {
    try {
      const r = await Share.share({
        message: `Check out ${reel.user} on CLOSETX — ${reel.title}`,
      });
      if (r.action === Share.sharedAction) setShareCount(c => c + 1);
    } catch {}
  };

  const submitComment = async () => {
    const t = draft.trim();
    if (!t) return;
    setDraft('');
    const optimistic = { user: 'you', text: t };
    setComments(c => [optimistic, ...c]);
    setCommentCount(n => n + 1);
    if (backed) {
      try {
        await reelsApi.addComment(reel.backendId!, t);
      } catch {
        // Roll back the optimistic insert so the UI matches the server.
        setComments(c => c.filter(x => x !== optimistic));
        setCommentCount(n => Math.max(0, n - 1));
      }
    }
  };

  return (
    <View style={{ height, width, backgroundColor: '#000' }}>
      <GestureDetector gesture={doubleTap}>
        <View style={StyleSheet.absoluteFillObject}>
          {/* Only mount the video player after this reel first becomes active */}
          {wasActive && <ReelVideo url={reel.video} isActive={isActive} />}
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.35)' }]} />
          {/* Double-tap heart — blooms at the tap position and fades */}
          <Animated.View style={[{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }, heartStyle]} pointerEvents="none">
            <Ionicons name="heart" size={120} color="#fff" style={{ textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 12 }} />
          </Animated.View>
        </View>
      </GestureDetector>

      {/* RIGHT ACTIONS */}
      <View style={s.actions}>
        <ReelAction icon={liked ? 'heart' : 'heart-outline'} iconSet="ion" count={likeCount} active={liked} onPress={toggleLike} />
        <ReelAction icon="message-circle" count={commentCount} onPress={openComments} />
        <ReelAction icon="share-2" count={shareCount} onPress={handleShare} />
        <ReelAction icon={saved ? 'bookmark' : 'bookmark-outline'} iconSet="ion" active={saved} onPress={toggleSave} />
      </View>

      {/* COMMENTS MODAL */}
      <Modal visible={commentsOpen} animationType="slide" transparent onRequestClose={() => setCommentsOpen(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setCommentsOpen(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalSheet}>
          <View style={s.modalHandle} />
          <View style={s.modalHeader}>
            <Text style={{ fontFamily: 'Inter_900Black', fontSize: 16, color: C.ink }}>{commentCount} COMMENTS</Text>
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

      {/* BOTTOM INFO — username + bio only */}
      <View style={s.bottom}>
        <Text style={{ fontFamily: 'Inter_900Black', color: '#fff', fontSize: rf(22) }}>{reel.user}</Text>
        <Text style={{ fontFamily: 'Inter_500Medium', color: '#fff', fontSize: 13, marginTop: 4 }}>{reel.title}</Text>
      </View>

      {/* PRODUCT TAG */}
      {reel.product && (
        <Animated.View style={[s.prodTag, prodCurve]}>
          <Pressable onPress={() => (reel.product!.img && reel.product!.price != null ? openProd(reel.product!.img, reel.product) : onOpenProduct())} style={{ flex: 1, flexDirection: 'row' }}>
            <View ref={prodRef} collapsable={false}>
              {reel.product.img ? (
                <Image source={{ uri: reel.product.img }} style={s.prodTagImg} />
              ) : (
                <View style={[s.prodTagImg, { backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }]}>
                  <Feather name="tag" size={22} color={C.white} />
                </View>
              )}
            </View>
            <View style={{ flex: 1, paddingHorizontal: 10, justifyContent: 'center' }}>
              {reel.product.brand ? <Text style={[T.monoB, { fontSize: 9, color: C.ink }]}>{reel.product.brand}</Text> : null}
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: C.ink }} numberOfLines={1}>{reel.product.name}</Text>
              {reel.product.price != null ? (
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: 13, color: C.ink, marginTop: 2 }}>₹{reel.product.price}</Text>
              ) : null}
            </View>
          </Pressable>
          <Pressable onPress={onAdd} style={s.prodAdd}>
            <Text style={{ fontFamily: 'Inter_900Black', fontSize: 11, color: C.white, letterSpacing: 0.5 }}>+ ADD</Text>
          </Pressable>
        </Animated.View>
      )}

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
