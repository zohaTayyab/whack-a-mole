/* Draws the hammer. This module is presentation only: it is told what happened
   and shows it. It never decides whether a hit counts, never touches the score,
   the timer, the audio, or the round, and nothing here can start a round or
   award a point. The game's own click handling remains the only way to score. */

import {
  findHoleAtPoint,
  getHoleCentre,
  offBoardPointerLeave,
  offBoardPointerMove,
  onBoardPointerLeave,
  onBoardPointerMove,
  positionHammerAt,
  setHammerCursor,
  setHammerStriking,
  setHammerVisible,
} from "./ui.js";

/* Long enough to read as a swing, short enough not to lag behind a fast
   player. Matches the strike animation in the stylesheet. */
const STRIKE_DURATION_MS = 220;

/* A hammer that follows the pointer only makes sense for a pointer that can
   hover and aim precisely. A finger cannot, and would be covered by its own
   hand, so touch gets a strike at the hole instead. */
const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";

function defaultHasFinePointer() {
  return () => {
    try {
      return (
        typeof globalThis.matchMedia === "function" &&
        globalThis.matchMedia(FINE_POINTER_QUERY).matches === true
      );
    } catch (error) {
      return false;
    }
  };
}

/* The kind of pointer is not fixed for the life of the page: a tablet gains one
   when its keyboard is attached and loses it again when it is taken away, and a
   desktop can have its mouse unplugged. Answering only once would leave those
   players with a hammer that never appears, or one still chasing a pointer that
   no longer exists.

   Returns a function that stops watching, or null where the browser gives no
   way to watch. */
function defaultOnFinePointerChange() {
  return (handler) => {
    try {
      if (typeof globalThis.matchMedia !== "function") {
        return null;
      }

      const query = globalThis.matchMedia(FINE_POINTER_QUERY);
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

function defaultRequestFrame() {
  return typeof globalThis.requestAnimationFrame === "function"
    ? (callback) => globalThis.requestAnimationFrame(callback)
    : (callback) => globalThis.setTimeout(callback, 0);
}

function defaultCancelFrame() {
  return typeof globalThis.cancelAnimationFrame === "function"
    ? (handle) => globalThis.cancelAnimationFrame(handle)
    : (handle) => globalThis.clearTimeout(handle);
}

/**
 * Creates the hammer controller.
 *
 * @param {{hasFinePointer?: () => boolean,
 *   onFinePointerChange?: (handler: (isFine: boolean) => void) => (() => void)|null,
 *   requestFrame?: Function, cancelFrame?: Function, schedule?: Function,
 *   cancel?: Function}} [dependencies]
 */
export function createHammerController({
  hasFinePointer = defaultHasFinePointer(),
  onFinePointerChange = defaultOnFinePointerChange(),
  requestFrame = defaultRequestFrame(),
  cancelFrame = defaultCancelFrame(),
  schedule = (callback, delayMs) => setTimeout(callback, delayMs),
  cancel = (handle) => clearTimeout(handle),
} = {}) {
  let connected = false;
  /* Only true while a round is running: the hammer has no business appearing
     over a board that cannot be played. */
  let active = false;
  let following = false;
  let fine = false;
  /* At most one frame is ever outstanding. A fast pointer produces far more
     events than frames, and queueing them all would be work nobody sees. */
  let pendingFrame = null;
  let pendingPoint = null;
  let strikeHandle = null;
  let stopWatchingPointer = null;

  function clearPendingFrame() {
    if (pendingFrame !== null) {
      cancelFrame(pendingFrame);
      pendingFrame = null;
    }

    pendingPoint = null;
  }

  function clearStrike() {
    if (strikeHandle !== null) {
      cancel(strikeHandle);
      strikeHandle = null;
    }

    setHammerStriking(false);
  }

  /* Everything the hammer might be doing, undone in one place, so no exit path
     can leave the cursor hidden or a swing frozen mid-air. */
  function hide() {
    clearPendingFrame();
    clearStrike();
    following = false;
    setHammerVisible(false);
    setHammerCursor(false);
  }

  function drawPendingPoint() {
    pendingFrame = null;

    if (!active || pendingPoint === null) {
      return;
    }

    positionHammerAt(pendingPoint.x, pendingPoint.y);
    pendingPoint = null;
  }

  /* Pointer movement positions the hammer and nothing else. It never reports a
     hit, and never consults the mole. */
  function handlePointerMove(event) {
    if (!active || !fine) {
      return;
    }

    if (findHoleAtPoint(event.clientX, event.clientY) === -1) {
      if (following) {
        following = false;
        setHammerVisible(false);
        setHammerCursor(false);
      }

      return;
    }

    if (!following) {
      following = true;
      setHammerVisible(true);
      setHammerCursor(true);
    }

    pendingPoint = { x: event.clientX, y: event.clientY };

    if (pendingFrame === null) {
      pendingFrame = requestFrame(drawPendingPoint);
    }
  }

  function handlePointerLeave() {
    if (!following) {
      return;
    }

    clearPendingFrame();
    following = false;
    setHammerVisible(false);
    setHammerCursor(false);
  }

  function strikeAt(point) {
    clearStrike();
    positionHammerAt(point.x, point.y);
    setHammerVisible(true);
    setHammerStriking(true);

    strikeHandle = schedule(() => {
      strikeHandle = null;
      setHammerStriking(false);

      /* A pointer that is still over the board keeps its hammer; anything
         else put it there only for the strike, so it goes away again. */
      if (!following) {
        setHammerVisible(false);
      }
    }, STRIKE_DURATION_MS);
  }

  /* The pointer listeners exist only while there is a pointer worth following,
     so gaining or losing one is a matter of registering or releasing them. A
     hammer left over from a pointer that has gone is put away with them. */
  function applyPointerKind(isFine) {
    if (isFine === fine) {
      return;
    }

    fine = isFine;

    if (fine) {
      onBoardPointerMove(handlePointerMove);
      onBoardPointerLeave(handlePointerLeave);
      return;
    }

    offBoardPointerMove();
    offBoardPointerLeave();
    hide();
  }

  return {
    connect() {
      if (connected) {
        return;
      }

      connected = true;
      hide();
      applyPointerKind(hasFinePointer() === true);
      stopWatchingPointer = onFinePointerChange(applyPointerKind);
    },

    /** Called when a round starts or resumes. */
    activate() {
      if (!connected) {
        return;
      }

      active = true;
    },

    /** Called when the round pauses, ends, restarts, or is torn down. */
    deactivate() {
      active = false;
      hide();
    },

    /**
     * Shows one strike over a hole that was activated. Called after the game
     * has already dealt with the activation, and told nothing about whether it
     * scored, because the hammer swings the same either way.
     *
     * @param {number} holeIndex
     */
    strikeHole(holeIndex) {
      if (!connected || !active) {
        return;
      }

      const centre = getHoleCentre(holeIndex);
      if (centre === null) {
        return;
      }

      strikeAt(centre);
    },

    disconnect() {
      if (!connected) {
        return;
      }

      connected = false;
      active = false;

      if (stopWatchingPointer !== null) {
        stopWatchingPointer();
        stopWatchingPointer = null;
      }

      /* Releases the pointer listeners if any were registered; hiding is
         unconditional, because the hammer may be mid-strike. */
      applyPointerKind(false);
      hide();
    },
  };
}
