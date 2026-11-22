import { Linking, StyleSheet, Text } from 'react-native';
import { useAppTheme } from '@/lib/theme';

export function Attribution() {
  const theme = useAppTheme();

  return (
    <Text style={[styles.text, { color: theme.textMuted }]}>
      Data from{' '}
      <Text
        style={[styles.link, { color: theme.accent }]}
        accessibilityRole="link"
        onPress={() => Linking.openURL('https://tatoeba.org')}
      >
        Tatoeba
      </Text>
      {'. Source code is on '}
      <Text
        style={[styles.link, { color: theme.accent }]}
        accessibilityRole="link"
        onPress={() => Linking.openURL('https://github.com/futurk/listen2bea')}
      >
        GitHub
      </Text>
      {'. Please consider contributing or donating if you find this tool useful.'}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  link: {
    textDecorationLine: 'underline',
  },
});
