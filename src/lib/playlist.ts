import type { AudioSource } from 'expo-audio';
import type { Settings } from './storage';
import { audioFileUrl, firstTranslationWithAudio } from './tatoeba';
import type { PlayableSentence } from './types';

export type ClipKind = 'original' | 'translation' | 'repeat' | 'pause';

export interface QueueEntry {
  sentenceIndex: number;
  kind: ClipKind;
}

export interface BuiltTrack {
  source: AudioSource;
  entry: QueueEntry;
}

/** Short silent MP3s used to insert pauses into the native playlist. */
export const SILENCE_TRACKS: AudioSource[] = [
  require('../../assets/audio/silence-1s.mp3'),
  require('../../assets/audio/silence-2s.mp3'),
  require('../../assets/audio/silence-3s.mp3'),
  require('../../assets/audio/silence-4s.mp3'),
  require('../../assets/audio/silence-5s.mp3'),
];

const BASE_METADATA = {
  title: 'Listen2Bea',
  artist: 'Tatoeba',
  albumTitle: 'Freeplay',
};

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const metadataForSentence = (sentence?: PlayableSentence) => {
  if (!sentence) {
    return BASE_METADATA;
  }
  const text =
    sentence.text.length > 80 ? `${sentence.text.slice(0, 77)}…` : sentence.text;
  return { ...BASE_METADATA, title: text };
};

export const silenceFor = (seconds: number): AudioSource => {
  const index = clamp(Math.round(seconds), 1, SILENCE_TRACKS.length) - 1;
  return SILENCE_TRACKS[index];
};

/**
 * Expands sentences into the exact clip order the native playlist should play:
 * original, pause, translation, pause, optional repeat, pause.
 */
export const buildPlaylistTracks = (
  sentences: PlayableSentence[],
  startIndex: number,
  settings: Settings
): BuiltTrack[] => {
  const tracks: BuiltTrack[] = [];
  const pauseTrack = silenceFor(settings.pauseSeconds);

  sentences.forEach((sentence, offset) => {
    const sentenceIndex = startIndex + offset;
    const original = sentence.audios[0];
    const translation = firstTranslationWithAudio(sentence)?.audios[0];

    const push = (source: AudioSource, kind: ClipKind) => {
      tracks.push({ source, entry: { sentenceIndex, kind } });
    };

    push(audioFileUrl(original), 'original');
    push(pauseTrack, 'pause');

    if (translation) {
      push(audioFileUrl(translation), 'translation');
      push(pauseTrack, 'pause');
    }

    if (settings.repeatOriginal) {
      push(audioFileUrl(original), 'repeat');
      push(pauseTrack, 'pause');
    }
  });

  return tracks;
};
