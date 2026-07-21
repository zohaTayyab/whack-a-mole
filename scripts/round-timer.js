/* Counts a round down in whole seconds. This module holds no DOM references,
   and its timing dependencies are injectable so the countdown can be tested
   without waiting in real time. */

import { ROUND_DURATION_SECONDS } from "./config.js";

const MILLISECONDS_PER_SECOND = 1000;

const TimerState = {
  Stopped: "stopped",
  Running: "running",
  Paused: "paused",
  Finished: "finished",
};

/**
 * Creates a round timer.
 *
 * @param {{durationSeconds?: number, now?: () => number,
 *   schedule?: (callback: () => void, delayMs: number) => *,
 *   cancel?: (handle: *) => void}} [dependencies]
 * @returns {{start: (handlers?: {onTick?: (seconds: number) => void,
 *   onComplete?: () => void}) => void, stop: () => void, pause: () => void,
 *   resume: () => void, getRemainingSeconds: () => number}}
 */
export function createRoundTimer({
  durationSeconds = ROUND_DURATION_SECONDS,
  now = () => Date.now(),
  schedule = (callback, delayMs) => setTimeout(callback, delayMs),
  cancel = (handle) => clearTimeout(handle),
} = {}) {
  const durationMs = durationSeconds * MILLISECONDS_PER_SECOND;

  let state = TimerState.Stopped;
  let scheduledHandle = null;
  let deadline = 0;
  let remainingMs = durationMs;
  let handlers = {};
  /* Incremented whenever a run ends or begins, so a callback scheduled by an
     earlier run cannot tick or complete a newer one. */
  let runToken = 0;

  /* Measured against a fixed deadline rather than accumulated from each tick,
     so a late callback does not push the end of the round further away. */
  function currentRemainingMs() {
    if (state !== TimerState.Running) {
      return remainingMs;
    }

    return Math.max(0, deadline - now());
  }

  function wholeSecondsFrom(milliseconds) {
    return Math.max(0, Math.ceil(milliseconds / MILLISECONDS_PER_SECOND));
  }

  function cancelScheduledTick() {
    if (scheduledHandle !== null) {
      cancel(scheduledHandle);
      scheduledHandle = null;
    }
  }

  /* Aims at the moment the displayed second changes, so a delayed callback
     resynchronises instead of drifting a little further every tick. */
  function scheduleNextTick() {
    const leftMs = currentRemainingMs();
    const nextBoundaryMs = (wholeSecondsFrom(leftMs) - 1) * MILLISECONDS_PER_SECOND;
    const token = runToken;

    scheduledHandle = schedule(() => tick(token), Math.max(0, leftMs - nextBoundaryMs));
  }

  function tick(token) {
    if (token !== runToken || state !== TimerState.Running) {
      return;
    }

    scheduledHandle = null;
    remainingMs = currentRemainingMs();

    if (remainingMs > 0) {
      handlers.onTick?.(wholeSecondsFrom(remainingMs));
      scheduleNextTick();
      return;
    }

    /* The run is retired before the callbacks so neither can be reached twice,
       even if a handler starts another round. */
    state = TimerState.Finished;
    runToken += 1;
    handlers.onTick?.(0);
    handlers.onComplete?.();
  }

  return {
    /** Starts a full round. Calling this while one runs has no effect. */
    start(nextHandlers = {}) {
      if (state === TimerState.Running || state === TimerState.Paused) {
        return;
      }

      handlers = nextHandlers;
      runToken += 1;
      remainingMs = durationMs;
      deadline = now() + durationMs;
      state = TimerState.Running;
      scheduleNextTick();
    },

    /** Cancels the round and returns to the full duration. */
    stop() {
      runToken += 1;
      cancelScheduledTick();
      state = TimerState.Stopped;
      remainingMs = durationMs;
    },

    /** Holds the remaining time. Only a running round can be paused. */
    pause() {
      if (state !== TimerState.Running) {
        return;
      }

      remainingMs = currentRemainingMs();
      cancelScheduledTick();
      state = TimerState.Paused;
    },

    /** Continues from the remaining time kept by pause. */
    resume() {
      if (state !== TimerState.Paused) {
        return;
      }

      deadline = now() + remainingMs;
      state = TimerState.Running;
      scheduleNextTick();
    },

    getRemainingSeconds() {
      return wholeSecondsFrom(currentRemainingMs());
    },
  };
}
