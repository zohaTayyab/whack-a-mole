"""Difficulty: the timing each level promises, the fallback for anything
unrecognised, and the lock that holds for the length of a round.
"""

import time

from support import game

NAME = "difficulty"
DESCRIPTION = "timing profiles, validation, and the in-round lock"

CONFIG = """
import('./scripts/config.js').then(module => ({
  holeCount: module.HOLE_COUNT,
  roundSeconds: module.ROUND_DURATION_SECONDS,
  defaultDifficulty: module.DEFAULT_DIFFICULTY,
  supported: module.supportedDifficulties(),
  profiles: module.DIFFICULTY_PROFILES,
  fallbacks: ['', 'IMPOSSIBLE', null, undefined, 0, [], {}, 'Easy']
    .map(value => module.resolveDifficulty(value)),
  frozen: Object.isFrozen(module.DIFFICULTY_PROFILES),
}))
"""


def run(browser, url, results):
    browser.viewport(1280, 800)
    browser.navigate(url)

    config = browser.eval(CONFIG, await_promise=True)
    results.check("nine holes", config["holeCount"], 9)
    results.check("a sixty second round", config["roundSeconds"], 60)
    results.check("normal is the default", config["defaultDifficulty"], "normal")
    results.check("three levels are offered", config["supported"], ["easy", "normal", "hard"])
    results.check("the profiles cannot be mutated", config["frozen"], True)
    results.check("anything unrecognised falls back to normal",
                  set(config["fallbacks"]), {"normal"})

    profiles = config["profiles"]
    results.check("easy timing", profiles["easy"],
                  {"visibleMinMs": 1000, "visibleMaxMs": 1700,
                   "gapMinMs": 400, "gapMaxMs": 900})
    results.check("normal timing", profiles["normal"],
                  {"visibleMinMs": 650, "visibleMaxMs": 1200,
                   "gapMinMs": 300, "gapMaxMs": 800})
    results.check("hard timing", profiles["hard"],
                  {"visibleMinMs": 500, "visibleMaxMs": 850,
                   "gapMinMs": 250, "gapMaxMs": 650})

    for level in ("easy", "normal", "hard"):
        results.ok(
            "{}: a mole stays visible longer than the gap before it".format(level),
            profiles[level]["visibleMinMs"] > profiles[level]["gapMinMs"],
        )
    results.ok("easy gives more reaction time than normal",
               profiles["easy"]["visibleMinMs"] > profiles["normal"]["visibleMinMs"])
    results.ok("hard gives less reaction time than normal",
               profiles["hard"]["visibleMinMs"] < profiles["normal"]["visibleMinMs"])

    results.check(
        "the markup offers exactly those three levels",
        browser.eval("[...document.querySelectorAll('#difficulty option')]"
                     ".map(option => option.value)"),
        ["easy", "normal", "hard"],
    )
    results.check(
        "the option labels are readable",
        browser.eval("[...document.querySelectorAll('#difficulty option')]"
                     ".map(option => option.textContent.trim())"),
        ["Easy", "Normal", "Hard"],
    )
    results.check("normal is selected to begin with",
                  browser.eval("document.querySelector('#difficulty').value"), "normal")

    # The lock: difficulty is fixed for as long as a round exists.
    browser.eval("""
      (() => {
        const select = document.querySelector('#difficulty');
        select.value = 'hard';
        select.dispatchEvent(new Event('change', {bubbles: true}));
      })()
    """)
    time.sleep(0.2)
    results.check("difficulty can be chosen before a round",
                  browser.eval("document.querySelector('#difficulty').value"), "hard")

    game.start_round(browser)
    results.check("difficulty is locked once the round starts",
                  browser.eval("document.querySelector('#difficulty').disabled"), True)

    browser.eval("document.querySelector('#restart-game').click()")
    time.sleep(0.3)
    results.check("and stays locked through a restart",
                  browser.eval("document.querySelector('#difficulty').disabled"), True)

    game.set_visibility(browser, True)
    results.check("and stays locked while paused",
                  browser.eval("document.querySelector('#difficulty').disabled"), True)
    game.set_visibility(browser, False)
