import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { C, T, SP, BORDER, rf } from '../theme/brutal';
import { ScreenHeader, BrutalStatusBar, BrutalButton } from '../components/Brutal';
import { useApp } from '../state/AppState';
import { updateMe } from '../services/auth';

function Field({ label, value, onChangeText, placeholder, keyboardType, multiline }: any) {
  return (
    <View style={{ marginTop: SP.l }}>
      <Text style={[T.label, { fontSize: 10, color: C.dim, marginBottom: 6 }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.dim}
        keyboardType={keyboardType}
        multiline={multiline}
        style={[{ paddingHorizontal: SP.m, paddingVertical: 12, fontFamily: 'Inter_700Bold', fontSize: 14, color: C.ink, backgroundColor: C.white, minHeight: multiline ? 80 : undefined, textAlignVertical: multiline ? 'top' : 'center' }, BORDER(1)]}
      />
    </View>
  );
}

export default function EditProfileScreen() {
  const nav = useNavigation<any>();
  const { user, token, applyConsumer, showToast } = useApp();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    // Phone is the immutable OTP identity; address lives in the addresses API.
    if (!token) { showToast('Sign in first', 'Log in to edit your profile', 'lock'); return; }
    if (!name.trim() || !email.trim()) { showToast('Missing details', 'Name and email are required', 'x'); return; }
    setSaving(true);
    try {
      const updated = await updateMe({ name: name.trim(), email: email.trim() });
      await applyConsumer(updated);
      showToast('Profile updated', 'Your details have been saved', 'check');
      nav.goBack();
    } catch (e: any) {
      showToast('Update failed', e?.message || 'Please try again', 'x');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <BrutalStatusBar />
      <ScreenHeader title="Edit Profile" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 60 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Avatar initials */}
        <View style={{ alignItems: 'center', marginTop: SP.s }}>
          <View style={[{ width: 80, height: 80, alignItems: 'center', justifyContent: 'center', backgroundColor: C.ink }, BORDER(1)]}>
            <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(28), color: C.white }}>
              {((name || 'You').split(' ').map(s => s[0]).join('').slice(0, 2) || 'Y').toUpperCase()}
            </Text>
          </View>
        </View>

        <Field label="FULL NAME" value={name} onChangeText={setName} placeholder="Your name" />
        <Field label="EMAIL" value={email} onChangeText={setEmail} placeholder="you@email.com" keyboardType="email-address" />

        {/* Phone is the login identity — read-only. */}
        <View style={{ marginTop: SP.l }}>
          <Text style={[T.label, { fontSize: 10, color: C.dim, marginBottom: 6 }]}>PHONE (LOGIN)</Text>
          <View style={[{ paddingHorizontal: SP.m, paddingVertical: 12, backgroundColor: C.hairline }, BORDER(1)]}>
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 14, color: C.dim }}>{user?.phone || '—'}</Text>
          </View>
        </View>

        <BrutalButton label="Manage delivery addresses" variant="outline" icon="map-pin" block onPress={() => nav.navigate('SavedAddresses')} style={{ marginTop: SP.l }} />

        <BrutalButton label={saving ? 'Saving…' : 'Save changes'} icon="check" block disabled={saving} onPress={save} style={{ marginTop: SP.xl }} />
      </ScrollView>
    </View>
  );
}
