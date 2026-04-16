import 'react-native-gesture-handler';
import React from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_900Black,
} from '@expo-google-fonts/inter';
import { SpaceMono_400Regular, SpaceMono_700Bold } from '@expo-google-fonts/space-mono';

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
    console.error('[ClosetX crash]', e, info?.componentStack);
  }
  render() {
    const { error } = this.state;
    if (error) {
      return (
        <View style={{ flex: 1, backgroundColor: '#000', padding: 24, paddingTop: 80 }}>
          <Text style={{ color: '#fff', fontFamily: 'monospace', fontSize: 12, fontWeight: 'bold', marginBottom: 12 }}>
            {'[ CLOSET-X · CRASH REPORT ]'}
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
  const [loaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_900Black,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
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
