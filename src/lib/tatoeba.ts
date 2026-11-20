import type {
  Audio,
  PlayableSentence,
  PlayableTranslation,
  Sentence,
  SentencePage,
  SentenceSearchResponse,
} from './types';

export const TATOEBA_API_BASE = 'https://api.tatoeba.org';

const DEFAULT_SENTENCES_ENDPOINT = `${TATOEBA_API_BASE}/v1/sentences`;
const SENTENCES_ENDPOINT =
  process.env.EXPO_PUBLIC_TATOEBA_API_URL || DEFAULT_SENTENCES_ENDPOINT;

export interface SentenceQuery {
  from: string;
  to: string;
  limit?: number;
  /** Only keep sentences whose translations have playable audio. */
  requireTranslationAudio?: boolean;
}

export interface FetchPageOptions {
  requireTranslationAudio?: boolean;
  signal?: AbortSignal;
}

const encodeQuery = (params: [string, string][]): string =>
  params
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

export function buildSentenceSearchUrl({
  from,
  to,
  limit = 20,
  requireTranslationAudio = true,
}: SentenceQuery): string {
  const params: [string, string][] = [
    ['lang', from],
    ['trans:lang', to],
    ['has_audio', 'yes'],
    ['origin', 'original'],
    ['sort', 'random'],
    ['limit', String(limit)],
    ['include', 'audios'],
  ];

  if (requireTranslationAudio) {
    params.push(['trans:has_audio', 'yes']);
  }

  return `${SENTENCES_ENDPOINT}?${encodeQuery(params)}`;
}

/**
 * An empty audio license means the author does not allow reuse outside of
 * Tatoeba. The download endpoint returns HTTP 403 for those recordings, which
 * browsers report as "The element has no supported sources".
 */
export const isReusableAudio = (audio: Audio): boolean =>
  (audio.license ?? '').trim().length > 0;

const reusableAudios = (audios: Audio[] | undefined): Audio[] =>
  (audios ?? []).filter(isReusableAudio);

export function toPlayableSentence(sentence: Sentence): PlayableSentence {
  const translations: PlayableTranslation[] = (sentence.translations ?? []).map(
    (translation) => ({
      ...translation,
      audios: reusableAudios(translation.audios),
    })
  );

  return {
    ...sentence,
    audios: reusableAudios(sentence.audios),
    translations,
  };
}

export function prepareSentences(
  data: Sentence[],
  requireTranslationAudio: boolean
): PlayableSentence[] {
  return data
    .map(toPlayableSentence)
    .filter((sentence) => sentence.translations.length > 0 && sentence.audios.length > 0)
    .filter(
      (sentence) =>
        !requireTranslationAudio ||
        sentence.translations.some((translation) => translation.audios.length > 0)
    );
}

const pageCache = new Map<string, SentencePage>();
const PAGE_CACHE_LIMIT = 20;

const cacheKey = (url: string, requireTranslationAudio: boolean): string =>
  `${requireTranslationAudio ? 'with-translation-audio' : 'text-only'}:${url}`;

export function clearSentencePageCache(): void {
  pageCache.clear();
}

export async function fetchSentencePage(
  url: string,
  { requireTranslationAudio = true, signal }: FetchPageOptions = {}
): Promise<SentencePage> {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  const key = cacheKey(url, requireTranslationAudio);
  const cached = pageCache.get(key);
  if (cached) {
    return cached;
  }

  const response = await fetch(url, {
    signal,
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Tatoeba request failed (${response.status})`);
  }

  const payload = (await response.json()) as Partial<SentenceSearchResponse>;
  const page: SentencePage = {
    sentences: prepareSentences(payload.data ?? [], requireTranslationAudio),
    next: payload.paging?.has_next ? payload.paging.next ?? null : null,
  };

  pageCache.set(key, page);
  if (pageCache.size > PAGE_CACHE_LIMIT) {
    const oldestKey = pageCache.keys().next().value;
    if (oldestKey) {
      pageCache.delete(oldestKey);
    }
  }

  return page;
}

/**
 * The API's own `download_url` points at `/v1/audio/{id}/file`, which returns
 * 404. The working endpoint uses the plural `audios`.
 */
export const audioFileUrl = (audio: Pick<Audio, 'id'>): string =>
  `${TATOEBA_API_BASE}/v1/audios/${audio.id}/file`;

export const firstTranslationWithAudio = (
  sentence?: PlayableSentence | null
): PlayableTranslation | null =>
  sentence?.translations.find((translation) => translation.audios.length > 0) ?? null;
