/**
 * Pick the product a reel features — and, when it has more than one, the exact
 * variant.
 *
 * Two stages in one screen: search the live catalog, then (only if the chosen
 * listing actually has variants worth choosing between) pick the colour/size.
 * A single-variant product skips stage two entirely — offering a picker with one
 * option reads as broken.
 *
 * NOTHING here is gated on having bought the product. Featuring is editorial:
 * you can shoot a reel about anything the store sells.
 *
 * Result is handed back by navigating to CreateReel with a `picked` param, which
 * merges into the existing screen rather than mounting a second one.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { C, T, SP, BORDER, HELV } from '../theme/brutal';
import { BrutalStatusBar, CachedImage, CARD } from '../components/Brutal';
import { CatalogSection, CatalogEmpty } from '../components/CatalogState';
import { useCatalogProducts } from '../hooks/useCatalogProducts';
import { useApp } from '../state/AppState';
import { getProductDetail, type ProductDetailData, type ProductVariant } from '../services/catalog';

export type PickedProduct = {
  productId: string;
  variantId?: string;
  name: string;
  image: string;
  variantLabel?: string;
};

export default function ReelProductPickerScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { gender } = useApp();
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');

  // Debounced so a fast typist does not fire one request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  /**
   * An explicit search is NOT gender-filtered; an idle browse is.
   *
   * Typing a name is a statement of intent — "Kenneth Cole Shirt" is a HIM
   * listing, so searching it from the HER rail returned nothing at all while the
   * store plainly stocks it. Browsing with no term keeps the shopper's rail so
   * the default grid is relevant rather than the entire catalog.
   *
   * (SearchScreen solves the same problem by searching the rail first and
   * widening only when empty. Here there is no reason to prefer the rail at all:
   * you can feature or try on anything the store sells.)
   */
  const { products, status, reload } = useCatalogProducts({
    ...(term ? { search: term } : { gender }),
    limit: 40,
  });

  // Stage 2 — the chosen listing's detail, loaded only once something is picked.
  const [chosen, setChosen] = useState<{ id: string; name: string; img: string } | null>(null);
  const [detail, setDetail] = useState<ProductDetailData | null>(null);
  const [detailFailed, setDetailFailed] = useState(false);

  const finish = (picked: PickedProduct) => {
    // `navigate` (not `push`) so this returns to the CreateReel already on the
    // stack, keeping the video and caption the user has already chosen.
    nav.navigate('CreateReel', { picked, pickToken: Date.now() });
  };

  useEffect(() => {
    if (!chosen) { setDetail(null); setDetailFailed(false); return; }
    let cancelled = false;
    setDetailFailed(false);
    getProductDetail(chosen.id)
      .then((d) => {
        if (cancelled) return;
        const variants = pickableVariants(d);
        // One variant (or none) is not a choice — take it and close.
        if (variants.length <= 1) {
          finish({
            productId: chosen.id,
            name: chosen.name,
            image: chosen.img,
            ...(variants[0] ? { variantId: variants[0].id, variantLabel: variantLabel(variants[0]) } : {}),
          });
          return;
        }
        setDetail(d);
      })
      .catch(() => { if (!cancelled) setDetailFailed(true); });
    return () => { cancelled = true; };
  }, [chosen?.id]);

  // ── Stage 2: variant grid ────────────────────────────────────────────────
  if (chosen && (detail || detailFailed)) {
    const variants = detail ? pickableVariants(detail) : [];
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <BrutalStatusBar />
        <View style={{ paddingTop: 56, paddingHorizontal: SP.l, paddingBottom: SP.m }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.m }}>
            <Pressable onPress={() => setChosen(null)} hitSlop={10}>
              <Feather name="arrow-left" size={22} color={C.ink} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={[T.h1, { textTransform: 'uppercase' }]}>Which one?</Text>
              <Text style={[T.caption, { color: C.dim, marginTop: 2 }]} numberOfLines={1}>{chosen.name}</Text>
            </View>
          </View>
        </View>
        <View style={{ height: 1, backgroundColor: C.hairline }} />

        <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 40 }}>
          {detailFailed ? (
            <CatalogEmpty
              icon="wifi-off"
              title="Couldn't load options"
              sub="Tag the product without a specific variant, or try again."
              actionLabel="Tag without variant"
              onAction={() => finish({ productId: chosen.id, name: chosen.name, image: chosen.img })}
            />
          ) : (
            <>
              <Pressable
                onPress={() => finish({ productId: chosen.id, name: chosen.name, image: chosen.img })}
                style={[{ padding: SP.m, marginBottom: SP.m, backgroundColor: C.white }, BORDER(1)]}
              >
                <Text style={[T.bodyB]}>Just the product</Text>
                <Text style={[T.micro, { color: C.dim, marginTop: 2 }]}>No specific colour or size</Text>
              </Pressable>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                {variants.map((v) => (
                  <Pressable
                    key={v.id}
                    onPress={() => finish({
                      productId: chosen.id,
                      variantId: v.id,
                      name: chosen.name,
                      image: v.img || chosen.img,
                      variantLabel: variantLabel(v),
                    })}
                    style={{ width: CARD.w, marginBottom: SP.m }}
                  >
                    <View style={[{ height: CARD.imgH, overflow: 'hidden', backgroundColor: C.hairline }, BORDER(1)]}>
                      <CachedImage source={{ uri: v.img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                    </View>
                    <Text style={[T.productName, { marginTop: 6 }]} numberOfLines={2}>{variantLabel(v)}</Text>
                    <Text style={[T.price, { marginTop: 3 }]}>₹{v.price}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </View>
    );
  }

  // ── Stage 1: search ──────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <BrutalStatusBar />
      <View style={{ paddingTop: 56, paddingHorizontal: SP.l, paddingBottom: SP.m }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.m }}>
          <Pressable onPress={() => nav.goBack()} hitSlop={10}>
            <Feather name="arrow-left" size={22} color={C.ink} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[T.h1, { textTransform: 'uppercase' }]}>Feature a product</Text>
            <Text style={[T.caption, { color: C.dim, marginTop: 2 }]}>Anything in the store · you don't have to own it</Text>
          </View>
        </View>

        <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: SP.m, paddingVertical: 10, marginTop: SP.m }, BORDER(1)]}>
          <Feather name="search" size={16} color={C.dim} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search products..."
            placeholderTextColor={C.dim}
            style={[T.body, { flex: 1, padding: 0 }]}
            autoFocus
          />
          {q.length > 0 && (
            <Pressable onPress={() => setQ('')} hitSlop={8}>
              <Feather name="x" size={16} color={C.dim} />
            </Pressable>
          )}
        </View>
      </View>
      <View style={{ height: 1, backgroundColor: C.hairline }} />

      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {route.params?.allowNone !== false && (
          <Pressable
            onPress={() => nav.navigate('CreateReel', { picked: null, pickToken: Date.now() })}
            style={[{ padding: SP.m, marginBottom: SP.m, backgroundColor: C.white }, BORDER(1)]}
          >
            <Text style={[T.bodyB]}>No product</Text>
            <Text style={[T.micro, { color: C.dim, marginTop: 2 }]}>Post the reel on its own</Text>
          </Pressable>
        )}

        <CatalogSection
          status={status}
          count={products.length}
          onRetry={reload}
          empty={<CatalogEmpty
            icon="search"
            title={term ? 'No matches' : 'Nothing to feature yet'}
            sub={term ? `No live listings match "${term}".` : 'Products appear here as stores go live.'}
          />}
        >
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {products.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => setChosen({ id: p.id, name: p.name, img: String(p.img) })}
                style={{ width: CARD.w, marginBottom: SP.m }}
              >
                <View style={[{ height: CARD.imgH, overflow: 'hidden', backgroundColor: C.hairline }, BORDER(1)]}>
                  <CachedImage source={{ uri: p.img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                </View>
                <Text style={[T.micro, { fontFamily: HELV, fontWeight: '600', color: C.ink, marginTop: 6 }]} numberOfLines={1}>
                  {(p.brand ?? '').toUpperCase()}
                </Text>
                <Text style={[T.productName, { marginTop: 2 }]} numberOfLines={2}>{p.name}</Text>
                <Text style={[T.price, { marginTop: 3 }]}>₹{p.price}</Text>
              </Pressable>
            ))}
          </View>
        </CatalogSection>
      </ScrollView>
    </View>
  );
}

/** "M / Black", or whichever half exists. */
function variantLabel(v: ProductVariant): string {
  return [v.color, v.size].filter(Boolean).join(' · ') || 'Variant';
}

/**
 * Variants worth offering as a choice.
 *
 * Out-of-stock ones stay — a reel is content, not an order, and a creator may
 * well be talking about a colourway that has sold out.
 */
function pickableVariants(d: ProductDetailData): ProductVariant[] {
  return d.variants ?? [];
}
