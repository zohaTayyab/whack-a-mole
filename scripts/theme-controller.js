/* Decides which theme the page shows and keeps the checkbox in step with it.
   It owns nothing else: no score, no audio, no lifecycle. */

import {
  applyTheme,
  getDarkThemeSelected,
  markThemeSettled,
  offDarkThemeChange,
  onDarkThemeChange,
  setDarkThemeSelected,
} from "./ui.js";

const LIGHT = "light";
const DARK = "dark";

const SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)";

/* Feature-detected rather than assumed: a browser without matchMedia simply
   has no system preference to read, which the light default already covers. */
function defaultSystemPrefersDark() {
  return () => {
    try {
      return (
        typeof globalThis.matchMedia === "function" &&
        globalThis.matchMedia(SYSTEM_DARK_QUERY).matches === true
      );
    } catch (error) {
      return false;
    }
  };
}

/* The operating system's scheme is not fixed for the life of the page: it can
   change on a schedule at dusk, or because the player switched it while the
   game was open. Reading it only once would leave the game in whichever scheme
   it happened to open with until it was reloaded.

   Returns a function that stops watching, or null where the browser gives no
   way to watch. */
function defaultOnSystemSchemeChange() {
  return (handler) => {
    try {
      if (typeof globalThis.matchMedia !== "function") {
        return null;
      }

      const query = globalThis.matchMedia(SYSTEM_DARK_QUERY);
      if (typeof query.addEventListener !== "function") {
        return null;
      }

      const listener = (event) => handler(event.matches === true);
      query.addEventListener("change", listener);
      return () => query.removeEventListener("change", listener);
    } catch (error) {
      return null;
    }
  };
}

function defaultAfterFirstPaint() {
  return typeof globalThis.requestAnimationFrame === "function"
    ? (callback) => globalThis.requestAnimationFrame(callback)
    : (callback) => callback();
}

/**
 * Creates the theme controller.
 *
 * @param {{preferences: Object, systemPrefersDark?: () => boolean,
 *   onSystemSchemeChange?: (handler: (prefersDark: boolean) => void) =>
 *     (() => void) | null,
 *   afterFirstPaint?: (callback: () => void) => void}} parts
 * @returns {{connect: () => void, disconnect: () => void}}
 */
export function createThemeController({
  preferences,
  systemPrefersDark = defaultSystemPrefersDark(),
  onSystemSchemeChange = defaultOnSystemSchemeChange(),
  afterFirstPaint = defaultAfterFirstPaint(),
} = {}) {
  let connected = false;
  let stopWatchingSystem = null;

  function resolveTheme() {
    /* A theme the player chose outranks the operating system. Without one, the
       system decides, and that decision is deliberately not written back: it is
       not the player's choice, and storing it would freeze the page against a
       later system change. */
    const chosen = preferences.readTheme();
    if (chosen === LIGHT || chosen === DARK) {
      return chosen;
    }

    return systemPrefersDark() ? DARK : LIGHT;
  }

  function handleThemeChange() {
    const theme = getDarkThemeSelected() ? DARK : LIGHT;
    applyTheme(theme);
    preferences.recordTheme(theme);
  }

  /* A theme the player chose still outranks the system, so a system change is
     followed only while there is no choice on record. The checkbox is set
     rather than clicked, which changes no preference: this is the game keeping
     up with the system, not the player deciding anything. */
  function handleSystemSchemeChange(prefersDark) {
    const chosen = preferences.readTheme();
    if (chosen === LIGHT || chosen === DARK) {
      return;
    }

    const theme = prefersDark ? DARK : LIGHT;
    applyTheme(theme);
    setDarkThemeSelected(theme === DARK);
  }

  return {
    /** Applies the resolved theme and starts listening. Repeated calls do nothing further. */
    connect() {
      if (connected) {
        return;
      }

      connected = true;
      const theme = resolveTheme();
      applyTheme(theme);
      setDarkThemeSelected(theme === DARK);

      /* One frame later, so the theme the page opens with is never animated
         into place; every change after this one is the player's and may be. */
      afterFirstPaint(markThemeSettled);

      onDarkThemeChange(handleThemeChange);
      stopWatchingSystem = onSystemSchemeChange(handleSystemSchemeChange);
    },

    /* The theme itself is left exactly as it is: the page should not flicker
       back to something else on the way out. */
    disconnect() {
      if (!connected) {
        return;
      }

      connected = false;
      offDarkThemeChange();

      if (stopWatchingSystem) {
        stopWatchingSystem();
        stopWatchingSystem = null;
      }
    },
  };
}
