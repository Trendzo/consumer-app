// Vertical reels feed with snap-paging, brutalism overlay UI.
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, FlatList, Image, Dimensions, Pressable, StyleSheet, StatusBar, Alert, DeviceEventEmitter, TextInput, Share, ScrollView } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { useVideoPlayer, VideoView } from 'expo-video';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSequence, withDelay, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import SearchScreen from './SearchScreen';
import { C, T, SP, BORDER, rf, HELV} from '../theme/brutal';
import { REELS } from '../data/mockData';
import { useApp } from '../state/AppState';
import {
  getFeed, like as likeReel, unlike, save as saveReel, unsave, recordView,
  listComments, addComment,
  type Reel as ApiReel,
} from '../services/reels';
import { useGenderCurve, CachedImage, OptionSheet } from '../components/Brutal';
import { useZoomCard } from '../navigation/ZoomTransition';

const { height, width } = Dimensions.get('window');

// Fashion / clothing reels (Mixkit, royalty-free – verified URLs)
const FASHION_VIDEOS: (string | number)[] = [
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

/**
 * Backend reel -> the shape this screen renders.
 *
 * The whole feed used to be `FASHION_VIDEOS` (ten hardcoded Mixkit URLs) paired
 * with mock products, and the like/comment counts were arithmetic on the index
 * (`1240 + i * 137`). The full /consumer/reels API — feed, like, save, comment,
 * view — existed and nothing called it.
 */
function adaptReel(r: ApiReel) {
  return {
    id: r.id,
    user: r.author?.name ? `@${r.author.name}` : '@trendzo',
    title: r.caption ?? '',
    colors: ['#111111', '#333333'] as [string, string],
    img: r.thumbnailUrl,
    video: r.videoUrl,
    likes: r.likeCount,
    comments: r.commentCount,
    viewerHasLiked: r.viewerHasLiked,
    viewerHasSaved: r.viewerHasSaved,
    /**
     * The tagged product, mapped onto the card shape the overlay expects.
     *
     * `variantId` rides along so "Add to bag" from a reel adds the colour/size the
     * creator actually featured, and the product page opens on that variant —
     * rather than silently falling back to the listing default.
     * `image` is already variant-first server-side.
     */
    product: r.product
      ? {
          id: r.product.id,
          name: r.product.name,
          brand: '',
          price: r.product.variant ? Math.round(r.product.variant.pricePaise / 100) : 0,
          img: r.product.image ?? '',
          variantId: r.product.variant?.id,
          variantLabel: r.product.variant?.label ?? null,
        }
      : null,
  };
}

type FeedItem = ReturnType<typeof adaptReel>;

/**
 * Demo page — used ONLY when the backend feed is empty (fresh environment), so
 * the screen is never a black void during development.
 *
 * `product` is null. It used to be `PRODUCTS[i % PRODUCTS.length]`, which put a
 * "Shop this look" tag on every demo reel pointing at a bundled demo product —
 * tapping it opened a fully priced product page for something with no listing,
 * and "Add to bag" put it in the cart. A demo reel now carries no product tag,
 * so nothing on this screen is shoppable unless the backend says it is.
 */
const buildPage = (offset: number, count: number) =>
  Array.from({ length: count }, (_, k) => {
    const i = offset + k;
    const base = REELS[i % REELS.length];
    return {
      ...base,
      id: `${base.id}-${i}`,
      video: FASHION_VIDEOS[i % FASHION_VIDEOS.length] as string,
      product: null,
      likes: 1240 + i * 137,
      comments: 89 + i * 12,
      viewerHasLiked: false,
      viewerHasSaved: false,
    };
  });

const PAGE_SIZE = 12;

export default function ReelsScreen({ route }: { route: any }) {
  const nav = useNavigation<any>();
  // Drops isActive on every player the moment the tab blurs → videos pause
  // instead of looping/decoding in the background on other tabs.
  const isFocused = useIsFocused();
  const { addToCart, toggleFavorite, isFavorite, showToast, requireAuth, token } = useApp();
  const s = React.useMemo(() => makeS(), []);
  const [active, setActive] = useState(0);
  const [seed, setSeed] = useState(0);
  const [data, setData] = useState<FeedItem[]>(() => buildPage(0, PAGE_SIZE * 2) as any);
  // null = still using the demo set; a string/undefined means the real feed owns
  // the list and this is where the next page starts.
  const [cursor, setCursor] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const loadingMore = useRef(false);

  useEffect(() => {
    let cancelled = false;
    getFeed({ limit: PAGE_SIZE })
      .then((page) => {
        if (cancelled || page.items.length === 0) return; // keep the demo set
        setData(page.items.map(adaptReel));
        setCursor(page.nextCursor);
        setLive(true);
      })
      .catch(() => { /* offline — demo set stays */ });
    return () => { cancelled = true; };
  }, [seed]);

  /**
   * Like/unlike. Optimistic so the heart responds instantly, reverted if the
   * request fails.
   *
   * A like is attributed to a person, so a signed-out viewer is sent to the sign-in
   * sheet and the like replays once they are in. It used to fall through to the
   * LOCAL favourites store, so a guest saw the heart fill and nothing was ever
   * recorded — the same lie the comment box told.
   */
  const toggleLike = useCallback((item: FeedItem) => {
    if (!token) { requireAuth(() => toggleLike(item)); return; }
    /**
     * Demo reels have no backend row to like. They also no longer carry a product
     * (that was the fake tag), so the old `toggleFavorite(item.product)` fallback
     * had nothing to act on and silently did nothing — the heart did not even
     * fill. Say so instead, matching the comment and save paths.
     */
    if (!live) {
      Alert.alert('Not available', 'This is a sample reel — likes open once real reels are live.');
      return;
    }
    const wasLiked = !!item.viewerHasLiked;
    const apply = (liked: boolean, count: number) =>
      setData((prev) => prev.map((r) => (r.id === item.id ? { ...r, viewerHasLiked: liked, likes: count } : r)));
    apply(!wasLiked, item.likes + (wasLiked ? -1 : 1));
    (wasLiked ? unlike(item.id) : likeReel(item.id))
      .then((res) => apply(res.liked, res.likeCount))
      .catch(() => apply(wasLiked, item.likes));
  }, [live, toggleFavorite, token, requireAuth]);

  const loadMore = useCallback(() => {
    // Demo mode keeps its endless synthetic paging; the real feed pages by cursor.
    if (!live) { setData((prev) => prev.concat(buildPage(prev.length, PAGE_SIZE) as any)); return; }
    if (!cursor || loadingMore.current) return;
    loadingMore.current = true;
    getFeed({ cursor, limit: PAGE_SIZE })
      .then((page) => {
        setData((prev) => prev.concat(page.items.map(adaptReel)));
        setCursor(page.nextCursor);
      })
      .catch(() => {})
      .finally(() => { loadingMore.current = false; });
  }, [live, cursor]);

  // A view is only meaningful for a reel the backend knows about.
  useEffect(() => {
    const current = data[active];
    if (!live || !current) return;
    recordView(current.id).catch(() => {});
  }, [active, live, data]);
  const listRef = useRef<FlatList>(null);

  // Stable list plumbing. `.current` on a ref created once, so these identities
  // never change across renders.
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
    if (viewableItems[0]) setActive(viewableItems[0].index || 0);
  }).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const getItemLayout = useRef((_: unknown, index: number) => ({
    length: height,
    offset: height * index,
    index,
  })).current;

  // A Home Reel card passes its exact local video source here. Put that video
  // first and reset the feed so the card the user tapped starts immediately.
  useEffect(() => {
    const selectedVideo = route?.params?.selectedVideo as string | number | undefined;
    if (!selectedVideo) return;
    const selectedIndex = Number(route?.params?.selectedIndex ?? 0);
    const base = REELS[selectedIndex % REELS.length];
    const selected = {
      ...base,
      id: `selected-${route?.params?.selectedGender ?? 'reel'}-${route?.params?.selectionToken ?? Date.now()}`,
      video: selectedVideo as string,
      product: null,
      likes: 1240 + selectedIndex * 137,
      comments: 89 + selectedIndex * 12,
      viewerHasLiked: false,
      viewerHasSaved: false,
    };
    setData([selected, ...buildPage(0, PAGE_SIZE * 2)] as any);
    setActive(0);
    requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated: false }));
  }, [route?.params?.selectionToken]);

  /**
   * Just posted → refetch page 1 so the author's own reel is there.
   *
   * Without this the feed keeps whatever it fetched on mount, and posting looks
   * like it did nothing. `justPostedId` is a fresh reel id each time, so it doubles
   * as the change token.
   */
  useEffect(() => {
    const posted = route?.params?.justPostedId as string | undefined;
    if (!posted) return;
    setSeed((n) => n + 1);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [route?.params?.justPostedId]);

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
      setData(buildPage(newSeed, PAGE_SIZE * 2) as any);
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
        onEndReached={loadMore}
        // Both MUST be stable references — React Native throws
        // "Changing onViewableItemsChanged on the fly is not supported" when
        // either identity changes between renders, and these were inline
        // literals (a new function and a new object every render).
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        windowSize={5}
        removeClippedSubviews={false}
        // Every row is exactly one screen tall (see snapToInterval above), so the
        // list never has to measure a cell to know where it sits. Lets it jump
        // straight to an index and skip layout passes while scrolling.
        getItemLayout={getItemLayout}
        renderItem={({ item, index }) => (
          <ReelItem
            reel={item}
            live={live}
            isActive={index === active && isFocused}
            distance={Math.abs(index - active)}
            onLike={() => toggleLike(item)}
            isLiked={live ? !!item.viewerHasLiked : (item.product ? isFavorite(item.product.id) : false)}
            onAdd={() => {
              if (!item.product) { showToast('No product tagged', 'This reel has nothing to add', 'x'); return; }
              // Pass the featured variant through, so the bag gets the colour/size
              // that was actually on screen rather than the listing default — and
              // so the line is server-priceable (a line without a variantId is not).
              addToCart(
                item.product as any,
                undefined,
                undefined,
                (item.product as any).variantId,
              );
              showToast('Added to bag', item.product.name, 'shopping-bag');
            }}
            onProduct={() => item.product && nav.navigate('ProductDetail', { product: item.product })}
          />
        )}
      />

      {/* TOP BAR — post + search. The post entry point is here because it was
          nowhere: the create API existed and had no button anywhere in the app.
          Guests get the sign-in sheet, then land on the composer. */}
      <View style={[s.topBar, { justifyContent: 'flex-end', gap: 20 }]}>
        <Pressable
          onPress={() => {
            if (!token) { requireAuth(() => nav.navigate('CreateReel')); return; }
            nav.navigate('CreateReel');
          }}
          hitSlop={12}
        >
          <Feather name="plus-square" size={22} color="#fff" />
        </Pressable>
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

/*
 * SEED_COMMENTS lived here: four hardcoded comments ("this fit is everything 🔥",
 * "where can I cop this?" …) shown under EVERY reel, including reels with none.
 * A reel with no comments now says so.
 */

// ── Isolated video component — only mounts when the reel is active so we
//    never create multiple AVPlayer instances simultaneously (fixes TestFlight crash).
function ReelVideo({ url, isActive }: { url: string | number; isActive: boolean }) {
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

function ReelItem({ reel, isActive, distance, onLike, isLiked, onAdd, onProduct, live }: any) {
  const s = React.useMemo(() => makeS(), []);
  const { requireAuth, token } = useApp();
  const { ref: prodRef, open: openProd } = useZoomCard();

  // Seeded from the server's per-viewer flag so a saved reel still reads as saved
  // on the next launch. It used to start false every time and only ever flip in
  // local state — the bookmark was decoration.
  const [saved, setSaved] = useState(!!reel.viewerHasSaved);

  /** Save/unsave, optimistic and reverted on failure. Needs an account. */
  const toggleSave = () => {
    if (!token) { requireAuth(() => toggleSave()); return; }
    if (!live) { Alert.alert('Not available', 'This is a sample reel — saving opens once real reels are live.'); return; }
    const next = !saved;
    setSaved(next);
    (next ? saveReel(reel.id) : unsave(reel.id))
      .then((r) => setSaved(r.saved))
      .catch(() => setSaved(!next));
  };
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<{ user: string; text: string }[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [posting, setPosting] = useState(false);
  const [draft, setDraft] = useState('');
  // Player mounting window: active reel ± 1 neighbor. The old `wasActive`
  // latch kept EVERY previously-viewed player mounted (and decoding) forever;
  // the window preserves the no-re-buffer-on-swipe-back behavior with at most
  // 3 live players. isActive also drops on tab blur, pausing playback.
  const mountVideo = distance <= 1;

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

  // Sharing needs no account and no server call — it hands the OS a string. The
  // only thing removed here is the counter: `useState(102)` that ticked up locally
  // and was never read by anything.
  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out ${reel.user} on TRENDZO — ${reel.title}`,
      });
    } catch {}
  };

  const openComments = () => {
    setCommentsOpen(true);
    if (!live || commentsLoaded) return;
    setCommentsLoaded(true);
    listComments(reel.id)
      .then((page) => setComments(page.items.map((c) => ({
        user: c.author?.name ? `@${c.author.name}` : '@trendzo',
        text: c.body,
      }))))
      .catch(() => { /* keep whatever is on screen */ });
  };

  const submitComment = () => {
    const t = draft.trim();
    if (!t || posting) return;
    /**
     * A comment is attributed to a person — sign in first.
     *
     * The draft is kept, so the shopper comes back from the sheet to the words
     * they already typed and just presses send again.
     */
    if (!token) { requireAuth(); return; }
    if (!live) {
      // Demo reels have no backend row to attach a comment to. Say so rather
      // than appending it locally, which read as "posted" and was not.
      Alert.alert('Not available', 'This is a sample reel — comments open once real reels are live.');
      return;
    }
    setPosting(true);
    // Optimistic, then reconciled: the row appears immediately and is removed if
    // the post fails, rather than silently pretending it was saved.
    const optimistic = { user: 'you', text: t };
    setComments(c => [optimistic, ...c]);
    setDraft('');
    addComment(reel.id, t)
      .catch(() => setComments(c => c.filter(x => x !== optimistic)))
      .finally(() => setPosting(false));
  };

  return (
    <View style={{ height, width, backgroundColor: '#000' }}>
      <GestureDetector gesture={doubleTap}>
        <View style={StyleSheet.absoluteFillObject}>
          {/* Only the active reel ± 1 neighbor keep a live player */}
          {mountVideo && <ReelVideo url={reel.video} isActive={isActive} />}
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.35)' }]} />
          {/* Double-tap heart — blooms at the tap position and fades */}
          <Animated.View style={[{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }, heartStyle]} pointerEvents="none">
            <Ionicons name="heart" size={120} color="#fff" style={{ textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 12 }} />
          </Animated.View>
        </View>
      </GestureDetector>

      {/* RIGHT ACTIONS */}
      <View style={s.actions}>
        {/* `reel.likes` ALREADY reflects this viewer's like — toggleLike applies the
            +1/-1 optimistically and then reconciles with the server's count. The
            old `+ (isLiked ? 1 : 0)` added a second one on top, so a like read as
            +2 and an unlike as -2. It was correct only in the original demo-only
            screen, where `likes` was a static number and the heart was local. */}
        <ReelAction icon={isLiked ? 'heart' : 'heart-outline'} iconSet="ion" count={reel.likes} active={isLiked} onPress={onLike} />
        <ReelAction icon="message-circle" count={live ? reel.comments : comments.length} onPress={openComments} />
        <ReelAction icon="share-2" onPress={handleShare} />
        <ReelAction icon={saved ? 'bookmark' : 'bookmark-outline'} iconSet="ion" active={saved} onPress={toggleSave} />
      </View>

      {/* COMMENTS — shared light bottom sheet (children mode) */}
      <OptionSheet visible={commentsOpen} title="Comments" onClose={() => setCommentsOpen(false)}>
        <ScrollView style={{ maxHeight: height * 0.5 }} contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
          {comments.length === 0 && (
            <Text style={[T.body, { color: C.dim, textAlign: 'center', paddingVertical: 24 }]}>
              {live ? 'No comments yet — be the first.' : 'Sample reel · no comments.'}
            </Text>
          )}
          {comments.map((c, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
              <View style={s.avatar}>
                <Text style={[T.bodyB, { color: C.white }]}>{c.user[0].toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[T.caption, { color: C.ink }]}>@{c.user}</Text>
                <Text style={[T.body, { marginTop: 2 }]}>{c.text}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
        <View style={s.commentInputRow}>
          <View style={{ flex: 1 }}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="add a comment..."
              placeholderTextColor={C.dim}
              style={s.commentInput}
              onSubmitEditing={submitComment}
              returnKeyType="send"
            />
          </View>
          <Pressable onPress={submitComment} style={s.sendBtn}>
            <Feather name="send" size={18} color={C.white} />
          </Pressable>
        </View>
      </OptionSheet>

      {/* BOTTOM INFO — username + bio only */}
      <View style={s.bottom}>
        <Text style={[T.h2, { color: '#fff' }]}>{reel.user}</Text>
        <Text style={[T.body, { color: '#fff', marginTop: 4 }]}>{reel.title}</Text>
      </View>

      {/* PRODUCT TAG — mini product card (white bg over video, sharp, hairline) */}
      {/* Only when the reel actually features something.
          Tagging a product is optional now — a reel is content first — and demo
          reels carry no tag at all, so this block cannot assume `product` exists.
          It read `reel.product.img` directly (note the `?.` one line above, which
          was the only nod to it) and crashed with
          "Cannot read property 'img' of null" on every untagged reel. */}
      {reel.product && (
        <View style={s.prodTag}>
          <Pressable onPress={() => reel.product?.img ? openProd(reel.product.img, reel.product) : onProduct()} style={{ flex: 1, flexDirection: 'row' }}>
            <View ref={prodRef} collapsable={false}><CachedImage source={{ uri: reel.product.img }} style={s.prodTagImg} resizeMode="cover" /></View>
            <View style={{ flex: 1, paddingHorizontal: 10, justifyContent: 'center' }}>
              {!!reel.product.brand && <Text style={[T.caption, { color: C.ink }]}>{reel.product.brand}</Text>}
              <Text style={[T.productName]} numberOfLines={1}>{reel.product.name}</Text>
              {/* Price comes from the featured VARIANT; an untagged variant has
                  none, so show the name alone rather than a confident "₹0". */}
              {reel.product.price > 0 && (
                <Text style={[T.price, { marginTop: 2 }]}>₹{reel.product.price}</Text>
              )}
              {!!reel.product.variantLabel && (
                <Text style={[T.micro, { color: C.dim, marginTop: 1 }]}>{reel.product.variantLabel}</Text>
              )}
            </View>
          </Pressable>
          <Pressable onPress={onAdd} style={s.prodAdd}>
            <Text style={[T.caption, { color: C.white, fontFamily: HELV, fontWeight: '600' }]}>+ Add</Text>
          </Pressable>
        </View>
      )}

    </View>
  );
}

function SearchCloseButton({ onPress }: { onPress: () => void }) {
  const curve = useGenderCurve(18);
  return (
    <Animated.View style={[{ position: 'absolute', top: 60, right: 16, width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white, borderWidth: 1, borderColor: C.hairline, zIndex: 60, overflow: 'hidden' }, curve]}>
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
      {count != null && <Text style={[T.caption, { color: '#fff' }]}>{count > 999 ? `${(count / 1000).toFixed(1)}K` : count}</Text>}
    </Pressable>
  );
}

const makeS = () => StyleSheet.create({
  topBar: { position: 'absolute', top: 60, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actions: { position: 'absolute', right: 14, bottom: 220, gap: 18, alignItems: 'center' },
  bottom: { position: 'absolute', bottom: 200, left: 16, right: 90 },
  prodTag: { position: 'absolute', bottom: 110, left: 16, right: 16, height: 70, flexDirection: 'row', backgroundColor: C.white, borderWidth: 1, borderColor: C.hairline, overflow: 'hidden' },
  prodTagImg: { width: 70, height: 70 },
  prodAdd: { paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: C.ink },
  avatar: { width: 32, height: 32, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderColor: C.hairline, padding: 10, gap: 8 },
  commentInput: { width: '100%', height: 42, paddingHorizontal: 12, backgroundColor: C.white, borderWidth: 1, borderColor: C.hairline, ...T.body },
  sendBtn: { width: 42, height: 42, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
});
