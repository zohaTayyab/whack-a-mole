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

function randomWholeNumberBetween(minimum, maximum) {
  return minimum + Math.floor(Math.random() * (maximum - minimum + 1));
}

/**
 * Creates a mole cycle that shows one mole at a time.
 *
 * @param {{showMole: (index: number) => void, hideMole: () => void}} renderer
 * @returns {{start: () => void, stop: () => void, isRunning: () => boolean}}
 */
export function createMoleCycle({ showMole, hideMole }) {
  let scheduledTimeoutId = null;
  let isCycleRunning = false;
  let previousHoleIndex = NO_PREVIOUS_HOLE;

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
    showMole(previousHoleIndex);

    scheduledTimeoutId = setTimeout(
      hideCurrentMole,
      randomWholeNumberBetween(MOLE_VISIBLE_MIN_MS, MOLE_VISIBLE_MAX_MS)
    );
  }

  function hideCurrentMole() {
    hideMole();

    scheduledTimeoutId = setTimeout(
      showNextMole,
      randomWholeNumberBetween(MOLE_GAP_MIN_MS, MOLE_GAP_MAX_MS)
    );
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
      if (isCycleRunning) {
        return;
      }

      isCycleRunning = true;
      showNextMole();
    },

    /** Stops the cycle, cancels pending work, and clears the visible mole. */
    stop() {
      isCycleRunning = false;
      cancelScheduledWork();
      hideMole();
      previousHoleIndex = NO_PREVIOUS_HOLE;
    },

    isRunning() {
      return isCycleRunning;
    },
  };
}
