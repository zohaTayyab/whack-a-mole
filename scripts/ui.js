/* Locates the interface elements and applies the documented pre-game state. */

const HOLE_COUNT = 9;

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

/**
 * Resolves every required element once so later work never re-queries the DOM.
 *
 * @returns {Object} the resolved elements, including the nine mole-hole buttons
 * @throws {Error} if any required element or the expected hole count is missing
 */
function findElements() {
  const elements = {};
  const missing = [];

  for (const [name, selector] of Object.entries(SELECTORS)) {
    const element = document.querySelector(selector);
    if (element) {
      elements[name] = element;
    } else {
      missing.push(selector);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Required elements are missing: ${missing.join(", ")}`);
  }

  elements.holes = Array.from(elements.board.querySelectorAll("button"));

  if (elements.holes.length !== HOLE_COUNT) {
    throw new Error(
      `Expected ${HOLE_COUNT} mole-hole buttons but found ${elements.holes.length}.`
    );
  }

  return elements;
}

/**
 * Applies the pre-game state: no round is in progress, so only Start Game is
 * available. Score, time, best score, difficulty, and sound keep their
 * authored values.
 */
function applyInitialState(elements) {
  elements.startGame.disabled = false;
  elements.restartGame.disabled = true;

  for (const hole of elements.holes) {
    hole.disabled = true;
  }

  // Rewriting an unchanged status region would announce it again to screen
  // readers, so only correct the message when it actually differs.
  if (elements.gameStatus.textContent.trim() !== READY_MESSAGE) {
    elements.gameStatus.textContent = READY_MESSAGE;
  }
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

/** Prepares the interface for a game that has not started yet. */
export function initializeInterface() {
  try {
    applyInitialState(findElements());
  } catch (error) {
    reportSetupFailure(error);
  }
}
