import {
  useAudioPlaylist,
  useAudioPlaylistStatus,
  type AudioPlaylistStatus,
} from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  initialFreeplayState,
  reduceFreeplay,
  type FreeplayAction,
  type FreeplayCommand,
  type FreeplayState,
} from '@/lib/freeplayMachine';
import {
  buildPlaylistPlan,
  clamp,
  findSentenceStart,
  metadataForSentence,
  sentenceAtTrack,
  type PlaylistPlan,
} from '@/lib/playlist';
import type { Settings } from '@/lib/storage';
import type { PlayableSentence } from '@/lib/types';

const NAVIGATION_SETTLE_MS = 200;
const LOAD_SETTLE_MS = 100;
const COMMAND_FAILURE_MESSAGE =
  'Could not prepare playback. Press Play to retry.';

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

  const [state, setState] = useState<FreeplayState>(initialFreeplayState);
  const stateRef = useRef<FreeplayState>(initialFreeplayState);
  const applyRef = useRef<(action: FreeplayAction) => void>(() => {});
  const skipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rebuildingRef = useRef(false);
  const loadTokenRef = useRef(0);
  const sessionRef = useRef(0);

  const buildPlan = useCallback(
    (start: number, config: Settings = settings): PlaylistPlan | null => {
      const list = sentencesRef.current;
      if (list.length === 0) {
        return null;
      }
      const startIndex = clamp(start, 0, list.length - 1);
      return buildPlaylistPlan(list, startIndex, config);
    },
    [sentencesRef, settings]
  );

  const executeCommand = useCallback(
    (command: FreeplayCommand) => {
      const currentState = stateRef.current;

      switch (command.type) {
        case 'load': {
          const token = ++loadTokenRef.current;
          rebuildingRef.current = true;

          try {
            playlist.setActiveForLockScreen(false);
            playlist.pause();
            playlist.clear();
            command.plan.tracks.forEach((track) => playlist.add(track.source));

            const sentence = sentencesRef.current[command.startSentence];
            playlist.setActiveForLockScreen(true, metadataForSentence(sentence));
            playlist.skipTo(0);
            if (command.autoPlay) {
              playlist.play();
            }
          } catch (error) {
            rebuildingRef.current = false;
            loadTokenRef.current++;
            throw error;
          }

          setTimeout(() => {
            if (loadTokenRef.current === token) {
              rebuildingRef.current = false;
            }
          }, LOAD_SETTLE_MS);
          return;
        }

        case 'skipToSentence': {
          const plan = currentState.plan;
          const trackIndex = plan
            ? findSentenceStart(plan, command.sentenceIndex)
            : null;
          if (trackIndex == null) {
            return;
          }

          playlist.skipTo(trackIndex);
          if (command.play) {
            playlist.play();
          }
          return;
        }

        case 'pauseAtSentenceStart': {
          const plan = currentState.plan;
          const trackIndex = plan
            ? findSentenceStart(plan, command.sentenceIndex)
            : null;

          playlist.pause();
          if (trackIndex != null) {
            playlist.skipTo(trackIndex);
            void playlist.seekTo(0).catch(() => {});
          }
          return;
        }

        case 'resume': {
          playlist.play();
          return;
        }

        case 'deactivate':
          playlist.pause();
          playlist.setActiveForLockScreen(false);
          return;

        case 'reset':
          playlist.setActiveForLockScreen(false);
          playlist.pause();
          playlist.clear();
          return;
      }
    },
    [playlist, sentencesRef]
  );

  const apply = useCallback(
    (action: FreeplayAction) => {
      const transition = reduceFreeplay(stateRef.current, action);
      stateRef.current = transition.state;
      setState(transition.state);

      try {
        transition.commands.forEach(executeCommand);
      } catch (error) {
        console.warn('Freeplay playback command failed', error);
        const failure = reduceFreeplay(stateRef.current, {
          type: 'playerError',
          message: COMMAND_FAILURE_MESSAGE,
        });
        stateRef.current = failure.state;
        setState(failure.state);
        failure.commands.forEach((command) => {
          try {
            executeCommand(command);
          } catch (recoveryError) {
            console.warn('Freeplay playback recovery failed', recoveryError);
          }
        });
      }
    },
    [executeCommand]
  );

  useEffect(() => {
    applyRef.current = apply;
  }, [apply]);

  useEffect(() => {
    const subscription = playlist.addListener('playlistStatusUpdate', (raw) => {
      const event = raw as AudioPlaylistStatus & { error?: unknown };

      if (event.error) {
        if (stateRef.current.plan) {
          applyRef.current({
            type: 'playerError',
            message: 'Playback interrupted. Press Play to retry.',
          });
        }
        return;
      }

      if (rebuildingRef.current || event.currentIndex == null) {
        return;
      }

      const plan = stateRef.current.plan;
      if (!plan) {
        return;
      }

      const sentenceIndex = sentenceAtTrack(plan, event.currentIndex);
      if (sentenceIndex == null) {
        return;
      }

      applyRef.current({ type: 'trackChanged', sentenceIndex });

      if (
        event.didJustFinish &&
        event.currentIndex >= plan.lastTrackIndex &&
        stateRef.current.status !== 'ended' &&
        stateRef.current.status !== 'interrupted'
      ) {
        applyRef.current({ type: 'playerEnded' });
      }
    });

    return () => subscription.remove();
  }, [playlist]);

  useEffect(
    () => () => {
      if (skipTimerRef.current !== null) {
        clearTimeout(skipTimerRef.current);
      }
      loadTokenRef.current++;
      sessionRef.current++;
    },
    []
  );

  const goTo = useCallback(
    (delta: number) => {
      const current = stateRef.current;
      const list = sentencesRef.current;
      if (list.length === 0 || current.fetchingMore) {
        return;
      }

      const base = current.targetSentence ?? current.currentSentence;
      const target = clamp(base + delta, 0, list.length - 1);
      if (target === base) {
        return;
      }

      if (skipTimerRef.current !== null) {
        clearTimeout(skipTimerRef.current);
        skipTimerRef.current = null;
      }

      if (!current.plan) {
        apply({ type: 'setTarget', sentenceIndex: target });
        return;
      }

      if (current.status === 'interrupted' || current.status === 'ended') {
        const plan = buildPlan(target);
        if (plan) {
          apply({ type: 'replan', plan, sentenceIndex: target, autoPlay: true });
        }
        return;
      }

      if (!current.plan.sentenceStarts.has(target)) {
        const plan = buildPlan(target);
        if (plan) {
          apply({
            type: 'replan',
            plan,
            sentenceIndex: target,
            autoPlay: current.intent === 'playing',
          });
        }
        return;
      }

      apply({ type: 'setTarget', sentenceIndex: target });
      skipTimerRef.current = setTimeout(() => {
        skipTimerRef.current = null;
        const latest = stateRef.current;
        if (latest.plan?.sentenceStarts.has(target)) {
          applyRef.current({
            type: 'navigate',
            sentenceIndex: target,
            play: latest.intent === 'playing',
          });
        }
      }, NAVIGATION_SETTLE_MS);
    },
    [apply, buildPlan, sentencesRef]
  );

  const play = useCallback(() => {
    if (stateRef.current.fetchingMore) {
      return;
    }

    if (skipTimerRef.current !== null) {
      clearTimeout(skipTimerRef.current);
      skipTimerRef.current = null;
    }

    const current = stateRef.current;
    const sentence = current.targetSentence ?? current.currentSentence;

    if (
      !current.plan ||
      current.status === 'interrupted' ||
      current.status === 'ended'
    ) {
      const list = sentencesRef.current;
      if (list.length === 0) {
        return;
      }
      const start = clamp(
        current.status === 'ended' ? sentence + 1 : sentence,
        0,
        list.length - 1
      );
      const plan = buildPlan(start);
      if (plan) {
        apply({ type: 'replan', plan, sentenceIndex: start, autoPlay: true });
      }
      return;
    }

    apply({ type: 'play' });
  }, [apply, buildPlan, sentencesRef]);

  const pause = useCallback(() => {
    if (stateRef.current.fetchingMore) {
      return;
    }
    if (skipTimerRef.current !== null) {
      clearTimeout(skipTimerRef.current);
      skipTimerRef.current = null;
    }
    apply({ type: 'pause' });
  }, [apply]);

  const reset = useCallback(() => {
    sessionRef.current++;
    if (skipTimerRef.current !== null) {
      clearTimeout(skipTimerRef.current);
      skipTimerRef.current = null;
    }
    loadTokenRef.current++;
    rebuildingRef.current = false;
    apply({ type: 'reset' });
  }, [apply]);

  const restart = useCallback(
    (config: Settings) => {
      const current = stateRef.current;
      if (!current.plan || current.fetchingMore) {
        return;
      }

      if (skipTimerRef.current !== null) {
        clearTimeout(skipTimerRef.current);
        skipTimerRef.current = null;
      }

      const start = clamp(
        current.targetSentence ?? current.currentSentence,
        0,
        sentencesRef.current.length - 1
      );
      const plan = buildPlan(start, config);
      if (plan) {
        apply({
          type: 'replan',
          plan,
          sentenceIndex: start,
          autoPlay: current.intent === 'playing',
        });
      }
    },
    [apply, buildPlan, sentencesRef]
  );

  const fetchMore = useCallback(async () => {
    const current = stateRef.current;
    if (current.fetchingMore) {
      return;
    }

    const session = sessionRef.current;
    const before = sentencesRef.current.length;
    const wasStarted = current.plan !== null;
    const shouldPlay = current.intent === 'playing';

    apply({ type: 'fetchingStarted' });
    if (skipTimerRef.current !== null) {
      clearTimeout(skipTimerRef.current);
      skipTimerRef.current = null;
    }

    try {
      await loadMore();

      if (session !== sessionRef.current) {
        return;
      }

      const after = sentencesRef.current.length;
      if (after <= before) {
        apply({
          type: 'error',
          message: 'No new usable sentences were returned. Try again later.',
        });
        return;
      }

      if (!wasStarted) {
        apply({ type: 'setTarget', sentenceIndex: before });
        apply({ type: 'fetchingFinished' });
        return;
      }

      const plan = buildPlan(before);
      if (!plan) {
        apply({ type: 'error', message: 'Could not prepare more sentences.' });
        return;
      }

      apply({
        type: 'replan',
        plan,
        sentenceIndex: before,
        autoPlay: shouldPlay,
      });
      apply({ type: 'fetchingFinished' });
    } catch (error) {
      apply({
        type: 'error',
        message:
          error instanceof Error ? error.message : 'Could not load more sentences.',
      });
    }
  }, [apply, buildPlan, loadMore, sentencesRef]);

  useEffect(() => {
    if (!state.plan) {
      return;
    }
    const sentence = sentences[state.targetSentence ?? state.currentSentence];
    playlist.updateLockScreenMetadata(metadataForSentence(sentence));
  }, [
    playlist,
    sentences,
    state.currentSentence,
    state.plan,
    state.targetSentence,
  ]);

  const currentIndex = state.targetSentence ?? state.currentSentence;
  const currentSentence = sentences[currentIndex];
  const playing = state.plan !== null && status.playing;

  return {
    currentIndex,
    currentSentence,
    playing,
    fetchingMore: state.fetchingMore,
    playbackError: state.error,
    play,
    pause,
    next: () => goTo(1),
    previous: () => goTo(-1),
    reset,
    restart,
    fetchMore,
  };
}
