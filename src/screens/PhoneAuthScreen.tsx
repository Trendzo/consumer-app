// Phone + OTP login — the real, backend-wired consumer auth path.
// Landing "SIGN UP" / "Log In" reach this. Two internal steps: enter phone →
// enter the 4-digit code. On success we store the session and drop straight
// into the app — name/email/gender are optional and filled later if at all.
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Pressable, TextInput } from 'react-native';
import { C, T, BORDER, SP, rf } from '../theme/brutal';
import { BrutalButton, BrutalInput, AsciiDivider, BrutalStatusBar } from '../components/Brutal';
import { useApp } from '../state/AppState';
import { initOtpWidget, sendOtp, resendOtp, verifyOtp, consumerOtpLogin } from '../services/auth';
import { DEFAULT_DIAL_CODE } from '../config/env';

const NATIONAL_RE = /^[0-9]{6,14}$/;
const RESEND_SECONDS = 30;
const OTP_LEN = 4;

// 4-box OTP entry — centered. Under the hood it's ONE hidden full-width input
// that owns the keyboard; the 4 boxes just render each digit. This makes every
// keypress fill the next box left-to-right (no per-box focus juggling, which is
// unreliable on Android/Expo) and lets paste/SMS-autofill drop in all 4 at once.
// `value` stays a plain joined string so the rest of the screen is unchanged.
function OtpBoxes({
  value,
  onChange,
  onComplete,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  // Receives the freshly-typed code — the parent's `otp` state is still one
  // render behind when the 4th digit lands, so verifying from state alone
  // would see 3 digits and flash a bogus "enter the code" error.
  onComplete?: (code: string) => void;
  error?: string;
}) {
  const inputRef = useRef<TextInput | null>(null);
  const digits = Array.from({ length: OTP_LEN }, (_, i) => value[i] ?? '');
  // The active box is the first empty one (or the last box once full).
  const activeIndex = Math.min(value.length, OTP_LEN - 1);
  const focus = () => inputRef.current?.focus();

  const handleChange = (text: string) => {
    const next = text.replace(/\D/g, '').slice(0, OTP_LEN);
    onChange(next);
    if (next.length >= OTP_LEN) {
      inputRef.current?.blur();
      onComplete?.(next);
    }
  };

  return (
    <View style={{ marginBottom: SP.l }}>
      <Text style={[T.label, { marginBottom: 10, textAlign: 'center' }]}>VERIFICATION CODE</Text>
      <Pressable onPress={focus} style={{ flexDirection: 'row', justifyContent: 'center', gap: 12 }}>
        {digits.map((d, i) => {
          const active = i === activeIndex && value.length < OTP_LEN;
          return (
            <View
              key={i}
              style={[
                {
                  width: 56,
                  height: 64,
                  alignItems: 'center',
                  justifyContent: 'center',
                },
                BORDER(error || active ? 2 : 1),
                error ? { borderColor: '#c1121f' } : active ? { borderColor: C.ink } : null,
              ]}
            >
              <Text style={{ fontFamily: 'SpaceMono_700Bold', fontSize: 26, color: C.ink }}>{d}</Text>
            </View>
          );
        })}

        {/* The real input: overlays the boxes, invisible, captures all typing. */}
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={handleChange}
          keyboardType="number-pad"
          maxLength={OTP_LEN}
          autoFocus
          returnKeyType="go"
          onSubmitEditing={() => { if (value.length >= OTP_LEN) onComplete?.(value); }}
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          caretHidden
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0 }}
        />
      </Pressable>
      {error ? (
        <Text style={{ fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: '#c1121f', marginTop: 8, letterSpacing: 0.5, textAlign: 'center' }}>{error}</Text>
      ) : null}
    </View>
  );
}

export function PhoneAuthScreen({ navigation }: any) {
  const { signInWithSession, showToast } = useApp();

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [reqId, setReqId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [phoneErr, setPhoneErr] = useState<string | undefined>();
  const [otpErr, setOtpErr] = useState<string | undefined>();
  const [resendIn, setResendIn] = useState(0);

  // Warm up the native MSG91 widget once.
  useEffect(() => { initOtpWidget(); }, []);

  // Resend cooldown ticker.
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const handleSend = async () => {
    setPhoneErr(undefined);
    const national = phone.replace(/\D/g, '');
    if (!NATIONAL_RE.test(national)) {
      setPhoneErr('Enter a valid mobile number');
      return;
    }
    setSending(true);
    try {
      const rid = await sendOtp(national, DEFAULT_DIAL_CODE);
      setReqId(rid);
      setOtp('');
      setStep('otp');
      setResendIn(RESEND_SECONDS);
    } catch (e: any) {
      setPhoneErr(e?.message ?? 'Could not send OTP. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleResend = async () => {
    if (resendIn > 0 || !reqId) return;
    try {
      await resendOtp(reqId);
      setResendIn(RESEND_SECONDS);
      showToast('OTP resent', `Sent to +${DEFAULT_DIAL_CODE} ${phone}`, 'send');
    } catch (e: any) {
      showToast('Could not resend', e?.message ?? 'Try again in a moment', 'alert-circle');
    }
  };

  // codeArg comes from OtpBoxes' onComplete (fresh, ahead of state). The button
  // press path passes an event object instead, so only trust actual strings.
  const handleVerify = async (codeArg?: unknown) => {
    setOtpErr(undefined);
    const code = (typeof codeArg === 'string' ? codeArg : otp).replace(/\D/g, '');
    if (code.length < 4 || !reqId) {
      setOtpErr('Enter the code we sent you');
      return;
    }
    setVerifying(true);
    try {
      const accessToken = await verifyOtp(reqId, code);
      const session = await consumerOtpLogin(accessToken);
      await signInWithSession(session);
      showToast('Welcome to Trendzo', undefined, 'check');
      // Straight into the app after OTP — no name/email/gender step. Profile
      // fields stay optional and can be filled later from the Profile tab.
      navigation.popToTop();
    } catch (e: any) {
      // The code was accepted by MSG91 but the backend rejected the token. With
      // the bundled retailer MSG91 widget this always happens (the backend
      // verifies consumer tokens against a separate account) — so don't ask the
      // user to re-enter a code that was actually correct. Surface an accurate
      // message and offer the guest path instead of a dead-end retry loop.
      if (e?.code === 'invalid_credentials') {
        setOtpErr(undefined);
        showToast(
          'Login unavailable',
          'Server rejected the login (OTP config). Browse as guest for now.',
          'alert-circle',
          { label: 'Browse', onPress: () => navigation.popToTop() },
        );
      } else {
        setOtpErr(e?.message ?? 'Invalid or expired OTP.');
      }
    } finally {
      setVerifying(false);
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
          <Pressable onPress={() => (step === 'otp' ? setStep('phone') : navigation.goBack())}>
            <Text style={{ fontFamily: 'SpaceMono_700Bold', fontSize: 11, color: C.ink, letterSpacing: 1 }}>{'[ ◀ BACK ]'}</Text>
          </Pressable>
          <AsciiDivider style={{ marginTop: 8 }} />

          {step === 'phone' ? (
            <>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(48), color: C.ink, letterSpacing: -2, lineHeight: rf(48), marginTop: 24 }}>YOUR{'\n'}NUMBER.</Text>
              <Text style={[T.body, { color: C.dim, marginTop: 10 }]}>We'll text you a one-time code. No passwords.</Text>

              <View style={{ marginTop: 36 }}>
                <BrutalInput
                  label={`Mobile (+${DEFAULT_DIAL_CODE})`}
                  value={phone}
                  onChangeText={setPhone}
                  icon="smartphone"
                  keyboardType="phone-pad"
                  placeholder="98765 43210"
                  maxLength={14}
                  autoFocus
                  returnKeyType="go"
                  onSubmitEditing={handleSend}
                  error={phoneErr}
                />
              </View>

              <BrutalButton
                label={sending ? 'Sending…' : 'Send code'}
                iconRight="arrow-right"
                onPress={handleSend}
                disabled={sending}
                block
              />
            </>
          ) : (
            <>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(48), color: C.ink, letterSpacing: -2, lineHeight: rf(48), marginTop: 24 }}>ENTER{'\n'}CODE.</Text>
              <Text style={[T.body, { color: C.dim, marginTop: 10 }]}>Sent to +{DEFAULT_DIAL_CODE} {phone}.</Text>

              <View style={{ marginTop: 36 }}>
                <OtpBoxes
                  value={otp}
                  onChange={(v) => { setOtp(v); if (otpErr) setOtpErr(undefined); }}
                  onComplete={handleVerify}
                  error={otpErr}
                />
              </View>

              <BrutalButton
                label={verifying ? 'Verifying…' : 'Verify & continue'}
                iconRight="arrow-right"
                onPress={handleVerify}
                disabled={verifying}
                block
              />

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SP.l }}>
                <Pressable onPress={() => { setStep('phone'); setOtp(''); setOtpErr(undefined); }} hitSlop={10}>
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: C.ink, textDecorationLine: 'underline' }}>Edit number</Text>
                </Pressable>
                <Pressable onPress={handleResend} disabled={resendIn > 0} hitSlop={10}>
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: resendIn > 0 ? C.dim : C.ink, textDecorationLine: resendIn > 0 ? 'none' : 'underline' }}>
                    {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
                  </Text>
                </Pressable>
              </View>
            </>
          )}

          <Text style={{ fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: C.dim, textAlign: 'center', marginTop: 28, letterSpacing: 1 }}>
            BY CONTINUING YOU ACCEPT TERMS · PRIVACY
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

export default PhoneAuthScreen;
