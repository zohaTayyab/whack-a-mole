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
  const gameController = createGameController({
    moleCycle,
    roundTimer,
    bestScoreStore,
    audio,
    preferences,
    hammer,
  });

  gameController.connect();

  /* Release the listeners, the pending timeout, and the audio resources when
     the page goes away. */
  window.addEventListener("pagehide", () => {
    gameController.disconnect();
    themeController.disconnect();
  });
}
