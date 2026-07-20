/* Application entry point. Module scripts are deferred, so the interface is
   ready to initialize as soon as this module runs. */

import {
  hideMoles,
  initializeInterface,
  onStartGame,
  setStartGameEnabled,
  setStatusMessage,
  showMoleAt,
} from "./ui.js";
import { createMoleCycle } from "./mole-cycle.js";

const MOLES_APPEARING_MESSAGE = "Moles are appearing.";

if (initializeInterface()) {
  const moleCycle = createMoleCycle({ showMole: showMoleAt, hideMole: hideMoles });

  onStartGame(() => {
    moleCycle.start();
    setStartGameEnabled(false);
    setStatusMessage(MOLES_APPEARING_MESSAGE);
  });

  /* Release the pending timeout when the page goes away. Pausing while merely
     hidden belongs to the game-lifecycle milestone. */
  window.addEventListener("pagehide", () => {
    moleCycle.stop();
  });
}
