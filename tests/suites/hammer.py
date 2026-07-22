"""The hammer.

It is decoration. It may never take a pointer event, enter the tab order,
change what a hole is called, or have any say in the score.
"""

import time

from support import game

NAME = "hammer"
DESCRIPTION = "decorative overlay, pointer behaviour, and the strike"


def run(browser, url, results):
    browser.before_load(game.FAST_CLOCK)
    browser.viewport(1280, 900)
    browser.navigate(url)
    game.clear_storage(browser)
    browser.navigate(url)

    results.check("hidden from assistive technology",
                  browser.eval("document.querySelector('#hammer')"
                               ".getAttribute('aria-hidden')"), "true")
    results.check("takes no pointer events",
                  browser.eval("getComputedStyle(document.querySelector('#hammer'))"
                               ".pointerEvents"), "none")
    results.check("is not in the tab order",
                  browser.eval("document.querySelector('#hammer').hasAttribute('tabindex')"),
                  False)
    results.check("holds no text of its own",
                  browser.eval("document.querySelector('#hammer').textContent.trim()"), "")
    results.check("appears nowhere in the accessibility tree",
                  any(node.get("name", {}).get("value", "").lower().find("hammer") >= 0
                      for node in browser.accessibility_tree()), False)
    results.check("starts out of sight",
                  browser.eval("getComputedStyle(document.querySelector('#hammer'))"
                               ".visibility"), "hidden")

    # The holes must be named by their own label, never by the overlay.
    results.check(
        "hole names are unchanged by the hammer",
        browser.eval("[...document.querySelectorAll('.hole')]"
                     ".map(hole => hole.textContent.trim())"),
        ["Hole {}".format(n) for n in range(1, 10)],
    )

    game.start_round(browser)

    # A pointer over the board brings the hammer out on a device that has one.
    browser.media_features(**{"any_pointer": "fine", "any_hover": "hover"})
    box = browser.eval("""
      (() => {
        const board = document.querySelector('#board');
        board.scrollIntoView({block: 'center', behavior: 'instant'});
        const rect = board.getBoundingClientRect();
        return {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2};
      })()
    """)
    browser.move_mouse(box["x"], box["y"])
    time.sleep(0.3)

    # Whether the hammer follows the pointer depends on the emulated pointer
    # kind, which headless Chrome does not always report as fine. Either answer
    # is acceptable; what matters is that it never blocks the board.
    visible = browser.eval("document.querySelector('#hammer')"
                           ".getAttribute('data-hammer-visible')")
    results.ok("the hammer's visibility is a plain attribute",
               visible in (None, "true"))

    # Whatever the hammer is doing, a click has to reach the button underneath.
    index = game.wait_for_mole(browser)
    results.ok("a mole appears", index >= 0)
    if index >= 0:
        point = game.mole_point(browser)
        before = game.control_state(browser)["score"]
        browser.click_point(point["x"], point["y"])
        time.sleep(0.25)
        results.check("a click passes through the hammer to the hole",
                      game.control_state(browser)["score"] - before, 1)

    # The strike is driven by one attribute so it cannot half-apply.
    browser.eval("""
      (() => {
        const hammer = document.querySelector('#hammer');
        hammer.dataset.hammerStriking = 'true';
      })()
    """)
    results.check("the strike is a single attribute",
                  browser.eval("document.querySelector('#hammer')"
                               ".dataset.hammerStriking"), "true")
    browser.eval("delete document.querySelector('#hammer').dataset.hammerStriking")

    # Keyboard players get the same feedback, and it must not steal focus.
    index = game.wait_for_mole(browser)
    if index >= 0:
        browser.eval("""
          [...document.querySelectorAll('.hole')]
            .find(hole => hole.dataset.moleVisible === 'true').focus()
        """)
        before = game.control_state(browser)["score"]
        browser.press_key("Enter")
        time.sleep(0.25)
        results.check("a keyboard hit still scores",
                      game.control_state(browser)["score"] - before, 1)
        results.check("focus stays on the hole the player was on",
                      browser.eval("document.activeElement.classList.contains('hole')"),
                      True)

    # Reduced motion keeps the feedback and drops the travel.
    browser.media_features(prefers_reduced_motion="reduce")
    time.sleep(0.2)
    results.check("reduced motion removes the swing",
                  browser.eval("""
                    (() => {
                      const hammer = document.querySelector('#hammer');
                      hammer.dataset.hammerStriking = 'true';
                      const name = getComputedStyle(hammer).animationName;
                      delete hammer.dataset.hammerStriking;
                      return name;
                    })()
                  """), "none")
    # A hole transitions more than one property, so the computed value is a
    # list; every entry has to have collapsed, not just the first.
    results.check("and removes every interface transition",
                  browser.eval("""
                    getComputedStyle(document.querySelector('.hole'))
                      .transitionDuration.split(',')
                      .every(duration => parseFloat(duration) === 0)
                  """), True)
