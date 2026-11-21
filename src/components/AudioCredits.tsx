import { Linking, StyleSheet, Text } from 'react-native';
import { useAppTheme } from '@/lib/theme';
import type { Audio } from '@/lib/types';

interface AudioCreditsProps {
  original?: Audio;
  translation?: Audio;
}

const profileUrl = (author: string): string =>
  `https://tatoeba.org/en/user/profile/${encodeURIComponent(author)}`;

function AudioLink({ audio }: { audio: Audio }) {
  const theme = useAppTheme();

  return (
    <Text
      style={[styles.link, { color: theme.accent }]}
      accessibilityRole="link"
      onPress={() => Linking.openURL(audio.attribution_url ?? profileUrl(audio.author))}
    >
      {audio.author}
    </Text>
  );
}

export function AudioCredits({ original, translation }: AudioCreditsProps) {
  const theme = useAppTheme();

  if (!original && !translation) {
    return null;
  }

  return (
    <Text style={[styles.text, { color: theme.textMuted }]}>
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
  },
  link: {
    textDecorationLine: 'underline',
  },
});
