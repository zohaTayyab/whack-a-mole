/* Application entry point. Module scripts are deferred, so the interface is
   ready to initialize as soon as this module runs. */

import { hideMoles, initializeInterface, showMoleAt } from "./ui.js";
import { createMoleCycle } from "./mole-cycle.js";
import { createRoundTimer } from "./round-timer.js";
import { createBestScoreStore } from "./best-score-store.js";
import { createPreferencesStore } from "./preferences-store.js";
import { createAudioController } from "./audio-controller.js";
import { createThemeController } from "./theme-controller.js";
import { createHammerController } from "./hammer-controller.js";
import { createScreenController } from "./screen-controller.js";
import { createGameController } from "./game-controller.js";

if (initializeInterface()) {
  const preferences = createPreferencesStore();
  const themeController = createThemeController({ preferences });

  /* Connected first, so the page settles on its theme as it first appears
     rather than a moment afterwards. */
  themeController.connect();

  const moleCycle = createMoleCycle({ showMole: showMoleAt, hideMole: hideMoles });
  const roundTimer = createRoundTimer();
  const bestScoreStore = createBestScoreStore();
  const audio = createAudioController();
  const hammer = createHammerController();
  const screens = createScreenController();

  /* Connected before the game, so the opening screen is in place before the
     controller asserts the state it opens in. */
  screens.connect();

  const gameController = createGameController({
    moleCycle,
    roundTimer,
    bestScoreStore,
    audio,
    preferences,
    hammer,
    screens,
  });

  gameController.connect();

  /* Release the listeners, the pending timeout, and the audio resources when
     the page goes away.

     Only when it is really going away, though: a persisted event means the
     browser is freezing the page for its back/forward cache and may restore it
     exactly as it stands, so tearing the game down here would bring the player
     back to a board that no longer responds. A frozen page runs nothing of its
     own, and an evicted one is discarded whole, so there is nothing left to
     release in that case. */
  window.addEventListener("pagehide", (event) => {
    if (event.persisted) {
      return;
    }

    gameController.disconnect();
    screens.disconnect();
    themeController.disconnect();
  });
}
