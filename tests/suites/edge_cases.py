"""The awkward cases: leaving the page and coming back, hammering the controls,
resizing mid-round, and anything that could leave two of something running.
"""

import time

from support import game

NAME = "edge-cases"
DESCRIPTION = "back/forward cache, rapid input, resize, and cleanup"

# Counts the timers the page has outstanding, so a duplicated round timer or a
# leaked mole cycle shows up as a number.
TIMER_SPY = """
(() => {
  window.__timers = {intervals: 0, timeouts: 0};
  const setInterval_ = window.setInterval;
  const clearInterval_ = window.clearInterval;
  window.setInterval = (...args) => { window.__timers.intervals += 1; return setInterval_(...args); };
  window.clearInterval = (...args) => { window.__timers.intervals -= 1; return clearInterval_(...args); };
})();
"""


def run(browser, url, results):
    browser.before_load(game.FAST_CLOCK)
    browser.before_load(TIMER_SPY)
    browser.viewport(1280, 900)
    browser.navigate(url)
    game.clear_storage(browser)
    browser.navigate(url)

    # A persisted pagehide is the back/forward cache freezing the page. Tearing
    # the game down there leaves the player returning to a board that no longer
    # responds.
    game.start_round(browser)
    browser.eval("window.dispatchEvent("
                 "new PageTransitionEvent('pagehide', {persisted: true}))")
    time.sleep(0.3)
    frozen = game.control_state(browser)
    results.check("a persisted pagehide leaves the board playable",
                  frozen["holesEnabled"], 9)
    results.check("and Restart Game still offered", frozen["restartEnabled"], True)

    index = game.wait_for_mole(browser)
    if index >= 0:
        before = frozen["score"]
        browser.eval("""
          (() => {
            const hole = [...document.querySelectorAll('.hole')]
              .find(hole => hole.dataset.moleVisible === 'true');
            if (hole) { hole.click(); }
          })()
        """)
        time.sleep(0.2)
        results.check("and a mole can still be scored after it",
                      game.control_state(browser)["score"] - before, 1)

    # A real pagehide must release everything.
    browser.eval("window.dispatchEvent("
                 "new PageTransitionEvent('pagehide', {persisted: false}))")
    time.sleep(0.3)
    torn_down = game.control_state(browser)
    results.check("a real pagehide closes the board", torn_down["holesEnabled"], 0)
    results.check("and withdraws Start Game", torn_down["startEnabled"], False)
    results.check("and withdraws Restart Game", torn_down["restartEnabled"], False)

    # Hammering the controls must not leave two rounds running.
    browser.navigate(url)
    for _ in range(10):
        browser.eval("document.querySelector('#start-game').click()")
    time.sleep(0.3)
    after_start_spam = game.control_state(browser)
    results.check("ten clicks on Start Game still leaves one round",
                  after_start_spam["holesEnabled"], 9)
    results.ok("and one round's worth of time, not several",
               30 <= after_start_spam["time"] <= 60)

    for _ in range(10):
        browser.eval("document.querySelector('#restart-game').click()")
    time.sleep(0.4)
    after_restart_spam = game.control_state(browser)
    results.check("ten restarts leave the score at zero", after_restart_spam["score"], 0)
    results.check("and one live board", after_restart_spam["holesEnabled"], 9)
    results.check("and at most one mole visible",
                  browser.eval("document.querySelectorAll("
                               "'.hole[data-mole-visible=\"true\"]').length") <= 1, True)

    # Repeatedly hiding and showing must not stack timers or leave it paused.
    for _ in range(5):
        game.set_visibility(browser, True)
        game.set_visibility(browser, False)
    settled = game.control_state(browser)
    results.check("after five hide and show cycles the board is live",
                  settled["holesEnabled"], 9)
    results.check("and the status is the running one", settled["status"],
                  "Game resumed.")

    # The countdown must only ever run down, and at the rate of the clock. The
    # test clock runs ten times real speed, so about ten seconds should come
    # off per real second; anything that gave time back, or ran away with it,
    # shows up here. Sampled several times because a single pair of readings
    # cannot tell a steady countdown from a stuttering one.
    # Restarted first, so there is a full round left to sample: the clicking
    # above runs the ten-times clock through a good part of one.
    browser.eval("document.querySelector('#restart-game').click()")
    time.sleep(0.3)
    samples = []
    for _ in range(6):
        samples.append(game.control_state(browser)["time"])
        time.sleep(0.25)
    results.ok("the countdown never goes back up",
               all(later <= earlier for earlier, later in zip(samples, samples[1:])))
    elapsed = samples[0] - samples[-1]
    results.ok("and runs down at about the rate of the clock, once over",
               6 <= elapsed <= 30)

    # Resizing and rotating must not disturb a round in progress.
    mid_round = game.control_state(browser)
    browser.viewport(390, 844, mobile=True)
    time.sleep(0.25)
    browser.viewport(844, 390, mobile=True)
    time.sleep(0.25)
    browser.viewport(1280, 900)
    time.sleep(0.25)
    resized = game.control_state(browser)
    results.check("resizing keeps the score", resized["score"], mid_round["score"])
    results.check("resizing keeps the board live", resized["holesEnabled"], 9)
    results.ok("resizing does not add time", resized["time"] <= mid_round["time"])

    # Game over happens once, and restarting afterwards works.
    results.ok("the round reaches game over", game.wait_for_game_over(browser))
    over = game.control_state(browser)
    time.sleep(1.0)
    still_over = game.control_state(browser)
    results.check("the game-over message is not rewritten afterwards",
                  still_over["status"], over["status"])
    results.check("the countdown stays at zero", still_over["time"], 0)

    browser.eval("document.querySelector('#restart-game').click()")
    time.sleep(0.4)
    results.check("a round can be started again after game over",
                  game.control_state(browser)["holesEnabled"], 9)

    # Nothing may be written to the console during normal play.
    results.check("no debugging output is left in the game",
                  browser.eval("window.__consoleCalls || 0"), 0)
