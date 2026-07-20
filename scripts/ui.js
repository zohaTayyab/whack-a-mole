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

const READY_MESSAGE = "Ready to start.";
const SETUP_FAILED_MESSAGE = "The game could not be set up. Please reload the page.";
const MOLE_VISIBLE_ATTRIBUTE = "moleVisible";

let elements = null;

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

/** @returns {HTMLButtonElement[]} the validated hole buttons, in board order */
export function getHoles() {
  return elements ? elements.holes : [];
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
  }
}

/* Clears the visible-mole state from every hole. Because at most one mole is
   visible, this both hides the current mole and resets the whole board. */
export function hideMoles() {
  if (!elements) {
    return;
  }

  for (const hole of elements.holes) {
    delete hole.dataset[MOLE_VISIBLE_ATTRIBUTE];
  }
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
  if (!elements) {
    return;
  }

  elements.startGame.addEventListener("click", handler);
}
