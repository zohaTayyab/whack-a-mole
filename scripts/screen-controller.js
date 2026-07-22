/* Decides which screen is visible, and nothing else.

   It owns no score, no timer, and no game rule: the round tells it where the
   game has got to, and the navigation controls tell it where the player wants
   to go. Every other module can stay unaware that screens exist at all. */

import {
  offCloseSettings,
  offOpenSettings,
  onCloseSettings,
  onOpenSettings,
  showScreen,
  visibleScreen,
} from "./ui.js";

export const Screen = Object.freeze({
  Title: "title",
  Game: "game",
  Settings: "settings",
  Over: "over",
});

const SCREEN_NAMES = Object.freeze(Object.values(Screen));

/**
 * Creates the screen controller.
 *
 * @returns {{connect: () => void, disconnect: () => void,
 *   show: (screen: string) => void, current: () => string|null}}
 */
export function createScreenController() {
  let connected = false;

  /* Where Back returns to. Settings can be opened from the title screen and,
     once game over has its own way in, from there too, so the way out has to
     be wherever the player came from rather than a fixed screen. */
  let returnTo = Screen.Title;

  function show(screen) {
    if (!SCREEN_NAMES.includes(screen)) {
      return;
    }

    showScreen(screen);
  }

  function handleOpenSettings() {
    const from = visibleScreen();
    returnTo = from === Screen.Settings ? returnTo : from || Screen.Title;
    show(Screen.Settings);
  }

  function handleCloseSettings() {
    show(returnTo);
  }

  return {
    /** Shows the opening screen and starts listening. Repeated calls do nothing further. */
    connect() {
      if (connected) {
        return;
      }

      connected = true;
      show(Screen.Title);

      onOpenSettings(handleOpenSettings);
      onCloseSettings(handleCloseSettings);
    },

    /* The screen itself is left as it is: the page should not jump somewhere
       else on the way out. */
    disconnect() {
      if (!connected) {
        return;
      }

      connected = false;
      offOpenSettings();
      offCloseSettings();
    },

    show,

    /** @returns {string|null} the screen currently shown */
    current() {
      return visibleScreen();
    },
  };
}
