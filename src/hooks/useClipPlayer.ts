import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useRef } from 'react';

const abortError = () => new DOMException('Aborted', 'AbortError');

export const isAbortError = (error: unknown): boolean =>
  error instanceof Error && error.name === 'AbortError';

interface PendingPlayback {
  abort: () => void;
  cleanup: () => void;
}

const LOCK_SCREEN_METADATA = {
  title: 'Listen2Bea',
  artist: 'Tatoeba',
};

export function useClipPlayer() {
  const playerRef = useRef<AudioPlayer | null>(null);
  const pendingRef = useRef<PendingPlayback | null>(null);

  useEffect(() => {
    const player = createAudioPlayer(null);
    playerRef.current = player;

    return () => {
      pendingRef.current?.abort();
      pendingRef.current = null;
      player.remove();
      playerRef.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    pendingRef.current?.abort();
    pendingRef.current = null;
    const player = playerRef.current;
    if (player) {
      player.pause();
      player.clearLockScreenControls();
    }
  }, []);

  const play = useCallback((uri: string, signal?: AbortSignal) => {
    return new Promise<void>((resolve, reject) => {
      const player = playerRef.current;
      if (!player) {
        reject(new Error('Audio player is not ready.'));
        return;
      }
      if (signal?.aborted) {
        reject(abortError());
        return;
      }

      stop();
      player.replace(uri);
      player.setActiveForLockScreen(true, LOCK_SCREEN_METADATA);

      let settled = false;

      const cleanup = () => {
        if (settled) {
          return;
        }
        settled = true;
        subscription.remove();
        signal?.removeEventListener('abort', onAbort);
        if (pendingRef.current?.cleanup === cleanup) {
          pendingRef.current = null;
        }
      };

      const settle = (action: () => void) => {
        if (settled) {
          return;
        }
        cleanup();
        action();
      };

      const onAbort = () => {
        player.pause();
        player.clearLockScreenControls();
        settle(() => reject(abortError()));
      };

      const subscription = player.addListener('playbackStatusUpdate', (status) => {
        if (status.error) {
          player.clearLockScreenControls();
          settle(() => reject(new Error(status.error ?? 'Audio playback failed')));
          return;
        }
        if (status.didJustFinish) {
          player.clearLockScreenControls();
          settle(resolve);
        }
      });

      pendingRef.current = {
        abort: () => settle(() => reject(abortError())),
        cleanup,
      };

      signal?.addEventListener('abort', onAbort, { once: true });
      player.play();
    });
  }, [stop]);

  return { play, stop };
}
