import type { AudioSource } from 'expo-audio';
import { Asset } from 'expo-asset';
import type { Settings } from './storage';
import {
  audioFileUrl,
  firstTranslationWithAudio,
  staticAudioFileUrl,
} from './tatoeba';
import type { PlayableSentence, PlayableTranslation } from './types';

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
export const SILENCE_TRACKS: number[] = [
  require('../../assets/audio/silence-1s.mp3'),
  require('../../assets/audio/silence-2s.mp3'),
  require('../../assets/audio/silence-3s.mp3'),
  require('../../assets/audio/silence-4s.mp3'),
  require('../../assets/audio/silence-5s.mp3'),
];

/**
 * Native AudioPlaylist.add() expects an AudioSource record, not a string or
 * asset module ID, and unlike AudioPlayer.replace() it is not normalized by
 * expo-audio's JS wrapper.
 */
const remoteSource = (url: string): AudioSource => ({ uri: url });

/**
 * Prefer the fast static host, but only when the playable recording is the
 * sentence's first one. The static host cannot address any other recording.
 */
const audioSourceFor = (item: PlayableSentence | PlayableTranslation): AudioSource => {
  const audio = item.audios[0];
  const url =
    audio.id === item.primaryAudioId
      ? staticAudioFileUrl(item.lang, item.id)
      : audioFileUrl(audio);
  return remoteSource(url);
};

const silenceSource = (moduleId: number): AudioSource => {
  const asset = Asset.fromModule(moduleId);
  return { uri: asset.localUri ?? asset.uri, name: asset.name };
};

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

export const silenceFor = (seconds: number): number => {
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
  const pauseTrack = silenceSource(silenceFor(settings.pauseSeconds));

  sentences.forEach((sentence, offset) => {
    const sentenceIndex = startIndex + offset;
    const translation = firstTranslationWithAudio(sentence);

    const push = (source: AudioSource, kind: ClipKind) => {
      tracks.push({ source, entry: { sentenceIndex, kind } });
    };

    push(audioSourceFor(sentence), 'original');
    push(pauseTrack, 'pause');

    if (translation) {
      push(audioSourceFor(translation), 'translation');
      push(pauseTrack, 'pause');
    }

    if (settings.repeatOriginal) {
      push(audioSourceFor(sentence), 'repeat');
      push(pauseTrack, 'pause');
    }
  });

  return tracks;
};

export interface PlaylistPlan {
  tracks: BuiltTrack[];
  /** Absolute sentence index -> index of that sentence's first (original) track. */
  sentenceStarts: Map<number, number>;
  lastSentenceIndex: number;
  lastTrackIndex: number;
}

export const buildPlaylistPlan = (
  sentences: PlayableSentence[],
  startIndex: number,
  settings: Settings
): PlaylistPlan => {
  const tracks = buildPlaylistTracks(sentences.slice(startIndex), startIndex, settings);
  const sentenceStarts = new Map<number, number>();

  tracks.forEach((track, trackIndex) => {
    if (!sentenceStarts.has(track.entry.sentenceIndex)) {
      sentenceStarts.set(track.entry.sentenceIndex, trackIndex);
    }
  });

  return {
    tracks,
    sentenceStarts,
    lastSentenceIndex: sentences.length - 1,
    lastTrackIndex: tracks.length - 1,
  };
};

export const findSentenceStart = (
  plan: PlaylistPlan,
  sentenceIndex: number
): number | null => plan.sentenceStarts.get(sentenceIndex) ?? null;

export const sentenceAtTrack = (
  plan: PlaylistPlan,
  trackIndex: number
): number | null => plan.tracks[trackIndex]?.entry.sentenceIndex ?? null;

