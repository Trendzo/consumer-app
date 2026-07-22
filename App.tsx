import 'react-native-gesture-handler';
import React from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { RobotoMono_400Regular, RobotoMono_500Medium, RobotoMono_700Bold } from '@expo-google-fonts/roboto-mono';

import { AppProvider } from './src/state/AppState';
import RootNav from './src/navigation/RootNav';

// ─── Production error boundary — shows the real crash instead of blank screen ──
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null };
  static getDerivedStateFromError(e: Error) { return { error: e }; }
  componentDidCatch(e: Error, info: any) {
    console.error('[Trendzo crash]', e, info?.componentStack);
  }
  render() {
    const { error } = this.state;
    if (error) {
      return (
        <View style={{ flex: 1, backgroundColor: '#000', padding: 24, paddingTop: 80 }}>
          <Text style={{ color: '#fff', fontFamily: 'monospace', fontSize: 12, fontWeight: 'bold', marginBottom: 12 }}>
            {'[ TRENDZO · CRASH REPORT ]'}
          </Text>
          <ScrollView>
            <Text style={{ color: '#ff4444', fontFamily: 'monospace', fontSize: 11 }}>
              {(error as any)?.message || String(error)}
            </Text>
            <Text style={{ color: '#888', fontFamily: 'monospace', fontSize: 10, marginTop: 12 }}>
              {(error as any)?.stack || ''}
            </Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  // Typography swap — the family names below are the SAME keys the whole app
  // already references (e.g. `fontFamily: 'Inter_900Black'`), so we re-alias
  // them to the new fonts here instead of editing hundreds of call sites:
  //   • headings (the black weight) → Helvetica Neue Black (bundled .ttf)
  //   • everything else (Inter body weights + the old Space Mono) → Roboto Mono,
  //     giving the typewriter/monospaced look for all non-heading text.
  const [loaded] = useFonts({
    // Headings
    Inter_900Black: require('./assets/fonts/HelveticaNeueBlack.ttf'),
    // Body / all other text → Roboto Mono (typewriter)
    Inter_700Bold: RobotoMono_700Bold,
    Inter_600SemiBold: RobotoMono_500Medium,
    Inter_500Medium: RobotoMono_500Medium,
    Inter_400Regular: RobotoMono_400Regular,
    // Existing mono accents keep their keys, now also Roboto Mono
    SpaceMono_400Regular: RobotoMono_400Regular,
    SpaceMono_700Bold: RobotoMono_700Bold,
  });

  if (!loaded) {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#000" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <AppProvider>
            <RootNav />
          </AppProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
