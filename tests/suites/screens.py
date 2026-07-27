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
    results.check("the opening screen appears without taking focus",
                  browser.eval("document.activeElement === document.body"), True)
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
    results.check("and focus moves to its heading",
                  browser.eval("document.activeElement.id"), "settings-heading")
    results.check("which offers only its own controls", browser.eval(REACHABLE),
                  ["close-settings", "difficulty", "sound", "music-volume", "dark-theme"])
    browser.eval("document.querySelector('#close-settings').click()")
    time.sleep(0.2)
    results.check("Back returns to where it was opened from",
                  visible(browser), "screen-title")
    results.check("and focus follows to that screen's heading",
                  browser.eval("document.activeElement.id"), "title-heading")

    # Escape is the other way out of settings, and lands focus the same way.
    browser.eval("document.querySelector('#open-settings').click()")
    time.sleep(0.2)
    browser.press_key("Escape")
    time.sleep(0.2)
    results.check("Escape leaves settings", visible(browser), "screen-title")
    results.check("returning focus to the heading",
                  browser.eval("document.activeElement.id"), "title-heading")
    # Escape is a way out of settings only, not a global shortcut.
    browser.press_key("Escape")
    time.sleep(0.2)
    results.check("and does nothing from another screen",
                  visible(browser), "screen-title")

    # The round drives the screens.
    game.start_round(browser)
    results.check("starting a round shows the board", visible(browser), "screen-game")
    results.check("and focus moves to the board heading",
                  browser.eval("document.activeElement.id"), "game-heading")
    reachable = browser.eval(REACHABLE)
    results.check("the heads-up controls lead the game screen",
                  reachable[:2], ["pause-game", "restart-round"])
    results.check("and the board follows", reachable[2].startswith("Hole"), True)

    game.set_visibility(browser, True)
    results.check("pausing stays on the board", visible(browser), "screen-game")
    results.check("and the status says so",
                  game.control_state(browser)["status"], "Game paused.")
    game.set_visibility(browser, False)
    results.check("resuming stays on the board", visible(browser), "screen-game")

    results.ok("the round reaches game over", game.wait_for_game_over(browser))
    results.check("game over shows the game over screen", visible(browser), "screen-over")
    results.check("focus moves to the game over heading",
                  browser.eval("document.activeElement.id"), "over-heading")
    # The screen change speaks, through the heading it just moved focus to. The
    # status region went out of the tree with the board that held it, so it
    # cannot announce as well: game over is spoken exactly once.
    results.check("and it is the only thing that announces game over",
                  len(browser.live_regions()), 0)
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

    # The title screen shows the best score for the selected difficulty as the
    # score to beat. A round played to the end should leave it there on the way
    # back, in step with the best-score reading it mirrors.
    game.start_round(browser)
    for _ in range(4):
        if game.wait_for_mole(browser) >= 0:
            browser.eval("""
              (() => {
                const hole = [...document.querySelectorAll('.hole')]
                  .find(hole => hole.dataset.moleVisible === 'true');
                if (hole) { hole.click(); }
              })()
            """)
        time.sleep(0.15)
    results.ok("a scoring round reaches game over", game.wait_for_game_over(browser))
    over = game.control_state(browser)
    recorded = over["best"]
    results.at_least("the round set a best score to show", recorded, 1)
    results.check("game over shows the final score",
                  browser.eval("document.querySelector('#final-score').textContent"),
                  str(over["score"]))
    results.check("game over shows the best score",
                  browser.eval("document.querySelector('#best-score').textContent"),
                  str(recorded))
    results.check("game over notes a record when one was set",
                  browser.eval("document.querySelector('#record-note').hidden"), False)
    browser.eval("document.querySelector('#main-menu').click()")
    time.sleep(0.35)
    results.check("the title screen shows the best score to beat",
                  browser.eval(
                      "document.querySelector('#title-best-score').textContent"),
                  str(recorded))

    # Teardown must leave the screens where they are rather than jumping.
    browser.eval("window.dispatchEvent("
                 "new PageTransitionEvent('pagehide', {persisted: false}))")
    time.sleep(0.25)
    results.check("teardown does not move the player", visible(browser), "screen-title")
