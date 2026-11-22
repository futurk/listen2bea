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

/**
 * Keeps only reusable recordings. When the API's first recording cannot be
 * reused but several others can, pick one of them at random so playback does
 * not always fall back to the same voice. Keeping the primary recording first
 * when it is reusable also keeps the fast static audio URL available.
 */
const playableAudios = (audios: Audio[] | undefined): Audio[] => {
  const all = audios ?? [];
  const eligible = all.filter(isReusableAudio);
  const primaryIsReusable = all.length > 0 && isReusableAudio(all[0]);

  if (primaryIsReusable || eligible.length < 2) {
    return eligible;
  }

  const pick = Math.floor(Math.random() * eligible.length);
  return [eligible[pick], ...eligible.slice(0, pick), ...eligible.slice(pick + 1)];
};

export function toPlayableSentence(sentence: Sentence): PlayableSentence {
  const translations: PlayableTranslation[] = (sentence.translations ?? []).map(
    (translation) => ({
      ...translation,
      audios: playableAudios(translation.audios),
      primaryAudioId: translation.audios?.[0]?.id ?? null,
    })
  );

  return {
    ...sentence,
    audios: playableAudios(sentence.audios),
    primaryAudioId: sentence.audios?.[0]?.id ?? null,
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

export const TATOEBA_AUDIO_BASE = 'https://audio.tatoeba.org';

/**
 * Static audio host. It serves the first recording of a sentence and responds
 * in milliseconds, while the API file endpoint can take seconds.
 */
export const staticAudioFileUrl = (lang: string, sentenceId: number): string =>
  `${TATOEBA_AUDIO_BASE}/sentences/${lang}/${sentenceId}.mp3`;

/**
 * Fallback for sentences whose playable recording is not the first one. The
 * API's own `download_url` points at `/v1/audio/{id}/file`, which returns 404.
 * The working endpoint uses the plural `audios`.
 */
export const audioFileUrl = (audio: Pick<Audio, 'id'>): string =>
  `${TATOEBA_API_BASE}/v1/audios/${audio.id}/file`;

/**
 * Prefer the fast static host, but only when the playable recording is the
 * item's first one. The static host cannot address any other recording.
 */
export const audioUrlFor = (
  item: PlayableSentence | PlayableTranslation
): string => {
  const audio = item.audios[0];
  return audio.id === item.primaryAudioId
    ? staticAudioFileUrl(item.lang, item.id)
    : audioFileUrl(audio);
};

export const firstTranslationWithAudio = (
  sentence?: PlayableSentence | null
): PlayableTranslation | null =>
  sentence?.translations.find((translation) => translation.audios.length > 0) ?? null;
