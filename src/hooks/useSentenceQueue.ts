import { useCallback, useEffect, useRef, useState } from 'react';
import { buildSentenceSearchUrl, fetchSentencePage } from '@/lib/tatoeba';
import type { PlayableSentence } from '@/lib/types';

interface UseSentenceQueueOptions {
  from: string;
  to: string;
  limit?: number;
  requireTranslationAudio?: boolean;
  /** Fetch immediately on mount and whenever the language pair changes. */
  enabled?: boolean;
}

const REQUEST_TIMEOUT_MS = 15_000;

export function useSentenceQueue({
  from,
  to,
  limit = 20,
  requireTranslationAudio = true,
  enabled = true,
}: UseSentenceQueueOptions) {
  const [sentences, setSentences] = useState<PlayableSentence[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const sentencesRef = useRef<PlayableSentence[]>([]);
  const nextUrlRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const commit = useCallback((next: PlayableSentence[]) => {
    sentencesRef.current = next;
    setSentences(next);
  }, []);

  const load = useCallback(
    async (reset = true) => {
      const requestId = ++requestIdRef.current;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, REQUEST_TIMEOUT_MS);

      if (reset) {
        setLoading(true);
        setError(null);
        setHasMore(false);
        nextUrlRef.current = null;
      }

      try {
        const url = reset
          ? buildSentenceSearchUrl({ from, to, limit, requireTranslationAudio })
          : nextUrlRef.current;

        if (!url) {
          return;
        }

        const page = await fetchSentencePage(url, {
          requireTranslationAudio,
          signal: controller.signal,
        });
        if (requestId !== requestIdRef.current) {
          return;
        }

        nextUrlRef.current = page.next;
        setHasMore(Boolean(page.next));
        const next = reset ? page.sentences : [...sentencesRef.current, ...page.sentences];
        commit(next);

        if (reset && next.length === 0) {
          setError('No sentences found for this language pair.');
        }
      } catch (err) {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setError(
          timedOut
            ? 'Tatoeba request timed out. Try again.'
            : err instanceof Error
              ? err.message
              : 'Could not load sentences.'
        );
      } finally {
        clearTimeout(timeout);
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [from, to, limit, requireTranslationAudio, commit]
  );

  const loadMore = useCallback(async () => {
    if (!nextUrlRef.current) {
      return;
    }
    await load(false);
  }, [load]);

  const reset = useCallback(() => {
    requestIdRef.current++;
    abortRef.current?.abort();
    abortRef.current = null;
    nextUrlRef.current = null;
    commit([]);
    setError(null);
    setHasMore(false);
    setLoading(false);
  }, [commit]);

  useEffect(
    () => () => {
      requestIdRef.current++;
      abortRef.current?.abort();
      abortRef.current = null;
    },
    []
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Schedule the fetch after the render so loading state is not set
    // synchronously inside the effect.
    const timer = setTimeout(() => {
      void load(true);
    }, 0);

    return () => clearTimeout(timer);
  }, [enabled, load]);

  return { sentences, sentencesRef, loading, error, hasMore, load, loadMore, reset };
}
