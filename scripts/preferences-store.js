/* Keeps the two settings the player chooses for themselves: the theme and the
   music volume. Best scores live in their own store under their own key, so a
   change to either shape cannot disturb the other. */

import {
  DEFAULT_MUSIC_VOLUME,
  MAX_MUSIC_VOLUME,
  MIN_MUSIC_VOLUME,
} from "./config.js";

/* Namespaced and versioned for the same reasons as the best-score key, and
   deliberately separate from it. */
const STORAGE_KEY = "whack-a-mole.preferences.v1";

const THEMES = ["light", "dark"];

/* Absence is meaningful: it means the player has never chosen, so the system
   preference should decide. */
const NO_EXPLICIT_THEME = null;

function isStorableTheme(theme) {
  return THEMES.includes(theme);
}

function isStorableVolume(volume) {
  return (
    Number.isInteger(volume) &&
    volume >= MIN_MUSIC_VOLUME &&
    volume <= MAX_MUSIC_VOLUME
  );
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
 * Creates the preferences store.
 *
 * @param {{storage?: {getItem: Function, setItem: Function}|null}} [dependencies]
 */
export function createPreferencesStore({ storage = defaultStorage() } = {}) {
  /* Loaded once and then kept here, so the settings keep working for the rest
     of the session even if storage stops answering. */
  let preferences = null;

  function readStoredText() {
    try {
      return storage === null ? null : storage.getItem(STORAGE_KEY);
    } catch (error) {
      return null;
    }
  }

  /* Anything unreadable, malformed, or out of range is treated as "not set"
     rather than as a reason to fail. */
  function load() {
    if (preferences !== null) {
      return preferences;
    }

    preferences = {};

    let stored = null;
    try {
      stored = JSON.parse(readStoredText());
    } catch (error) {
      stored = null;
    }

    if (stored !== null && typeof stored === "object" && !Array.isArray(stored)) {
      if (isStorableTheme(stored.theme)) {
        preferences.theme = stored.theme;
      }

      if (isStorableVolume(stored.musicVolume)) {
        preferences.musicVolume = stored.musicVolume;
      }
    }

    return preferences;
  }

  function persist() {
    if (storage === null) {
      return;
    }

    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      /* Quota or a denied write. The settings stay correct for this session. */
    }
  }

  return {
    /**
     * @returns {string|null} "light" or "dark" if the player has chosen one,
     *   or null when the system preference should decide
     */
    readTheme() {
      const stored = load().theme;
      return isStorableTheme(stored) ? stored : NO_EXPLICIT_THEME;
    },

    /**
     * Records a theme the player chose deliberately. A theme that merely came
     * from the system is not a choice and is not passed here.
     *
     * @param {string} theme
     * @returns {boolean} whether it was accepted
     */
    recordTheme(theme) {
      if (!isStorableTheme(theme)) {
        return false;
      }

      load().theme = theme;
      persist();
      return true;
    },

    /** @returns {number} the stored volume, or the default when unset */
    readMusicVolume() {
      const stored = load().musicVolume;
      return isStorableVolume(stored) ? stored : DEFAULT_MUSIC_VOLUME;
    },

    /**
     * @param {number} volume a whole percentage from 0 to 100
     * @returns {boolean} whether it was accepted
     */
    recordMusicVolume(volume) {
      if (!isStorableVolume(volume)) {
        return false;
      }

      load().musicVolume = volume;
      persist();
      return true;
    },
  };
}
