// Resolves where the shopper is, once, at app open.
//
// APP STORE REVIEW — guideline 5.1.1(iv). This sheet is a "pre-permission"
// screen: it appears BEFORE the system location dialog. Apple allows that (and
// encourages explaining why you are asking), but the controls on it must not
// steer the answer. Build 1.0.5(6) was rejected because the primary button read
// "Allow location access": a custom button that says "Allow" reads as part of
// the system prompt and pushes the user toward granting. The button is neutral
// ("Continue") and MUST STAY neutral — do not reintroduce "Allow", "Enable",
// "Turn on", "Grant", or a crosshair/locate glyph on it. The copy above it may
// explain the purpose; the button may not lobby for an answer.
//
// The order matters and is the whole point of this component:
//
//   1. Already know a place (persisted from a previous launch) → say nothing, use it.
//   2. Permission already granted → read a fix silently. No dialog for someone who agreed once.
//   3. Nothing decided yet → explain why we are asking, then show the system dialog.
//   4. Refused, or the fix failed, or Android has stopped allowing the dialog → offer the map.
//      A refusal is an answer, not a dead end: the shopper picks the spot themselves and the
//      app is fully usable either way.
//
// Mounted once next to AuthSheet in RootNav, so it covers app open regardless of which tab the
// shopper lands on, and there is exactly one of it.

import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Linking } from 'react-native';
import { MotiView } from 'moti';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { C, T, SP, BORDER } from '../theme/brutal';
import { BrutalButton } from './Brutal';
import { MapPicker } from './MapPicker';
import {
  getPermissionState, requestPermission, captureCurrentLocation, describeCoords,
} from '../services/geo';
import {
  getPlace, hasAsked, hydratePlace, markAsked, setPlace, subscribeLocationPick, usePlace,
} from '../state/location';

type Step =
  /** Deciding — nothing on screen. */
  | 'idle'
  /** Asking for permission, in our own words, before the system dialog. */
  | 'ask'
  /** Refused or unavailable: the map is the way forward. */
  | 'manual'
  /** Reading a fix from the device. */
  | 'working';

export function LocationGate({ active = true }: { active?: boolean }) {
  const insets = useSafeAreaInsets();
  const place = usePlace();
  const [step, setStep] = useState<Step>('idle');
  const [mapOpen, setMapOpen] = useState(false);
  /**
   * The system will not present its dialog again — the shopper has already
   * refused, or the OS has stopped offering. Only then is a pointer to Settings
   * appropriate: offering it before they have been asked once is another way of
   * pressing for the permission, which is the thing 5.1.1(iv) prohibits.
   */
  const [blocked, setBlocked] = useState(false);

  // Waits for `active` (RootNav passes phase === 'main'): the ask used to fire
  // the moment the app booted, so the sheet popped over the SPLASH. Now it
  // asks only once the shopper is actually on the home page.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    (async () => {
      await hydratePlace();
      if (cancelled) return;
      // (1) A known place is enough. Refreshing it silently on every launch would spin the GPS
      // for a value that rarely changes; the shopper can re-pick from the header any time.
      if (getPlace()) return;

      const perm = await getPermissionState();
      if (cancelled) return;

      // (2) Already granted: no dialog, just read it.
      if (perm.granted) {
        setStep('working');
        const res = await captureCurrentLocation();
        if (cancelled) return;
        if (res.ok) {
          await setPlace({
            coords: res.coords,
            city: res.city ?? null,
            postalCode: res.postalCode ?? null,
            region: res.region ?? null,
            source: 'gps',
          });
          setStep('idle');
          return;
        }
        // Granted but no fix (indoors, radio off). The map still works.
        setStep('manual');
        return;
      }

      // (4) The system will not show the dialog again — go straight to the map.
      if (!perm.canAskAgain) { setBlocked(true); setStep(hasAsked() ? 'idle' : 'manual'); return; }

      // (3) Never asked, or asked and dismissed without a decision.
      setStep('ask');
    })();
    return () => { cancelled = true; };
  }, [active]);

  // A header tap ("change location") opens the same picker as the gate's own fallback.
  useEffect(() => subscribeLocationPick(() => setMapOpen(true)), []);

  /**
   * Hands off to the SYSTEM dialog. Named for what it does — continue the flow —
   * not for the answer we would like; see the 5.1.1(iv) note at the top.
   */
  const proceed = async () => {
    setStep('working');
    const granted = await requestPermission();
    await markAsked();
    if (!granted) {
      // Refusing is a valid answer, not a failure: fall through to the map so the
      // app is fully usable, and note that the dialog is spent so the Settings
      // pointer becomes relevant.
      const after = await getPermissionState();
      setBlocked(!after.canAskAgain);
      setStep('manual');
      return;
    }
    const res = await captureCurrentLocation();
    if (!res.ok) { setStep('manual'); return; }
    await setPlace({
      coords: res.coords,
      city: res.city ?? null,
      postalCode: res.postalCode ?? null,
      region: res.region ?? null,
      source: 'gps',
    });
    setStep('idle');
  };

  const dismiss = async () => {
    // Dismissing is allowed — browsing does not require a location, only delivery does. But it
    // counts as answered, so the sheet does not reappear on every launch.
    await markAsked();
    setStep('idle');
  };

  const open = step === 'ask' || step === 'manual' || step === 'working';

  return (
    <>
      <Modal transparent visible={open && !mapOpen} animationType="none" onRequestClose={dismiss}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable onPress={dismiss} style={StyleSheet.absoluteFill}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} />
          </Pressable>
          <MotiView
            from={{ translateY: 400 }}
            animate={{ translateY: 0 }}
            transition={{ type: 'timing', duration: 280 }}
            onStartShouldSetResponder={() => true}
            style={[
              { backgroundColor: '#fff', paddingHorizontal: SP.l, paddingTop: SP.l, paddingBottom: insets.bottom + SP.l },
              BORDER(1),
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Feather name="map-pin" size={20} color={C.ink} />
              <Pressable onPress={dismiss} hitSlop={12}>
                <Feather name="x" size={18} color={C.ink} />
              </Pressable>
            </View>

            {step === 'manual' ? (
              <>
                <Text style={[T.h2, { textTransform: 'uppercase', marginTop: SP.m }]}>Where are you?</Text>
                <Text style={[T.caption, { color: C.dim, marginTop: 6 }]}>
                  No problem — place the pin yourself and we'll show what's deliverable near you.
                </Text>
                <BrutalButton
                  label="Set location on map"
                  iconRight="arrow-right"
                  onPress={() => setMapOpen(true)}
                  block
                  style={{ marginTop: SP.l }}
                />
                {/* Only once the system will no longer ask. Apple's own guidance for
                    a declined permission: tell the user where the switch lives
                    rather than re-prompting them. */}
                {blocked && (
                  <Pressable onPress={() => Linking.openSettings().catch(() => {})} hitSlop={10} style={{ alignSelf: 'center', marginTop: SP.m }}>
                    <Text style={[T.caption, { color: C.ink, textDecorationLine: 'underline' }]}>
                      Location is off for Trendzo · open Settings
                    </Text>
                  </Pressable>
                )}
                <Pressable onPress={dismiss} hitSlop={10} style={{ alignSelf: 'center', marginTop: SP.m }}>
                  <Text style={[T.caption, { color: C.dim, textDecorationLine: 'underline' }]}>Not now</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={[T.h2, { textTransform: 'uppercase', marginTop: SP.m }]}>Shop what's near you</Text>
                {/* Explaining the purpose before the system dialog is allowed, and
                    is the reason this sheet exists. It states what the data is for
                    and what happens next — it does not ask for a decision. */}
                <Text style={[T.caption, { color: C.dim, marginTop: 6 }]}>
                  Your location decides which stores can reach you and how fast. It is used for
                  delivery only and is not shared with anyone.
                </Text>
                <Text style={[T.caption, { color: C.dim, marginTop: 8 }]}>
                  Next, iOS will ask whether to share it. You can also set your location by hand,
                  and change it any time from the home screen.
                </Text>
                {/* NEUTRAL. See the 5.1.1(iv) note at the top of this file — this
                    label must not advocate for the permission. */}
                <BrutalButton
                  label={step === 'working' ? 'Locating…' : 'Continue'}
                  iconRight="arrow-right"
                  onPress={proceed}
                  disabled={step === 'working'}
                  block
                  style={{ marginTop: SP.l }}
                />
                <Pressable onPress={() => setMapOpen(true)} hitSlop={10} style={{ alignSelf: 'center', marginTop: SP.m }}>
                  <Text style={[T.caption, { color: C.ink, textDecorationLine: 'underline' }]}>
                    Set my location manually
                  </Text>
                </Pressable>
              </>
            )}
          </MotiView>
        </View>
      </Modal>

      <MapPicker
        visible={mapOpen}
        initial={place?.coords ?? null}
        title="Set your location"
        onCancel={() => setMapOpen(false)}
        onConfirm={async (picked) => {
          await setPlace({ ...picked, source: 'manual' });
          await markAsked();
          setMapOpen(false);
          setStep('idle');
        }}
      />
    </>
  );
}

export default LocationGate;
