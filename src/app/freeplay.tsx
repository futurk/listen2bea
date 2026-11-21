import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AudioCredits } from '@/components/AudioCredits';
import { Attribution } from '@/components/Attribution';
import { Button } from '@/components/Button';
import { LanguagePicker } from '@/components/LanguagePicker';
import { Screen } from '@/components/Screen';
import { useFreeplayPlaylist } from '@/hooks/useFreeplayPlaylist';
import { useSentenceQueue } from '@/hooks/useSentenceQueue';
import { useSettings } from '@/hooks/useSettings';
import type { LanguageCode } from '@/lib/languages';
import { firstTranslationWithAudio } from '@/lib/tatoeba';

export default function FreeplayScreen() {
  const { settings, update } = useSettings();
  const { sentences, sentencesRef, loading, error, loadMore } = useSentenceQueue({
    from: settings.from,
    to: settings.to,
    requireTranslationAudio: true,
  });
  const {
    currentIndex,
    currentSentence,
    playing,
    preparing,
    playbackError,
    play,
    pause,
    next,
    previous,
    reset,
    restart,
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
    if (preparing) {
      return;
    }
    if (playing) {
      pause();
    } else {
      play();
    }
  };

  const changeIndex = (delta: number) => {
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
        {preparing
          ? 'Preparing…'
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
        <Button
          label="Prev"
          onPress={() => changeIndex(-1)}
          disabled={preparing || !currentSentence || currentIndex <= 0}
          style={styles.control}
        />
        <Button
          label={preparing ? 'Preparing…' : playing ? 'Pause' : 'Play'}
          onPress={togglePlayback}
          disabled={preparing || !currentSentence}
          variant="primary"
          style={styles.control}
        />
        <Button
          label="Next"
          onPress={() => changeIndex(1)}
          disabled={
            preparing || !currentSentence || currentIndex >= sentences.length - 1
          }
          style={styles.control}
        />
      </View>

      <View style={styles.optionRow}>
        <Button
          label={showTranslation ? 'Hide translation' : 'Show translation'}
          onPress={() => setShowTranslation((value) => !value)}
          disabled={!translation}
          style={styles.option}
        />
        <Button
          label={`Repeat original: ${settings.repeatOriginal ? 'On' : 'Off'}`}
          onPress={toggleRepeat}
          style={styles.option}
        />
      </View>

      <View style={styles.pauseRow}>
        <Text style={styles.pauseLabel}>Pause: {settings.pauseSeconds}s</Text>
        <Button
          label="-"
          onPress={() => changePause(Math.max(1, settings.pauseSeconds - 1))}
          disabled={settings.pauseSeconds <= 1}
        />
        <Button
          label="+"
          onPress={() => changePause(Math.min(5, settings.pauseSeconds + 1))}
          disabled={settings.pauseSeconds >= 5}
        />
      </View>

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
    gap: 8,
  },
  control: {
    flex: 1,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  option: {
    flex: 1,
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
