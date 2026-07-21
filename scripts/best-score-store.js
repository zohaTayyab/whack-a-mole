/* Keeps one best score per difficulty. This is the only module that touches
   persistent storage, and it stores nothing but those scores. */

import { resolveDifficulty, supportedDifficulties } from "./config.js";

/* Namespaced so the game cannot collide with anything else on the origin, and
   versioned so a future shape change can be introduced without having to
   interpret, migrate, or discard data written under this one. */
const STORAGE_KEY = "whack-a-mole.best-scores.v1";

const NO_SCORE = 0;

function isStorableScore(score) {
  return Number.isInteger(score) && score >= NO_SCORE;
}

/* Storage can be missing, disabled, or throw on access alone in a restricted
   browsing context, so reaching it at all is guarded. */
function defaultStorage() {
  try {
    const candidate = globalThis.localStorage;
    if (
      candidate &&
      typeof candidate.getItem === "function" &&
      typeof candidate.setItem === "function"
    ) {
      return candidate;
    }
  } catch (error) {
    /* Treated the same as having no storage at all. */
  }

  return null;
}

/**
 * Creates the best-score store.
 *
 * @param {{storage?: {getItem: Function, setItem: Function}|null}} [dependencies]
 * @returns {{readBestScore: (difficulty: string) => number,
 *   recordBestScore: (difficulty: string, score: number) => boolean}}
 */
export function createBestScoreStore({ storage = defaultStorage() } = {}) {
  /* Loaded once and then kept here, so a round never depends on storage
     staying available and the game keeps working for the rest of the session
     when it does not. */
  let scores = null;

  function readStoredText() {
    try {
      return storage === null ? null : storage.getItem(STORAGE_KEY);
    } catch (error) {
      return null;
    }
  }

  /* Anything unreadable, malformed, or out of range is treated as "no score
     recorded yet" rather than as a reason to fail. */
  function load() {
    if (scores !== null) {
      return scores;
    }

    scores = {};

    let stored = null;
    try {
      stored = JSON.parse(readStoredText());
    } catch (error) {
      stored = null;
    }

    if (stored !== null && typeof stored === "object" && !Array.isArray(stored)) {
      for (const difficulty of supportedDifficulties()) {
        const score = stored[difficulty];
        if (isStorableScore(score)) {
          scores[difficulty] = score;
        }
      }
    }

    return scores;
  }

  function persist() {
    if (storage === null) {
      return;
    }

    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(scores));
    } catch (error) {
      /* Quota or a denied write. The scores stay correct for this session. */
    }
  }

  function readBestScore(difficulty) {
    const recorded = load()[resolveDifficulty(difficulty)];
    return isStorableScore(recorded) ? recorded : NO_SCORE;
  }

  return {
    /**
     * @param {string} difficulty
     * @returns {number} the best score recorded for that difficulty, or 0
     */
    readBestScore,

    /**
     * Records a completed round's score, keeping whichever score is higher.
     *
     * @param {string} difficulty
     * @param {number} score
     * @returns {boolean} whether this score became the new best score
     */
    recordBestScore(difficulty, score) {
      if (!isStorableScore(score)) {
        return false;
      }

      const key = resolveDifficulty(difficulty);
      if (score <= readBestScore(key)) {
        return false;
      }

      load()[key] = score;
      persist();
      return true;
    },
  };
}
