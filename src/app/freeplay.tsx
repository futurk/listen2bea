import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AudioCredits } from '@/components/AudioCredits';
import { Attribution } from '@/components/Attribution';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { LanguagePicker } from '@/components/LanguagePicker';
import { Screen } from '@/components/Screen';
import { useFreeplayPlaylist } from '@/hooks/useFreeplayPlaylist';
import { useSentenceQueue } from '@/hooks/useSentenceQueue';
import { useSettings } from '@/hooks/useSettings';
import type { LanguageCode } from '@/lib/languages';
import { firstTranslationWithAudio } from '@/lib/tatoeba';

export default function FreeplayScreen() {
  const { settings, update } = useSettings();
  const { sentences, sentencesRef, loading, error, hasMore, loadMore } =
    useSentenceQueue({
      from: settings.from,
      to: settings.to,
      limit: 40,
      requireTranslationAudio: true,
    });
  const {
    currentIndex,
    currentSentence,
    playing,
    fetchingMore,
    playbackError,
    play,
    pause,
    next,
    previous,
    reset,
    restart,
    fetchMore,
  } = useFreeplayPlaylist({
    sentences,
    sentencesRef,
    loadMore,
    settings,
  });

  const [showTranslation, setShowTranslation] = useState(false);

  const translation = currentSentence ? firstTranslationWithAudio(currentSentence) : null;
  const originalAudio = currentSentence?.audios[0];
  const translationAudio = translation?.audios[0];

  const togglePlayback = () => {
    if (fetchingMore) {
      return;
    }
    if (playing) {
      pause();
    } else {
      play();
    }
  };

  const changeIndex = (delta: number) => {
    if (fetchingMore) {
      return;
    }
    if (delta > 0) {
      next();
    } else {
      previous();
    }
  };

  const changeLanguage = (key: 'from' | 'to', value: LanguageCode) => {
    reset();
    setShowTranslation(false);
    update(key, value);
  };

  const changePause = (value: number) => {
    const nextSettings = { ...settings, pauseSeconds: value };
    update('pauseSeconds', value);
    restart(nextSettings);
  };

  const toggleRepeat = () => {
    const nextSettings = {
      ...settings,
      repeatOriginal: !settings.repeatOriginal,
    };
    update('repeatOriginal', nextSettings.repeatOriginal);
    restart(nextSettings);
  };

  return (
    <Screen>
      <View style={styles.languageRow}>
        <LanguagePicker
          label="Practice"
          value={settings.from}
          onChange={(value) => changeLanguage('from', value)}
        />
        <LanguagePicker
          label="Translate"
          value={settings.to}
          onChange={(value) => changeLanguage('to', value)}
        />
      </View>

      <Text style={styles.tracker}>
        {fetchingMore
          ? 'Loading more…'
          : loading
            ? 'Loading…'
            : sentences.length > 0
              ? `${currentIndex + 1} / ${sentences.length}`
              : ' '}
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {playbackError ? <Text style={styles.error}>{playbackError}</Text> : null}

      <View style={styles.sentenceBox}>
        {loading && sentences.length === 0 ? <ActivityIndicator /> : null}
        {currentSentence ? (
          <Text style={styles.sentence}>{currentSentence.text}</Text>
        ) : null}
        {currentSentence && showTranslation && translation ? (
          <Text style={styles.translation}>{translation.text}</Text>
        ) : null}
      </View>

      <View style={styles.controlRow}>
        <IconButton
          name="chevron-back"
          accessibilityLabel="Previous sentence"
          onPress={() => changeIndex(-1)}
          disabled={fetchingMore || !currentSentence || currentIndex <= 0}
        />
        <IconButton
          name={fetchingMore ? 'hourglass-outline' : playing ? 'pause' : 'play'}
          accessibilityLabel={
            fetchingMore ? 'Loading more sentences' : playing ? 'Pause' : 'Play'
          }
          onPress={togglePlayback}
          disabled={fetchingMore || !currentSentence}
          variant="primary"
          size={24}
        />
        <IconButton
          name="chevron-forward"
          accessibilityLabel="Next sentence"
          onPress={() => changeIndex(1)}
          disabled={
            fetchingMore ||
            !currentSentence ||
            currentIndex >= sentences.length - 1
          }
        />
      </View>

      <View style={styles.optionRow}>
        <IconButton
          name={showTranslation ? 'eye-off-outline' : 'eye-outline'}
          accessibilityLabel={
            showTranslation ? 'Hide translation' : 'Show translation'
          }
          onPress={() => setShowTranslation((value) => !value)}
          disabled={!translation}
          active={showTranslation}
        />
        <IconButton
          name="repeat"
          accessibilityLabel={`Repeat original ${settings.repeatOriginal ? 'on' : 'off'}`}
          onPress={toggleRepeat}
          active={settings.repeatOriginal}
        />
      </View>

      <View style={styles.pauseRow}>
        <Text style={styles.pauseLabel}>Pause: {settings.pauseSeconds}s</Text>
        <IconButton
          name="remove"
          accessibilityLabel="Decrease pause length"
          onPress={() => changePause(Math.max(1, settings.pauseSeconds - 1))}
          disabled={settings.pauseSeconds <= 1}
          size={20}
        />
        <IconButton
          name="add"
          accessibilityLabel="Increase pause length"
          onPress={() => changePause(Math.min(5, settings.pauseSeconds + 1))}
          disabled={settings.pauseSeconds >= 5}
          size={20}
        />
      </View>

      {currentSentence && currentIndex >= sentences.length - 1 ? (
        <Button
          label={
            fetchingMore
              ? 'Loading more…'
              : hasMore
                ? 'Fetch more sentences'
                : 'No more sentences'
          }
          icon={hasMore ? 'add-circle-outline' : 'checkmark-circle-outline'}
          onPress={fetchMore}
          disabled={fetchingMore || !hasMore}
        />
      ) : null}

      <AudioCredits original={originalAudio} translation={translationAudio} />
      <Attribution />
    </Screen>
  );
}

const styles = StyleSheet.create({
  languageRow: {
    flexDirection: 'row',
    gap: 12,
  },
  tracker: {
    fontSize: 13,
    color: '#666666',
    textAlign: 'center',
    minHeight: 18,
  },
  error: {
    fontSize: 14,
    color: '#b00020',
    textAlign: 'center',
  },
  sentenceBox: {
    minHeight: 140,
    borderWidth: 1,
    borderColor: '#dddddd',
    borderRadius: 6,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  sentence: {
    fontSize: 22,
    lineHeight: 30,
    textAlign: 'center',
    color: '#111111',
  },
  translation: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: '#555555',
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  pauseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  pauseLabel: {
    fontSize: 15,
    color: '#111111',
  },
});
