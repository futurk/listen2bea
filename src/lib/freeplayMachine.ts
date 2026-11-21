import type { PlaylistPlan } from './playlist';

export type FreeplayStatus = 'idle' | 'playing' | 'paused' | 'interrupted' | 'ended';
export type PlaybackIntent = 'playing' | 'paused';

export interface FreeplayState {
  status: FreeplayStatus;
  plan: PlaylistPlan | null;
  currentSentence: number;
  targetSentence: number | null;
  intent: PlaybackIntent;
  error: string | null;
  fetchingMore: boolean;
}

export type FreeplayCommand =
  | { type: 'load'; plan: PlaylistPlan; startSentence: number; autoPlay: boolean }
  | { type: 'skipToSentence'; sentenceIndex: number; play: boolean }
  | { type: 'pauseAtSentenceStart'; sentenceIndex: number }
  | { type: 'resume'; sentenceIndex: number }
  | { type: 'deactivate' }
  | { type: 'reset' };

export type FreeplayAction =
  | { type: 'setTarget'; sentenceIndex: number }
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'navigate'; sentenceIndex: number; play: boolean }
  | { type: 'trackChanged'; sentenceIndex: number }
  | { type: 'playerError'; message: string }
  | { type: 'playerEnded' }
  | { type: 'replan'; plan: PlaylistPlan; sentenceIndex: number; autoPlay: boolean }
  | { type: 'fetchingStarted' }
  | { type: 'fetchingFinished' }
  | { type: 'error'; message: string }
  | { type: 'reset' };

export interface FreeplayTransition {
  state: FreeplayState;
  commands: FreeplayCommand[];
}

export const initialFreeplayState: FreeplayState = {
  status: 'idle',
  plan: null,
  currentSentence: 0,
  targetSentence: null,
  intent: 'paused',
  error: null,
  fetchingMore: false,
};

const idle = (state: FreeplayState): FreeplayTransition => ({
  state,
  commands: [],
});

const load = (
  state: FreeplayState,
  plan: PlaylistPlan,
  sentenceIndex: number,
  autoPlay: boolean
): FreeplayTransition => ({
  state: {
    ...state,
    status: autoPlay ? 'playing' : 'paused',
    plan,
    currentSentence: sentenceIndex,
    targetSentence: null,
    intent: autoPlay ? 'playing' : 'paused',
    error: null,
  },
  commands: [{ type: 'load', plan, startSentence: sentenceIndex, autoPlay }],
});

export function reduceFreeplay(
  state: FreeplayState,
  action: FreeplayAction
): FreeplayTransition {
  switch (action.type) {
    case 'setTarget':
      return idle({ ...state, targetSentence: action.sentenceIndex });

    case 'play':
      if (!state.plan) {
        return idle(state);
      }
      if (state.targetSentence !== null) {
        return {
          state: { ...state, status: 'playing', intent: 'playing', error: null },
          commands: [
            {
              type: 'skipToSentence',
              sentenceIndex: state.targetSentence,
              play: true,
            },
          ],
        };
      }
      return {
        state: { ...state, status: 'playing', intent: 'playing', error: null },
        commands: [{ type: 'resume', sentenceIndex: state.currentSentence }],
      };

    case 'pause': {
      if (!state.plan) {
        return idle({
          ...state,
          status: 'idle',
          intent: 'paused',
          targetSentence: null,
          error: null,
        });
      }
      const sentenceIndex = state.targetSentence ?? state.currentSentence;
      return {
        state: {
          ...state,
          currentSentence: sentenceIndex,
          // The pause command rewinds to this sentence's start, so a pending
          // navigation has been realized and no longer needs to be tracked.
          targetSentence: null,
          status: 'paused',
          intent: 'paused',
          error: null,
        },
        commands: [{ type: 'pauseAtSentenceStart', sentenceIndex }],
      };
    }

    case 'navigate':
      if (!state.plan) {
        return idle({
          ...state,
          currentSentence: action.sentenceIndex,
          targetSentence: null,
          status: 'idle',
          intent: 'paused',
          error: null,
        });
      }
      return {
        state: {
          ...state,
          currentSentence: action.sentenceIndex,
          targetSentence: action.sentenceIndex,
          status: action.play ? 'playing' : 'paused',
          intent: action.play ? 'playing' : 'paused',
          error: null,
        },
        commands: [
          {
            type: 'skipToSentence',
            sentenceIndex: action.sentenceIndex,
            play: action.play,
          },
        ],
      };

    case 'trackChanged':
      if (
        state.targetSentence !== null &&
        action.sentenceIndex !== state.targetSentence
      ) {
        return idle(state);
      }
      if (
        state.targetSentence === null &&
        state.currentSentence === action.sentenceIndex
      ) {
        // Status updates arrive several times a second; keep the same state
        // object so React can bail out of the re-render.
        return idle(state);
      }
      return idle({
        ...state,
        currentSentence: action.sentenceIndex,
        targetSentence: null,
      });

    case 'playerError':
      if (state.status === 'interrupted' && state.error === action.message) {
        return idle(state);
      }
      return {
        state: {
          ...state,
          status: 'interrupted',
          intent: 'paused',
          error: action.message,
          targetSentence: null,
        },
        commands: [{ type: 'deactivate' }],
      };

    case 'playerEnded':
      if (state.status === 'ended') {
        return idle(state);
      }
      return {
        state: {
          ...state,
          status: 'ended',
          intent: 'paused',
          error: null,
          targetSentence: null,
        },
        commands: [{ type: 'deactivate' }],
      };

    case 'replan':
      return load(state, action.plan, action.sentenceIndex, action.autoPlay);

    case 'fetchingStarted':
      return idle({ ...state, fetchingMore: true, error: null });

    case 'fetchingFinished':
      return idle({ ...state, fetchingMore: false });

    case 'error':
      return idle({ ...state, error: action.message, fetchingMore: false });

    case 'reset':
      return {
        state: initialFreeplayState,
        commands: [{ type: 'reset' }],
      };

    default:
      return idle(state);
  }
}
