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

const NAVIGATION_SETTLE_MS = 200;

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
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [started, setStarted] = useState(false);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const entriesRef = useRef<QueueEntry[]>([]);
  const startedRef = useRef(false);
  const settingsRef = useRef(settings);
  const pendingIndexRef = useRef(0);
  const pendingNavigationRef = useRef(false);
  const desiredPlayingRef = useRef(false);
  const interruptedRef = useRef(false);
  const rebuildingRef = useRef(false);
  const skipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchingMoreRef = useRef(false);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    const subscription = playlist.addListener('playlistStatusUpdate', (raw) => {
      const error = (raw as unknown as { error?: unknown }).error;
      if (!error) {
        return;
      }
      if (skipTimerRef.current !== null) {
        clearTimeout(skipTimerRef.current);
        skipTimerRef.current = null;
      }
      interruptedRef.current = true;
      desiredPlayingRef.current = false;
      setPlaybackError('Playback interrupted. Press Play to retry.');
      playlist.setActiveForLockScreen(false);
    });

    return () => subscription.remove();
  }, [playlist]);

  useEffect(() => {
    const subscription = playlist.addListener(
      'trackChanged',
      ({ currentIndex: trackIndex }) => {
        if (rebuildingRef.current || skipTimerRef.current !== null) {
          return;
        }
        const sentenceIndex = entriesRef.current[trackIndex]?.sentenceIndex;
        if (sentenceIndex == null) {
          return;
        }
        if (
          pendingNavigationRef.current &&
          sentenceIndex !== pendingIndexRef.current
        ) {
          return;
        }
        pendingIndexRef.current = sentenceIndex;
        setIndex(sentenceIndex);
        if (pendingNavigationRef.current) {
          pendingNavigationRef.current = false;
          setPendingIndex(null);
        }
      }
    );

    return () => subscription.remove();
  }, [playlist]);

  useEffect(
    () => () => {
      if (skipTimerRef.current !== null) {
        clearTimeout(skipTimerRef.current);
      }
    },
    []
  );

  useEffect(() => {
    const subscription = playlist.addListener('playlistStatusUpdate', (raw) => {
      const trackIndex = (raw as unknown as { currentIndex?: number }).currentIndex;
      if (
        trackIndex == null ||
        rebuildingRef.current ||
        skipTimerRef.current !== null
      ) {
        return;
      }
      const sentenceIndex = entriesRef.current[trackIndex]?.sentenceIndex;
      if (sentenceIndex == null) {
        return;
      }

      if (pendingNavigationRef.current) {
        if (sentenceIndex !== pendingIndexRef.current) {
          return;
        }
        pendingNavigationRef.current = false;
        setPendingIndex(null);
        setIndex(sentenceIndex);
        return;
      }

      // Fallback sync for platforms where trackChanged may not arrive.
      if (sentenceIndex !== pendingIndexRef.current) {
        pendingIndexRef.current = sentenceIndex;
        setIndex(sentenceIndex);
      }
    });

    return () => subscription.remove();
  }, [playlist]);

  const activeEntry = started ? entries[status.currentIndex] : undefined;
  const currentIndex = pendingIndex ?? activeEntry?.sentenceIndex ?? index;
  const currentSentence = sentences[currentIndex];
  const playing = started && status.playing;
  const atEnd =
    pendingIndex === null &&
    started &&
    entries.length > 0 &&
    status.currentIndex >= entries.length - 1 &&
    !status.playing;

  const flushPendingSkip = useCallback((): boolean => {
    if (skipTimerRef.current === null) {
      return false;
    }
    clearTimeout(skipTimerRef.current);
    skipTimerRef.current = null;

    if (!startedRef.current) {
      return false;
    }

    const trackIndex = entriesRef.current.findIndex(
      (entry) => entry.sentenceIndex === pendingIndexRef.current
    );
    if (trackIndex < 0) {
      return false;
    }

    playlist.skipTo(trackIndex);
    return true;
  }, [playlist]);

  const replaceQueue = useCallback(
    (sentenceIndex: number, config: Settings, autoPlay: boolean) => {
      setPlaybackError(null);
      desiredPlayingRef.current = autoPlay;

      if (skipTimerRef.current !== null) {
        clearTimeout(skipTimerRef.current);
        skipTimerRef.current = null;
      }
      rebuildingRef.current = true;

      try {
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

        pendingIndexRef.current = start;
        pendingNavigationRef.current = true;
        setPendingIndex(start);
        startedRef.current = true;
        setStarted(true);
        setIndex(start);
        interruptedRef.current = false;
        rebuildingRef.current = false;

        playlist.setActiveForLockScreen(true, metadataForSentence(list[start]));
        playlist.skipTo(0);
        if (autoPlay) {
          playlist.play();
        }
      } catch (error) {
        setPlaybackError(
          error instanceof Error ? error.message : 'Could not prepare playback.'
        );
      } finally {
        rebuildingRef.current = false;
      }
    },
    [playlist, sentencesRef]
  );

  const play = useCallback(() => {
    flushPendingSkip();

    const needsRebuild =
      !startedRef.current ||
      atEnd ||
      interruptedRef.current ||
      playbackError !== null;

    if (needsRebuild) {
      desiredPlayingRef.current = true;
      const target = atEnd ? pendingIndexRef.current + 1 : pendingIndexRef.current;
      replaceQueue(target, settingsRef.current, true);
      return;
    }

    desiredPlayingRef.current = true;
    interruptedRef.current = false;
    setPlaybackError(null);
    playlist.setActiveForLockScreen(true, metadataForSentence(currentSentence));
    playlist.play();
  }, [
    atEnd,
    currentSentence,
    flushPendingSkip,
    playbackError,
    playlist,
    replaceQueue,
  ]);

  const pause = useCallback(() => {
    desiredPlayingRef.current = false;
    flushPendingSkip();
    playlist.pause();
  }, [flushPendingSkip, playlist]);

  const goTo = useCallback(
    (target: number) => {
      if (rebuildingRef.current || fetchingMoreRef.current) {
        return;
      }

      const list = sentencesRef.current;
      if (list.length === 0) {
        return;
      }

      const nextIndex = clamp(target, 0, list.length - 1);
      if (nextIndex === pendingIndexRef.current) {
        return;
      }

      pendingIndexRef.current = nextIndex;
      pendingNavigationRef.current = true;
      setPendingIndex(nextIndex);
      setIndex(nextIndex);

      if (!startedRef.current) {
        return;
      }

      if (interruptedRef.current || playbackError !== null) {
        desiredPlayingRef.current = true;
        replaceQueue(nextIndex, settingsRef.current, true);
        return;
      }

      if (skipTimerRef.current !== null) {
        clearTimeout(skipTimerRef.current);
      }

      skipTimerRef.current = setTimeout(() => {
        skipTimerRef.current = null;
        if (rebuildingRef.current) {
          return;
        }

        const trackIndex = entriesRef.current.findIndex(
          (entry) => entry.sentenceIndex === nextIndex
        );

        if (trackIndex < 0) {
          replaceQueue(nextIndex, settingsRef.current, desiredPlayingRef.current);
          return;
        }

        playlist.skipTo(trackIndex);
        if (desiredPlayingRef.current) {
          playlist.play();
        }
      }, NAVIGATION_SETTLE_MS);
    },
    [playbackError, playlist, replaceQueue, sentencesRef]
  );

  const next = useCallback(
    () => goTo(pendingIndexRef.current + 1),
    [goTo]
  );
  const previous = useCallback(
    () => goTo(pendingIndexRef.current - 1),
    [goTo]
  );

  const reset = useCallback(() => {
    if (skipTimerRef.current !== null) {
      clearTimeout(skipTimerRef.current);
      skipTimerRef.current = null;
    }
    playlist.setActiveForLockScreen(false);
    playlist.pause();
    playlist.clear();

    entriesRef.current = [];
    setEntries([]);
    pendingIndexRef.current = 0;
    pendingNavigationRef.current = false;
    setPendingIndex(null);
    startedRef.current = false;
    setStarted(false);
    interruptedRef.current = false;
    desiredPlayingRef.current = false;
    rebuildingRef.current = false;
    setPlaybackError(null);
    setIndex(0);
  }, [playlist]);

  const restart = useCallback(
    (config: Settings) => {
      if (!startedRef.current) {
        return;
      }
      replaceQueue(pendingIndexRef.current, config, desiredPlayingRef.current);
    },
    [replaceQueue]
  );

  const fetchMore = useCallback(async () => {
    if (fetchingMoreRef.current) {
      return;
    }

    fetchingMoreRef.current = true;
    setFetchingMore(true);
    setPlaybackError(null);

    const before = sentencesRef.current.length;
    const wasStarted = startedRef.current;
    const shouldPlay = desiredPlayingRef.current;

    try {
      await loadMore();

      if (sentencesRef.current.length <= before) {
        setPlaybackError('No new usable sentences were returned. Try again later.');
        return;
      }

      if (!wasStarted) {
        pendingIndexRef.current = before;
        pendingNavigationRef.current = true;
        setPendingIndex(before);
        setIndex(before);
        return;
      }

      replaceQueue(before, settingsRef.current, shouldPlay);
    } catch (error) {
      setPlaybackError(
        error instanceof Error ? error.message : 'Could not load more sentences.'
      );
    } finally {
      fetchingMoreRef.current = false;
      setFetchingMore(false);
    }
  }, [loadMore, replaceQueue, sentencesRef]);

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
    fetchingMore,
    playbackError,
    play,
    pause,
    next,
    previous,
    reset,
    restart,
    fetchMore,
  };
}
