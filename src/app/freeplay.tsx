import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AudioCredits } from '@/components/AudioCredits';
import { Attribution } from '@/components/Attribution';
import { Button } from '@/components/Button';
import { LanguagePicker } from '@/components/LanguagePicker';
import { Screen } from '@/components/Screen';
import { isAbortError, useClipPlayer } from '@/hooks/useClipPlayer';
import { useSentenceQueue } from '@/hooks/useSentenceQueue';
import { useSettings } from '@/hooks/useSettings';
import type { LanguageCode } from '@/lib/languages';
import { audioFileUrl, firstTranslationWithAudio } from '@/lib/tatoeba';

const sleep = (milliseconds: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    let timer: ReturnType<typeof setTimeout>;

    const finish = (action: () => void) => {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      action();
    };

    const onAbort = () =>
      finish(() => reject(new DOMException('Aborted', 'AbortError')));

    timer = setTimeout(() => finish(resolve), milliseconds);
    signal.addEventListener('abort', onAbort, { once: true });
  });

export default function FreeplayScreen() {
  const { settings, update } = useSettings();
  const { sentences, sentencesRef, loading, error, loadMore } = useSentenceQueue({
    from: settings.from,
    to: settings.to,
    requireTranslationAudio: true,
  });
  const { play: playClip, stop: stopClip } = useClipPlayer();

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const controllerRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);
  const mountedRef = useRef(true);
  const settingsRef = useRef(settings);

  const displayIndex =
    sentences.length === 0 ? 0 : Math.min(index, sentences.length - 1);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  const stopPlayback = useCallback(() => {
    runIdRef.current++;
    controllerRef.current?.abort();
    controllerRef.current = null;
    stopClip();
    setPlaying(false);
  }, [stopClip]);

  const runFrom = useCallback(
    async (startIndex: number) => {
      const runId = ++runIdRef.current;
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      setPlaying(true);
      setMessage(null);

      try {
        let cursor = startIndex;

        while (!controller.signal.aborted && runId === runIdRef.current) {
          if (cursor >= sentencesRef.current.length - 3) {
            await loadMore();
          }

          const sentence = sentencesRef.current[cursor];
          if (!sentence) {
            break;
          }

          setIndex(cursor);

          const pause = settingsRef.current.pauseSeconds * 1000;
          const originalAudio = sentence.audios[0];
          const translationAudio = firstTranslationWithAudio(sentence)?.audios[0];

          try {
            await playClip(audioFileUrl(originalAudio), controller.signal);
            await sleep(pause, controller.signal);

            if (translationAudio) {
              await playClip(audioFileUrl(translationAudio), controller.signal);
              await sleep(pause, controller.signal);
            }

            if (settingsRef.current.repeatOriginal) {
              await playClip(audioFileUrl(originalAudio), controller.signal);
              await sleep(pause, controller.signal);
            }
          } catch (clipError) {
            if (isAbortError(clipError)) {
              throw clipError;
            }
            // Skip a sentence with an unplayable clip instead of stopping.
            if (mountedRef.current) {
              setMessage('Skipped a sentence with unavailable audio.');
            }
          }

          cursor++;
        }
      } catch (playbackError) {
        if (!isAbortError(playbackError) && runId === runIdRef.current && mountedRef.current) {
          setMessage(
            playbackError instanceof Error ? playbackError.message : 'Playback failed.'
          );
        }
      } finally {
        if (runId === runIdRef.current) {
          controllerRef.current = null;
          if (mountedRef.current) {
            setPlaying(false);
          }
        }
      }
    },
    [loadMore, playClip, sentencesRef]
  );

  const togglePlayback = () => {
    if (playing) {
      stopPlayback();
      return;
    }
    void runFrom(displayIndex);
  };

  const changeIndex = (delta: number) => {
    const next = Math.max(0, Math.min(sentences.length - 1, displayIndex + delta));
    if (next === displayIndex) {
      return;
    }

    setMessage(null);
    if (playing) {
      void runFrom(next);
    } else {
      setIndex(next);
    }
  };

  const changeLanguage = (key: 'from' | 'to', value: LanguageCode) => {
    stopPlayback();
    setIndex(0);
    setMessage(null);
    update(key, value);
  };

  const current = sentences[displayIndex];
  const translation = current ? firstTranslationWithAudio(current) : null;
  const originalAudio = current?.audios[0];
  const translationAudio = translation?.audios[0];

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
        {loading
          ? 'Loading…'
          : sentences.length > 0
            ? `${displayIndex + 1} / ${sentences.length}`
            : ' '}
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.notice}>{message}</Text> : null}

      <View style={styles.sentenceBox}>
        {loading && sentences.length === 0 ? <ActivityIndicator /> : null}
        {current ? <Text style={styles.sentence}>{current.text}</Text> : null}
        {current && showTranslation && translation ? (
          <Text style={styles.translation}>{translation.text}</Text>
        ) : null}
      </View>

      <View style={styles.controlRow}>
        <Button
          label="Prev"
          onPress={() => changeIndex(-1)}
          disabled={displayIndex <= 0}
          style={styles.control}
        />
        <Button
          label={playing ? 'Pause' : 'Play'}
          onPress={togglePlayback}
          disabled={!current}
          variant="primary"
          style={styles.control}
        />
        <Button
          label="Next"
          onPress={() => changeIndex(1)}
          disabled={!current || displayIndex >= sentences.length - 1}
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
          onPress={() => update('repeatOriginal', !settings.repeatOriginal)}
          style={styles.option}
        />
      </View>

      <View style={styles.pauseRow}>
        <Text style={styles.pauseLabel}>Pause: {settings.pauseSeconds}s</Text>
        <Button
          label="-"
          onPress={() => update('pauseSeconds', Math.max(1, settings.pauseSeconds - 1))}
          disabled={settings.pauseSeconds <= 1}
        />
        <Button
          label="+"
          onPress={() => update('pauseSeconds', Math.min(5, settings.pauseSeconds + 1))}
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
  notice: {
    fontSize: 14,
    color: '#666666',
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
