// Global bottom-sheet login — phone + OTP, no dedicated page. Opened via
// useApp().requireAuth() whenever a guest attempts to buy/checkout; the
// pending action resumes automatically the moment sign-in succeeds.
import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { View, Text, Pressable, TextInput, KeyboardAvoidingView, Platform, Dimensions, StyleSheet, Modal } from 'react-native';
import { MotiView } from 'moti';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { C, T, SP, BORDER, rf } from '../theme/brutal';
import { BrutalButton, BrutalInput } from './Brutal';
import { useApp } from '../state/AppState';
import { authBus } from '../state/uiBus';
import { sendOtp, resendOtp, verifyOtp, consumerOtpLogin } from '../services/auth';
import { DEFAULT_DIAL_CODE } from '../config/env';

const { height: SCREEN_H } = Dimensions.get('window');
const NATIONAL_RE = /^[0-9]{6,14}$/;
const RESEND_SECONDS = 30;
const OTP_LEN = 4;

// 4-box OTP entry — one hidden full-width input owns the keyboard; the boxes
// just render each digit, so paste/SMS-autofill drops all 4 in at once.
function OtpBoxes({
  value,
  onChange,
  onComplete,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (code: string) => void;
  error?: string;
}) {
  const inputRef = useRef<TextInput | null>(null);
  const digits = Array.from({ length: OTP_LEN }, (_, i) => value[i] ?? '');
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
                { width: 52, height: 60, alignItems: 'center', justifyContent: 'center' },
                BORDER(error || active ? 2 : 1),
                error ? { borderColor: '#c1121f' } : active ? { borderColor: C.dim } : null,
              ]}
            >
              <Text style={{ fontFamily: 'SpaceMono_700Bold', fontSize: 24, color: C.ink }}>{d}</Text>
            </View>
          );
        })}
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

export function AuthSheet() {
  // Sheet state comes from the uiBus — only this component re-renders when
  // requireAuth() opens/closes it, same pattern as BrutalToast/BrutalConfirm.
  const data = useSyncExternalStore(authBus.subscribe, authBus.get);
  const { signInWithSession, showToast, hideAuthSheet } = useApp();
  const insets = useSafeAreaInsets();
  const open = !!data;

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [reqId, setReqId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [phoneErr, setPhoneErr] = useState<string | undefined>();
  const [otpErr, setOtpErr] = useState<string | undefined>();
  const [resendIn, setResendIn] = useState(0);

  // Reset the form whenever the sheet closes so the next buy attempt (a
  // different product/order) always starts from a clean phone step.
  useEffect(() => {
    if (open) return;
    setStep('phone'); setPhone(''); setOtp(''); setReqId(null);
    setPhoneErr(undefined); setOtpErr(undefined); setResendIn(0);
  }, [open]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const handleSend = async () => {
    setPhoneErr(undefined);
    const national = phone.replace(/\D/g, '');
    if (!NATIONAL_RE.test(national)) { setPhoneErr('Enter a valid mobile number'); return; }
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

  const handleVerify = async (codeArg?: unknown) => {
    setOtpErr(undefined);
    const code = (typeof codeArg === 'string' ? codeArg : otp).replace(/\D/g, '');
    if (code.length < 4 || !reqId) { setOtpErr('Enter the code we sent you'); return; }
    setVerifying(true);
    try {
      const accessToken = await verifyOtp(reqId, code);
      const session = await consumerOtpLogin(accessToken);
      await signInWithSession(session);
      const onSuccess = data?.onSuccess;
      hideAuthSheet();
      showToast('Welcome to Trendzo', undefined, 'check');
      onSuccess?.();
    } catch (e: any) {
      // Same MSG91/backend token mismatch as the old phone-auth screen — the
      // code itself was correct, so don't dead-end the user on a retry loop.
      if (e?.code === 'invalid_credentials') {
        hideAuthSheet();
        showToast('Login unavailable', 'Server rejected the login (OTP config). Browse as guest for now.', 'alert-circle');
      } else {
        setOtpErr(e?.message ?? 'Invalid or expired OTP.');
      }
    } finally {
      setVerifying(false);
    }
  };

  if (!data) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={hideAuthSheet}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable onPress={hideAuthSheet} style={StyleSheet.absoluteFill}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} />
        </Pressable>
        <MotiView
          from={{ translateY: SCREEN_H }}
          animate={{ translateY: 0 }}
          transition={{ type: 'timing', duration: 280 }}
          onStartShouldSetResponder={() => true}
          style={[{ backgroundColor: '#fff', paddingBottom: insets.bottom + SP.l }, BORDER(2)]}
        >
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SP.l, paddingTop: SP.l }}>
            <Text style={{ fontFamily: 'Inter_900Black', fontSize: 12, color: C.ink, letterSpacing: 1 }}>
              {step === 'phone' ? 'SIGN IN TO CONTINUE' : 'ENTER CODE'}
            </Text>
            <Pressable onPress={hideAuthSheet} hitSlop={12}>
              <Feather name="x" size={18} color={C.ink} />
            </Pressable>
          </View>

          <View style={{ paddingHorizontal: SP.l, paddingTop: SP.m }}>
            {step === 'phone' ? (
              <>
                <Text style={{ fontFamily: 'Inter_900Black', fontSize: rf(30), color: C.ink, letterSpacing: -1, lineHeight: rf(32) }}>ONE STEP{'\n'}TO CHECKOUT.</Text>
                <Text style={[T.body, { color: C.dim, marginTop: 8 }]}>We'll text you a one-time code. No passwords.</Text>
                <View style={{ marginTop: 24 }}>
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
                <BrutalButton label={sending ? 'Sending…' : 'Send code'} iconRight="arrow-right" onPress={handleSend} disabled={sending} block />
              </>
            ) : (
              <>
                <Text style={[T.body, { color: C.dim, marginBottom: 8 }]}>Sent to +{DEFAULT_DIAL_CODE} {phone}.</Text>
                <OtpBoxes value={otp} onChange={(v) => { setOtp(v); if (otpErr) setOtpErr(undefined); }} onComplete={handleVerify} error={otpErr} />
                <BrutalButton label={verifying ? 'Verifying…' : 'Verify & continue'} iconRight="arrow-right" onPress={handleVerify} disabled={verifying} block />
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
          </View>
        </MotiView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default AuthSheet;
