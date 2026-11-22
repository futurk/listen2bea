import type { AudioMetadata, AudioSource } from 'expo-audio';
import type { FreeplayCommand, FreeplayState } from './freeplayMachine';
import { findSentenceStart, metadataForSentence } from './playlist';
import type { PlayableSentence } from './types';

export const LOAD_SETTLE_MS = 100;

/**
 * The subset of expo-audio's AudioPlaylist that the freeplay executor uses.
 * Keeping it narrow makes the native command sequence testable.
 */
export interface FreeplayPlaylistHandle {
  setActiveForLockScreen(active: boolean, metadata?: AudioMetadata): void;
  pause(): void;
  clear(): void;
  add(source: AudioSource): void;
  skipTo(index: number): void;
  seekTo(seconds: number): Promise<void>;
  play(): void;
}

export interface FreeplayExecutorRefs {
  stateRef: { current: FreeplayState };
  sentencesRef: { current: PlayableSentence[] };
  loadTokenRef: { current: number };
  rebuildingRef: { current: boolean };
}

export interface FreeplayExecutorOptions {
  playlist: FreeplayPlaylistHandle;
  refs: FreeplayExecutorRefs;
  settleDelayMs?: number;
}

export const executeFreeplayCommand = (
  {
    playlist,
    refs,
    settleDelayMs = LOAD_SETTLE_MS,
  }: FreeplayExecutorOptions,
  command: FreeplayCommand
): void => {
  const state = refs.stateRef.current;

  switch (command.type) {
    case 'load': {
      const token = ++refs.loadTokenRef.current;
      refs.rebuildingRef.current = true;

      try {
        playlist.setActiveForLockScreen(false);
        playlist.pause();
        playlist.clear();
        command.plan.tracks.forEach((track) => playlist.add(track.source));

        const sentence = refs.sentencesRef.current[command.startSentence];
        playlist.setActiveForLockScreen(true, metadataForSentence(sentence));
        playlist.skipTo(0);
        if (command.autoPlay) {
          playlist.play();
        }
      } catch (error) {
        refs.rebuildingRef.current = false;
        refs.loadTokenRef.current++;
        throw error;
      }

      setTimeout(() => {
        if (refs.loadTokenRef.current === token) {
          refs.rebuildingRef.current = false;
        }
      }, settleDelayMs);
      return;
    }

    case 'skipToSentence': {
      const trackIndex = state.plan
        ? findSentenceStart(state.plan, command.sentenceIndex)
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
      const trackIndex = state.plan
        ? findSentenceStart(state.plan, command.sentenceIndex)
        : null;

      playlist.pause();
      if (trackIndex != null) {
        playlist.skipTo(trackIndex);
        void playlist.seekTo(0).catch(() => {});
      }
      return;
    }

    case 'resume':
      playlist.play();
      return;

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
};
