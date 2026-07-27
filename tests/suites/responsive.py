"""Layout across the viewports the game is meant to support, plus the things
that make it usable there: no sideways scrolling, targets a finger can hit, and
a focus ring that can actually be seen.
"""

from support import game

NAME = "responsive"
DESCRIPTION = "layout, overflow, target sizes, and focus visibility"

VIEWPORTS = [
    ("320x568 portrait", 320, 568, True),
    ("375x667 portrait", 375, 667, True),
    ("390x844 portrait", 390, 844, True),
    ("768x1024 tablet", 768, 1024, True),
    ("1024x768 landscape", 1024, 768, True),
    ("1280x800 desktop", 1280, 800, False),
    ("1440x900 desktop", 1440, 900, False),
    ("667x375 landscape", 667, 375, True),
    # The CSS viewport left by 200% page zoom on a 1280 pixel screen.
    ("640x400 at 200% zoom", 640, 400, False),
]

MINIMUM_TARGET = 44


def run(browser, url, results):
    for label, width, height, mobile in VIEWPORTS:
        browser.viewport(width, height, mobile=mobile)
        browser.navigate(url, settle=0.35)

        overflow = browser.eval("""
          (() => {
            const doc = document.documentElement;
            return {
              scrollWidth: doc.scrollWidth,
              clientWidth: doc.clientWidth,
              widest: [...document.querySelectorAll('main *')]
                .reduce((widest, el) => Math.max(widest, el.getBoundingClientRect().right), 0),
            };
          })()
        """)
        results.ok("{}: the page does not scroll sideways".format(label),
                   overflow["scrollWidth"] <= overflow["clientWidth"] + 1)

        # The stage is one screen tall and the document itself never scrolls;
        # anything that does not fit scrolls inside the layout instead, so a
        # round is never interrupted by the page moving under the player.
        stage = browser.eval("""
          (() => {
            const doc = document.documentElement;
            const layout = document.querySelector('.stage');
            return {
              stageHeight: Math.round(document.body.getBoundingClientRect().height),
              viewport: doc.clientHeight,
              documentScrolls: doc.scrollHeight > doc.clientHeight + 1,
              everythingReachable:
                layout.scrollHeight <= layout.clientHeight + 1 ||
                getComputedStyle(layout).overflowY === 'auto',
            };
          })()
        """)
        results.ok("{}: the stage fills exactly one screen".format(label),
                   abs(stage["stageHeight"] - stage["viewport"]) <= 1)
        results.check("{}: the document does not scroll".format(label),
                      stage["documentScrolls"], False)
        results.check("{}: nothing is left unreachable".format(label),
                      stage["everythingReachable"], True)
        results.ok("{}: nothing reaches past the viewport".format(label),
                   overflow["widest"] <= overflow["clientWidth"] + 1)

        # The board lives on the game screen, so the round has to be started
        # before there is anything to measure.
        browser.eval("document.querySelector('#start-game').click()")
        board = browser.eval("""
          (() => {
            const rect = document.querySelector('#board').getBoundingClientRect();
            return {width: Math.round(rect.width), height: Math.round(rect.height)};
          })()
        """)
        results.ok("{}: the board is square".format(label),
                   abs(board["width"] - board["height"]) <= 2)
        results.ok("{}: the board has room to be played".format(label),
                   board["width"] >= 200)

        # The heads-up display is only on show during a round, so its overflow
        # would slip past a check made on the title screen. The tight row of
        # score, countdown, and controls is exactly what could push the play
        # screen wider than the viewport, so it is measured here with the round
        # under way.
        play = browser.eval("""
          (() => {
            const doc = document.documentElement;
            return {
              scrollWidth: doc.scrollWidth,
              clientWidth: doc.clientWidth,
              widest: [...document.querySelectorAll('#screen-game *')]
                .reduce((widest, el) => Math.max(widest, el.getBoundingClientRect().right), 0),
            };
          })()
        """)
        results.ok("{}: the play screen does not scroll sideways".format(label),
                   play["scrollWidth"] <= play["clientWidth"] + 1)
        results.ok("{}: nothing on the play screen reaches past the viewport".format(label),
                   play["widest"] <= play["clientWidth"] + 1)

        # A checkbox sits inside its label, so the label is the target: the
        # whole row activates the control, not only the 22px box. Measuring the
        # box alone would measure something the player never has to hit.
        smallest = browser.eval("""
          (() => {
            const targets = [...document.querySelectorAll(
              'button, select, input[type="range"], .field__label--checkbox')];
            return targets.reduce((smallest, el) => {
              const rect = el.getBoundingClientRect();
              const size = Math.min(rect.width, rect.height);
              return size > 0 && size < smallest ? size : smallest;
            }, Infinity);
          })()
        """)
        results.at_least("{}: every target is at least {}px".format(label, MINIMUM_TARGET),
                         round(smallest), MINIMUM_TARGET)

        results.ok("{}: the heading is readable".format(label),
                   browser.eval("parseFloat(getComputedStyle("
                                "document.querySelector('.page-title')).fontSize)") >= 24)

    # Focus has to be visible, in both themes, on the controls and the board.
    for scheme in ("light", "dark"):
        browser.viewport(1280, 800)
        browser.color_scheme(scheme)
        browser.navigate(url, settle=0.35)
        # The ring is drawn with :focus-visible, which a programmatic focus()
        # deliberately does not satisfy. Reaching the control with Tab is the
        # only way to measure what a keyboard player actually sees.
        browser.eval("document.body.focus()")
        for _ in range(20):
            browser.press_key("Tab")
            if browser.eval("document.activeElement.id") == "start-game":
                break
        results.check("{}: Tab reaches Start Game".format(scheme),
                      browser.eval("document.activeElement.id"), "start-game")

        outline = browser.eval("""
          (() => {
            const button = document.querySelector('#start-game');
            const style = getComputedStyle(button);
            return {
              width: parseFloat(style.outlineWidth) || 0,
              style: style.outlineStyle,
              offset: parseFloat(style.outlineOffset) || 0,
              matches: button.matches(':focus-visible'),
            };
          })()
        """)
        results.ok("{}: the control is treated as keyboard-focused".format(scheme),
                   outline["matches"])
        results.at_least("{}: the focus ring is thick enough to see".format(scheme),
                         outline["width"], 2)
        results.ok("{}: the focus ring is drawn".format(scheme),
                   outline["style"] not in ("none", ""))
        results.at_least("{}: the focus ring is offset clear of the control".format(scheme),
                         outline["offset"], 1)

    # Tab order has to follow the document, and nothing may trap it.
    browser.viewport(1280, 800)
    browser.navigate(url, settle=0.35)
    game.start_round(browser)
    reachable = browser.eval("""
      (() => {
        const focusable = [...document.querySelectorAll(
          'button:not([disabled]), select:not([disabled]), input:not([disabled])')];
        return focusable.length;
      })()
    """)
    results.at_least("every enabled control can be reached", reachable, 12)
    # A screen's heading is made programmatically focusable so focus can land on
    # it when that screen is entered. That is the only use of a negative
    # tabindex: no interactive control is taken out of the tab order.
    results.check("no interactive control is removed from the tab order",
                  browser.eval("document.querySelectorAll("
                               "'button[tabindex=\"-1\"], a[tabindex=\"-1\"], "
                               "select[tabindex=\"-1\"], input[tabindex=\"-1\"], "
                               "[tabindex=\"-1\"][role]').length"), 0)
    results.check("only the screen headings are made programmatically focusable",
                  browser.eval("[...document.querySelectorAll('[tabindex=\"-1\"]')]"
                               ".every(el => el.classList.contains('screen__title'))"), True)
