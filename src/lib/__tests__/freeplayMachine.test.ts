import { describe, expect, it } from '@jest/globals';
import {
  initialFreeplayState,
  reduceFreeplay,
  type FreeplayState,
} from '../freeplayMachine';
import type { PlaylistPlan } from '../playlist';

const plan: PlaylistPlan = {
  tracks: [],
  sentenceStarts: new Map([
    [0, 0],
    [1, 3],
    [2, 6],
  ]),
  lastSentenceIndex: 2,
  lastTrackIndex: 8,
};

const startedState = (overrides: Partial<FreeplayState> = {}): FreeplayState => ({
  ...initialFreeplayState,
  status: 'playing',
  plan,
  currentSentence: 1,
  intent: 'playing',
  ...overrides,
});

describe('reduceFreeplay', () => {
  it('loads a plan and reports playback intent', () => {
    const transition = reduceFreeplay(initialFreeplayState, {
      type: 'replan',
      plan,
      sentenceIndex: 1,
      autoPlay: true,
    });

    expect(transition.state.status).toBe('playing');
    expect(transition.state.plan).toBe(plan);
    expect(transition.state.currentSentence).toBe(1);
    expect(transition.commands).toEqual([
      { type: 'load', plan, startSentence: 1, autoPlay: true },
    ]);
  });

  it('loads paused when autoplay is disabled', () => {
    const transition = reduceFreeplay(initialFreeplayState, {
      type: 'replan',
      plan,
      sentenceIndex: 1,
      autoPlay: false,
    });

    expect(transition.state.status).toBe('paused');
    expect(transition.state.intent).toBe('paused');
    expect(transition.commands[0]).toMatchObject({ type: 'load', autoPlay: false });
  });

  it('resumes when playing without a pending target', () => {
    const transition = reduceFreeplay(startedState({ status: 'paused', intent: 'paused' }), {
      type: 'play',
    });

    expect(transition.state.intent).toBe('playing');
    expect(transition.commands).toEqual([
      { type: 'resume', sentenceIndex: 1 },
    ]);
  });

  it('skips to a pending target and keeps it until the track change confirms it', () => {
    const targetState = reduceFreeplay(startedState(), {
      type: 'setTarget',
      sentenceIndex: 2,
    }).state;

    const transition = reduceFreeplay(targetState, { type: 'play' });

    expect(transition.state.targetSentence).toBe(2);
    expect(transition.commands).toEqual([
      { type: 'skipToSentence', sentenceIndex: 2, play: true },
    ]);

    const confirmed = reduceFreeplay(transition.state, {
      type: 'trackChanged',
      sentenceIndex: 2,
    }).state;

    expect(confirmed.currentSentence).toBe(2);
    expect(confirmed.targetSentence).toBeNull();
  });

  it('ignores a track change that does not match the pending target', () => {
    const targetState = reduceFreeplay(startedState(), {
      type: 'setTarget',
      sentenceIndex: 2,
    }).state;

    const transition = reduceFreeplay(targetState, {
      type: 'trackChanged',
      sentenceIndex: 1,
    });

    expect(transition.state.currentSentence).toBe(1);
    expect(transition.state.targetSentence).toBe(2);
  });

  it('keeps the same state when a status update repeats the current sentence', () => {
    const state = startedState();

    const transition = reduceFreeplay(state, {
      type: 'trackChanged',
      sentenceIndex: 1,
    });

    expect(transition.state).toBe(state);
    expect(transition.commands).toEqual([]);
  });

  it('pauses at the beginning of the pending sentence', () => {
    const targetState = reduceFreeplay(startedState(), {
      type: 'setTarget',
      sentenceIndex: 2,
    }).state;

    const transition = reduceFreeplay(targetState, { type: 'pause' });

    expect(transition.state.status).toBe('paused');
    expect(transition.state.currentSentence).toBe(2);
    expect(transition.state.targetSentence).toBeNull();
    expect(transition.commands).toEqual([
      { type: 'pauseAtSentenceStart', sentenceIndex: 2 },
    ]);
  });

  it('moves to interrupted state on a player error', () => {
    const transition = reduceFreeplay(startedState(), {
      type: 'playerError',
      message: 'network',
    });

    expect(transition.state.status).toBe('interrupted');
    expect(transition.state.error).toBe('network');
    expect(transition.state.intent).toBe('paused');
    expect(transition.commands).toEqual([{ type: 'deactivate' }]);
  });

  it('marks the session as ended once', () => {
    const first = reduceFreeplay(startedState(), { type: 'playerEnded' });
    expect(first.state.status).toBe('ended');
    expect(first.commands).toEqual([{ type: 'deactivate' }]);

    const second = reduceFreeplay(first.state, { type: 'playerEnded' });
    expect(second.commands).toEqual([]);
  });

  it('tracks fetching state and errors', () => {
    const started = reduceFreeplay(startedState(), { type: 'fetchingStarted' });
    expect(started.state.fetchingMore).toBe(true);

    const failed = reduceFreeplay(started.state, {
      type: 'error',
      message: 'no results',
    });
    expect(failed.state.fetchingMore).toBe(false);
    expect(failed.state.error).toBe('no results');
  });

  it('resets to the initial state', () => {
    const transition = reduceFreeplay(startedState(), { type: 'reset' });

    expect(transition.state).toEqual(initialFreeplayState);
    expect(transition.commands).toEqual([{ type: 'reset' }]);
  });
});
