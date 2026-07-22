"""Helpers shared by the browser suites: driving a round, reading the
interface, and the small pieces of instrumentation the tests install.
"""

import time

# Ten times real speed, installed before any module runs, so a sixty-second
# round finishes in about six and the finished state can be measured rather
# than assumed.
FAST_CLOCK = """
(() => {
  const origin = Date.now();
  const realNow = Date.now.bind(Date);
  Date.now = () => origin + (realNow() - origin) * 10;
})();
"""

CONTROL_STATE = """
(() => {
  const holes = [...document.querySelectorAll('.hole')];
  return {
    startEnabled: !document.querySelector('#start-game').disabled,
    restartEnabled: !document.querySelector('#restart-game').disabled,
    difficultyEnabled: !document.querySelector('#difficulty').disabled,
    holesEnabled: holes.filter(hole => !hole.disabled).length,
    status: document.querySelector('#game-status').textContent.trim(),
    score: Number(document.querySelector('#score').textContent.trim()),
    time: Number(document.querySelector('#time-remaining').textContent.trim()),
    best: Number(document.querySelector('#best-score').textContent.trim()),
  };
})()
"""


def control_state(browser):
    return browser.eval(CONTROL_STATE)


def start_round(browser, settle=0.35):
    browser.eval("document.querySelector('#start-game').click()")
    time.sleep(settle)


def set_visibility(browser, hidden):
    """The game reads document.hidden, which is the boolean the Page Visibility
    API defines, so that is the property a test has to override."""
    browser.eval(
        "Object.defineProperty(document, 'hidden', "
        "{{configurable: true, get: () => {}}});"
        "document.dispatchEvent(new Event('visibilitychange'));".format(
            "true" if hidden else "false")
    )
    time.sleep(0.25)


def wait_for_mole(browser, timeout=6.0):
    """Returns the index of the visible mole, or -1 if none appears in time."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        index = browser.eval(
            "[...document.querySelectorAll('.hole')]"
            ".findIndex(hole => hole.dataset.moleVisible === 'true')"
        )
        if index is not None and index >= 0:
            return index
        time.sleep(0.05)
    return -1


def mole_point(browser):
    """Centre of the visible mole in viewport coordinates, scrolled into view
    first: an element above or below the fold reports coordinates the input
    dispatcher cannot reach."""
    return browser.eval("""
      (() => {
        const hole = [...document.querySelectorAll('.hole')]
          .find(hole => hole.dataset.moleVisible === 'true');
        if (!hole) { return null; }
        hole.scrollIntoView({block: 'center', behavior: 'instant'});
        const box = hole.getBoundingClientRect();
        return {x: box.left + box.width / 2, y: box.top + box.height / 2};
      })()
    """)


def wait_for_game_over(browser, timeout=25.0):
    """Waits for the countdown to reach zero. Only sensible with FAST_CLOCK."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        if browser.eval("document.querySelector('#time-remaining').textContent") == "0":
            time.sleep(0.4)
            return True
        time.sleep(0.2)
    return False


def clear_storage(browser):
    browser.eval("""
      try {
        localStorage.removeItem('whack-a-mole.best-scores.v1');
        localStorage.removeItem('whack-a-mole.preferences.v1');
      } catch (error) { /* storage may be denied; nothing to clear */ }
    """)
