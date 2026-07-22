"""The round lifecycle: which controls are available in each state, what the
status region says, and that pausing and resuming keep the remaining time.

Difficulty is locked for as long as a round exists, so the round the player is
in is always the round they started.
"""

import time

from support import game

NAME = "lifecycle"
DESCRIPTION = "round states, control availability, and status messages"


def run(browser, url, results):
    browser.before_load(game.FAST_CLOCK)
    browser.viewport(1280, 800)
    browser.navigate(url)
    game.clear_storage(browser)
    browser.navigate(url)

    ready = game.control_state(browser)
    results.check("ready: Start Game offered", ready["startEnabled"], True)
    results.check("ready: Restart Game withheld", ready["restartEnabled"], False)
    results.check("ready: difficulty can be chosen", ready["difficultyEnabled"], True)
    results.check("ready: no hole can be hit", ready["holesEnabled"], 0)
    results.check("ready: status", ready["status"], "Ready to start.")
    results.check("ready: score starts at zero", ready["score"], 0)
    results.check("ready: the full round is shown", ready["time"], 60)

    game.start_round(browser)
    running = game.control_state(browser)
    results.check("running: Start Game withdrawn", running["startEnabled"], False)
    results.check("running: Restart Game offered", running["restartEnabled"], True)
    results.check("running: difficulty locked", running["difficultyEnabled"], False)
    results.check("running: every hole is live", running["holesEnabled"], 9)
    results.check("running: status", running["status"],
                  "Hit each mole before it disappears.")

    game.set_visibility(browser, True)
    paused = game.control_state(browser)
    results.check("paused: status", paused["status"], "Game paused.")
    results.check("paused: no hole can be hit", paused["holesEnabled"], 0)
    results.check("paused: Restart Game still offered", paused["restartEnabled"], True)
    results.check("paused: difficulty stays locked", paused["difficultyEnabled"], False)

    held = game.control_state(browser)["time"]
    time.sleep(1.2)
    results.check("paused: the countdown is not running",
                  game.control_state(browser)["time"], held)

    game.set_visibility(browser, False)
    resumed = game.control_state(browser)
    results.check("resumed: status", resumed["status"], "Game resumed.")
    results.check("resumed: the board is live again", resumed["holesEnabled"], 9)
    results.at_least("resumed: the remaining time was kept",
                     held - resumed["time"], 0)

    results.ok("resumed: no time was given back", resumed["time"] <= held)

    results.ok("game over is reached", game.wait_for_game_over(browser))
    finished = game.control_state(browser)
    results.check("finished: countdown at zero", finished["time"], 0)
    results.check("finished: Start Game stays withdrawn", finished["startEnabled"], False)
    results.check("finished: Restart Game offered", finished["restartEnabled"], True)
    results.check("finished: difficulty can be changed again",
                  finished["difficultyEnabled"], True)
    results.check("finished: the board is closed", finished["holesEnabled"], 0)
    results.ok("finished: the status reports the round is over",
               finished["status"].startswith("Game over. Final score:"))
    results.ok("finished: the status says how to play again",
               "Restart Game" in finished["status"])

    # A finished round must stay finished: no mole may appear afterwards.
    time.sleep(1.0)
    results.check("finished: no mole appears after the round ends",
                  browser.eval("document.querySelectorAll("
                               "'.hole[data-mole-visible=\"true\"]').length"), 0)

    browser.eval("document.querySelector('#restart-game').click()")
    time.sleep(0.4)
    restarted = game.control_state(browser)
    results.check("restart: the score returns to zero", restarted["score"], 0)
    results.check("restart: the full round is back", restarted["time"], 60)
    results.check("restart: the board is live", restarted["holesEnabled"], 9)
    results.check("restart: difficulty locks again", restarted["difficultyEnabled"], False)
