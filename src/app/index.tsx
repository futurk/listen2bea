import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Attribution } from '@/components/Attribution';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { useAppTheme } from '@/lib/theme';

export default function HomeScreen() {
  const router = useRouter();
  const theme = useAppTheme();

  return (
    <Screen>
      <View style={styles.main}>
        <Text style={[styles.title, { color: theme.text }]}>Listen2Bea</Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>
          Practice listening with Tatoeba sentences.
        </Text>

        <Button
          label="Freeplay"
          icon="headset"
          variant="primary"
          onPress={() => router.push('/freeplay')}
          style={styles.button}
        />
        <Button
          label="Dictation"
          icon="pencil"
          onPress={() => router.push('/dictation')}
          style={styles.button}
        />
      </View>

      <Attribution />
    </Screen>
  );
}

const styles = StyleSheet.create({
  main: {
    flex: 1,
    gap: 12,
    paddingTop: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 15,
    marginBottom: 12,
  },
  button: {
    width: '100%',
  },
});
