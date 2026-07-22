"""Hit detection and scoring across every input the game accepts.

A point is only ever awarded for activating the hole a mole is actually in, and
each mole can be scored at most once however many times it is struck.
"""

import time

from support import game

NAME = "scoring"
DESCRIPTION = "hit detection by mouse, keyboard, and touch"


def run(browser, url, results):
    browser.before_load(game.FAST_CLOCK)
    browser.viewport(1280, 900)
    browser.navigate(url)
    game.clear_storage(browser)
    browser.navigate(url)

    game.start_round(browser)

    # Mouse
    index = game.wait_for_mole(browser)
    results.ok("a mole appears once the round starts", index >= 0)
    point = game.mole_point(browser)
    results.ok("the mole has a reachable position", point is not None)
    if point:
        before = game.control_state(browser)["score"]
        browser.click_point(point["x"], point["y"])
        time.sleep(0.25)
        after = game.control_state(browser)["score"]
        results.check("a mouse click on the mole scores one point", after - before, 1)
        results.ok("the hit is reported in words",
                   game.control_state(browser)["status"].startswith("Mole hit."))
        results.check("the mole is taken away once hit",
                      browser.eval("document.querySelectorAll("
                                   "'.hole[data-mole-visible=\"true\"]').length"), 0)

    # The same mole cannot be scored twice.
    index = game.wait_for_mole(browser)
    if index >= 0:
        point = game.mole_point(browser)
        before = game.control_state(browser)["score"]
        for _ in range(4):
            browser.click_point(point["x"], point["y"])
        time.sleep(0.3)
        results.check("striking the same mole four times scores once",
                      game.control_state(browser)["score"] - before, 1)

    # An empty hole is worth nothing.
    browser.eval("""
      [...document.querySelectorAll('.hole')]
        .forEach(hole => hole.removeAttribute('data-mole-visible'));
    """)
    before = game.control_state(browser)["score"]
    browser.eval("""
      (() => {
        const hole = [...document.querySelectorAll('.hole')]
          .find(hole => hole.dataset.moleVisible !== 'true');
        hole.click();
      })()
    """)
    time.sleep(0.2)
    results.check("an empty hole scores nothing",
                  game.control_state(browser)["score"], before)

    # Keyboard
    index = game.wait_for_mole(browser)
    if index >= 0:
        before = game.control_state(browser)["score"]
        browser.eval(
            "[...document.querySelectorAll('.hole')]"
            ".find(hole => hole.dataset.moleVisible === 'true').focus()"
        )
        results.check("the mole's hole can take focus",
                      browser.eval("document.activeElement.classList.contains('hole')"), True)
        browser.press_key("Enter")
        time.sleep(0.25)
        results.check("Enter scores the mole",
                      game.control_state(browser)["score"] - before, 1)

    index = game.wait_for_mole(browser)
    if index >= 0:
        before = game.control_state(browser)["score"]
        browser.eval(
            "[...document.querySelectorAll('.hole')]"
            ".find(hole => hole.dataset.moleVisible === 'true').focus()"
        )
        browser.press_key(" ")
        time.sleep(0.25)
        results.check("Space scores the mole",
                      game.control_state(browser)["score"] - before, 1)

    # Touch
    browser.viewport(390, 844, mobile=True, touch=True)
    index = game.wait_for_mole(browser)
    if index >= 0:
        point = game.mole_point(browser)
        before = game.control_state(browser)["score"]
        browser.call("Input.dispatchTouchEvent", type="touchStart",
                     touchPoints=[{"x": point["x"], "y": point["y"]}])
        browser.call("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[])
        time.sleep(0.3)
        results.check("a tap scores the mole",
                      game.control_state(browser)["score"] - before, 1)
    browser.viewport(1280, 900)

    # Hits are refused while paused.
    game.set_visibility(browser, True)
    paused_score = game.control_state(browser)["score"]
    browser.eval("[...document.querySelectorAll('.hole')].forEach(hole => hole.click())")
    time.sleep(0.2)
    results.check("no hole can be scored while paused",
                  game.control_state(browser)["score"], paused_score)
    game.set_visibility(browser, False)

    # Hits are refused once the round is over.
    results.ok("the round finishes", game.wait_for_game_over(browser))
    final = game.control_state(browser)["score"]
    browser.eval("""
      [...document.querySelectorAll('.hole')].forEach(hole => {
        hole.disabled = false;
        hole.dataset.moleVisible = 'true';
        hole.click();
      });
    """)
    time.sleep(0.25)
    results.check("no hole can be scored after game over",
                  game.control_state(browser)["score"], final)
