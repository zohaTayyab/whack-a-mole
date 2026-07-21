/* Owns every DOM reference: locates the interface elements, applies the
   documented pre-game state, and renders mole visibility. */

import { DEFAULT_MUSIC_VOLUME, HOLE_COUNT } from "./config.js";

const SELECTORS = {
  score: "#score",
  timeRemaining: "#time-remaining",
  bestScore: "#best-score",
  difficulty: "#difficulty",
  sound: "#sound",
  musicVolume: "#music-volume",
  musicVolumeValue: "#music-volume-value",
  darkTheme: "#dark-theme",
  startGame: "#start-game",
  restartGame: "#restart-game",
  gameStatus: "#game-status",
  board: "#board",
  hammer: "#hammer",
};

const HOLE_LABEL_SELECTOR = ".visually-hidden";

const READY_MESSAGE = "Ready to start.";
const SETUP_FAILED_MESSAGE = "The game could not be set up. Please reload the page.";
const MOLE_VISIBLE_ATTRIBUTE = "moleVisible";
/* Appended to a hole's authored name so the mole is announced as part of the
   button's own accessible name rather than through the live status region. */
const MOLE_VISIBLE_NAME_SUFFIX = ", mole visible";

let elements = null;
let holeActivationListener = null;
let startGameListener = null;
let restartGameListener = null;
let difficultyListener = null;
let soundListener = null;
let musicVolumeListener = null;
let darkThemeListener = null;
let boardPointerMoveListener = null;
let boardPointerLeaveListener = null;
let visibilityListener = null;

/**
 * Resolves every required element once so later work never re-queries the DOM.
 *
 * @returns {Object} the resolved elements, including the nine mole-hole buttons
 * @throws {Error} if any required element or the expected hole count is missing
 */
function findElements() {
  const found = {};
  const missing = [];

  for (const [name, selector] of Object.entries(SELECTORS)) {
    const element = document.querySelector(selector);
    if (element) {
      found[name] = element;
    } else {
      missing.push(selector);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Required elements are missing: ${missing.join(", ")}`);
  }

  found.holes = Array.from(found.board.querySelectorAll("button"));

  if (found.holes.length !== HOLE_COUNT) {
    throw new Error(
      `Expected ${HOLE_COUNT} mole-hole buttons but found ${found.holes.length}.`
    );
  }

  found.holeLabels = found.holes.map((hole) => hole.querySelector(HOLE_LABEL_SELECTOR));

  if (found.holeLabels.some((label) => label === null)) {
    throw new Error("Every mole-hole button must contain a label element.");
  }

  /* The authored names are the source of truth, so the visible-mole suffix can
     always be removed without guessing what the name used to be. */
  found.holeNames = found.holeLabels.map((label) => label.textContent.trim());

  return found;
}

/**
 * Applies the pre-game state: no round is in progress, so only Start Game is
 * available. Score, time, best score, difficulty, and sound keep their
 * authored values.
 */
function applyInitialState() {
  applyControls({
    startEnabled: true,
    restartEnabled: false,
    holesEnabled: false,
    difficultyEnabled: true,
  });
  hideMoles();
  setStatusMessage(READY_MESSAGE);
}

/* The player-facing message is set first so that it does not depend on the
   developer-facing report succeeding. */
function reportSetupFailure(error) {
  const gameStatus = document.querySelector(SELECTORS.gameStatus);
  if (gameStatus) {
    gameStatus.textContent = SETUP_FAILED_MESSAGE;
  }

  console.error("Whack-a-Mole could not be initialized.", error);
}

/**
 * Prepares the interface for a game that has not started yet.
 *
 * @returns {boolean} whether the interface is ready to use
 */
export function initializeInterface() {
  try {
    elements = findElements();
    applyInitialState();
    return true;
  } catch (error) {
    elements = null;
    reportSetupFailure(error);
    return false;
  }
}

/**
 * Shows a mole in one hole. Any previously visible mole is cleared first, so
 * only one mole is ever visible.
 */
export function showMoleAt(holeIndex) {
  if (!elements) {
    return;
  }

  hideMoles();

  const hole = elements.holes[holeIndex];
  if (hole) {
    hole.dataset[MOLE_VISIBLE_ATTRIBUTE] = "true";
    elements.holeLabels[holeIndex].textContent =
      elements.holeNames[holeIndex] + MOLE_VISIBLE_NAME_SUFFIX;
  }
}

/* Clears the visible-mole state from every hole. Because at most one mole is
   visible, this both hides the current mole and resets the whole board. */
export function hideMoles() {
  if (!elements) {
    return;
  }

  elements.holes.forEach((hole, index) => {
    delete hole.dataset[MOLE_VISIBLE_ATTRIBUTE];
    elements.holeLabels[index].textContent = elements.holeNames[index];
  });
}

/**
 * Applies the controls for one lifecycle state in a single step, so no state
 * can leave a stale combination of enabled and disabled controls behind.
 */
export function applyControls({
  startEnabled,
  restartEnabled,
  holesEnabled,
  difficultyEnabled,
}) {
  if (!elements) {
    return;
  }

  elements.startGame.disabled = !startEnabled;
  elements.restartGame.disabled = !restartEnabled;
  elements.difficulty.disabled = !difficultyEnabled;

  for (const hole of elements.holes) {
    hole.disabled = !holesEnabled;
  }
}

/* Resolves the board position of whatever was selected. The label span is the
   usual event target, so the enclosing button is what identifies the hole. */
function findHoleIndex(eventTarget) {
  if (!(eventTarget instanceof Element)) {
    return -1;
  }

  return elements.holes.indexOf(eventTarget.closest("button"));
}

/**
 * Registers the single hole-activation handler. One delegated click listener
 * serves mouse, touch, pen, Enter, and Space, so no activation is counted
 * twice.
 *
 * @param {(holeIndex: number) => void} handler called with the selected hole
 */
export function onHoleActivate(handler) {
  if (!elements || holeActivationListener) {
    return;
  }

  holeActivationListener = (event) => {
    const holeIndex = findHoleIndex(event.target);
    if (holeIndex !== -1) {
      handler(holeIndex);
    }
  };

  elements.board.addEventListener("click", holeActivationListener);
}

export function offHoleActivate() {
  if (!elements || !holeActivationListener) {
    return;
  }

  elements.board.removeEventListener("click", holeActivationListener);
  holeActivationListener = null;
}

export function setScore(score) {
  if (!elements) {
    return;
  }

  elements.score.textContent = String(score);
}

/* Best Score carries no aria-live of its own. It is written whenever the
   selection or the round changes, so an unchanged value is left alone: a
   needless write would be a needless change for anything watching it. */
export function setBestScore(score) {
  if (!elements) {
    return;
  }

  const text = String(score);
  if (elements.bestScore.textContent !== text) {
    elements.bestScore.textContent = text;
  }
}

/* Time Remaining is deliberately not a live region: announcing every second
   would talk over everything else. */
export function setTimeRemaining(seconds) {
  if (!elements) {
    return;
  }

  elements.timeRemaining.textContent = String(seconds);
}

/* Game Status is a live region, so an unchanged message is left alone to avoid
   announcing it again. */
export function setStatusMessage(message) {
  if (!elements) {
    return;
  }

  if (elements.gameStatus.textContent.trim() !== message) {
    elements.gameStatus.textContent = message;
  }
}

export function onStartGame(handler) {
  if (!elements || startGameListener) {
    return;
  }

  startGameListener = handler;
  elements.startGame.addEventListener("click", startGameListener);
}

export function offStartGame() {
  if (!elements || !startGameListener) {
    return;
  }

  elements.startGame.removeEventListener("click", startGameListener);
  startGameListener = null;
}

export function onRestartGame(handler) {
  if (!elements || restartGameListener) {
    return;
  }

  restartGameListener = handler;
  elements.restartGame.addEventListener("click", restartGameListener);
}

export function offRestartGame() {
  if (!elements || !restartGameListener) {
    return;
  }

  elements.restartGame.removeEventListener("click", restartGameListener);
  restartGameListener = null;
}

/** @returns {string} the difficulty currently selected in the interface */
export function getSelectedDifficulty() {
  return elements ? elements.difficulty.value : "";
}

export function onDifficultyChange(handler) {
  if (!elements || difficultyListener) {
    return;
  }

  difficultyListener = handler;
  elements.difficulty.addEventListener("change", difficultyListener);
}

export function offDifficultyChange() {
  if (!elements || !difficultyListener) {
    return;
  }

  elements.difficulty.removeEventListener("change", difficultyListener);
  difficultyListener = null;
}

/** @returns {boolean} whether the player currently wants sound */
export function getSoundEnabled() {
  return elements ? elements.sound.checked : false;
}

export function onSoundChange(handler) {
  if (!elements || soundListener) {
    return;
  }

  soundListener = handler;
  elements.sound.addEventListener("change", soundListener);
}

export function offSoundChange() {
  if (!elements || !soundListener) {
    return;
  }

  elements.sound.removeEventListener("change", soundListener);
  soundListener = null;
}

/**
 * Reflects whether the browser can play sound at all. When it cannot, the
 * checkbox is cleared as well as disabled, so its state stays truthful rather
 * than offering sound that will never arrive.
 */
/**
 * Reflects whether the browser can play sound at all. When it cannot, the
 * checkbox is cleared as well as disabled, so its state stays truthful rather
 * than offering sound that will never arrive. Music Volume goes with it,
 * because a volume for music that cannot play is meaningless.
 */
export function setSoundAvailable(isAvailable) {
  if (!elements) {
    return;
  }

  if (!isAvailable) {
    elements.sound.checked = false;
  }

  elements.sound.disabled = !isAvailable;
  elements.musicVolume.disabled = !isAvailable;
}

/** @returns {number} the selected music volume as a whole percentage */
export function getMusicVolume() {
  return elements ? Number(elements.musicVolume.value) : DEFAULT_MUSIC_VOLUME;
}

/* The percentage is a plain reading beside the slider, not a live region: the
   range already reports its own value to assistive technology, so announcing
   it a second time would only talk over the player. */
export function setMusicVolume(volume) {
  if (!elements) {
    return;
  }

  elements.musicVolume.value = String(volume);
  elements.musicVolumeValue.textContent = `${volume}%`;
}

export function onMusicVolumeChange(handler) {
  if (!elements || musicVolumeListener) {
    return;
  }

  musicVolumeListener = handler;
  /* "input" rather than "change", so dragging the slider is heard as it moves
     rather than only when it is released. */
  elements.musicVolume.addEventListener("input", musicVolumeListener);
}

export function offMusicVolumeChange() {
  if (!elements || !musicVolumeListener) {
    return;
  }

  elements.musicVolume.removeEventListener("input", musicVolumeListener);
  musicVolumeListener = null;
}

/** @returns {boolean} whether the dark-theme checkbox is ticked */
export function getDarkThemeSelected() {
  return elements ? elements.darkTheme.checked : false;
}

export function setDarkThemeSelected(isDark) {
  if (!elements) {
    return;
  }

  elements.darkTheme.checked = isDark === true;
}

/**
 * Pins the document to one theme. The stylesheet follows the operating system
 * until this attribute appears, so it is only ever set for a deliberate
 * choice.
 */
export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
}

/* Marks the point after which a theme change is a deliberate one and may be
   animated. Until then a change is the page settling on the right theme, which
   should simply be right rather than fade into place. */
export function markThemeSettled() {
  document.documentElement.dataset.themeReady = "true";
}

export function onDarkThemeChange(handler) {
  if (!elements || darkThemeListener) {
    return;
  }

  darkThemeListener = handler;
  elements.darkTheme.addEventListener("change", darkThemeListener);
}

export function offDarkThemeChange() {
  if (!elements || !darkThemeListener) {
    return;
  }

  elements.darkTheme.removeEventListener("change", darkThemeListener);
  darkThemeListener = null;
}

/* Hammer view. The hammer is decoration, so these helpers only ever move it,
   show it, or strike it; none of them can reach the score or the mole cycle. */

const HAMMER_VISIBLE_ATTRIBUTE = "hammerVisible";
const HAMMER_STRIKING_ATTRIBUTE = "hammerStriking";
const HAMMER_CURSOR_ATTRIBUTE = "hammerCursor";

export function setHammerVisible(isVisible) {
  if (!elements) {
    return;
  }

  if (isVisible) {
    elements.hammer.dataset[HAMMER_VISIBLE_ATTRIBUTE] = "true";
  } else {
    delete elements.hammer.dataset[HAMMER_VISIBLE_ATTRIBUTE];
  }
}

export function setHammerStriking(isStriking) {
  if (!elements) {
    return;
  }

  if (isStriking) {
    elements.hammer.dataset[HAMMER_STRIKING_ATTRIBUTE] = "true";
  } else {
    delete elements.hammer.dataset[HAMMER_STRIKING_ATTRIBUTE];
  }
}

/* The native cursor is only hidden while the hammer is actually standing in
   for it, so the pointer is never simply missing. */
export function setHammerCursor(isHidden) {
  if (!elements) {
    return;
  }

  if (isHidden) {
    elements.board.dataset[HAMMER_CURSOR_ATTRIBUTE] = "true";
  } else {
    delete elements.board.dataset[HAMMER_CURSOR_ATTRIBUTE];
  }
}

/* Position is handed to the stylesheet as two custom properties rather than as
   layout values, so where the hammer sits relative to its own artwork stays a
   styling decision. Coordinates are viewport-based and converted here, because
   this module owns the elements they are measured against. */
export function positionHammerAt(viewportX, viewportY) {
  if (!elements) {
    return;
  }

  const panel = elements.hammer.parentElement;
  if (!panel) {
    return;
  }

  const bounds = panel.getBoundingClientRect();
  elements.hammer.style.setProperty("--hammer-x", `${viewportX - bounds.left}px`);
  elements.hammer.style.setProperty("--hammer-y", `${viewportY - bounds.top}px`);
}

/**
 * @param {number} holeIndex
 * @returns {{x: number, y: number}|null} the viewport centre of a hole, or
 *   null when the index is not a hole
 */
export function getHoleCentre(holeIndex) {
  /* Strict about the index: an array happily answers to "0" as well as 0, and
     a position on the board should only ever be a whole number. */
  if (!elements || !Number.isInteger(holeIndex)) {
    return null;
  }

  const hole = elements.holes[holeIndex];
  if (!hole) {
    return null;
  }

  const bounds = hole.getBoundingClientRect();
  return { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
}

/**
 * Reports which hole a viewport point is over, or -1. Used to follow the
 * pointer; it never reports a hit.
 */
export function findHoleAtPoint(viewportX, viewportY) {
  if (!elements) {
    return -1;
  }

  return elements.holes.findIndex((hole) => {
    if (hole.disabled) {
      return false;
    }

    const bounds = hole.getBoundingClientRect();
    return (
      viewportX >= bounds.left &&
      viewportX <= bounds.right &&
      viewportY >= bounds.top &&
      viewportY <= bounds.bottom
    );
  });
}

export function onBoardPointerMove(handler) {
  if (!elements || boardPointerMoveListener) {
    return;
  }

  boardPointerMoveListener = handler;
  elements.board.addEventListener("pointermove", boardPointerMoveListener);
}

export function offBoardPointerMove() {
  if (!elements || !boardPointerMoveListener) {
    return;
  }

  elements.board.removeEventListener("pointermove", boardPointerMoveListener);
  boardPointerMoveListener = null;
}

export function onBoardPointerLeave(handler) {
  if (!elements || boardPointerLeaveListener) {
    return;
  }

  boardPointerLeaveListener = handler;
  elements.board.addEventListener("pointerleave", boardPointerLeaveListener);
}

export function offBoardPointerLeave() {
  if (!elements || !boardPointerLeaveListener) {
    return;
  }

  elements.board.removeEventListener("pointerleave", boardPointerLeaveListener);
  boardPointerLeaveListener = null;
}

/**
 * Registers a document-visibility handler when the browser supports the Page
 * Visibility API. Where it is unavailable nothing is registered and the round
 * simply continues, which is the safe outcome.
 *
 * @param {(isHidden: boolean) => void} handler
 */
export function onDocumentVisibilityChange(handler) {
  if (visibilityListener || typeof document.hidden !== "boolean") {
    return;
  }

  visibilityListener = () => handler(document.hidden);
  document.addEventListener("visibilitychange", visibilityListener);
}

export function offDocumentVisibilityChange() {
  if (!visibilityListener) {
    return;
  }

  document.removeEventListener("visibilitychange", visibilityListener);
  visibilityListener = null;
}
