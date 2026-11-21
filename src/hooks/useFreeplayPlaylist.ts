import { useAudioPlaylist, useAudioPlaylistStatus } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import {
  buildPlaylistTracks,
  clamp,
  metadataForSentence,
  type QueueEntry,
} from '@/lib/playlist';
import type { Settings } from '@/lib/storage';
import type { PlayableSentence } from '@/lib/types';

// expo/expo#52192: on Android, moving a lock-screen-active AudioPlaylist to a
// track appended after setActiveForLockScreen() crashes the app. Keep the
// native queue but skip playlist lock-screen controls on Android for now.
const supportsPlaylistLockScreen = Platform.OS !== 'android';

interface UseFreeplayPlaylistOptions {
  sentences: PlayableSentence[];
  sentencesRef: { current: PlayableSentence[] };
  loadMore: () => Promise<void>;
  settings: Settings;
}

export function useFreeplayPlaylist({
  sentences,
  sentencesRef,
  loadMore,
  settings,
}: UseFreeplayPlaylistOptions) {
  const playlist = useAudioPlaylist({
    sources: [],
    loop: 'none',
    updateInterval: 250,
  });
  const status = useAudioPlaylistStatus(playlist);

  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [index, setIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const entriesRef = useRef<QueueEntry[]>([]);
  const startedRef = useRef(false);
  const builtCountRef = useRef(0);
  const settingsRef = useRef(settings);
  const loadingMoreRef = useRef(false);
  const pausedByUserRef = useRef(false);
  const interruptedRef = useRef(false);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    const subscription = playlist.addListener('playlistStatusUpdate', (raw) => {
      const error = (raw as unknown as { error?: unknown }).error;
      if (!error) {
        return;
      }
      interruptedRef.current = true;
      pausedByUserRef.current = false;
      setPlaybackError('Playback interrupted. Press Play to retry.');
      playlist.setActiveForLockScreen(false);
    });

    return () => subscription.remove();
  }, [playlist]);

  const activeEntry = started ? entries[status.currentIndex] : undefined;
  const currentIndex = activeEntry?.sentenceIndex ?? index;
  const currentSentence = sentences[currentIndex];
  const playing = started && status.playing;
  const atEnd =
    started &&
    entries.length > 0 &&
    status.currentIndex >= entries.length - 1 &&
    !status.playing;

  const replaceQueue = useCallback(
    (sentenceIndex: number, config: Settings, autoPlay: boolean) => {
      const list = sentencesRef.current;
      if (list.length === 0) {
        return;
      }

      const start = clamp(sentenceIndex, 0, list.length - 1);
      const tracks = buildPlaylistTracks(list.slice(start), start, config);

      playlist.clear();
      tracks.forEach((track) => playlist.add(track.source));

      entriesRef.current = tracks.map((track) => track.entry);
      setEntries(entriesRef.current);

      builtCountRef.current = list.length;
      startedRef.current = true;
      setStarted(true);
      setIndex(start);
      pausedByUserRef.current = !autoPlay;
      interruptedRef.current = false;
      setPlaybackError(null);

      if (supportsPlaylistLockScreen) {
        playlist.setActiveForLockScreen(true, metadataForSentence(list[start]));
      }
      playlist.skipTo(0);
      if (autoPlay) {
        playlist.play();
      }
    },
    [playlist, sentencesRef]
  );

  const play = useCallback(() => {
    const needsRebuild =
      !startedRef.current ||
      atEnd ||
      interruptedRef.current ||
      playbackError !== null ||
      (!status.playing && !pausedByUserRef.current);

    if (needsRebuild) {
      replaceQueue(currentIndex, settingsRef.current, true);
      return;
    }

    pausedByUserRef.current = false;
    interruptedRef.current = false;
    setPlaybackError(null);
    if (supportsPlaylistLockScreen) {
      playlist.setActiveForLockScreen(true, metadataForSentence(currentSentence));
    }
    playlist.play();
  }, [
    atEnd,
    currentIndex,
    currentSentence,
    playbackError,
    playlist,
    replaceQueue,
    status.playing,
  ]);

  const pause = useCallback(() => {
    pausedByUserRef.current = true;
    playlist.pause();
  }, [playlist]);

  const goTo = useCallback(
    (target: number) => {
      const list = sentencesRef.current;
      if (list.length === 0) {
        return;
      }

      const nextIndex = clamp(target, 0, list.length - 1);
      if (!startedRef.current) {
        setIndex(nextIndex);
        return;
      }

      if (interruptedRef.current || playbackError !== null) {
        replaceQueue(nextIndex, settingsRef.current, true);
        return;
      }

      const trackIndex = entriesRef.current.findIndex(
        (entry) => entry.sentenceIndex === nextIndex
      );

      if (trackIndex >= 0) {
        playlist.skipTo(trackIndex);
      } else {
        replaceQueue(nextIndex, settingsRef.current, status.playing);
      }
    },
    [playbackError, playlist, replaceQueue, sentencesRef, status.playing]
  );

  const next = useCallback(() => goTo(currentIndex + 1), [currentIndex, goTo]);
  const previous = useCallback(() => goTo(currentIndex - 1), [currentIndex, goTo]);

  const reset = useCallback(() => {
    playlist.pause();
    playlist.clear();
    playlist.setActiveForLockScreen(false);

    entriesRef.current = [];
    setEntries([]);
    startedRef.current = false;
    setStarted(false);
    builtCountRef.current = 0;
    pausedByUserRef.current = false;
    interruptedRef.current = false;
    setPlaybackError(null);
    setIndex(0);
  }, [playlist]);

  const restart = useCallback(
    (config: Settings) => {
      if (!startedRef.current) {
        return;
      }
      replaceQueue(currentIndex, config, status.playing);
    },
    [currentIndex, replaceQueue, status.playing]
  );

  // Append newly fetched sentences to the native queue without interrupting it.
  useEffect(() => {
    if (!startedRef.current || sentences.length <= builtCountRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      const list = sentencesRef.current;
      const from = builtCountRef.current;
      if (!startedRef.current || list.length <= from) {
        return;
      }

      const tracks = buildPlaylistTracks(list.slice(from), from, settingsRef.current);
      tracks.forEach((track) => playlist.add(track.source));

      const nextEntries = [...entriesRef.current, ...tracks.map((track) => track.entry)];
      entriesRef.current = nextEntries;
      setEntries(nextEntries);
      builtCountRef.current = list.length;
    }, 0);

    return () => clearTimeout(timer);
  }, [sentences, playlist, sentencesRef]);

  // Fetch the next page before the buffered queue runs out.
  useEffect(() => {
    if (!startedRef.current || loadingMoreRef.current) {
      return;
    }
    if (currentIndex < sentences.length - 3) {
      return;
    }

    loadingMoreRef.current = true;
    void loadMore().finally(() => {
      loadingMoreRef.current = false;
    });
  }, [currentIndex, loadMore, sentences.length]);

  // Keep the lock-screen title in sync with the current sentence.
  useEffect(() => {
    if (started && supportsPlaylistLockScreen) {
      playlist.updateLockScreenMetadata(metadataForSentence(currentSentence));
    }
  }, [currentSentence, playlist, started]);

  useEffect(() => {
    if (status.didJustFinish) {
      playlist.setActiveForLockScreen(false);
    }
  }, [playlist, status.didJustFinish]);

  return {
    currentIndex,
    currentSentence,
    playing,
    playbackError,
    play,
    pause,
    next,
    previous,
    reset,
    restart,
  };
}
