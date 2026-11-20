import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerTitleAlign: 'center' }}>
        <Stack.Screen name="index" options={{ title: 'Listen2Bea' }} />
        <Stack.Screen name="freeplay" options={{ title: 'Freeplay' }} />
        <Stack.Screen name="dictation" options={{ title: 'Dictation' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
