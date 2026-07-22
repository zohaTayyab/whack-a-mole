"""Light and dark themes.

Two rules decide everything here: a theme the player chose outranks the
operating system, and a theme that merely came from the system is not a choice
and is never written to storage.
"""

import time

from support import game

NAME = "theme"
DESCRIPTION = "system scheme, explicit choice, and what counts as a choice"

PREFS_KEY = "whack-a-mole.preferences.v1"
LIGHT_CANVAS = "rgb(242, 239, 230)"
DARK_CANVAS = "rgb(22, 20, 15)"


def state(browser):
    return {
        "canvas": browser.eval("getComputedStyle(document.body).backgroundColor"),
        "theme": browser.eval("document.documentElement.dataset.theme"),
        "checked": browser.eval("document.querySelector('#dark-theme').checked"),
        "stored": browser.eval("localStorage.getItem('{}')".format(PREFS_KEY)),
    }


def run(browser, url, results):
    browser.viewport(1280, 800)
    browser.color_scheme("light")
    browser.navigate(url)
    game.clear_storage(browser)
    browser.navigate(url)

    opened = state(browser)
    results.check("opens light under a light system", opened["canvas"], LIGHT_CANVAS)
    results.check("the checkbox agrees", opened["checked"], False)
    results.check("matching the system stores nothing", opened["stored"], None)

    browser.color_scheme("dark")
    time.sleep(0.4)
    followed = state(browser)
    results.check("follows the system to dark without a reload",
                  followed["canvas"], DARK_CANVAS)
    results.check("the root attribute follows", followed["theme"], "dark")
    results.check("the checkbox follows", followed["checked"], True)
    results.check("following the system still stores nothing", followed["stored"], None)

    browser.color_scheme("light")
    time.sleep(0.4)
    back = state(browser)
    results.check("follows the system back to light", back["canvas"], LIGHT_CANVAS)
    results.check("the checkbox follows back", back["checked"], False)
    results.check("and still stores nothing", back["stored"], None)

    browser.eval("document.querySelector('#dark-theme').click()")
    time.sleep(0.35)
    chosen = state(browser)
    results.check("choosing dark applies dark", chosen["canvas"], DARK_CANVAS)
    results.ok("the choice is recorded", "dark" in (chosen["stored"] or ""))

    browser.color_scheme("light")
    time.sleep(0.4)
    results.check("a system change cannot override the choice",
                  state(browser)["canvas"], DARK_CANVAS)
    browser.color_scheme("dark")
    time.sleep(0.4)
    results.check("nor can a system change back", state(browser)["canvas"], DARK_CANVAS)

    browser.color_scheme("light")
    browser.navigate(url)
    results.check("the choice survives a reload under a light system",
                  state(browser)["canvas"], DARK_CANVAS)

    # Clearing the record hands control back to the system on the next load:
    # the store keeps its answer for the session so settings survive storage
    # that stops responding.
    browser.eval("localStorage.removeItem('{}')".format(PREFS_KEY))
    browser.color_scheme("dark")
    browser.navigate(url)
    cleared = state(browser)
    results.check("with the record cleared the system decides again",
                  cleared["canvas"], DARK_CANVAS)
    results.check("and nothing has been written back", cleared["stored"], None)
    browser.color_scheme("light")
    time.sleep(0.4)
    results.check("and it goes on following", state(browser)["canvas"], LIGHT_CANVAS)

    # Teardown must release the subscription.
    browser.eval("localStorage.removeItem('{}')".format(PREFS_KEY))
    browser.color_scheme("dark")
    browser.navigate(url)
    results.check("loads dark with no choice on record", state(browser)["theme"], "dark")
    browser.eval("window.dispatchEvent("
                 "new PageTransitionEvent('pagehide', {persisted: false}))")
    time.sleep(0.2)
    browser.color_scheme("light")
    time.sleep(0.4)
    results.check("after teardown the page stops following the system",
                  state(browser)["theme"], "dark")

    # A persisted pagehide is the back/forward cache freezing the page, which
    # must leave everything attached.
    browser.color_scheme("dark")
    browser.navigate(url)
    browser.eval("window.dispatchEvent("
                 "new PageTransitionEvent('pagehide', {persisted: true}))")
    time.sleep(0.2)
    browser.color_scheme("light")
    time.sleep(0.4)
    results.check("a persisted pagehide leaves the page still following",
                  state(browser)["theme"], "light")

    # Both palettes have to be legible, not merely different.
    for scheme, canvas in (("light", LIGHT_CANVAS), ("dark", DARK_CANVAS)):
        browser.eval("localStorage.removeItem('{}')".format(PREFS_KEY))
        browser.color_scheme(scheme)
        browser.navigate(url)
        results.check("{}: the canvas is the expected colour".format(scheme),
                      browser.eval("getComputedStyle(document.body).backgroundColor"),
                      canvas)
        ratio = browser.eval("""
          (() => {
            const luminance = (colour) => {
              const [r, g, b] = colour.match(/\\d+/g).slice(0, 3).map(Number)
                .map(v => v / 255)
                .map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
              return 0.2126 * r + 0.7152 * g + 0.0722 * b;
            };
            const style = getComputedStyle(document.body);
            const a = luminance(style.color) + 0.05;
            const b = luminance(style.backgroundColor) + 0.05;
            return Math.round((Math.max(a, b) / Math.min(a, b)) * 100) / 100;
          })()
        """)
        results.at_least("{}: body text meets 4.5:1".format(scheme), ratio, 4.5)
