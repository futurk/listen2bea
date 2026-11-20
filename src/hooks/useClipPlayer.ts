import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useRef } from 'react';

const abortError = () => new DOMException('Aborted', 'AbortError');

export const isAbortError = (error: unknown): boolean =>
  error instanceof Error && error.name === 'AbortError';

interface PendingPlayback {
  abort: () => void;
  cleanup: () => void;
}

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
    playerRef.current?.pause();
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
        settle(() => reject(abortError()));
      };

      const subscription = player.addListener('playbackStatusUpdate', (status) => {
        if (status.error) {
          settle(() => reject(new Error(status.error ?? 'Audio playback failed')));
          return;
        }
        if (status.didJustFinish) {
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
