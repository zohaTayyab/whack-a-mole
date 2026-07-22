"""The screens: which one is shown, and what the round has to do with it.

Two rules hold everything together. Exactly one screen is ever on show, and a
hidden screen leaves the page completely rather than merely stopping being
painted, so nothing invisible can still be reached with Tab.
"""

import time

from support import game

NAME = "screens"
DESCRIPTION = "the screen router and the round transitions that drive it"

VISIBLE = """
[...document.querySelectorAll('.screen')].filter(screen => !screen.hidden)
  .map(screen => screen.id)
"""

REACHABLE = """
[...document.querySelectorAll(
  'button:not([disabled]), select:not([disabled]), input:not([disabled])')]
  .filter(control => control.offsetParent !== null)
  .map(control => control.id || control.textContent.trim())
"""


def visible(browser):
    shown = browser.eval(VISIBLE)
    return shown[0] if len(shown) == 1 else shown


def run(browser, url, results):
    browser.before_load(game.FAST_CLOCK)
    browser.viewport(1280, 900)
    browser.navigate(url)
    game.clear_storage(browser)
    browser.navigate(url)

    results.check("the game opens on the title screen", visible(browser), "screen-title")
    results.check("and only one screen is on show",
                  len(browser.eval(VISIBLE)), 1)
    results.check("the title screen offers only its own controls",
                  browser.eval(REACHABLE), ["start-game", "open-settings"])
    results.check("every other screen carries the hidden attribute",
                  browser.eval("""
                    [...document.querySelectorAll('.screen')]
                      .filter(screen => screen.id !== 'screen-title')
                      .every(screen => screen.hasAttribute('hidden'))
                  """), True)
    results.check("a hidden screen is really hidden, not merely unpainted",
                  browser.eval("""
                    getComputedStyle(document.querySelector('#screen-game')).display
                  """), "none")
    results.check("and nothing inside it is in the accessibility tree",
                  sum(1 for node in browser.accessibility_tree()
                      if node.get("name", {}).get("value", "").startswith("Hole")), 0)

    # Settings, and back to wherever it was opened from.
    browser.eval("document.querySelector('#open-settings').click()")
    time.sleep(0.2)
    results.check("Settings opens the settings screen", visible(browser), "screen-settings")
    results.check("which offers only its own controls", browser.eval(REACHABLE),
                  ["close-settings", "difficulty", "sound", "music-volume", "dark-theme"])
    browser.eval("document.querySelector('#close-settings').click()")
    time.sleep(0.2)
    results.check("Back returns to where it was opened from",
                  visible(browser), "screen-title")

    # The round drives the screens.
    game.start_round(browser)
    results.check("starting a round shows the board", visible(browser), "screen-game")
    results.check("and the board is what can be reached",
                  browser.eval(REACHABLE)[0].startswith("Hole"), True)

    game.set_visibility(browser, True)
    results.check("pausing stays on the board", visible(browser), "screen-game")
    results.check("and the status says so",
                  game.control_state(browser)["status"], "Game paused.")
    game.set_visibility(browser, False)
    results.check("resuming stays on the board", visible(browser), "screen-game")

    results.ok("the round reaches game over", game.wait_for_game_over(browser))
    results.check("game over shows the game over screen", visible(browser), "screen-over")
    results.check("which offers a way to play again and a way out",
                  browser.eval(REACHABLE), ["restart-game", "main-menu"])

    browser.eval("document.querySelector('#restart-game').click()")
    time.sleep(0.35)
    results.check("Restart Game returns to the board", visible(browser), "screen-game")
    results.check("with a fresh score", game.control_state(browser)["score"], 0)

    # Main Menu belongs to game over: a round still being played is left alone.
    browser.eval("document.querySelector('#main-menu').click()")
    time.sleep(0.25)
    results.check("Main Menu does nothing during a round", visible(browser), "screen-game")
    results.check("and the round is still live",
                  game.control_state(browser)["holesEnabled"], 9)

    results.ok("the round reaches game over again", game.wait_for_game_over(browser))
    browser.eval("document.querySelector('#main-menu').click()")
    time.sleep(0.35)
    menu = game.control_state(browser)
    results.check("Main Menu returns to the title screen", visible(browser), "screen-title")
    results.check("and the game is ready to start again", menu["startEnabled"], True)
    results.check("with the score cleared", menu["score"], 0)
    results.check("the full round restored", menu["time"], 60)
    results.check("and the opening message", menu["status"], "Ready to start.")

    game.start_round(browser)
    results.check("a fresh round starts from the title screen",
                  visible(browser), "screen-game")
    results.check("with a live board", game.control_state(browser)["holesEnabled"], 9)

    # Settings can be reached and left without disturbing anything.
    browser.eval("document.querySelector('#restart-game').click()")
    time.sleep(0.2)
    game.wait_for_game_over(browser)
    browser.eval("document.querySelector('#main-menu').click()")
    time.sleep(0.3)
    browser.eval("document.querySelector('#open-settings').click()")
    time.sleep(0.2)
    browser.eval("""
      (() => {
        const select = document.querySelector('#difficulty');
        select.value = 'hard';
        select.dispatchEvent(new Event('change', {bubbles: true}));
      })()
    """)
    time.sleep(0.2)
    browser.eval("document.querySelector('#close-settings').click()")
    time.sleep(0.2)
    results.check("a difficulty chosen in settings survives leaving it",
                  browser.eval("document.querySelector('#difficulty').value"), "hard")
    results.check("and the title screen is where Back leads",
                  visible(browser), "screen-title")

    # Teardown must leave the screens where they are rather than jumping.
    browser.eval("window.dispatchEvent("
                 "new PageTransitionEvent('pagehide', {persisted: false}))")
    time.sleep(0.25)
    results.check("teardown does not move the player", visible(browser), "screen-title")
