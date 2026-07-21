/* Coordinates player input, the round timer, the mole cycle, the settings, the
   audio, and the interface. This module owns the score, the difficulty a round
   is played under, and the round lifecycle; the other modules each answer for
   one thing and hold no game state. */

import { ROUND_DURATION_SECONDS, difficultyProfile, resolveDifficulty } from "./config.js";
import {
  applyControls,
  getSelectedDifficulty,
  getSoundEnabled,
  offDifficultyChange,
  offDocumentVisibilityChange,
  offHoleActivate,
  offRestartGame,
  offSoundChange,
  offStartGame,
  onDifficultyChange,
  onDocumentVisibilityChange,
  onHoleActivate,
  onRestartGame,
  onSoundChange,
  onStartGame,
  setBestScore,
  setScore,
  setSoundAvailable,
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

/* Difficulty is locked for as long as a round exists, so the round the player
   is in is always the round they started. */
const CONTROLS_BY_STATE = {
  [RoundState.Ready]: {
    startEnabled: true, restartEnabled: false, holesEnabled: false, difficultyEnabled: true,
  },
  [RoundState.Running]: {
    startEnabled: false, restartEnabled: true, holesEnabled: true, difficultyEnabled: false,
  },
  [RoundState.Paused]: {
    startEnabled: false, restartEnabled: true, holesEnabled: false, difficultyEnabled: false,
  },
  [RoundState.Finished]: {
    startEnabled: false, restartEnabled: true, holesEnabled: false, difficultyEnabled: true,
  },
  [RoundState.Disposed]: {
    startEnabled: false, restartEnabled: false, holesEnabled: false, difficultyEnabled: false,
  },
};

const IN_PROGRESS_MESSAGE = "Hit each mole before it disappears.";
const PAUSED_MESSAGE = "Game paused.";
const RESUMED_MESSAGE = "Game resumed.";

function hitMessage(score) {
  return `Mole hit. Score ${score}.`;
}

function gameOverMessage(score, isNewRecord) {
  const record = isNewRecord ? " New best score." : "";
  return `Game over. Final score: ${score}.${record} Select Restart Game to play again.`;
}

/**
 * Creates the game controller.
 *
 * @param {{moleCycle: Object, roundTimer: Object, bestScoreStore: Object,
 *   audio: Object}} parts
 * @returns {{connect: () => void, disconnect: () => void}}
 */
export function createGameController({ moleCycle, roundTimer, bestScoreStore, audio }) {
  let state = RoundState.Ready;
  let score = STARTING_SCORE;
  /* The difficulty the current round is being played under. It is captured
     when the round starts and is not read from the interface again, so the
     round is scored and recorded under the difficulty it was actually
     played at. */
  let activeDifficulty = resolveDifficulty(getSelectedDifficulty());
  /* Identifies the current round. A timer callback carries the identifier it
     was scheduled under, so a callback outliving a restart cannot tick, end,
     or record a score for the round that replaced it. */
  let roundId = 0;

  function enterState(nextState) {
    state = nextState;
    applyControls(CONTROLS_BY_STATE[nextState]);
  }

  /* Sound is the one part of the game that depends on hardware and on a
     browser policy that can refuse at any moment. Every audio call goes
     through here so that a failure costs the player the sound and nothing
     else: the round, the score, and the countdown carry on. */
  function withSound(operation) {
    try {
      operation();
    } catch (error) {
      /* Play continues in silence. */
    }
  }

  function isRoundInProgress() {
    return state === RoundState.Running || state === RoundState.Paused;
  }

  function showBestScoreFor(difficulty) {
    setBestScore(bestScoreStore.readBestScore(difficulty));
  }

  function beginRound(difficulty) {
    roundId += 1;
    const currentRound = roundId;

    /* Cleared before anything new is created, so a restart can never leave a
       second timer, cycle, or background loop running alongside the fresh
       one. */
    roundTimer.stop();
    moleCycle.stop();

    /* Audio is prepared before the round is, not after. Creating the audio
       context is slow the first time and the browser only allows it from this
       activation, so doing it here means the countdown and the first mole both
       begin once it is over, rather than losing their first moments to it. */
    withSound(() => {
      audio.stopRoundMusic();
      audio.setEnabled(getSoundEnabled());
      audio.playRoundStart();
      audio.startRoundMusic();
    });

    activeDifficulty = difficulty;
    moleCycle.configure(difficultyProfile(activeDifficulty));

    score = STARTING_SCORE;
    setScore(score);
    setTimeRemaining(ROUND_DURATION_SECONDS);
    showBestScoreFor(activeDifficulty);
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
    withSound(() => audio.stopRoundMusic());
    setTimeRemaining(0);

    /* Only a completed round is recorded, so an abandoned or restarted round
       never reaches the best score. */
    const isNewRecord = bestScoreStore.recordBestScore(activeDifficulty, score);
    showBestScoreFor(activeDifficulty);
    setStatusMessage(gameOverMessage(score, isNewRecord));
    withSound(() => audio.playGameOver());
  }

  function handleStartGame() {
    if (state !== RoundState.Ready) {
      return;
    }

    beginRound(resolveDifficulty(getSelectedDifficulty()));
  }

  /* Restarting a round in progress keeps its difficulty, because the player
     never chose a new one; restarting after game over takes whatever is
     selected now, which is how a different difficulty is played next. */
  function handleRestartGame() {
    if (state === RoundState.Ready || state === RoundState.Disposed) {
      return;
    }

    beginRound(
      isRoundInProgress() ? activeDifficulty : resolveDifficulty(getSelectedDifficulty())
    );
  }

  function handleHoleActivation(holeIndex) {
    if (state !== RoundState.Running || !moleCycle.attemptHit(holeIndex)) {
      return;
    }

    score += POINTS_PER_HIT;
    setScore(score);
    setStatusMessage(hitMessage(score));
    withSound(() => audio.playHit());
  }

  /* Outside a round the difficulty selection only decides which best score is
     on show. The control is disabled during a round, so this is a safeguard
     rather than an expected path. */
  function handleDifficultyChange() {
    if (isRoundInProgress()) {
      return;
    }

    showBestScoreFor(resolveDifficulty(getSelectedDifficulty()));
  }

  /* Sound is the player's to change at any time, and changing it must not
     disturb the round in any other way. */
  function handleSoundChange() {
    const wantsSound = getSoundEnabled();

    withSound(() => {
      audio.setEnabled(wantsSound);

      if (wantsSound && state === RoundState.Running) {
        audio.startRoundMusic();
      }
    });
  }

  /* Visibility is the only reason a round pauses, so a paused round is always
     one waiting for the page to come back. */
  function handleVisibilityChange(isHidden) {
    if (isHidden && state === RoundState.Running) {
      enterState(RoundState.Paused);
      roundTimer.pause();
      moleCycle.pause();
      withSound(() => audio.stopRoundMusic());
      setStatusMessage(PAUSED_MESSAGE);
      return;
    }

    if (!isHidden && state === RoundState.Paused) {
      enterState(RoundState.Running);
      roundTimer.resume();
      moleCycle.resume();
      setStatusMessage(RESUMED_MESSAGE);

      /* The context already exists from the activation that began the round,
         so continuing the loop needs no new permission. */
      if (getSoundEnabled()) {
        withSound(() => audio.startRoundMusic());
      }
    }
  }

  return {
    /** Wires up the interface. Repeated calls register nothing further. */
    connect() {
      /* The controller owns the lifecycle, so it asserts the controls for the
         state it is in rather than assuming the markup already matches. */
      applyControls(CONTROLS_BY_STATE[state]);
      withSound(() => {
        setSoundAvailable(audio.isSupported());
        audio.setEnabled(getSoundEnabled());
      });
      showBestScoreFor(resolveDifficulty(getSelectedDifficulty()));

      onStartGame(handleStartGame);
      onRestartGame(handleRestartGame);
      onHoleActivate(handleHoleActivation);
      onDifficultyChange(handleDifficultyChange);
      onSoundChange(handleSoundChange);
      onDocumentVisibilityChange(handleVisibilityChange);
    },

    /** Releases every listener and all work still scheduled. */
    disconnect() {
      offStartGame();
      offRestartGame();
      offHoleActivate();
      offDifficultyChange();
      offSoundChange();
      offDocumentVisibilityChange();
      roundTimer.stop();
      moleCycle.stop();
      withSound(() => audio.dispose());
      /* Nothing responds after disposal, so the controls say so. */
      enterState(RoundState.Disposed);
    },
  };
}
