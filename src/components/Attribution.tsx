import { Linking, StyleSheet, Text } from 'react-native';

export function Attribution() {
  return (
    <Text style={styles.text}>
      Data from{' '}
      <Text
        style={styles.link}
        accessibilityRole="link"
        onPress={() => Linking.openURL('https://tatoeba.org')}
      >
        Tatoeba
      </Text>
      . Please consider contributing or donating if you find this useful.
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 12,
    lineHeight: 18,
    color: '#666666',
    marginTop: 8,
  },
  link: {
    textDecorationLine: 'underline',
  },
});
