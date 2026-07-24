import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { C, T, SP, BORDER, rf } from '../theme/brutal';
import { ScreenHeader, BrutalStatusBar, BrutalButton } from '../components/Brutal';
import { useApp } from '../state/AppState';

function Field({ label, value, onChangeText, placeholder, keyboardType, multiline }: any) {
  return (
    <View style={{ marginTop: SP.l }}>
      <Text style={[T.caption, { marginBottom: 6 }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.dim}
        keyboardType={keyboardType}
        multiline={multiline}
        style={[T.body, { paddingHorizontal: SP.m, paddingVertical: 12, backgroundColor: C.white, minHeight: multiline ? 80 : undefined, textAlignVertical: multiline ? 'top' : 'center' }, BORDER(1)]}
      />
    </View>
  );
}

export default function EditProfileScreen() {
  const nav = useNavigation<any>();
  const { user, updateUser, showToast } = useApp();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [address, setAddress] = useState(user?.address || '');

  const save = () => {
    updateUser({ name: name.trim() || 'You', email: email.trim() || 'guest@trendzo.app', phone: phone.trim(), address: address.trim() });
    showToast('Profile updated', 'Your details have been saved', 'check');
    nav.goBack();
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <BrutalStatusBar />
      <ScreenHeader title="Edit Profile" onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: SP.l, paddingBottom: 60 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Avatar initials */}
        <View style={{ alignItems: 'center', marginTop: SP.s }}>
          <View style={[{ width: 80, height: 80, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F4F4' }, BORDER(1)]}>
            <Text style={[T.h2, { color: C.ink }]}>
              {((name || 'You').split(' ').map(s => s[0]).join('').slice(0, 2) || 'Y').toUpperCase()}
            </Text>
          </View>
        </View>

        <Field label="Full name" value={name} onChangeText={setName} placeholder="Your name" />
        <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@email.com" keyboardType="email-address" />
        <Field label="Phone" value={phone} onChangeText={setPhone} placeholder="+91 98xxx xxx21" keyboardType="phone-pad" />
        <Field label="Delivery address" value={address} onChangeText={setAddress} placeholder="House / Flat, Street, Area, City, PIN" multiline />

        <BrutalButton label="Save changes" icon="check" block onPress={save} style={{ marginTop: SP.xl }} />
      </ScrollView>
    </View>
  );
}
