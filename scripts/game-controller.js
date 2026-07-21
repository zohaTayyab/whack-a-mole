/* Coordinates player input, the mole cycle, and the interface. This module owns
   the score; the mole cycle only reports whether a hit was valid. */

import {
  offHoleActivate,
  offStartGame,
  onHoleActivate,
  onStartGame,
  setHolesEnabled,
  setScore,
  setStartGameEnabled,
  setStatusMessage,
} from "./ui.js";

const STARTING_SCORE = 0;
const POINTS_PER_HIT = 1;

const IN_PROGRESS_MESSAGE = "Hit each mole before it disappears.";

function hitMessage(score) {
  return `Mole hit. Score ${score}.`;
}

/**
 * Creates the game controller.
 *
 * @param {{start: () => void, stop: () => void,
 *   attemptHit: (holeIndex: number) => boolean}} moleCycle
 * @returns {{connect: () => void, disconnect: () => void}}
 */
export function createGameController({ moleCycle }) {
  let score = STARTING_SCORE;
  let hasStarted = false;

  function handleStartGame() {
    if (hasStarted) {
      return;
    }

    hasStarted = true;
    setScore(score);
    setStartGameEnabled(false);
    setHolesEnabled(true);
    setStatusMessage(IN_PROGRESS_MESSAGE);
    moleCycle.start();
  }

  /* The cycle decides whether the selection was a hit, so a wrong hole, a
     repeated activation, and a selection made between appearances all leave the
     score untouched. */
  function handleHoleActivation(holeIndex) {
    if (!moleCycle.attemptHit(holeIndex)) {
      return;
    }

    score += POINTS_PER_HIT;
    setScore(score);
    setStatusMessage(hitMessage(score));
  }

  return {
    /** Wires up the interface. Repeated calls register nothing further. */
    connect() {
      onStartGame(handleStartGame);
      onHoleActivate(handleHoleActivation);
    },

    /** Releases the listeners and any mole work still scheduled. */
    disconnect() {
      offStartGame();
      offHoleActivate();
      moleCycle.stop();
    },
  };
}
