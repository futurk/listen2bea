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

  const entriesRef = useRef<QueueEntry[]>([]);
  const startedRef = useRef(false);
  const builtCountRef = useRef(0);
  const settingsRef = useRef(settings);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const activeEntry = started ? entries[status.currentIndex] : undefined;
  const currentIndex = activeEntry?.sentenceIndex ?? index;
  const currentSentence = sentences[currentIndex];
  const playing = started && status.playing;

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

      playlist.setActiveForLockScreen(true, metadataForSentence(list[start]));
      playlist.skipTo(0);
      if (autoPlay) {
        playlist.play();
      }
    },
    [playlist, sentencesRef]
  );

  const play = useCallback(() => {
    if (!startedRef.current || status.didJustFinish) {
      replaceQueue(currentIndex, settingsRef.current, true);
      return;
    }
    playlist.setActiveForLockScreen(true, metadataForSentence(currentSentence));
    playlist.play();
  }, [currentIndex, currentSentence, playlist, replaceQueue, status.didJustFinish]);

  const pause = useCallback(() => {
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

      const trackIndex = entriesRef.current.findIndex(
        (entry) => entry.sentenceIndex === nextIndex
      );

      if (trackIndex >= 0) {
        playlist.skipTo(trackIndex);
      } else {
        replaceQueue(nextIndex, settingsRef.current, status.playing);
      }
    },
    [playlist, replaceQueue, sentencesRef, status.playing]
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
    play,
    pause,
    next,
    previous,
    reset,
    restart,
  };
}
