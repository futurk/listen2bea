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

  const sentencesRef = useRef<PlayableSentence[]>([]);
  const nextUrlRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);

  const commit = useCallback((next: PlayableSentence[]) => {
    sentencesRef.current = next;
    setSentences(next);
  }, []);

  const load = useCallback(
    async (reset = true) => {
      const requestId = ++requestIdRef.current;

      if (reset) {
        setLoading(true);
        setError(null);
        nextUrlRef.current = null;
      }

      try {
        const url = reset
          ? buildSentenceSearchUrl({ from, to, limit, requireTranslationAudio })
          : nextUrlRef.current;

        if (!url) {
          return;
        }

        const page = await fetchSentencePage(url, { requireTranslationAudio });
        if (requestId !== requestIdRef.current) {
          return;
        }

        nextUrlRef.current = page.next;
        const next = reset ? page.sentences : [...sentencesRef.current, ...page.sentences];
        commit(next);

        if (reset && next.length === 0) {
          setError('No sentences found for this language pair.');
        }
      } catch (err) {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setError(err instanceof Error ? err.message : 'Could not load sentences.');
      } finally {
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
    nextUrlRef.current = null;
    commit([]);
    setError(null);
    setLoading(false);
  }, [commit]);

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

  return { sentences, sentencesRef, loading, error, load, loadMore, reset };
}
