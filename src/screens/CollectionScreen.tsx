// One page per editorial collection — the destination that replaced
// `navigate('Categories', { label: <editorial copy> })`.
//
// Deliberately ONE parameterised screen rather than a file per tile: every
// collection page is the same thing (a titled, blurbed, shoppable grid) and
// differs only in its query, which lives in content/collections.ts. Adding a
// new curated tile is a registry entry, not a screen.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, T, SP, BORDER, rf } from '../theme/brutal';
import { CARD_STYLES, FadeInUp, ProductCard } from '../components/Brutal';
import { CatalogSection, CatalogEmpty, type LoadStatus } from '../components/CatalogState';
import { listCollectionProducts, listProducts } from '../services/catalog';
import { getCollection, type CollectionDef } from '../content/collections';
import { useApp } from '../state/AppState';
import type { Product } from '../data/mockData';

const PAGE_SIZE = 40;

/**
 * Resolve a collection to products: backend collection first, then the mapped
 * category slugs merged in order, then a free-text search. Each step is only
 * attempted if the previous one came back empty, so a curated server-side
 * collection always wins over the category approximation of it.
 */
function useCollectionProducts(def: CollectionDef | null, appGender: 'her' | 'him') {
  const [products, setProducts] = useState<Product[]>([]);
  const [status, setStatus] = useState<LoadStatus>(def ? 'loading' : 'ready');
  const [nonce, setNonce] = useState(0);
  const runId = useRef(0);
  const reload = () => setNonce((n) => n + 1);

  // The query object is rebuilt every render; depend on its content, not its
  // identity, or this effect would refetch on every parent re-render.
  const q = def?.query;
  const qKey = JSON.stringify(q ?? null);
  const gender = q?.gender ?? appGender;

  useEffect(() => {
    if (!def || !q) { setProducts([]); setStatus('ready'); return; }
    const id = ++runId.current;
    const ac = new AbortController();
    setStatus('loading');

    (async () => {
      try {
        // 1 — real curated collection. When the collection EXISTS its answer is final,
        // empty included: falling through to a category browse because a real
        // collection happens to be empty would render unrelated products under its
        // name. Only a genuinely missing collection (404) drops to the mapping below.
        if (q.collection) {
          const res = await listCollectionProducts(q.collection, { gender });
          if (id !== runId.current) return;
          if (res.status === 'ok') { setProducts(res.products); setStatus('ready'); return; }
          if (res.status === 'error') { setStatus('error'); return; }
        }

        // 2 — mapped category slugs, merged in order and de-duplicated. Fetched
        // in parallel; a slug that fails contributes nothing rather than
        // failing the page.
        if (q.categorySlugs?.length) {
          const per = Math.max(8, Math.ceil(PAGE_SIZE / q.categorySlugs.length));
          const lists = await Promise.all(
            q.categorySlugs.map((slug) =>
              listProducts({
                categorySlug: slug,
                gender,
                limit: per,
                ...(q.sort ? { sort: q.sort } : {}),
                signal: ac.signal,
              }).catch(() => [] as Product[]),
            ),
          );
          if (id !== runId.current) return;
          const seen = new Set<string>();
          const merged: Product[] = [];
          // Round-robin across the slugs so the grid opens mixed rather than
          // showing every tee before the first pair of jeans.
          for (let i = 0; i < per; i += 1) {
            for (const list of lists) {
              const p = list[i];
              if (p && !seen.has(p.id)) { seen.add(p.id); merged.push(p); }
            }
          }
          if (merged.length) { setProducts(merged.slice(0, PAGE_SIZE)); setStatus('ready'); return; }
        }

        // 3 — free text
        if (q.search) {
          const rows = await listProducts({ search: q.search, gender, limit: PAGE_SIZE, signal: ac.signal });
          if (id !== runId.current) return;
          setProducts(rows);
          setStatus('ready');
          return;
        }

        if (id === runId.current) { setProducts([]); setStatus('ready'); }
      } catch {
        if (id === runId.current) { setProducts([]); setStatus('error'); }
      }
    })();

    return () => ac.abort();
  }, [qKey, gender, nonce, def]);

  return { products, status, reload };
}

export default function CollectionScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { gender } = useApp();

  const key = route.params?.key as string | undefined;
  const def = useMemo(() => getCollection(key), [key]);
  const { products, status, reload } = useCollectionProducts(def, gender);

  // A collection key that no longer exists must degrade to a readable page, not
  // a crash — content outlives builds (same reasoning as openLink's no-op).
  const kicker = def?.kicker ?? (route.params?.kicker as string) ?? 'COLLECTION';
  const title = def?.title ?? (route.params?.title as string) ?? 'Collection';
  const blurb = def?.blurb ?? '';

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* header — matches the section pages' back + centred title bar */}
      <View style={{ backgroundColor: C.white }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SP.l, paddingTop: insets.top + 8, paddingBottom: SP.m }}>
          <Pressable onPress={() => nav.goBack()} hitSlop={12} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="arrow-left" size={22} color={C.ink} />
          </Pressable>
          <Text style={[T.h3, { textTransform: 'uppercase', letterSpacing: 1 }]} numberOfLines={1}>{kicker}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ height: 1, backgroundColor: C.hairline }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>
        {/* editorial masthead — typographic, so a collection needs no artwork
            to look authored */}
        <View style={{ paddingHorizontal: SP.l, paddingTop: SP.xl }}>
          <Text style={[T.micro, { letterSpacing: 2, color: C.dim }]}>{kicker}</Text>
          <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(38), lineHeight: rf(40), color: C.ink, letterSpacing: -1, marginTop: 6 }}>
            {title}
          </Text>
          {blurb ? <Text style={[T.body, { color: C.inkSoft, marginTop: SP.s }]}>{blurb}</Text> : null}
          <View style={{ height: 1, backgroundColor: C.ink, marginTop: SP.l }} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: SP.l, marginTop: SP.m }}>
          <Text style={[T.micro, { color: C.dim }]}>THE EDIT</Text>
          <Text style={[T.micro, { color: C.dim }]}>
            {status === 'ready' ? `${products.length} piece${products.length === 1 ? '' : 's'}` : ''}
          </Text>
        </View>

        <View style={{ paddingHorizontal: SP.l, marginTop: SP.m }}>
          <CatalogSection
            status={status}
            count={products.length}
            onRetry={reload}
            empty={
              <CatalogEmpty
                title="Nothing in this edit yet"
                sub="These pieces are being restocked. Check back shortly."
              />
            }
          >
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.s }}>
              {products.map((p, i) => (
                <FadeInUp key={p.id} delay={(i % 6) * 30}>
                  <ProductCard p={p} style={CARD_STYLES.mb_s} />
                </FadeInUp>
              ))}
            </View>
          </CatalogSection>
        </View>
      </ScrollView>
    </View>
  );
}
