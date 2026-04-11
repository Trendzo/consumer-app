// Login + Signup + Forgot — all in one file, brutalism style
import React, { useState } from 'react';
import { View, Text, ScrollView, StatusBar, KeyboardAvoidingView, Platform, Pressable, Alert, Image, StyleSheet, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { MotiView } from 'moti';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, T, SP, BORDER, ASCII } from '../theme/brutal';
import { BrutalButton, BrutalInput, AsciiDivider } from '../components/Brutal';
import { useApp } from '../state/AppState';

const { height } = Dimensions.get('window');
const LOGIN_HERO = require('../../assets/login.jpeg');

// ── Auth landing — full-bleed motion-blur hero, sharp edges ──
export function LoginScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <StatusBar barStyle="dark-content" />

      {/* Full-bleed hero image */}
      <Image source={LOGIN_HERO} style={StyleSheet.absoluteFill} resizeMode="contain" />

      {/* Top close */}
      <Pressable
        onPress={() => navigation.goBack()}
        hitSlop={16}
        style={{ position: 'absolute', top: insets.top + 12, right: SP.l, zIndex: 5 }}
      >
        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: '#000' }}>Close</Text>
      </Pressable>

      {/* PAST · PRESENT · FUTURE row — vertically centered */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MotiView
          from={{ opacity: 0, translateY: 8 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 600 }}
          style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingHorizontal: SP.xl }}
        >
          <Text style={[landingStyles.eraText, landingStyles.eraDark]}>PAST</Text>
          <Text style={landingStyles.eraText}>PRESENT</Text>
          <Text style={[landingStyles.eraText, landingStyles.eraDark]}>FUTURE</Text>
        </MotiView>
      </View>

      {/* Bottom action stack */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingBottom: insets.bottom + SP.l,
          paddingHorizontal: SP.l,
        }}
      >
        <Text style={landingStyles.shopFrom}>
          Shopping from <Text style={landingStyles.shopFromUnderline}>India</Text>
        </Text>

        <Pressable
          onPress={() => navigation.navigate('Signup')}
          style={landingStyles.signupBtn}
        >
          <BlurView intensity={100} tint="light" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.25)' }]} />
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.9)' }} />
          <View style={[StyleSheet.absoluteFill, { borderWidth: 1, borderColor: '#000' }]} pointerEvents="none" />
          <Text style={landingStyles.signupText}>SIGN UP</Text>
        </Pressable>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: SP.m }}>
          <Pressable onPress={() => navigation.navigate('EmailLogin')} hitSlop={10}>
            <Text style={landingStyles.linkText}>Log In</Text>
          </Pressable>
          <Text style={landingStyles.linkSep}>or</Text>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
            <Text style={landingStyles.linkText}>Start Browsing</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const landingStyles = StyleSheet.create({
  eraText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: '#fff',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  eraDark: {
    color: '#000',
    textShadowColor: 'transparent',
  },
  shopFrom: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
    marginBottom: SP.m,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  shopFromUnderline: {
    textDecorationLine: 'underline',
  },
  signupBtn: {
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  signupText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: '#000',
    letterSpacing: 1,
  },
  linkText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: '#fff',
    textDecorationLine: 'underline',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  linkSep: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});

// ── Email login form (kept for users who tap "Log In") ──
export function EmailLoginScreen({ navigation }: any) {
  const { signIn } = useApp();
  const [email, setEmail] = useState('demo@closetx.app');
  const [password, setPassword] = useState('••••••••');

  const handleLogin = () => {
    if (!email.includes('@')) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }
    signIn(email, email.split('@')[0]);
    navigation.popToTop();
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingTop: 64, paddingHorizontal: SP.l, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => navigation.goBack()}>
            <Text style={{ fontFamily: 'SpaceMono_700Bold', fontSize: 11, color: C.ink, letterSpacing: 1 }}>{'[ ◀ BACK ]'}</Text>
          </Pressable>
          <AsciiDivider style={{ marginTop: 8 }} />

          <Text style={{ fontFamily: 'Inter_900Black', fontSize: 48, color: C.ink, letterSpacing: -2, lineHeight: 48, marginTop: 24 }}>WELCOME{'\n'}BACK.</Text>
          <Text style={[T.body, { color: C.dim, marginTop: 10 }]}>Sign in to your closet.</Text>

          <View style={{ marginTop: 36 }}>
            <BrutalInput label="Email" value={email} onChangeText={setEmail} icon="mail" keyboardType="email-address" autoCapitalize="none" placeholder="you@closetx.app" />
            <BrutalInput label="Password" value={password} onChangeText={setPassword} icon="lock" secureTextEntry placeholder="••••••••" />
          </View>

          <BrutalButton label="Sign in" iconRight="arrow-right" onPress={handleLogin} block />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

export function SignupScreen({ navigation }: any) {
  const { signIn } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignup = () => {
    if (!name || !email.includes('@') || password.length < 4) {
      Alert.alert('Check your details', 'Name, valid email, and a password (4+ chars) are required.');
      return;
    }
    signIn(email, name);
    navigation.popToTop();
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <StatusBar barStyle="dark-content" />

      {/* Top bar — sharp, no grab handle */}
      <View style={signupStyles.topBar}>
        <Text style={signupStyles.brand}>{'> CLOSET-X'}</Text>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={signupStyles.close}>CLOSE  ✕</Text>
        </Pressable>
      </View>
      <View style={{ height: 1, backgroundColor: '#000' }} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: SP.l, paddingTop: SP.xl, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={signupStyles.kicker}>NEW HERE  ·  10s SIGN-UP</Text>

          <Text style={signupStyles.title}>JOIN THE{'\n'}CLOSET.</Text>
          <Text style={signupStyles.sub}>
            Drop in. Build your fit. Get fashion in 60 minutes.
          </Text>

          <View style={{ marginTop: 28 }}>
            <BrutalInput label="Full name" value={name} onChangeText={setName} icon="user" placeholder="Your name" />
            <BrutalInput label="Email" value={email} onChangeText={setEmail} icon="mail" keyboardType="email-address" autoCapitalize="none" placeholder="you@closetx.app" />
            <BrutalInput label="Password" value={password} onChangeText={setPassword} icon="lock" secureTextEntry placeholder="••••••••" />
          </View>

          <BrutalButton label="Create account" iconRight="arrow-right" onPress={handleSignup} block />

          <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 22, gap: 12 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: '#000' }} />
            <Text style={signupStyles.orText}>OR</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: '#000' }} />
          </View>

          <BrutalButton label="Continue with Apple" icon="smartphone" variant="outline" onPress={() => { signIn('apple@closetx.app', 'Apple User'); navigation.popToTop(); }} block style={{ marginBottom: 10 }} />
          <BrutalButton label="Continue with Google" icon="globe" variant="outline" onPress={() => { signIn('google@closetx.app', 'Google User'); navigation.popToTop(); }} block />

          <Pressable onPress={() => navigation.replace('EmailLogin')} style={{ marginTop: 22 }}>
            <Text style={signupStyles.haveAcc}>
              Already have an account?  <Text style={{ textDecorationLine: 'underline' }}>Log in</Text>
            </Text>
          </Pressable>

          <Text style={signupStyles.terms}>
            BY CONTINUING YOU ACCEPT TERMS · PRIVACY
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const signupStyles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SP.l,
    paddingTop: 14,
    paddingBottom: 12,
    backgroundColor: '#fff',
  },
  brand: {
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 11,
    color: '#000',
    letterSpacing: 1.5,
  },
  close: {
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 11,
    color: '#000',
    letterSpacing: 1.5,
  },
  kicker: {
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 10,
    color: '#000',
    letterSpacing: 2,
    marginBottom: 12,
  },
  title: {
    fontFamily: 'Inter_900Black',
    fontSize: 44,
    color: '#000',
    letterSpacing: -2,
    lineHeight: 46,
  },
  sub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#666',
    marginTop: 10,
    lineHeight: 19,
  },
  orText: {
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 10,
    color: '#666',
    letterSpacing: 1,
  },
  haveAcc: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: '#000',
    textAlign: 'center',
  },
  terms: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9,
    color: '#666',
    textAlign: 'center',
    marginTop: 18,
    letterSpacing: 1,
  },
});
