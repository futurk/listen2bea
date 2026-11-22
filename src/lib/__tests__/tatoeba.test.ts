import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  audioFileUrl,
  audioUrlFor,
  buildSentenceSearchUrl,
  clearSentencePageCache,
  fetchSentencePage,
  firstTranslationWithAudio,
  isReusableAudio,
  prepareSentences,
  staticAudioFileUrl,
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
  afterEach(() => {
    jest.restoreAllMocks();
  });

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

  it('remembers the primary recording before license filtering', () => {
    const [prepared] = prepareSentences(
      [
        sentence({
          audios: [usableAudio(11, ''), usableAudio(12)],
          translations: [
            {
              id: 13,
              text: 'Hi.',
              lang: 'eng',
              is_direct: true,
              audios: [usableAudio(14), usableAudio(15, '')],
            },
          ],
        }),
      ],
      false
    );

    expect(prepared.primaryAudioId).toBe(11);
    expect(prepared.audios.map((audio) => audio.id)).toEqual([12]);
    expect(prepared.translations[0].primaryAudioId).toBe(14);
    expect(prepared.translations[0].audios.map((audio) => audio.id)).toEqual([14]);
  });

  it('shuffles eligible recordings when the primary one is not reusable', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.99);

    const [prepared] = prepareSentences(
      [
        sentence({
          audios: [usableAudio(20, ''), usableAudio(21), usableAudio(22)],
          translations: [
            {
              id: 23,
              text: 'Hi.',
              lang: 'eng',
              is_direct: true,
              audios: [usableAudio(24, ''), usableAudio(25), usableAudio(26)],
            },
          ],
        }),
      ],
      false
    );

    expect(prepared.audios.map((audio) => audio.id)).toEqual([22, 21]);
    expect(prepared.primaryAudioId).toBe(20);
    expect(prepared.translations[0].audios.map((audio) => audio.id)).toEqual([
      26, 25,
    ]);
    expect(prepared.translations[0].primaryAudioId).toBe(24);
  });

  it('keeps the primary recording first when it is reusable', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.99);

    const [prepared] = prepareSentences(
      [
        sentence({
          audios: [usableAudio(30), usableAudio(31), usableAudio(32)],
        }),
      ],
      false
    );

    expect(prepared.audios.map((audio) => audio.id)).toEqual([30, 31, 32]);
  });

  it('does not shuffle when only one recording is reusable', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);

    const [prepared] = prepareSentences(
      [sentence({ audios: [usableAudio(40, ''), usableAudio(41)] })],
      false
    );

    expect(prepared.audios.map((audio) => audio.id)).toEqual([41]);
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

  it('builds the static sentence audio URL', () => {
    expect(staticAudioFileUrl('deu', 2525369)).toBe(
      'https://audio.tatoeba.org/sentences/deu/2525369.mp3'
    );
  });
});

describe('audioUrlFor', () => {
  it('uses the static host for primary sentence and translation recordings', () => {
    const [prepared] = prepareSentences([sentence()], false);

    expect(audioUrlFor(prepared)).toBe(
      'https://audio.tatoeba.org/sentences/deu/1.mp3'
    );
    expect(audioUrlFor(prepared.translations[0])).toBe(
      'https://audio.tatoeba.org/sentences/eng/2.mp3'
    );
  });

  it('falls back to the API when the playable recording is not primary', () => {
    const [prepared] = prepareSentences(
      [sentence({ audios: [usableAudio(1, ''), usableAudio(2)] })],
      false
    );

    expect(audioUrlFor(prepared)).toBe(
      'https://api.tatoeba.org/v1/audios/2/file'
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

  it('rejects immediately when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      fetchSentencePage('https://example.test/aborted', {
        signal: controller.signal,
      })
    ).rejects.toThrow('Aborted');
  });

  it('stops an in-flight request when its signal aborts', async () => {
    globalThis.fetch = jest.fn(
      (_url: string, init?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        })
    ) as unknown as typeof fetch;

    const controller = new AbortController();
    const request = fetchSentencePage('https://example.test/slow', {
      signal: controller.signal,
    });
    controller.abort();

    await expect(request).rejects.toThrow('Aborted');
  });
});
