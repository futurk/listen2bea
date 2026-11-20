import { describe, expect, it } from '@jest/globals';
import {
  buildPlaylistTracks,
  metadataForSentence,
  SILENCE_TRACKS,
  silenceFor,
} from '../playlist';
import type { Settings } from '../storage';
import type { PlayableSentence } from '../types';

const settings: Settings = {
  from: 'deu',
  to: 'eng',
  pauseSeconds: 2,
  repeatOriginal: true,
};

const sentence = (overrides: Partial<PlayableSentence> = {}): PlayableSentence => ({
  id: 1,
  text: 'Hallo.',
  lang: 'deu',
  audios: [{ id: 1, author: 'a', license: 'CC BY 4.0' }],
  translations: [
    {
      id: 2,
      text: 'Hello.',
      lang: 'eng',
      is_direct: true,
      audios: [{ id: 2, author: 'b', license: 'CC BY 4.0' }],
    },
  ],
  ...overrides,
});

describe('buildPlaylistTracks', () => {
  it('builds original, pause, translation, pause, repeat, pause', () => {
    const tracks = buildPlaylistTracks([sentence()], 0, settings);

    expect(tracks.map((track) => track.entry.kind)).toEqual([
      'original',
      'pause',
      'translation',
      'pause',
      'repeat',
      'pause',
    ]);
    expect(tracks[0].source).toContain('/v1/audios/1/file');
    expect(tracks[2].source).toContain('/v1/audios/2/file');
    expect(tracks[1].source).toBe(SILENCE_TRACKS[1]);
    expect(tracks[3].source).toBe(SILENCE_TRACKS[1]);
  });

  it('omits the repeat when disabled', () => {
    const tracks = buildPlaylistTracks([sentence()], 0, {
      ...settings,
      repeatOriginal: false,
    });

    expect(tracks.map((track) => track.entry.kind)).toEqual([
      'original',
      'pause',
      'translation',
      'pause',
    ]);
  });

  it('skips the translation when it has no audio', () => {
    const tracks = buildPlaylistTracks(
      [
        sentence({
          translations: [
            { id: 3, text: 'Hi.', lang: 'eng', is_direct: true, audios: [] },
          ],
        }),
      ],
      0,
      settings
    );

    expect(tracks.map((track) => track.entry.kind)).toEqual([
      'original',
      'pause',
      'repeat',
      'pause',
    ]);
  });

  it('maps entries back to their original sentence index', () => {
    const tracks = buildPlaylistTracks(
      [sentence(), sentence({ id: 4, text: 'Tschüss.' })],
      7,
      settings
    );

    expect(tracks[0].entry.sentenceIndex).toBe(7);
    expect(tracks[6].entry.sentenceIndex).toBe(8);
  });
});

describe('silence tracks', () => {
  it('clamps pause lengths to the available assets', () => {
    expect(silenceFor(0)).toBe(SILENCE_TRACKS[0]);
    expect(silenceFor(3)).toBe(SILENCE_TRACKS[2]);
    expect(silenceFor(99)).toBe(SILENCE_TRACKS[4]);
  });
});

describe('metadataForSentence', () => {
  it('uses and truncates the sentence text', () => {
    expect(metadataForSentence(sentence()).title).toBe('Hallo.');

    const longText = 'a'.repeat(100);
    const title = metadataForSentence(sentence({ text: longText })).title;
    expect(title).toBe(`${'a'.repeat(77)}…`);
  });
});
