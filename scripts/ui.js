/* Owns every DOM reference: locates the interface elements, applies the
   documented pre-game state, and renders mole visibility. */

import { DEFAULT_MUSIC_VOLUME, HOLE_COUNT } from "./config.js";

const SELECTORS = {
  score: "#score",
  timeReading: ".hud__reading--time",
  timeRemaining: "#time-remaining",
  timeBar: "#time-bar",
  bestScore: "#best-score",
  titleBestScore: "#title-best-score",
  finalScore: "#final-score",
  recordNote: "#record-note",
  overSummary: "#over-summary",
  difficulty: "#difficulty",
  sound: "#sound",
  musicVolume: "#music-volume",
  musicVolumeValue: "#music-volume-value",
  darkTheme: "#dark-theme",
  startGame: "#start-game",
  restartGame: "#restart-game",
  restartRound: "#restart-round",
  pauseGame: "#pause-game",
  pauseLabel: "#pause-label",
  gameStatus: "#game-status",
  board: "#board",
  hammer: "#hammer",
  openSettings: "#open-settings",
  closeSettings: "#close-settings",
  mainMenu: "#main-menu",
  screenTitle: "#screen-title",
  screenGame: "#screen-game",
  screenSettings: "#screen-settings",
  screenOver: "#screen-over",
};

/* The screens, by the name the rest of the game refers to them by. */
const SCREEN_ELEMENTS = {
  title: "screenTitle",
  game: "screenGame",
  settings: "screenSettings",
  over: "screenOver",
};

const HOLE_LABEL_SELECTOR = ".visually-hidden";
const SCREEN_HEADING_SELECTOR = ".screen__title";

const READY_MESSAGE = "Ready to start.";
const SETUP_FAILED_MESSAGE = "The game could not be set up. Please reload the page.";
const MOLE_VISIBLE_ATTRIBUTE = "moleVisible";
/* Appended to a hole's authored name so the mole is announced as part of the
   button's own accessible name rather than through the live status region. */
const MOLE_VISIBLE_NAME_SUFFIX = ", mole visible";

/* Seconds at or below which the countdown reading takes on, then intensifies,
   an urgent look. Purely visual: the reading is not a live region, so this adds
   no announcement, and the numbers themselves are unchanged. */
const LOW_TIME_SECONDS = 10;
const CRITICAL_TIME_SECONDS = 5;

/* Sparks thrown off by a hit, one per fixed direction, so the burst has some
   colour and life without any randomness. */
const SPARK_COUNT = 6;

/* Confetti at game over, and how long its layer lives before it is removed. The
   fall runs longer than a hit's feedback, so it keeps its own timing. */
const CONFETTI_COUNT = 16;
const CONFETTI_CLEANUP_MS = 1800;

/* How long a hit's floating reward and impact linger before they are removed.
   It is only a safety net: each element is normally removed the moment its
   animation ends, and this clears it even where no animation runs, such as
   under reduced motion. */
const HIT_FEEDBACK_CLEANUP_MS = 800;

/* The last score rendered, so a rise can be told from the reset to zero at the
   start of a round and only a rise makes the reading pulse. */
let previousScore = 0;

let elements = null;
/* Whether a screen has ever been shown. The opening screen simply appears, and
   moving focus onto it would be taking focus with no navigation behind it,
   which is the one thing the focus rule forbids. Every screen shown after it is
   the result of navigating, so its heading is where focus belongs. */
let screenHasSettled = false;
let holeActivationListener = null;
let startGameListener = null;
let restartGameListener = null;
let difficultyListener = null;
let soundListener = null;
let musicVolumeListener = null;
let darkThemeListener = null;
let openSettingsListener = null;
let closeSettingsListener = null;
let mainMenuListener = null;
let restartRoundListener = null;
let pauseGameListener = null;
let boardPointerMoveListener = null;
let boardPointerLeaveListener = null;
let visibilityListener = null;
let escapeKeyListener = null;

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
  if (score > previousScore) {
    retrigger(elements.score, "pop");
  }
  previousScore = score;
}

/* The reward that rises from the struck hole: a "+1" floats up and a ring
   flashes over the opening. Both are decoration, hidden from assistive
   technology, and each clears itself once its animation is done. The score
   reading's own pulse is handled in setScore, where the rise is known. */
export function showHitFeedback(holeIndex) {
  if (!elements) {
    return;
  }

  const hole = elements.holes[holeIndex];
  if (!hole) {
    return;
  }

  spawnTransient(hole, "score-float", "+1");
  spawnTransient(hole, "hit-burst");
  for (let point = 0; point < SPARK_COUNT; point += 1) {
    spawnTransient(hole, `spark spark--${point}`);
  }
}

/* The game-over flourish: a short fall of confetti over the outcome screen,
   spawned only when a record is set. The pieces are decoration — hidden from
   assistive technology, taking no pointer events — and their positions and
   colours are all set in CSS, so nothing here carries an inline style. The whole
   layer is removed once the fall is done; under reduced motion the pieces never
   travel, so it resolves to nothing seen. */
export function celebrate() {
  if (!elements) {
    return;
  }

  const layer = document.createElement("div");
  layer.className = "confetti";
  layer.setAttribute("aria-hidden", "true");
  for (let piece = 0; piece < CONFETTI_COUNT; piece += 1) {
    layer.appendChild(document.createElement("span")).className = "confetti__piece";
  }

  elements.screenOver.appendChild(layer);
  setTimeout(() => layer.remove(), CONFETTI_CLEANUP_MS);
}

/* Replays a one-shot animation by clearing its trigger, forcing a reflow so the
   removal takes effect, and setting it again. */
function retrigger(element, attribute) {
  delete element.dataset[attribute];
  void element.offsetWidth;
  element.dataset[attribute] = "true";
}

/* Adds a short-lived decorative element that removes itself when its animation
   ends, with a timed fallback for the cases where none runs. */
function spawnTransient(parent, className, text) {
  const element = document.createElement("span");
  element.className = className;
  element.setAttribute("aria-hidden", "true");
  if (text) {
    element.textContent = text;
  }

  const remove = () => element.remove();
  element.addEventListener("animationend", remove, { once: true });
  setTimeout(remove, HIT_FEEDBACK_CLEANUP_MS);

  parent.appendChild(element);
}

/* Best Score carries no aria-live of its own. It is written whenever the
   selection or the round changes, so an unchanged value is left alone: a
   needless write would be a needless change for anything watching it. The same
   reading is shown on the title screen as the score to beat, so both are kept
   in step from the one call. */
export function setBestScore(score) {
  if (!elements) {
    return;
  }

  const text = String(score);
  if (elements.bestScore.textContent !== text) {
    elements.bestScore.textContent = text;
  }
  if (elements.titleBestScore.textContent !== text) {
    elements.titleBestScore.textContent = text;
  }
}

/* Time Remaining is deliberately not a live region: announcing every second
   would talk over everything else. The bar beside the number is decoration and
   is driven from the same value, so the two never disagree. */
export function setTimeRemaining(seconds) {
  if (!elements) {
    return;
  }

  elements.timeRemaining.textContent = String(seconds);
  elements.timeBar.value = seconds;

  const urgency =
    seconds <= CRITICAL_TIME_SECONDS
      ? "critical"
      : seconds <= LOW_TIME_SECONDS
        ? "low"
        : "none";
  if (elements.timeReading.dataset.urgency !== urgency) {
    elements.timeReading.dataset.urgency = urgency;
  }
}

/* The game-over readings live on their own screen, filled in before it is
   shown. Final Score is a plain reading; the record note is shown only when a
   record was set; the summary is what the heading announces as it takes focus,
   so the outcome is spoken once without a second live region. */
export function setFinalScore(score) {
  if (!elements) {
    return;
  }

  elements.finalScore.textContent = String(score);
}

export function setRecordSet(isRecord) {
  if (!elements) {
    return;
  }

  elements.recordNote.hidden = !isRecord;
}

export function setGameOverSummary(text) {
  if (!elements) {
    return;
  }

  elements.overSummary.textContent = text;
}

/* The pause control is one button that both pauses and resumes, so its name
   and its icon follow the state rather than a second control appearing. The
   name is real text in the button, not an ARIA attribute. */
export function setPaused(isPaused) {
  if (!elements) {
    return;
  }

  elements.pauseGame.dataset.paused = isPaused ? "true" : "false";
  elements.pauseLabel.textContent = isPaused ? "Resume" : "Pause";
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

/* Screens.

   Hiding is the `hidden` attribute rather than a class, because a hidden
   screen has to leave the page altogether: out of the tab order, out of the
   accessibility tree, and out of reach of a find-in-page. A class that only
   stopped it being painted would leave a keyboard player tabbing into controls
   they cannot see. */

/**
 * Shows one screen and hides the rest. When this is a genuine change of screen
 * rather than the opening paint, focus is moved to the new screen's heading:
 * the control the player was on may belong to the screen just hidden, so
 * leaving focus where it was would strand a keyboard user on something gone.
 *
 * @param {string} name one of the known screen names
 * @returns {boolean} whether the name was one the interface knows
 */
export function showScreen(name) {
  if (!elements || !Object.prototype.hasOwnProperty.call(SCREEN_ELEMENTS, name)) {
    return false;
  }

  const previous = visibleScreen();

  for (const [screen, key] of Object.entries(SCREEN_ELEMENTS)) {
    elements[key].hidden = screen !== name;
  }

  if (screenHasSettled && previous !== name) {
    focusScreenHeading(name);
  }
  screenHasSettled = true;

  return true;
}

/* Sends focus to a screen's heading once that screen is on show. The heading
   is focusable only programmatically, so this both announces the new place and
   sets where Tab resumes, without adding a stop of its own to the tab order. */
function focusScreenHeading(name) {
  const screen = elements[SCREEN_ELEMENTS[name]];
  const heading = screen && screen.querySelector(SCREEN_HEADING_SELECTOR);
  if (heading) {
    heading.focus();
  }
}

/** @returns {string|null} the screen currently shown, or null before setup */
export function visibleScreen() {
  if (!elements) {
    return null;
  }

  const shown = Object.entries(SCREEN_ELEMENTS).find(([, key]) => !elements[key].hidden);
  return shown ? shown[0] : null;
}

export function onOpenSettings(handler) {
  if (!elements || openSettingsListener) {
    return;
  }

  openSettingsListener = handler;
  elements.openSettings.addEventListener("click", openSettingsListener);
}

export function offOpenSettings() {
  if (!elements || !openSettingsListener) {
    return;
  }

  elements.openSettings.removeEventListener("click", openSettingsListener);
  openSettingsListener = null;
}

export function onCloseSettings(handler) {
  if (!elements || closeSettingsListener) {
    return;
  }

  closeSettingsListener = handler;
  elements.closeSettings.addEventListener("click", closeSettingsListener);
}

export function offCloseSettings() {
  if (!elements || !closeSettingsListener) {
    return;
  }

  elements.closeSettings.removeEventListener("click", closeSettingsListener);
  closeSettingsListener = null;
}

/* Escape is a document-level key rather than one control's, so it is listened
   for on the document and the caller decides whether it applies. It is used to
   leave the settings screen, which the visible Back control also does. */
export function onEscapeKey(handler) {
  if (escapeKeyListener) {
    return;
  }

  escapeKeyListener = (event) => {
    if (event.key === "Escape") {
      handler(event);
    }
  };
  document.addEventListener("keydown", escapeKeyListener);
}

export function offEscapeKey() {
  if (!escapeKeyListener) {
    return;
  }

  document.removeEventListener("keydown", escapeKeyListener);
  escapeKeyListener = null;
}

export function onMainMenu(handler) {
  if (!elements || mainMenuListener) {
    return;
  }

  mainMenuListener = handler;
  elements.mainMenu.addEventListener("click", mainMenuListener);
}

export function offMainMenu() {
  if (!elements || !mainMenuListener) {
    return;
  }

  elements.mainMenu.removeEventListener("click", mainMenuListener);
  mainMenuListener = null;
}

/* The heads-up Restart: a second way into a fresh round, on the play surface
   rather than only after game over. It runs the same restart the game already
   knows, so it holds no logic of its own. */
export function onRestartRound(handler) {
  if (!elements || restartRoundListener) {
    return;
  }

  restartRoundListener = handler;
  elements.restartRound.addEventListener("click", restartRoundListener);
}

export function offRestartRound() {
  if (!elements || !restartRoundListener) {
    return;
  }

  elements.restartRound.removeEventListener("click", restartRoundListener);
  restartRoundListener = null;
}

export function onPauseGame(handler) {
  if (!elements || pauseGameListener) {
    return;
  }

  pauseGameListener = handler;
  elements.pauseGame.addEventListener("click", pauseGameListener);
}

export function offPauseGame() {
  if (!elements || !pauseGameListener) {
    return;
  }

  elements.pauseGame.removeEventListener("click", pauseGameListener);
  pauseGameListener = null;
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
 * until this attribute appears, after which the theme controller owns it and
 * keeps it in step with either the player's choice or the system.
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
