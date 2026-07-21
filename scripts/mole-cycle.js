/* Schedules which hole shows a mole and for how long. This module holds no DOM
   references: the caller supplies how to show and hide a mole. */

import {
  HOLE_COUNT,
  MOLE_VISIBLE_MIN_MS,
  MOLE_VISIBLE_MAX_MS,
  MOLE_GAP_MIN_MS,
  MOLE_GAP_MAX_MS,
} from "./config.js";

const NO_PREVIOUS_HOLE = -1;
const NO_ACTIVE_MOLE = -1;

const CycleState = {
  Stopped: "stopped",
  Running: "running",
  Paused: "paused",
};

function randomWholeNumberBetween(minimum, maximum) {
  return minimum + Math.floor(Math.random() * (maximum - minimum + 1));
}

/**
 * Creates a mole cycle that shows one mole at a time.
 *
 * @param {{showMole: (index: number) => void, hideMole: () => void}} renderer
 * @returns {{start: () => void, stop: () => void, pause: () => void,
 *   resume: () => void, isRunning: () => boolean,
 *   attemptHit: (holeIndex: number) => boolean}}
 */
export function createMoleCycle({ showMole, hideMole }) {
  let scheduledTimeoutId = null;
  let cycleState = CycleState.Stopped;
  let previousHoleIndex = NO_PREVIOUS_HOLE;
  /* The hole a mole currently occupies and has not yet been hit in. Cleared as
     soon as the appearance ends, which is what makes an appearance scoreable at
     most once. */
  let activeHoleIndex = NO_ACTIVE_MOLE;

  /* Chooses from the holes other than the previous one, so the same hole is
     never used twice in a row. Shifting past the previous index keeps every
     remaining hole equally likely. */
  function chooseNextHoleIndex() {
    if (previousHoleIndex === NO_PREVIOUS_HOLE) {
      return randomWholeNumberBetween(0, HOLE_COUNT - 1);
    }

    const choice = randomWholeNumberBetween(0, HOLE_COUNT - 2);
    return choice >= previousHoleIndex ? choice + 1 : choice;
  }

  function showNextMole() {
    previousHoleIndex = chooseNextHoleIndex();
    activeHoleIndex = previousHoleIndex;
    showMole(previousHoleIndex);

    scheduledTimeoutId = setTimeout(
      hideCurrentMole,
      randomWholeNumberBetween(MOLE_VISIBLE_MIN_MS, MOLE_VISIBLE_MAX_MS)
    );
  }

  function scheduleNextAppearance() {
    scheduledTimeoutId = setTimeout(
      showNextMole,
      randomWholeNumberBetween(MOLE_GAP_MIN_MS, MOLE_GAP_MAX_MS)
    );
  }

  function hideCurrentMole() {
    activeHoleIndex = NO_ACTIVE_MOLE;
    hideMole();
    scheduleNextAppearance();
  }

  function cancelScheduledWork() {
    if (scheduledTimeoutId !== null) {
      clearTimeout(scheduledTimeoutId);
      scheduledTimeoutId = null;
    }
  }

  return {
    /** Starts the cycle. Calling this while it runs has no effect. */
    start() {
      if (cycleState !== CycleState.Stopped) {
        return;
      }

      cycleState = CycleState.Running;
      showNextMole();
    },

    /**
     * Reports whether selecting a hole hits the mole currently in it, and ends
     * that appearance when it does.
     *
     * @param {number} holeIndex the hole the player selected
     * @returns {boolean} true only for the first hit on a visible mole
     */
    attemptHit(holeIndex) {
      if (
        cycleState !== CycleState.Running ||
        activeHoleIndex === NO_ACTIVE_MOLE ||
        holeIndex !== activeHoleIndex
      ) {
        return false;
      }

      /* The appearance is retired before anything else runs, so a repeated or
         re-entrant activation finds no active mole and cannot score again. */
      activeHoleIndex = NO_ACTIVE_MOLE;
      cancelScheduledWork();
      hideMole();
      scheduleNextAppearance();

      return true;
    },

    /**
     * Suspends the cycle without ending it. The board is cleared and the
     * current appearance is retired, so nothing can be hit until it resumes.
     * The previous hole is kept so repeat prevention survives the pause.
     */
    pause() {
      if (cycleState !== CycleState.Running) {
        return;
      }

      cycleState = CycleState.Paused;
      cancelScheduledWork();
      activeHoleIndex = NO_ACTIVE_MOLE;
      hideMole();
    },

    /** Continues a paused cycle with exactly one new appearance. */
    resume() {
      if (cycleState !== CycleState.Paused) {
        return;
      }

      cycleState = CycleState.Running;
      showNextMole();
    },

    /** Stops the cycle, cancels pending work, and clears the visible mole. */
    stop() {
      cycleState = CycleState.Stopped;
      cancelScheduledWork();
      hideMole();
      previousHoleIndex = NO_PREVIOUS_HOLE;
      activeHoleIndex = NO_ACTIVE_MOLE;
    },

    isRunning() {
      return cycleState === CycleState.Running;
    },
  };
}
