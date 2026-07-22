"""Best scores and stored settings, including the cases where storage is
denied, empty, or holding something it should not.

The game must stay playable whatever storage does. A record is only ever set
by a round that was played to the end.
"""

import time

from support import game

NAME = "persistence"
DESCRIPTION = "best scores per difficulty, settings, and hostile storage"

BEST_KEY = "whack-a-mole.best-scores.v1"
PREFS_KEY = "whack-a-mole.preferences.v1"

DENY_STORAGE = """
(() => {
  const deny = () => { throw new DOMException('denied', 'SecurityError'); };
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get() { return {getItem: deny, setItem: deny, removeItem: deny}; },
  });
})();
"""


def played_round(browser, hits=2):
    """Plays a round to the end, scoring roughly the requested number of hits."""
    game.start_round(browser)
    scored = 0
    while scored < hits:
        if game.wait_for_mole(browser, timeout=3.0) < 0:
            break
        browser.eval("""
          (() => {
            const hole = [...document.querySelectorAll('.hole')]
              .find(hole => hole.dataset.moleVisible === 'true');
            if (hole) { hole.click(); }
          })()
        """)
        scored += 1
        time.sleep(0.1)
    game.wait_for_game_over(browser)
    return game.control_state(browser)["score"]


def run(browser, url, results):
    browser.before_load(game.FAST_CLOCK)
    browser.viewport(1280, 800)
    browser.navigate(url)
    game.clear_storage(browser)
    browser.navigate(url)

    results.check("no best score before anything is played",
                  game.control_state(browser)["best"], 0)

    score = played_round(browser, hits=2)
    results.ok("a completed round scores something", score > 0)
    results.check("the completed round sets the best score",
                  game.control_state(browser)["best"], score)
    results.ok("game over reports a new record",
               "New best score" in game.control_state(browser)["status"])

    stored = browser.eval("localStorage.getItem('{}')".format(BEST_KEY))
    results.ok("the best score is written to storage", stored is not None)
    results.ok("and it is filed under the difficulty played",
               "normal" in (stored or ""))

    browser.navigate(url)
    results.check("the best score survives a reload",
                  game.control_state(browser)["best"], score)

    # An abandoned round must not set a record.
    game.start_round(browser)
    if game.wait_for_mole(browser, timeout=3.0) >= 0:
        browser.eval("""
          (() => {
            const hole = [...document.querySelectorAll('.hole')]
              .find(hole => hole.dataset.moleVisible === 'true');
            if (hole) { hole.click(); }
          })()
        """)
    time.sleep(0.2)
    browser.eval("document.querySelector('#restart-game').click()")
    time.sleep(0.3)
    results.check("restarting mid-round leaves the record alone",
                  game.control_state(browser)["best"], score)
    results.check("and the score starts again from zero",
                  game.control_state(browser)["score"], 0)

    # Each difficulty keeps its own record.
    browser.navigate(url)
    browser.eval("""
      (() => {
        const select = document.querySelector('#difficulty');
        select.value = 'easy';
        select.dispatchEvent(new Event('change', {bubbles: true}));
      })()
    """)
    time.sleep(0.2)
    results.check("switching difficulty shows that difficulty's record",
                  game.control_state(browser)["best"], 0)
    browser.eval("""
      (() => {
        const select = document.querySelector('#difficulty');
        select.value = 'normal';
        select.dispatchEvent(new Event('change', {bubbles: true}));
      })()
    """)
    time.sleep(0.2)
    results.check("switching back shows the record again",
                  game.control_state(browser)["best"], score)

    # Corrupt storage must be treated as no record rather than as a failure.
    for corrupt in ("not json at all", "[]", "null", '{"normal": "seventy"}',
                    '{"normal": -5}', '{"normal": {"nested": 1}}'):
        browser.eval("localStorage.setItem('{}', {})".format(BEST_KEY, repr(corrupt)))
        browser.navigate(url)
        state = game.control_state(browser)
        results.check("corrupt best scores are ignored: {!r}".format(corrupt[:24]),
                      state["best"], 0)
        results.check("and the game still opens ready to play: {!r}".format(corrupt[:24]),
                      state["status"], "Ready to start.")

    for corrupt in ("{", '{"theme": "purple"}', '{"musicVolume": 900}',
                    '{"musicVolume": "loud"}'):
        browser.eval("localStorage.setItem('{}', {})".format(PREFS_KEY, repr(corrupt)))
        browser.navigate(url)
        results.check("corrupt settings fall back to full volume: {!r}".format(corrupt[:24]),
                      browser.eval("document.querySelector('#music-volume').value"), "100")

    # Denied storage must not stop the game being played.
    browser.before_load(DENY_STORAGE)
    browser.navigate(url)
    denied = game.control_state(browser)
    results.check("the game opens when storage is denied", denied["status"], "Ready to start.")
    results.check("no record is claimed when storage is denied", denied["best"], 0)
    game.start_round(browser)
    results.check("and a round can still be started",
                  game.control_state(browser)["holesEnabled"], 9)
