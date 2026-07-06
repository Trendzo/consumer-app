// Complete-profile step — shown right after a first OTP login (backend consumers
// start with only a verified phone). Name + email are required by the backend
// before checkout (order snapshots freeze them as NOT NULL). Gender preference
// is optional and also drives the app's her/him UI morph.
import React, { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { C, T, SP, rf, BORDER } from '../theme/brutal';
import { BrutalButton, BrutalInput, AsciiDivider, BrutalStatusBar } from '../components/Brutal';
import { useApp } from '../state/AppState';
import { updateMe } from '../services/auth';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type Gender = 'her' | 'him' | 'unisex';
const GENDERS: { key: Gender; label: string }[] = [
  { key: 'her', label: 'HER' },
  { key: 'him', label: 'HIM' },
  { key: 'unisex', label: 'BOTH' },
];

export function CompleteProfileScreen({ navigation }: any) {
  const { user, applyConsumer, setGender, showToast, gender } = useApp();
  const [name, setName] = useState(user?.name && user.name !== 'You' ? user.name : '');
  const [email, setEmail] = useState(user?.email && !user.email.endsWith('@trendzo.app') ? user.email : '');
  const [pref, setPref] = useState<Gender>(gender);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  const handleSave = async () => {
    const e: typeof errors = {};
    if (name.trim().length < 2) e.name = 'Enter your name';
    if (!EMAIL_RE.test(email.trim())) e.email = 'Enter a valid email';
    setErrors(e);
    if (Object.keys(e).length) return;

    setSaving(true);
    try {
      const consumer = await updateMe({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        genderPreference: pref,
      });
      await applyConsumer(consumer);
      if (pref === 'her' || pref === 'him') setGender(pref);
      showToast('Profile saved', undefined, 'check');
      navigation.popToTop();
    } catch (err: any) {
      if (err?.code === 'email_already_taken') {
        setErrors({ email: 'That email is already in use' });
      } else {
        showToast('Could not save', err?.message ?? 'Please try again', 'alert-circle');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <BrutalStatusBar />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingTop: 64, paddingHorizontal: SP.l, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={{ fontFamily: 'SpaceMono_700Bold', fontSize: 10, color: C.ink, letterSpacing: 2 }}>ONE LAST STEP</Text>
          <AsciiDivider style={{ marginTop: 8 }} />

          <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(44), color: C.ink, letterSpacing: -2, lineHeight: rf(46), marginTop: 24 }}>ALMOST{'\n'}THERE.</Text>
          <Text style={[T.body, { color: C.dim, marginTop: 10 }]}>We need your name and email to place orders.</Text>

          <View style={{ marginTop: 32 }}>
            <BrutalInput label="Full name" value={name} onChangeText={setName} icon="user" placeholder="Your name" autoCapitalize="words" error={errors.name} />
            <BrutalInput label="Email" value={email} onChangeText={setEmail} icon="mail" keyboardType="email-address" autoCapitalize="none" placeholder="you@trendzo.app" error={errors.email} />

            <Text style={[T.label, { marginBottom: 8 }]}>SHOPPING FOR</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: SP.l }}>
              {GENDERS.map(g => {
                const active = pref === g.key;
                return (
                  <Pressable
                    key={g.key}
                    onPress={() => setPref(g.key)}
                    style={[{ flex: 1, paddingVertical: 14, alignItems: 'center', backgroundColor: active ? C.ink : C.white }, BORDER(1)]}
                  >
                    <Text style={{ fontFamily: 'Inter_900Black', fontSize: 12, letterSpacing: 1, color: active ? C.white : C.ink }}>{g.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <BrutalButton label={saving ? 'Saving…' : 'Finish'} iconRight="arrow-right" onPress={handleSave} disabled={saving} block />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

export default CompleteProfileScreen;
