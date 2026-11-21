import { useAudioPlaylist, useAudioPlaylistStatus } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildPlaylistTracks,
  clamp,
  metadataForSentence,
  type QueueEntry,
} from '@/lib/playlist';
import type { Settings } from '@/lib/storage';
import type { PlayableSentence } from '@/lib/types';

const PREFETCH_TARGET = 30;
const PREFETCH_MAX_PAGES = 4;

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
  const [preparing, setPreparing] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const entriesRef = useRef<QueueEntry[]>([]);
  const startedRef = useRef(false);
  const settingsRef = useRef(settings);
  const prepareIdRef = useRef(0);
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

  const prefetch = useCallback(
    async (minIndex: number) => {
      let pages = 0;
      while (
        (sentencesRef.current.length < PREFETCH_TARGET ||
          sentencesRef.current.length <= minIndex) &&
        pages < PREFETCH_MAX_PAGES
      ) {
        const before = sentencesRef.current.length;
        await loadMore();
        pages++;
        if (sentencesRef.current.length === before) {
          break;
        }
      }
    },
    [loadMore, sentencesRef]
  );

  const replaceQueue = useCallback(
    async (sentenceIndex: number, config: Settings, autoPlay: boolean) => {
      const prepareId = ++prepareIdRef.current;
      setPreparing(true);
      setPlaybackError(null);

      try {
        await prefetch(sentenceIndex);
        if (prepareId !== prepareIdRef.current) {
          return;
        }

        const list = sentencesRef.current;
        if (list.length === 0) {
          return;
        }

        const start = clamp(sentenceIndex, 0, list.length - 1);
        const tracks = buildPlaylistTracks(list.slice(start), start, config);

        // Never grow an active playlist: Android crashes if a lock-screen
        // session sees a timeline change (expo/expo#52192).
        playlist.setActiveForLockScreen(false);
        playlist.pause();
        playlist.clear();
        tracks.forEach((track) => playlist.add(track.source));

        entriesRef.current = tracks.map((track) => track.entry);
        setEntries(entriesRef.current);

        startedRef.current = true;
        setStarted(true);
        setIndex(start);
        pausedByUserRef.current = !autoPlay;
        interruptedRef.current = false;

        playlist.setActiveForLockScreen(true, metadataForSentence(list[start]));
        playlist.skipTo(0);
        if (autoPlay) {
          playlist.play();
        }
      } catch (error) {
        if (prepareId === prepareIdRef.current) {
          setPlaybackError(
            error instanceof Error ? error.message : 'Could not prepare playback.'
          );
        }
      } finally {
        if (prepareId === prepareIdRef.current) {
          setPreparing(false);
        }
      }
    },
    [playlist, prefetch, sentencesRef]
  );

  const play = useCallback(() => {
    if (preparing) {
      return;
    }

    const needsRebuild =
      !startedRef.current ||
      atEnd ||
      interruptedRef.current ||
      playbackError !== null ||
      (!status.playing && !pausedByUserRef.current);

    if (needsRebuild) {
      const target = atEnd ? currentIndex + 1 : currentIndex;
      void replaceQueue(target, settingsRef.current, true);
      return;
    }

    pausedByUserRef.current = false;
    interruptedRef.current = false;
    setPlaybackError(null);
    playlist.setActiveForLockScreen(true, metadataForSentence(currentSentence));
    playlist.play();
  }, [
    atEnd,
    currentIndex,
    currentSentence,
    playbackError,
    playlist,
    preparing,
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
        void replaceQueue(nextIndex, settingsRef.current, true);
        return;
      }

      const trackIndex = entriesRef.current.findIndex(
        (entry) => entry.sentenceIndex === nextIndex
      );

      if (trackIndex >= 0) {
        playlist.skipTo(trackIndex);
      } else {
        void replaceQueue(nextIndex, settingsRef.current, status.playing);
      }
    },
    [playbackError, playlist, replaceQueue, sentencesRef, status.playing]
  );

  const next = useCallback(() => goTo(currentIndex + 1), [currentIndex, goTo]);
  const previous = useCallback(() => goTo(currentIndex - 1), [currentIndex, goTo]);

  const reset = useCallback(() => {
    prepareIdRef.current++;
    playlist.setActiveForLockScreen(false);
    playlist.pause();
    playlist.clear();

    entriesRef.current = [];
    setEntries([]);
    startedRef.current = false;
    setStarted(false);
    pausedByUserRef.current = false;
    interruptedRef.current = false;
    setPlaybackError(null);
    setPreparing(false);
    setIndex(0);
  }, [playlist]);

  const restart = useCallback(
    (config: Settings) => {
      if (!startedRef.current) {
        return;
      }
      void replaceQueue(currentIndex, config, status.playing);
    },
    [currentIndex, replaceQueue, status.playing]
  );

  // Keep the lock-screen title in sync with the current sentence.
  useEffect(() => {
    if (started) {
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
    preparing,
    playbackError,
    play,
    pause,
    next,
    previous,
    reset,
    restart,
  };
}
