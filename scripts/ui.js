/* Owns every DOM reference: locates the interface elements, applies the
   documented pre-game state, and renders mole visibility. */

import { HOLE_COUNT } from "./config.js";

const SELECTORS = {
  score: "#score",
  timeRemaining: "#time-remaining",
  bestScore: "#best-score",
  difficulty: "#difficulty",
  sound: "#sound",
  startGame: "#start-game",
  restartGame: "#restart-game",
  gameStatus: "#game-status",
  board: "#board",
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
  elements.startGame.disabled = false;
  elements.restartGame.disabled = true;

  for (const hole of elements.holes) {
    hole.disabled = true;
  }

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

/** Enables or disables all nine mole-hole buttons together. */
export function setHolesEnabled(isEnabled) {
  if (!elements) {
    return;
  }

  for (const hole of elements.holes) {
    hole.disabled = !isEnabled;
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

export function setStartGameEnabled(isEnabled) {
  if (!elements) {
    return;
  }

  elements.startGame.disabled = !isEnabled;
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
