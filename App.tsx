import 'react-native-gesture-handler';
import React from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { RobotoMono_400Regular, RobotoMono_500Medium, RobotoMono_600SemiBold, RobotoMono_700Bold } from '@expo-google-fonts/roboto-mono';

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
  // Typography — the original brutalist stack: Helvetica Neue Black for the
  // black/heading weight, Roboto Mono (typewriter) for everything else. The
  // family keys below are the SAME strings the whole codebase references
  // (e.g. `Inter_700Bold`), re-aliased here so we don't touch call sites.
  // (No real Inter — only these two fonts are used.)
  const [loaded] = useFonts({
    // Headings → Helvetica Neue Black (bundled)
    Inter_900Black: require('./assets/fonts/HelveticaNeueBlack.ttf'),
    // Everything else → Roboto Mono weights
    Inter_700Bold: RobotoMono_700Bold,
    Inter_600SemiBold: RobotoMono_600SemiBold,
    Inter_500Medium: RobotoMono_500Medium,
    Inter_400Regular: RobotoMono_400Regular,
    SpaceMono_400Regular: RobotoMono_400Regular,
    SpaceMono_700Bold: RobotoMono_700Bold,
  });

  if (!loaded) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000' }}>
        <SafeAreaProvider>
          <AppProvider>
            <RootNav />
          </AppProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
