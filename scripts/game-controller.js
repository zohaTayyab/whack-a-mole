/* Coordinates player input, the round timer, the mole cycle, the settings, the
   audio, and the interface. This module owns the score, the difficulty a round
   is played under, and the round lifecycle; the other modules each answer for
   one thing and hold no game state. */

import {
  DEFAULT_MUSIC_VOLUME,
  ROUND_DURATION_SECONDS,
  difficultyProfile,
  resolveDifficulty,
} from "./config.js";
import { Screen } from "./screen-controller.js";
import {
  applyControls,
  celebrate,
  getMusicVolume,
  getSelectedDifficulty,
  getSoundEnabled,
  offDifficultyChange,
  offDocumentVisibilityChange,
  offHoleActivate,
  offMainMenu,
  offMusicVolumeChange,
  offPauseGame,
  offRestartGame,
  offRestartRound,
  offSoundChange,
  offStartGame,
  onDifficultyChange,
  onDocumentVisibilityChange,
  onHoleActivate,
  onMainMenu,
  onMusicVolumeChange,
  onPauseGame,
  onRestartGame,
  onRestartRound,
  onSoundChange,
  onStartGame,
  setBestScore,
  setFinalScore,
  setGameOverSummary,
  setMusicVolume,
  setPaused,
  setRecordSet,
  setScore,
  setSoundAvailable,
  setStatusMessage,
  setTimeRemaining,
  showHitFeedback,
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

/* Where the game has got to decides which screen is shown, so the round never
   has to announce a screen change separately from the state change that caused
   it. A disposed game is left where it is: the page is going away, and moving
   the player somewhere else on the way out would only be visible as a flicker. */
const SCREEN_BY_STATE = {
  [RoundState.Ready]: Screen.Title,
  [RoundState.Running]: Screen.Game,
  [RoundState.Paused]: Screen.Game,
  [RoundState.Finished]: Screen.Over,
};

const READY_MESSAGE = "Ready to start.";
const IN_PROGRESS_MESSAGE = "Hit each mole before it disappears.";
const PAUSED_MESSAGE = "Game paused.";
const RESUMED_MESSAGE = "Game resumed.";

function hitMessage(score) {
  return `Mole hit. Score ${score}.`;
}

function gameOverMessage(score, isNewRecord) {
  const record = isNewRecord ? " New best score." : "";
  return `Game over. Final score: ${score}.${record} Select Play Again to play again.`;
}

/* What the game-over heading announces as it takes focus: the outcome in one
   line, so it is spoken once without a second live region. */
function gameOverSummary(score, best, isNewRecord) {
  const record = isNewRecord ? " New best score." : "";
  return `Final score ${score}. Best score ${best}.${record}`;
}

/**
 * Creates the game controller.
 *
 * @param {{moleCycle: Object, roundTimer: Object, bestScoreStore: Object,
 *   audio: Object, preferences: Object, hammer: Object,
 *   screens?: {show: (screen: string) => void}}} parts
 * @returns {{connect: () => void, disconnect: () => void}}
 */
export function createGameController({
  moleCycle,
  roundTimer,
  bestScoreStore,
  audio,
  preferences,
  hammer,
  /* Inert by default: the screens are presentation, so a game without them
     still starts, scores, and finishes exactly the same way. */
  screens = { show() {} },
}) {
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

  /* Whether the player paused the round themselves. A pause the player asked
     for must outlast the page being hidden and shown again, so returning to the
     page resumes only a pause the page itself caused. */
  let pausedByUser = false;

  function enterState(nextState) {
    state = nextState;
    applyControls(CONTROLS_BY_STATE[nextState]);

    /* The pause control is only on show while a round is, so its name follows
       the two states it can be seen in and is left alone otherwise. */
    if (nextState === RoundState.Running) {
      setPaused(false);
    } else if (nextState === RoundState.Paused) {
      setPaused(true);
    }

    const screen = SCREEN_BY_STATE[nextState];
    if (screen) {
      screens.show(screen);
    }
  }

  /* Sound, the hammer, and stored settings are comforts rather than the game:
     each depends on something the browser may withhold, whether an audio
     device, a pointer, or storage. Every call into them goes through here, so
     a failure costs the player that one comfort and nothing else. The round,
     the score, and the countdown carry on regardless. */
  function optional(operation) {
    try {
      operation();
    } catch (error) {
      /* Play continues without it. */
    }
  }

  /* A browser can offer everything audio needs and still refuse the moment it
     is asked: the constructor exists, and creating a context throws. That is
     only discoverable by trying, so availability is reflected again after each
     point where the audio has had the chance to find out. Without this the
     Sound checkbox would sit enabled and ticked while nothing could ever be
     heard, which is the one thing it is meant not to do. */
  function reflectSoundAvailability() {
    optional(() => setSoundAvailable(audio.isSupported()));
  }

  /* The reading equivalent: a settings store that cannot answer should leave
     the game at its documented default rather than stop it. */
  function preferredMusicVolume() {
    try {
      return preferences.readMusicVolume();
    } catch (error) {
      return DEFAULT_MUSIC_VOLUME;
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
    pausedByUser = false;

    /* Cleared before anything new is created, so a restart can never leave a
       second timer, cycle, or background loop running alongside the fresh
       one. */
    roundTimer.stop();
    moleCycle.stop();
    optional(() => hammer.deactivate());

    /* Audio is prepared before the round is, not after. Creating the audio
       context is slow the first time and the browser only allows it from this
       activation, so doing it here means the countdown and the first mole both
       begin once it is over, rather than losing their first moments to it. */
    optional(() => {
      audio.stopRoundMusic();
      audio.setEnabled(getSoundEnabled());
      audio.playRoundStart();
      audio.startRoundMusic();
    });
    reflectSoundAvailability();

    activeDifficulty = difficulty;
    moleCycle.configure(difficultyProfile(activeDifficulty));

    score = STARTING_SCORE;
    setScore(score);
    setTimeRemaining(ROUND_DURATION_SECONDS);
    showBestScoreFor(activeDifficulty);
    enterState(RoundState.Running);
    setStatusMessage(IN_PROGRESS_MESSAGE);

    optional(() => hammer.activate());
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
    /* The round is torn down first, which hides the mole and stops the clock,
       so nothing can be scored while the outcome is being prepared. */
    roundTimer.stop();
    moleCycle.stop();
    optional(() => hammer.deactivate());
    optional(() => audio.stopRoundMusic());
    setTimeRemaining(0);

    /* Only a completed round is recorded, so an abandoned or restarted round
       never reaches the best score. */
    const isNewRecord = bestScoreStore.recordBestScore(activeDifficulty, score);
    const best = bestScoreStore.readBestScore(activeDifficulty);
    showBestScoreFor(activeDifficulty);
    setFinalScore(score);
    setRecordSet(isNewRecord);
    setGameOverSummary(gameOverSummary(score, best, isNewRecord));
    setStatusMessage(gameOverMessage(score, isNewRecord));

    /* Shown last, once the outcome is in place: this moves to the game-over
       screen and puts focus on its heading, and the heading announces the
       summary set just above. Entering the finished state here also closes the
       board, so any click landing afterwards finds the round already over. */
    enterState(RoundState.Finished);
    if (isNewRecord) {
      celebrate();
    }
    optional(() => audio.playGameOver());
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

  /* Leaving a finished round returns the game to the state it opens in, so the
     title screen offers a round that can actually be started. A round still in
     progress is left alone: this control belongs to game over, and abandoning
     a live round is what Restart Game is for. */
  function handleMainMenu() {
    if (state !== RoundState.Finished) {
      return;
    }

    roundTimer.stop();
    moleCycle.stop();
    optional(() => hammer.deactivate());
    optional(() => audio.stopRoundMusic());

    score = STARTING_SCORE;
    setScore(score);
    setTimeRemaining(ROUND_DURATION_SECONDS);
    showBestScoreFor(resolveDifficulty(getSelectedDifficulty()));
    enterState(RoundState.Ready);
    setStatusMessage(READY_MESSAGE);
  }

  function handleHoleActivation(holeIndex) {
    if (state !== RoundState.Running) {
      return;
    }

    /* The hammer swings for the attempt, not for the outcome, so a miss looks
       like a miss rather than like nothing happening. It is decoration and is
       kept clear of the decision below. */
    optional(() => hammer.strikeHole(holeIndex));

    if (!moleCycle.attemptHit(holeIndex)) {
      return;
    }

    score += POINTS_PER_HIT;
    setScore(score);
    setStatusMessage(hitMessage(score));
    showHitFeedback(holeIndex);
    optional(() => audio.playHit());
  }

  function handleMusicVolumeChange() {
    const volume = getMusicVolume();
    setMusicVolume(volume);
    optional(() => preferences.recordMusicVolume(volume));
    optional(() => audio.setMusicVolume(volume));
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

    optional(() => {
      audio.setEnabled(wantsSound);

      if (wantsSound && state === RoundState.Running) {
        audio.startRoundMusic();
      }
    });
    reflectSoundAvailability();
  }

  /* Pausing and resuming are the same two steps whoever asks for them, so the
     player's Pause control and the page being hidden share one path each. */
  function pauseRound() {
    enterState(RoundState.Paused);
    roundTimer.pause();
    moleCycle.pause();
    optional(() => hammer.deactivate());
    optional(() => audio.stopRoundMusic());
    setStatusMessage(PAUSED_MESSAGE);
  }

  function resumeRound() {
    enterState(RoundState.Running);
    roundTimer.resume();
    moleCycle.resume();
    optional(() => hammer.activate());
    setStatusMessage(RESUMED_MESSAGE);

    /* The context already exists from the activation that began the round, so
       continuing the loop needs no new permission. */
    if (getSoundEnabled()) {
      optional(() => audio.startRoundMusic());
    }
  }

  /* The player's own Pause. It records that the pause was deliberate, so the
     page returning from the background does not undo it. */
  function handlePauseToggle() {
    if (state === RoundState.Running) {
      pausedByUser = true;
      pauseRound();
    } else if (state === RoundState.Paused) {
      pausedByUser = false;
      resumeRound();
    }
  }

  /* A round pauses on its own when the page is hidden, and comes back when the
     page does, unless the player had paused it deliberately, in which case it
     is theirs to resume. */
  function handleVisibilityChange(isHidden) {
    if (isHidden && state === RoundState.Running) {
      pauseRound();
      return;
    }

    if (!isHidden && state === RoundState.Paused && !pausedByUser) {
      resumeRound();
    }
  }

  return {
    /** Wires up the interface. Repeated calls register nothing further. */
    connect() {
      /* The controller owns the lifecycle, so it asserts the controls for the
         state it is in rather than assuming the markup already matches. */
      applyControls(CONTROLS_BY_STATE[state]);
      reflectSoundAvailability();
      optional(() => audio.setEnabled(getSoundEnabled()));

      /* The stored volume is shown and handed to the audio before any context
         exists, so it is already in force the first time music plays. */
      const volume = preferredMusicVolume();
      setMusicVolume(volume);
      optional(() => audio.setMusicVolume(volume));

      showBestScoreFor(resolveDifficulty(getSelectedDifficulty()));
      optional(() => hammer.connect());

      onStartGame(handleStartGame);
      onRestartGame(handleRestartGame);
      onRestartRound(handleRestartGame);
      onPauseGame(handlePauseToggle);
      onMainMenu(handleMainMenu);
      onHoleActivate(handleHoleActivation);
      onDifficultyChange(handleDifficultyChange);
      onSoundChange(handleSoundChange);
      onMusicVolumeChange(handleMusicVolumeChange);
      onDocumentVisibilityChange(handleVisibilityChange);
    },

    /** Releases every listener and all work still scheduled. */
    disconnect() {
      offStartGame();
      offRestartGame();
      offRestartRound();
      offPauseGame();
      offMainMenu();
      offHoleActivate();
      offDifficultyChange();
      offSoundChange();
      offMusicVolumeChange();
      offDocumentVisibilityChange();
      roundTimer.stop();
      moleCycle.stop();
      optional(() => hammer.disconnect());
      optional(() => audio.dispose());
      /* Nothing responds after disposal, so the controls say so. */
      enterState(RoundState.Disposed);
    },
  };
}
