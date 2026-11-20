import { Linking, StyleSheet, Text } from 'react-native';
import type { Audio } from '@/lib/types';

interface AudioCreditsProps {
  original?: Audio;
  translation?: Audio;
}

const profileUrl = (author: string): string =>
  `https://tatoeba.org/en/user/profile/${encodeURIComponent(author)}`;

function AudioLink({ audio }: { audio: Audio }) {
  return (
    <Text
      style={styles.link}
      accessibilityRole="link"
      onPress={() => Linking.openURL(audio.attribution_url ?? profileUrl(audio.author))}
    >
      {audio.author}
    </Text>
  );
}

export function AudioCredits({ original, translation }: AudioCreditsProps) {
  if (!original && !translation) {
    return null;
  }

  return (
    <Text style={styles.text}>
      Audio:{' '}
      {original ? <AudioLink audio={original} /> : null}
      {original && translation ? ' / ' : null}
      {translation ? <AudioLink audio={translation} /> : null}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 12,
    color: '#666666',
  },
  link: {
    textDecorationLine: 'underline',
  },
});
