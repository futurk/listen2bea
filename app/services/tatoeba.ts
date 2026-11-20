import type { Audio, Sentence, SentenceSearchResponse, Translation } from '../constants/types';

export const TATOEBA_API_BASE = 'https://api.tatoeba.org';

const DEFAULT_SENTENCES_ENDPOINT = `${TATOEBA_API_BASE}/v1/sentences`;
const SENTENCES_ENDPOINT =
    process.env.EXPO_PUBLIC_TATOEBA_API_URL || DEFAULT_SENTENCES_ENDPOINT;

export interface SentenceSearchOptions {
    from: string;
    to: string;
    limit?: number;
    /** Only return sentences whose translations have audio (needed by freeplay). */
    requireTranslationAudio?: boolean;
}

export interface SentencePage {
    sentences: Sentence[];
    next: string | null;
}

export interface FetchSentencePageOptions {
    /** Only keep sentences whose translations have playable audio (needed by freeplay). */
    requireTranslationAudio?: boolean;
    signal?: AbortSignal;
}

const buildQuery = (params: Array<[string, string]>): string =>
    params
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&');

export const buildSentenceSearchUrl = ({
    from,
    to,
    limit = 20,
    requireTranslationAudio = true,
}: SentenceSearchOptions): string => {
    const params: Array<[string, string]> = [
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

    return `${SENTENCES_ENDPOINT}?${buildQuery(params)}`;
};

/**
 * An empty audio license means the author does not allow reuse outside of
 * Tatoeba. The download endpoint returns HTTP 403 for those recordings and the
 * browser reports it as "The element has no supported sources".
 */
type PlayableTranslation = Omit<Translation, 'audios'> & { audios: Audio[] };

type PlayableSentence = Omit<Sentence, 'audios' | 'translations'> & {
    audios: Audio[];
    translations: PlayableTranslation[];
};

const isReusableAudio = (audio: Audio): boolean => (audio.license ?? '').trim().length > 0;

const withReusableAudios = (sentence: Sentence): PlayableSentence => ({
    ...sentence,
    audios: (sentence.audios ?? []).filter(isReusableAudio),
    translations: (sentence.translations ?? []).map((translation) => ({
        ...translation,
        audios: (translation.audios ?? []).filter(isReusableAudio),
    })),
});

export const fetchSentencePage = async (
    url: string,
    { requireTranslationAudio = true, signal }: FetchSentencePageOptions = {}
): Promise<SentencePage> => {
    const response = await fetch(url, {
        signal,
        headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
        throw new Error(`Tatoeba API request failed: ${response.status} ${response.statusText}`);
    }

    const json = (await response.json()) as Partial<SentenceSearchResponse>;

    // Keep only sentences we can actually practice with: they need a
    // playable translation and (original) audio. This also narrows the type
    // for consumers.
    const sentences = (json.data ?? [])
        .map(withReusableAudios)
        .filter((sentence) => sentence.translations.length > 0)
        .filter((sentence) => sentence.audios.length > 0)
        .filter(
            (sentence) =>
                !requireTranslationAudio ||
                sentence.translations.some((translation) => translation.audios.length > 0)
        );

    return {
        sentences,
        next: json.paging?.has_next ? json.paging.next ?? null : null,
    };
};

/**
 * The `download_url` returned by the API points at `/v1/audio/{id}/file`, which
 * currently 404s. The working endpoint uses the plural `audios`.
 */
export const audioFileUrl = (audio: Pick<Audio, 'id'>): string =>
    `${TATOEBA_API_BASE}/v1/audios/${audio.id}/file`;

export const firstTranslationWithAudio = (sentence?: Sentence | null): Translation | null =>
    sentence?.translations?.find((translation) => (translation.audios?.length ?? 0) > 0) ?? null;
