/* Application entry point. Module scripts are deferred, so the interface is
   ready to initialize as soon as this module runs. */

import { hideMoles, initializeInterface, showMoleAt } from "./ui.js";
import { createMoleCycle } from "./mole-cycle.js";
import { createRoundTimer } from "./round-timer.js";
import { createGameController } from "./game-controller.js";

if (initializeInterface()) {
  const moleCycle = createMoleCycle({ showMole: showMoleAt, hideMole: hideMoles });
  const roundTimer = createRoundTimer();
  const gameController = createGameController({ moleCycle, roundTimer });

  gameController.connect();

  /* Release the listeners and the pending timeout when the page goes away.
     Pausing while merely hidden belongs to the game-lifecycle milestone. */
  window.addEventListener("pagehide", () => {
    gameController.disconnect();
  });
}
