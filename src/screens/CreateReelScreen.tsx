/**
 * Post a reel.
 *
 * The backend has had `POST /consumer/reels/media` + `POST /consumer/reels` all
 * along and nothing in the app ever called them — there was no way to post at
 * all. This is that flow: pick a video, write a caption, optionally feature a
 * product (and a specific variant), post.
 *
 * Product rules this screen implements:
 *  • anyone signed in may post — no purchase required, no product required
 *  • the 30s cap is checked here for a fast, kind rejection; the SERVER measures
 *    the real duration and is the authority (the picker's number can be missing
 *    or wrong depending on platform, so it is treated as advisory only)
 */
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import { C, T, SP, BORDER, HELV, rf } from '../theme/brutal';
import { BrutalStatusBar, CachedImage } from '../components/Brutal';
import { useApp } from '../state/AppState';
import { uploadMedia, createReel } from '../services/reels';
import type { PickedProduct } from './ReelProductPickerScreen';

const MAX_SECONDS = 30;
const MAX_CAPTION = 2200;

export default function CreateReelScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { showToast, requireAuth, token } = useApp();

  const [videoUri, setVideoUri] = useState<string | null>(null);
  /** From the picker, in seconds. Null when the platform did not report it. */
  const [videoSeconds, setVideoSeconds] = useState<number | null>(null);
  const [caption, setCaption] = useState('');
  const [product, setProduct] = useState<PickedProduct | null>(null);
  const [posting, setPosting] = useState(false);
  const [stage, setStage] = useState<'idle' | 'uploading' | 'creating'>('idle');

  /**
   * Posting needs an account. Gate on ARRIVAL rather than at the post button so
   * nobody records, writes a caption and picks a product only to be asked to sign
   * in at the very end.
   */
  useEffect(() => {
    if (!token) requireAuth(() => {});
  }, [token]);

  /**
   * The picker screen hands its result back by navigating here with `picked`.
   * `pickToken` changes on every pick so choosing the SAME product twice (after
   * clearing it) still registers — params alone would be shallow-equal.
   */
  useEffect(() => {
    if (route.params?.pickToken === undefined) return;
    setProduct((route.params.picked as PickedProduct | null) ?? null);
    nav.setParams({ picked: undefined, pickToken: undefined });
  }, [route.params?.pickToken]);

  const pickVideo = async () => {
    // No permission request: launchImageLibraryAsync goes through the Android
    // photo picker, which hands back only the file the user chose and needs no
    // media permission. Asking for one would put READ_MEDIA_IMAGES back in the
    // manifest, which Play only grants to gallery/editor apps.
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 1,
      videoMaxDuration: MAX_SECONDS,
    });
    if (res.canceled) return;
    const asset = res.assets?.[0];
    if (!asset?.uri) return;
    // `duration` is in MILLISECONDS and is not reported on every platform.
    const secs = typeof asset.duration === 'number' ? asset.duration / 1000 : null;
    if (secs !== null && secs > MAX_SECONDS + 0.5) {
      Alert.alert('Too long', `Reels are up to ${MAX_SECONDS} seconds. Trim it and try again.`);
      return;
    }
    setVideoUri(asset.uri);
    setVideoSeconds(secs);
  };

  const post = async () => {
    if (!token) { requireAuth(() => {}); return; }
    if (!videoUri || posting) return;
    setPosting(true);
    try {
      setStage('uploading');
      const media = await uploadMedia({ uri: videoUri, name: 'reel.mp4', type: 'video/mp4' });
      setStage('creating');
      const reel = await createReel({
        videoUrl: media.videoUrl,
        videoPublicId: media.videoPublicId,
        thumbnailUrl: media.thumbnailUrl,
        ...(media.durationSec != null ? { durationSec: media.durationSec } : {}),
        ...(media.width != null ? { width: media.width } : {}),
        ...(media.height != null ? { height: media.height } : {}),
        ...(media.bytes != null ? { bytes: media.bytes } : {}),
        ...(caption.trim() ? { caption: caption.trim() } : {}),
        ...(product ? { productId: product.productId } : {}),
        ...(product?.variantId ? { variantId: product.variantId } : {}),
      });
      showToast('Posted', 'Your reel is live', 'check');
      nav.navigate('Tabs', { screen: 'ReelsTab', params: { justPostedId: reel.id } });
    } catch (e: any) {
      /**
       * Surface the server's own words. The two the shopper can act on are the
       * duration rejection (measured server-side, so it can fire even when the
       * picker reported nothing) and the reels ban.
       */
      const msg = e?.message || 'Could not post your reel. Please try again.';
      Alert.alert('Post failed', msg);
    } finally {
      setPosting(false);
      setStage('idle');
    }
  };

  const canPost = !!videoUri && !posting && !!token;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <BrutalStatusBar />

      {/* HEADER */}
      <View style={{ paddingTop: 56, paddingHorizontal: SP.l, paddingBottom: SP.m, flexDirection: 'row', alignItems: 'center', gap: SP.m }}>
        <Pressable onPress={() => nav.goBack()} hitSlop={10}>
          <Feather name="x" size={22} color={C.ink} />
        </Pressable>
        <Text style={[T.h1, { flex: 1, textTransform: 'uppercase' }]}>New reel</Text>
        <Pressable
          onPress={post}
          disabled={!canPost}
          style={[{ paddingHorizontal: 16, paddingVertical: 9, backgroundColor: canPost ? C.ink : C.hairline }, BORDER(1)]}
        >
          <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(13), letterSpacing: 1, color: canPost ? C.white : C.dim }}>
            POST
          </Text>
        </Pressable>
      </View>
      <View style={{ height: 1, backgroundColor: C.hairline }} />

      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        {/* VIDEO */}
        {videoUri ? (
          <View>
            <VideoPreview uri={videoUri} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SP.s }}>
              <Text style={[T.micro, { color: C.dim }]}>
                {videoSeconds != null ? `${videoSeconds.toFixed(1)}s of ${MAX_SECONDS}s` : `Up to ${MAX_SECONDS}s`}
              </Text>
              <Pressable onPress={pickVideo} hitSlop={8}>
                <Text style={[T.caption, { color: C.ink, fontFamily: HELV, fontWeight: '700' }]}>Change</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={pickVideo}
            style={[{ height: 260, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white, gap: 10 }, BORDER(1)]}
          >
            <Feather name="video" size={34} color={C.ink} />
            <Text style={[T.bodyB]}>Choose a video</Text>
            <Text style={[T.micro, { color: C.dim }]}>{`Up to ${MAX_SECONDS} seconds`}</Text>
          </Pressable>
        )}

        {/* CAPTION */}
        <Text style={[T.caption, { marginTop: SP.xl }]}>Caption</Text>
        <View style={[{ marginTop: 8, padding: SP.m, backgroundColor: C.white }, BORDER(1)]}>
          <TextInput
            value={caption}
            onChangeText={(t) => setCaption(t.slice(0, MAX_CAPTION))}
            placeholder="Say something about this fit..."
            placeholderTextColor={C.dim}
            multiline
            style={[T.body, { minHeight: 70, padding: 0, textAlignVertical: 'top' }]}
          />
        </View>
        <Text style={[T.micro, { color: C.dim, marginTop: 4, textAlign: 'right' }]}>
          {`${caption.length}/${MAX_CAPTION}`}
        </Text>

        {/* PRODUCT — optional by design */}
        <Text style={[T.caption, { marginTop: SP.xl }]}>Featured product</Text>
        {product ? (
          <View style={[{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: SP.m, padding: SP.m, backgroundColor: C.white }, BORDER(1)]}>
            <View style={[{ width: 56, height: 70, overflow: 'hidden', backgroundColor: C.hairline }, BORDER(1)]}>
              <CachedImage source={{ uri: product.image }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[T.productName]} numberOfLines={2}>{product.name}</Text>
              {!!product.variantLabel && (
                <Text style={[T.micro, { color: C.dim, marginTop: 3 }]}>{product.variantLabel}</Text>
              )}
            </View>
            <Pressable onPress={() => setProduct(null)} hitSlop={10}>
              <Feather name="x" size={18} color={C.dim} />
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => nav.navigate('ReelProductPicker')}
            style={[{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 10, padding: SP.m, backgroundColor: C.white }, BORDER(1)]}
          >
            <Feather name="tag" size={18} color={C.ink} />
            <View style={{ flex: 1 }}>
              <Text style={[T.bodyB]}>Tag a product</Text>
              <Text style={[T.micro, { color: C.dim, marginTop: 2 }]}>Optional · anything in the store</Text>
            </View>
            <Feather name="chevron-right" size={18} color={C.dim} />
          </Pressable>
        )}

        {posting && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: SP.xl }}>
            <ActivityIndicator color={C.ink} />
            <Text style={[T.caption, { color: C.dim }]}>
              {stage === 'uploading' ? 'Uploading video…' : 'Publishing…'}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/** Muted looping preview of the picked file. */
function VideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return (
    <View style={[{ height: 380, backgroundColor: '#000', overflow: 'hidden' }, BORDER(1)]}>
      <VideoView
        player={player}
        style={{ width: '100%', height: '100%' }}
        contentFit="contain"
        nativeControls={false}
      />
    </View>
  );
}
