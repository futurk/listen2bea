import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  audioFileUrl,
  buildSentenceSearchUrl,
  clearSentencePageCache,
  fetchSentencePage,
  firstTranslationWithAudio,
  isReusableAudio,
  prepareSentences,
} from '../tatoeba';
import type { Sentence } from '../types';

const usableAudio = (id: number, license = 'CC BY 4.0') => ({
  id,
  author: `author-${id}`,
  license,
});

const sentence = (overrides: Partial<Sentence> = {}): Sentence => ({
  id: 1,
  text: 'Hallo.',
  lang: 'deu',
  audios: [usableAudio(1)],
  translations: [
    {
      id: 2,
      text: 'Hello.',
      lang: 'eng',
      is_direct: true,
      audios: [usableAudio(2)],
    },
  ],
  ...overrides,
});

describe('buildSentenceSearchUrl', () => {
  it('builds a v1 sentence search with audio and cursor pagination', () => {
    const url = buildSentenceSearchUrl({ from: 'deu', to: 'eng', limit: 5 });

    expect(url.startsWith('https://api.tatoeba.org/v1/sentences?')).toBe(true);
    expect(url).toContain('lang=deu');
    expect(url).toContain('trans%3Alang=eng');
    expect(url).toContain('has_audio=yes');
    expect(url).toContain('origin=original');
    expect(url).toContain('include=audios');
    expect(url).toContain('sort=random');
    expect(url).toContain('limit=5');
    expect(url).toContain('trans%3Ahas_audio=yes');
  });

  it('does not require translation audio when disabled', () => {
    const url = buildSentenceSearchUrl({
      from: 'deu',
      to: 'eng',
      requireTranslationAudio: false,
    });

    expect(url).not.toContain('trans%3Ahas_audio=yes');
  });
});

describe('audio filtering', () => {
  it('treats empty or whitespace licenses as unusable', () => {
    expect(isReusableAudio(usableAudio(1))).toBe(true);
    expect(isReusableAudio(usableAudio(1, ''))).toBe(false);
    expect(isReusableAudio(usableAudio(1, '   '))).toBe(false);
  });

  it('strips unusable audio from sentences and translations', () => {
    const [prepared] = prepareSentences(
      [
        sentence({
          audios: [usableAudio(3), usableAudio(4, '')],
          translations: [
            {
              id: 5,
              text: 'Hi.',
              lang: 'eng',
              is_direct: true,
              audios: [usableAudio(6, '')],
            },
          ],
        }),
      ],
      false
    );

    expect(prepared.audios.map((audio) => audio.id)).toEqual([3]);
    expect(prepared.translations[0].audios).toEqual([]);
  });

  it('drops sentences without a usable original recording', () => {
    const result = prepareSentences(
      [sentence({ audios: [usableAudio(1, '')] })],
      false
    );

    expect(result).toHaveLength(0);
  });

  it('requires translation audio only when requested', () => {
    const data = [
      sentence({
        translations: [
          { id: 7, text: 'Hello.', lang: 'eng', is_direct: true, audios: [] },
        ],
      }),
    ];

    expect(prepareSentences(data, true)).toHaveLength(0);
    expect(prepareSentences(data, false)).toHaveLength(1);
  });

  it('picks the first translation with audio', () => {
    const [prepared] = prepareSentences(
      [
        sentence({
          translations: [
            { id: 8, text: 'No audio.', lang: 'eng', is_direct: true, audios: [] },
            {
              id: 9,
              text: 'With audio.',
              lang: 'eng',
              is_direct: true,
              audios: [usableAudio(10)],
            },
          ],
        }),
      ],
      true
    );

    expect(firstTranslationWithAudio(prepared)?.id).toBe(9);
  });
});

describe('audioFileUrl', () => {
  it('uses the working plural audios endpoint', () => {
    expect(audioFileUrl({ id: 695154 })).toBe(
      'https://api.tatoeba.org/v1/audios/695154/file'
    );
  });
});

describe('fetchSentencePage', () => {
  beforeEach(() => {
    clearSentencePageCache();
    jest.restoreAllMocks();
  });

  it('normalizes data and caches identical requests', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        data: [sentence()],
        paging: { total: 1, has_next: true, next: 'https://example.test/next' },
      }),
    }));

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const first = await fetchSentencePage('https://example.test/page', {
      requireTranslationAudio: true,
    });
    const second = await fetchSentencePage('https://example.test/page', {
      requireTranslationAudio: true,
    });

    expect(first.sentences).toHaveLength(1);
    expect(first.next).toBe('https://example.test/next');
    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws on a failed response', async () => {
    globalThis.fetch = jest.fn(async () => ({
      ok: false,
      status: 403,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    await expect(fetchSentencePage('https://example.test/fail')).rejects.toThrow(
      'Tatoeba request failed (403)'
    );
  });
});
