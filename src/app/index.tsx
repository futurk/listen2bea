import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Attribution } from '@/components/Attribution';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <Screen>
      <View style={styles.main}>
        <Text style={styles.title}>Listen2Bea</Text>
        <Text style={styles.subtitle}>Practice listening with Tatoeba sentences.</Text>

        <Button
          label="Freeplay"
          variant="primary"
          onPress={() => router.push('/freeplay')}
          style={styles.button}
        />
        <Button
          label="Dictation"
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
    color: '#111111',
  },
  subtitle: {
    fontSize: 15,
    color: '#555555',
    marginBottom: 12,
  },
  button: {
    width: '100%',
  },
});
