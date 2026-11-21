import { diffWords, type Change } from 'diff';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputInstance,
} from 'react-native';
import { AudioCredits } from '@/components/AudioCredits';
import { Attribution } from '@/components/Attribution';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { LanguagePairSelectors } from '@/components/LanguagePairSelectors';
import { Screen } from '@/components/Screen';
import { isAbortError, useClipPlayer } from '@/hooks/useClipPlayer';
import { useSentenceQueue } from '@/hooks/useSentenceQueue';
import { useSettings } from '@/hooks/useSettings';
import type { LanguageCode } from '@/lib/languages';
import { audioFileUrl } from '@/lib/tatoeba';

export default function DictationScreen() {
  const { settings, update } = useSettings();
  const { sentences, loading, error, load, reset } = useSentenceQueue({
    from: settings.from,
    to: settings.to,
    requireTranslationAudio: false,
    enabled: false,
  });
  const { play: playClip, stop: stopClip } = useClipPlayer();

  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const inputRef = useRef<TextInputInstance>(null);

  const current = sentences[index];
  const translation = current?.translations[0] ?? null;
  const originalAudio = current?.audios[0];

  const differences: Change[] =
    checked && current ? diffWords(answer, current.text, { ignoreCase: true }) : [];

  const isPerfect =
    checked && differences.length > 0 && differences.every((part) => !part.added && !part.removed);

  useEffect(() => {
    if (current && !checked) {
      inputRef.current?.focus();
    }
  }, [current, checked]);

  const changeLanguage = (key: 'from' | 'to', value: LanguageCode) => {
    stopClip();
    reset();
    setIndex(0);
    setAnswer('');
    setChecked(false);
    setShowTranslation(false);
    setMessage(null);
    update(key, value);
  };

  const handleLoad = async () => {
    stopClip();
    setIndex(0);
    setAnswer('');
    setChecked(false);
    setShowTranslation(false);
    setMessage(null);
    await load(true);
  };

  const handlePlay = () => {
    if (!originalAudio) {
      return;
    }
    setMessage(null);
    void playClip(audioFileUrl(originalAudio)).catch((playbackError) => {
      if (!isAbortError(playbackError)) {
        setMessage('Audio unavailable for this sentence.');
      }
    });
  };

  const handleNext = () => {
    if (index >= sentences.length - 1) {
      return;
    }
    stopClip();
    setIndex((value) => value + 1);
    setAnswer('');
    setChecked(false);
    setShowTranslation(false);
    setMessage(null);
  };

  const handleJump = (delta: number) => {
    const next = Math.max(0, Math.min(sentences.length - 1, index + delta));
    if (next === index) {
      return;
    }
    stopClip();
    setIndex(next);
    setAnswer('');
    setChecked(false);
    setShowTranslation(false);
    setMessage(null);
  };

  const expectedParts = differences.filter((part) => !part.removed);
  const extraText = differences
    .filter((part) => part.removed)
    .map((part) => part.value)
    .join('')
    .trim();

  return (
    <Screen>
      <LanguagePairSelectors
        from={settings.from}
        to={settings.to}
        onFromChange={(value) => changeLanguage('from', value)}
        onToChange={(value) => changeLanguage('to', value)}
      />

      <Button
        label={loading ? 'Loading…' : 'Load sentences'}
        icon="cloud-download-outline"
        onPress={handleLoad}
        disabled={loading}
      />

      <Text style={styles.tracker}>
        {sentences.length > 0 ? `${index + 1} / ${sentences.length}` : ' '}
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.notice}>{message}</Text> : null}

      {loading && sentences.length === 0 ? <ActivityIndicator /> : null}

      {current ? (
        <>
          <View style={styles.audioRow}>
            <IconButton
              name="play"
              accessibilityLabel="Play audio"
              onPress={handlePlay}
              disabled={!originalAudio}
              variant="primary"
              size={24}
            />
            <IconButton
              name={showTranslation ? 'eye-off-outline' : 'eye-outline'}
              accessibilityLabel={
                showTranslation ? 'Hide translation' : 'Show translation'
              }
              tooltip={
                showTranslation ? 'Hides the translation.' : 'Shows the translation.'
              }
              onPress={() => setShowTranslation((value) => !value)}
              disabled={!translation}
              active={showTranslation}
            />
          </View>

          {showTranslation && translation ? (
            <Text style={styles.translation}>{translation.text}</Text>
          ) : null}

          <TextInput
            ref={inputRef}
            style={styles.input}
            value={answer}
            onChangeText={setAnswer}
            editable={!checked}
            placeholder="Type the sentence you hear"
            placeholderTextColor="#999999"
            autoCorrect={false}
            autoCapitalize="none"
            autoComplete="off"
            returnKeyType={checked ? 'next' : 'done'}
            onSubmitEditing={checked ? handleNext : () => setChecked(true)}
            blurOnSubmit={false}
          />

          {!checked ? (
            <Button
              label="Check"
              icon="checkmark"
              onPress={() => setChecked(true)}
              variant="primary"
              disabled={answer.trim().length === 0}
            />
          ) : (
            <View style={styles.result}>
              <Text style={styles.resultLabel}>
                {isPerfect ? 'Correct.' : 'Expected:'}
              </Text>
              <Text style={styles.expected}>
                {expectedParts.map((part, partIndex) => (
                  <Text
                    key={`${partIndex}-${part.value}`}
                    style={part.added ? styles.missing : undefined}
                  >
                    {part.value}
                  </Text>
                ))}
              </Text>
              {extraText ? (
                <Text style={styles.extra}>Extra words: {extraText}</Text>
              ) : null}
            </View>
          )}

          <View style={styles.navRow}>
            <IconButton
              name="chevron-back"
              accessibilityLabel="Previous sentence"
              onPress={() => handleJump(-1)}
              disabled={index <= 0}
            />
            <IconButton
              name="chevron-forward"
              accessibilityLabel="Next sentence"
              onPress={handleNext}
              disabled={index >= sentences.length - 1}
            />
          </View>

          <AudioCredits original={originalAudio} translation={translation?.audios[0]} />
        </>
      ) : (
        <Text style={styles.empty}>Press “Load sentences” to start.</Text>
      )}

      <Attribution />
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  notice: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  audioRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  translation: {
    fontSize: 16,
    lineHeight: 24,
    color: '#555555',
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#111111',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 96,
    textAlignVertical: 'top',
    color: '#111111',
  },
  result: {
    gap: 8,
  },
  resultLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111111',
  },
  expected: {
    fontSize: 16,
    lineHeight: 24,
    color: '#111111',
  },
  missing: {
    color: '#0a7a2f',
    fontWeight: '600',
  },
  extra: {
    fontSize: 14,
    color: '#b00020',
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  empty: {
    fontSize: 15,
    color: '#666666',
    textAlign: 'center',
  },
});
