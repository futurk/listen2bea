import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { AudioMetadata, AudioSource } from 'expo-audio';
import {
  executeFreeplayCommand,
  LOAD_SETTLE_MS,
  type FreeplayPlaylistHandle,
} from '../freeplayExecutor';
import { initialFreeplayState, type FreeplayState } from '../freeplayMachine';
import type { PlaylistPlan } from '../playlist';
import type { PlayableSentence } from '../types';

const plan: PlaylistPlan = {
  tracks: [
    { source: { uri: 'original-0' }, entry: { sentenceIndex: 0, kind: 'original' } },
    {
      source: { uri: 'translation-0' },
      entry: { sentenceIndex: 0, kind: 'translation' },
    },
    { source: { uri: 'original-1' }, entry: { sentenceIndex: 1, kind: 'original' } },
  ],
  sentenceStarts: new Map([
    [0, 0],
    [1, 2],
  ]),
  lastTrackIndex: 2,
};

const startedState: FreeplayState = {
  ...initialFreeplayState,
  status: 'playing',
  plan,
  intent: 'playing',
};

const sentence = (id: number): PlayableSentence => ({
  id,
  text: `Sentence ${id}`,
  lang: 'deu',
  audios: [],
  primaryAudioId: null,
  translations: [],
});

const createRefs = (
  state: FreeplayState = startedState,
  sentences: PlayableSentence[] = [sentence(1), sentence(2)]
) => ({
  stateRef: { current: state },
  sentencesRef: { current: sentences },
  loadTokenRef: { current: 0 },
  rebuildingRef: { current: false },
});

const createPlaylist = (overrides: Partial<FreeplayPlaylistHandle> = {}) => {
  const calls = {
    log: [] as string[],
    added: [] as AudioSource[],
    skipped: [] as number[],
    sought: [] as number[],
    activated: [] as { active: boolean; title?: string }[],
    paused: 0,
    cleared: 0,
    played: 0,
  };

  const playlist: FreeplayPlaylistHandle = {
    setActiveForLockScreen: (active: boolean, metadata?: AudioMetadata) => {
      calls.log.push(`active:${active}`);
      calls.activated.push({ active, title: metadata?.title });
    },
    pause: () => {
      calls.log.push('pause');
      calls.paused++;
    },
    clear: () => {
      calls.log.push('clear');
      calls.cleared++;
    },
    add: (source: AudioSource) => {
      calls.log.push('add');
      calls.added.push(source);
    },
    skipTo: (index: number) => {
      calls.log.push(`skip:${index}`);
      calls.skipped.push(index);
    },
    seekTo: async (seconds: number) => {
      calls.log.push(`seek:${seconds}`);
      calls.sought.push(seconds);
    },
    play: () => {
      calls.log.push('play');
      calls.played++;
    },
    ...overrides,
  };

  return { playlist, calls };
};

describe('executeFreeplayCommand', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('rebuilds the queue, activates the lock screen and plays', () => {
    jest.useFakeTimers();
    const { playlist, calls } = createPlaylist();
    const refs = createRefs();

    executeFreeplayCommand(
      { playlist, refs },
      { type: 'load', plan, startSentence: 1, autoPlay: true }
    );

    expect(calls.log.slice(0, 4)).toEqual(['active:false', 'pause', 'clear', 'add']);
    expect(calls.added).toHaveLength(plan.tracks.length);
    expect(calls.activated.at(-1)).toEqual({
      active: true,
      title: 'Sentence 2',
    });
    expect(calls.skipped).toEqual([0]);
    expect(calls.played).toBe(1);
    expect(refs.rebuildingRef.current).toBe(true);

    jest.advanceTimersByTime(LOAD_SETTLE_MS);
    expect(refs.rebuildingRef.current).toBe(false);
  });

  it('loads paused when autoplay is disabled', () => {
    jest.useFakeTimers();
    const { playlist, calls } = createPlaylist();
    const refs = createRefs();

    executeFreeplayCommand(
      { playlist, refs },
      { type: 'load', plan, startSentence: 0, autoPlay: false }
    );

    expect(calls.played).toBe(0);
    jest.advanceTimersByTime(LOAD_SETTLE_MS);
    expect(refs.rebuildingRef.current).toBe(false);
  });

  it('clears the rebuild flag when loading fails', () => {
    let additions = 0;
    const { playlist } = createPlaylist({
      add: () => {
        additions++;
        if (additions === 2) {
          throw new Error('add failed');
        }
      },
    });
    const refs = createRefs();

    expect(() =>
      executeFreeplayCommand(
        { playlist, refs },
        { type: 'load', plan, startSentence: 0, autoPlay: true }
      )
    ).toThrow('add failed');

    expect(refs.rebuildingRef.current).toBe(false);
    expect(refs.loadTokenRef.current).toBe(2);
  });

  it('skips to a sentence start and resumes when requested', () => {
    const { playlist, calls } = createPlaylist();
    const refs = createRefs();

    executeFreeplayCommand(
      { playlist, refs },
      { type: 'skipToSentence', sentenceIndex: 1, play: true }
    );

    expect(calls.skipped).toEqual([2]);
    expect(calls.played).toBe(1);
    expect(calls.activated).toEqual([]);
  });

  it('skips without playing when playback is paused', () => {
    const { playlist, calls } = createPlaylist();
    const refs = createRefs();

    executeFreeplayCommand(
      { playlist, refs },
      { type: 'skipToSentence', sentenceIndex: 1, play: false }
    );

    expect(calls.skipped).toEqual([2]);
    expect(calls.played).toBe(0);
  });

  it('ignores a sentence that is not in the plan', () => {
    const { playlist, calls } = createPlaylist();
    const refs = createRefs();

    executeFreeplayCommand(
      { playlist, refs },
      { type: 'skipToSentence', sentenceIndex: 9, play: true }
    );

    expect(calls.log).toEqual([]);
  });

  it('pauses at the beginning of the requested sentence', () => {
    const { playlist, calls } = createPlaylist();
    const refs = createRefs();

    executeFreeplayCommand(
      { playlist, refs },
      { type: 'pauseAtSentenceStart', sentenceIndex: 1 }
    );

    expect(calls.paused).toBe(1);
    expect(calls.skipped).toEqual([2]);
    expect(calls.sought).toEqual([0]);
  });

  it('resumes without touching the lock screen', () => {
    const { playlist, calls } = createPlaylist();
    const refs = createRefs();

    executeFreeplayCommand({ playlist, refs }, { type: 'resume', sentenceIndex: 0 });

    expect(calls.played).toBe(1);
    expect(calls.activated).toEqual([]);
  });

  it('pauses and detaches on deactivate', () => {
    const { playlist, calls } = createPlaylist();
    const refs = createRefs();

    executeFreeplayCommand({ playlist, refs }, { type: 'deactivate' });

    expect(calls.paused).toBe(1);
    expect(calls.activated).toEqual([{ active: false, title: undefined }]);
  });

  it('deactivates, pauses and clears on reset', () => {
    const { playlist, calls } = createPlaylist();
    const refs = createRefs();

    executeFreeplayCommand({ playlist, refs }, { type: 'reset' });

    expect(calls.activated).toEqual([{ active: false, title: undefined }]);
    expect(calls.paused).toBe(1);
    expect(calls.cleared).toBe(1);
  });
});
