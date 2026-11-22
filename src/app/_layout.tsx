import { setAudioModeAsync } from 'expo-audio';
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  type Theme,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAppTheme } from '@/lib/theme';

export default function RootLayout() {
  const scheme = useColorScheme();
  const theme = useAppTheme();

  useEffect(() => {
    // Background playback and lock-screen controls depend on this. Without
    // shouldPlayInBackground, expo-audio pauses playback when the activity
    // backgrounds, including when the screen locks.
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    }).catch((error) => {
      console.warn('Failed to configure audio mode', error);
    });
  }, []);

  const navigationTheme = useMemo<Theme>(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;

    return {
      ...base,
      colors: {
        ...base.colors,
        primary: theme.accent,
        background: theme.background,
        card: theme.surface,
        text: theme.text,
        border: theme.subtleBorder,
        notification: theme.accent,
      },
    };
  }, [scheme, theme]);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(theme.background).catch(() => {});
  }, [theme.background]);

  return (
    <SafeAreaProvider>
      <ThemeProvider value={navigationTheme}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerTitleAlign: 'center',
            headerStyle: { backgroundColor: theme.surface },
            headerTintColor: theme.text,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: theme.background },
          }}
        >
          <Stack.Screen name="index" options={{ title: 'Listen2Bea' }} />
          <Stack.Screen name="freeplay" options={{ title: 'Freeplay' }} />
          <Stack.Screen name="dictation" options={{ title: 'Dictation' }} />
        </Stack>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
