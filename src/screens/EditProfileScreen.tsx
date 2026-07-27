// EDIT PROFILE — one page, three sticky-tab sections (Basics · Size Details ·
// Style), Myntra-style: tap a tab to jump, scroll to spy the active tab.
// Compact, app-matching (tokens, sharp corners, hairline borders, grey tiles).
// Basics form save is preserved; Size/Style summarise and deep-link to the
// step-by-step flows.
import React, { useRef, useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { C, T, SP, BORDER } from '../theme/brutal';
import { ScreenHeader, BrutalStatusBar, BrutalButton } from '../components/Brutal';
import { useApp } from '../state/AppState';
import { updateMe } from '../services/auth';

const TILE = '#F4F4F4';
const TABS = ['Basics', 'Size Details', 'Style'] as const;
const NA = '#E0731F'; // "not answered" amber accent

// Compact labelled input row.
function Field({ label, value, onChangeText, placeholder, keyboardType, multiline }: any) {
  return (
    <View style={{ marginTop: SP.m }}>
      <Text style={[T.micro, { color: C.dim, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.dim}
        keyboardType={keyboardType}
        multiline={multiline}
        style={[T.body, { paddingHorizontal: SP.m, paddingVertical: 11, backgroundColor: C.white, minHeight: multiline ? 70 : undefined, textAlignVertical: multiline ? 'top' : 'center' }, BORDER(1)]}
      />
    </View>
  );
}

// Grey band section header (Myntra-style separator between sections).
function Band({ title }: { title: string }) {
  return (
    <View style={{ marginTop: SP.l }}>
      <View style={{ height: 8, backgroundColor: TILE }} />
      <Text style={[T.h3, { textTransform: 'uppercase', paddingHorizontal: SP.l, paddingTop: SP.m, paddingBottom: SP.s }]}>{title}</Text>
      <View style={{ height: 1, backgroundColor: C.hairline }} />
    </View>
  );
}

// A single "value / not-answered" row inside a size card.
function SizeRow({ k, v }: { k: string; v?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
      <Text style={[T.caption, { color: C.dim }]}>{k}</Text>
      <Text style={[T.caption, { color: v ? C.ink : NA, fontFamily: v ? 'Inter_600SemiBold' : 'Inter_400Regular', flexShrink: 1, textAlign: 'right', marginLeft: SP.m }]} numberOfLines={1}>{v || 'Not answered'}</Text>
    </View>
  );
}

export default function EditProfileScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const initialTab: number = Math.min(2, Math.max(0, route.params?.tab ?? 0));
  const { user, updateUser, showToast, gender, setGender } = useApp();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [saving, setSaving] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const sectionY = useRef<Record<number, number>>({});
  const suppress = useRef(false);
  const [active, setActive] = useState(initialTab);
  const jumpedInitial = useRef(false);

  const jumpTo = (i: number, animated = true) => {
    const y = sectionY.current[i] ?? 0;
    suppress.current = true;
    setActive(i);
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 4), animated });
    setTimeout(() => { suppress.current = false; }, 420);
  };
  // Measure each section; once the requested initial tab's offset is known,
  // jump there (deep-link from the Profile pills).
  const onSectionLayout = (i: number) => (e: any) => {
    sectionY.current[i] = e.nativeEvent.layout.y;
    if (!jumpedInitial.current && initialTab > 0 && sectionY.current[initialTab] != null) {
      jumpedInitial.current = true;
      setTimeout(() => jumpTo(initialTab, false), 0);
    }
  };
  const onScroll = (e: any) => {
    if (suppress.current) return;
    const y = e.nativeEvent.contentOffset.y + 80;
    let cur = 0;
    for (let i = 0; i < TABS.length; i++) if ((sectionY.current[i] ?? Infinity) <= y) cur = i;
    if (cur !== active) setActive(cur);
  };

  const save = () => {
    updateUser({ name: name.trim() || 'You', email: email.trim() || 'guest@trendzo.app', phone: phone.trim(), address: address.trim() });
    showToast('Profile updated', 'Your details have been saved', 'check');
  };
  const initials = ((name || 'You').split(' ').map((s) => s[0]).join('').slice(0, 2) || 'Y').toUpperCase();
  const genderLabel = gender === 'her' ? 'Her' : gender === 'him' ? 'Him' : 'Both';

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <BrutalStatusBar />
      <ScreenHeader title="Edit Profile" onBack={() => nav.goBack()} />

      {/* ─── STICKY TABS ─── */}
      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: C.hairline }}>
        {TABS.map((t, i) => {
          const on = i === active;
          return (
            <Pressable key={t} onPress={() => jumpTo(i)} style={{ flex: 1, alignItems: 'center', paddingVertical: 13 }}>
              <Text style={[T.caption, { color: on ? C.ink : C.dim, fontFamily: on ? 'Inter_700Bold' : 'Inter_400Regular' }]}>{t}</Text>
              {on && <View style={{ position: 'absolute', bottom: -1, height: 2, left: '22%', right: '22%', backgroundColor: C.ink }} />}
            </Pressable>
          );
        })}
      </View>

      {/* Keyboard-aware: fields never hide behind the keyboard — the page
          shrinks and stays scrollable while typing. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scrollRef} onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ═══ BASICS — clean rows (Myntra-style), avatar on top ═══ */}
        <View onLayout={onSectionLayout(0)}>
          <View style={{ alignItems: 'center', paddingTop: SP.l, paddingBottom: SP.s }}>
            <Pressable onPress={() => showToast('Coming soon', 'Photo upload is on the way', 'camera')} style={[{ width: 76, height: 76, backgroundColor: TILE, alignItems: 'center', justifyContent: 'center' }, BORDER(1)]}>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 26, color: C.ink }}>{initials}</Text>
              <View style={[{ position: 'absolute', bottom: -1, right: -1, width: 22, height: 22, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }, BORDER(1)]}>
                <Feather name="camera" size={10} color="#fff" />
              </View>
            </Pressable>
          </View>

          <View style={{ paddingHorizontal: SP.l, paddingTop: SP.s }}>
            <View style={[BORDER(1)]}>
              {([['Name', name, setName], ['Email', email, setEmail], ['Phone', phone, setPhone]] as const).map(([label, val, set], i) => (
                <View key={label} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SP.m, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: C.hairline }}>
                  <Text style={[T.caption, { color: C.dim, width: 72 }]}>{label}</Text>
                  <TextInput value={val} onChangeText={set as any} placeholder={`Add ${label.toLowerCase()}`} placeholderTextColor={C.dim} style={[T.body, { flex: 1, textAlign: 'right', padding: 0 }]} keyboardType={label === 'Email' ? 'email-address' : label === 'Phone' ? 'phone-pad' : undefined} />
                </View>
              ))}
              {/* Gender row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SP.m, paddingVertical: 10, borderTopWidth: 1, borderColor: C.hairline }}>
                <Text style={[T.caption, { color: C.dim, width: 72 }]}>Shopping</Text>
                <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 6 }}>
                  {([['her', 'Her'], ['him', 'Him']] as const).map(([g, lbl]) => {
                    const on = gender === g;
                    return (
                      <Pressable key={g} onPress={() => setGender(g)} style={[{ paddingHorizontal: 14, paddingVertical: 6, backgroundColor: on ? C.ink : C.white }, BORDER(1)]}>
                        <Text style={[T.caption, { color: on ? '#fff' : C.ink, fontFamily: on ? 'Inter_700Bold' : 'Inter_400Regular' }]}>{lbl}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
            <BrutalButton label="Save" icon="check" block onPress={save} style={{ marginTop: SP.l }} />
          </View>
        </View>

        {/* ═══ SIZE DETAILS ═══ */}
        <View onLayout={onSectionLayout(1)}>
          <Band title="Size Details" />
          <View style={{ paddingHorizontal: SP.l, paddingTop: SP.m }}>
            {/* Basics & Topwear card */}
            <View style={[{ padding: SP.m, backgroundColor: C.white }, BORDER(1)]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={[T.body, { fontFamily: 'Inter_700Bold' }]}>Basics & Topwear</Text>
                <Pressable onPress={() => nav.navigate('Measurement')} hitSlop={8}><Feather name="edit-2" size={15} color={C.ink} /></Pressable>
              </View>
              <SizeRow k="Height / Weight" v={undefined} />
              <SizeRow k="Body Shape" v={undefined} />
              <SizeRow k="Size" v={undefined} />
              <SizeRow k="Preferred Brand" v={undefined} />
              <SizeRow k="Fit Preference" v={undefined} />
              <SizeRow k="Body Type" v={undefined} />
            </View>

            {/* Bottomwear + Footwear get-now rows */}
            {[['Bottomwear', 'bottomwear'], ['Footwear', 'footwear']].map(([label]) => (
              <Pressable key={label} onPress={() => nav.navigate('Measurement')} style={[{ marginTop: SP.s, padding: SP.m, backgroundColor: TILE, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, BORDER(1)]}>
                <View style={{ flex: 1 }}>
                  <Text style={[T.body, { fontFamily: 'Inter_600SemiBold' }]}>{label}</Text>
                  <Text style={[T.micro, { color: C.dim, marginTop: 1 }]}>Get size recommendations</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={[T.caption, { color: C.ink, fontFamily: 'Inter_700Bold' }]}>Get now</Text>
                  <Feather name="arrow-right" size={14} color={C.ink} />
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ═══ STYLE ═══ */}
        <View onLayout={onSectionLayout(2)}>
          <Band title="Style" />
          <View style={{ paddingHorizontal: SP.l, paddingTop: SP.m }}>
            <View style={[{ padding: SP.l, backgroundColor: TILE, alignItems: 'center' }, BORDER(1)]}>
              <View style={[{ width: 48, height: 48, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }, BORDER(1)]}>
                <Feather name="sliders" size={22} color={C.ink} />
              </View>
              <Text style={[T.h3, { textTransform: 'uppercase', marginTop: SP.m, textAlign: 'center' }]}>Shop with more confidence</Text>
              <Text style={[T.caption, { color: C.dim, marginTop: 4, textAlign: 'center' }]}>Tell us your style & fit — we'll tailor picks and sizes to you.</Text>
              <BrutalButton label="Set style preferences" block onPress={() => nav.navigate('StylePreferences')} style={{ marginTop: SP.l, alignSelf: 'stretch' }} />
            </View>
            {/* current preference summary */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, marginTop: SP.s, borderBottomWidth: 1, borderColor: C.hairline }}>
              <Text style={[T.caption, { color: C.dim }]}>Shopping preference</Text>
              <Text style={[T.caption, { color: C.ink, fontFamily: 'Inter_600SemiBold' }]}>{genderLabel}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
