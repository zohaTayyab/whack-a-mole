/* Coordinates player input, the round timer, the mole cycle, and the
   interface. This module owns the score and the round lifecycle; the mole
   cycle only reports whether a hit was valid, and the timer only counts. */

import { ROUND_DURATION_SECONDS } from "./config.js";
import {
  applyControls,
  offDocumentVisibilityChange,
  offHoleActivate,
  offRestartGame,
  offStartGame,
  onDocumentVisibilityChange,
  onHoleActivate,
  onRestartGame,
  onStartGame,
  setScore,
  setStatusMessage,
  setTimeRemaining,
} from "./ui.js";

const STARTING_SCORE = 0;
const POINTS_PER_HIT = 1;

/* One explicit state rather than several booleans, so every action can be
   accepted or rejected by asking a single question. */
const RoundState = {
  Ready: "ready",
  Running: "running",
  Paused: "paused",
  Finished: "finished",
  Disposed: "disposed",
};

const CONTROLS_BY_STATE = {
  [RoundState.Ready]: { startEnabled: true, restartEnabled: false, holesEnabled: false },
  [RoundState.Running]: { startEnabled: false, restartEnabled: true, holesEnabled: true },
  [RoundState.Paused]: { startEnabled: false, restartEnabled: true, holesEnabled: false },
  [RoundState.Finished]: { startEnabled: false, restartEnabled: true, holesEnabled: false },
  [RoundState.Disposed]: { startEnabled: false, restartEnabled: false, holesEnabled: false },
};

const IN_PROGRESS_MESSAGE = "Hit each mole before it disappears.";
const PAUSED_MESSAGE = "Game paused.";
const RESUMED_MESSAGE = "Game resumed.";

function hitMessage(score) {
  return `Mole hit. Score ${score}.`;
}

function gameOverMessage(score) {
  return `Game over. Final score: ${score}. Select Restart Game to play again.`;
}

/**
 * Creates the game controller.
 *
 * @param {{moleCycle: Object, roundTimer: Object}} parts
 * @returns {{connect: () => void, disconnect: () => void}}
 */
export function createGameController({ moleCycle, roundTimer }) {
  let state = RoundState.Ready;
  let score = STARTING_SCORE;
  /* Identifies the current round. A timer callback carries the identifier it
     was scheduled under, so a callback outliving a restart cannot tick or end
     the round that replaced it. */
  let roundId = 0;

  function enterState(nextState) {
    state = nextState;
    applyControls(CONTROLS_BY_STATE[nextState]);
  }

  function beginRound() {
    roundId += 1;
    const currentRound = roundId;

    /* Cleared before anything new is created, so a restart can never leave a
       second timer or cycle running alongside the fresh one. */
    roundTimer.stop();
    moleCycle.stop();

    score = STARTING_SCORE;
    setScore(score);
    setTimeRemaining(ROUND_DURATION_SECONDS);
    enterState(RoundState.Running);
    setStatusMessage(IN_PROGRESS_MESSAGE);

    moleCycle.start();
    roundTimer.start({
      onTick: (secondsRemaining) => {
        if (currentRound === roundId && state === RoundState.Running) {
          setTimeRemaining(secondsRemaining);
        }
      },
      onComplete: () => {
        if (currentRound === roundId) {
          finishRound();
        }
      },
    });
  }

  function finishRound() {
    /* The running state is retired first so a hit arriving alongside the final
       tick cannot still score. */
    enterState(RoundState.Finished);

    roundTimer.stop();
    moleCycle.stop();
    setTimeRemaining(0);
    setStatusMessage(gameOverMessage(score));
  }

  function handleStartGame() {
    if (state !== RoundState.Ready) {
      return;
    }

    beginRound();
  }

  function handleRestartGame() {
    if (state === RoundState.Ready || state === RoundState.Disposed) {
      return;
    }

    beginRound();
  }

  function handleHoleActivation(holeIndex) {
    if (state !== RoundState.Running || !moleCycle.attemptHit(holeIndex)) {
      return;
    }

    score += POINTS_PER_HIT;
    setScore(score);
    setStatusMessage(hitMessage(score));
  }

  /* Visibility is the only reason a round pauses, so a paused round is always
     one waiting for the page to come back. */
  function handleVisibilityChange(isHidden) {
    if (isHidden && state === RoundState.Running) {
      enterState(RoundState.Paused);
      roundTimer.pause();
      moleCycle.pause();
      setStatusMessage(PAUSED_MESSAGE);
      return;
    }

    if (!isHidden && state === RoundState.Paused) {
      enterState(RoundState.Running);
      roundTimer.resume();
      moleCycle.resume();
      setStatusMessage(RESUMED_MESSAGE);
    }
  }

  return {
    /** Wires up the interface. Repeated calls register nothing further. */
    connect() {
      /* The controller owns the lifecycle, so it asserts the controls for the
         state it is in rather than assuming the markup already matches. */
      applyControls(CONTROLS_BY_STATE[state]);
      onStartGame(handleStartGame);
      onRestartGame(handleRestartGame);
      onHoleActivate(handleHoleActivation);
      onDocumentVisibilityChange(handleVisibilityChange);
    },

    /** Releases every listener and all work still scheduled. */
    disconnect() {
      offStartGame();
      offRestartGame();
      offHoleActivate();
      offDocumentVisibilityChange();
      roundTimer.stop();
      moleCycle.stop();
      /* Nothing responds after disposal, so the controls say so. */
      enterState(RoundState.Disposed);
    },
  };
}
