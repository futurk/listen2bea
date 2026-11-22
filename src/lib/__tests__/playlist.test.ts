import { describe, expect, it } from '@jest/globals';
import {
  buildPlaylistPlan,
  buildPlaylistTracks,
  findSentenceStart,
  metadataForSentence,
  sentenceAtTrack,
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
  primaryAudioId: 1,
  translations: [
    {
      id: 2,
      text: 'Hello.',
      lang: 'eng',
      is_direct: true,
      audios: [{ id: 2, author: 'b', license: 'CC BY 4.0' }],
      primaryAudioId: 2,
    },
  ],
  ...overrides,
});

const uriOf = (source: unknown): string | undefined => {
  if (source && typeof source === 'object' && 'uri' in source) {
    return (source as { uri?: string }).uri;
  }
  return undefined;
};

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
    expect(uriOf(tracks[0].source)).toBe(
      'https://audio.tatoeba.org/sentences/deu/1.mp3'
    );
    expect(uriOf(tracks[2].source)).toBe(
      'https://audio.tatoeba.org/sentences/eng/2.mp3'
    );
    expect(uriOf(tracks[4].source)).toBe(
      'https://audio.tatoeba.org/sentences/deu/1.mp3'
    );
    expect(uriOf(tracks[1].source)).toBeTruthy();
    expect(tracks[1].source).toEqual(tracks[3].source);
  });

  it('falls back to the API file when the playable audio is not the primary recording', () => {
    const tracks = buildPlaylistTracks(
      [
        sentence({
          audios: [{ id: 5, author: 'a', license: 'CC BY 4.0' }],
          primaryAudioId: 4,
        }),
      ],
      0,
      settings
    );

    expect(uriOf(tracks[0].source)).toBe(
      'https://api.tatoeba.org/v1/audios/5/file'
    );
    expect(uriOf(tracks[4].source)).toBe(
      'https://api.tatoeba.org/v1/audios/5/file'
    );
  });

  it('passes every track as an AudioSource object with a uri', () => {
    const tracks = buildPlaylistTracks([sentence()], 0, settings);

    for (const track of tracks) {
      expect(typeof track.source).toBe('object');
      expect(track.source).not.toBeNull();
      expect(uriOf(track.source)).toBeTruthy();
    }
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
            {
              id: 3,
              text: 'Hi.',
              lang: 'eng',
              is_direct: true,
              audios: [],
              primaryAudioId: null,
            },
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

describe('buildPlaylistPlan', () => {
  it('maps sentence starts and final indexes', () => {
    const plan = buildPlaylistPlan(
      [sentence(), sentence({ id: 4, text: 'Tschüss.' })],
      0,
      settings
    );

    expect(plan.sentenceStarts.get(0)).toBe(0);
    expect(plan.sentenceStarts.get(1)).toBe(6);
    expect(plan.lastTrackIndex).toBe(11);
    expect(sentenceAtTrack(plan, 6)).toBe(1);
    expect(findSentenceStart(plan, 1)).toBe(6);
  });

  it('can start a plan from a later sentence', () => {
    const plan = buildPlaylistPlan(
      [sentence(), sentence({ id: 4, text: 'Tschüss.' })],
      1,
      settings
    );

    expect(plan.sentenceStarts.has(0)).toBe(false);
    expect(plan.sentenceStarts.get(1)).toBe(0);
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
