"""Colour contrast, measured rather than pinned.

Every check here computes the WCAG contrast ratio from the colours the browser
actually resolves and asserts it against the threshold for what is being read.
Nothing asserts a fixed hex value, so a change of palette is judged on whether
it stays legible, not on whether it matches a number written down beforehand.

Thresholds (WCAG 2.1 AA):
  - normal text            4.5:1
  - large text             3.0:1  (>= 24px, or >= 18.66px bold)
  - user-interface graphics 3.0:1  (focus ring, controls, the board, the bar)
"""

from support import game

NAME = "contrast"
DESCRIPTION = "measured WCAG contrast ratios across both themes and every screen"

NORMAL_TEXT = 4.5
LARGE_TEXT = 3.0
UI_GRAPHIC = 3.0

# Defines the ratio helpers on the page. Redefined after every navigation,
# because a load clears them. relativeLuminance and the ratio formula are the
# ones the specification gives.
HELPERS = r"""
window.__lum = (colour) => {
  const parts = colour.match(/[\d.]+/g);
  if (!parts) { return null; }
  const [r, g, b] = parts.slice(0, 3).map(Number).map(v => v / 255)
    .map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
window.__ratio = (foreground, background) => {
  const a = window.__lum(foreground) + 0.05;
  const b = window.__lum(background) + 0.05;
  if (a === null || b === null) { return null; }
  return Math.round((Math.max(a, b) / Math.min(a, b)) * 100) / 100;
};
/* The colour actually painted behind an element: the first ancestor whose
   background is not transparent. Text sitting on the bare canvas resolves to
   the body's background this way. */
window.__behind = (node) => {
  for (let n = node; n; n = n.parentElement) {
    const bg = getComputedStyle(n).backgroundColor;
    const parts = bg.match(/[\d.]+/g);
    if (parts && (parts.length < 4 || Number(parts[3]) > 0)) { return bg; }
  }
  return "rgb(255, 255, 255)";
};
/* Text against whatever is painted behind it. */
window.__textRatio = (selector) => {
  const el = document.querySelector(selector);
  if (!el) { return null; }
  return window.__ratio(getComputedStyle(el).color, window.__behind(el));
};
"""

# One screen at a time is shown by hiding the others, so an element can be
# measured on the screen it belongs to. This reads painted colour, not
# behaviour, so driving the screen directly is enough.
REVEAL = ("[...document.querySelectorAll('.screen')]"
          ".forEach(s => s.hidden = s.id !== '{}')")


def reveal(browser, screen_id):
    browser.eval(REVEAL.format(screen_id))


def text(browser, results, scheme, selector, label, threshold):
    ratio = browser.eval("window.__textRatio('{}')".format(selector))
    if ratio is None:
        results.skip("{}: {} not found".format(scheme, label))
        return
    results.at_least("{}: {} reaches {}:1".format(scheme, label, threshold),
                     ratio, threshold)


def run(browser, url, results):
    # The board's colours change with the round: a live hole and its opening are
    # the interactive state that matters, so the game screen is measured with a
    # round under way rather than by revealing a board of disabled holes.
    browser.before_load(game.FAST_CLOCK)

    for scheme in ("light", "dark"):
        browser.viewport(1280, 800)
        browser.color_scheme(scheme)
        browser.navigate(url)
        browser.eval(HELPERS)

        # Title screen.
        reveal(browser, "screen-title")
        text(browser, results, scheme, ".page-intro", "the intro text", NORMAL_TEXT)
        text(browser, results, scheme, ".title-best", "the best-score label", NORMAL_TEXT)
        text(browser, results, scheme, ".title-best__value", "the best-score value", LARGE_TEXT)
        text(browser, results, scheme, "#start-game", "the Play button label", NORMAL_TEXT)
        text(browser, results, scheme, "#open-settings", "the Settings button label", NORMAL_TEXT)
        text(browser, results, scheme, ".instructions__list", "the instructions", NORMAL_TEXT)
        text(browser, results, scheme, ".page-title", "the wordmark", LARGE_TEXT)

        # The focus ring has to stand out from what is behind the control it
        # rings. It is drawn by :focus-visible, which only a keyboard focus
        # satisfies, so the control is reached with Tab first.
        browser.eval("document.body.focus()")
        for _ in range(6):
            browser.press_key("Tab")
            if browser.eval("document.activeElement.id") == "start-game":
                break
        # The ring is offset clear of the control, so it is drawn on the canvas
        # behind it rather than on the control's own fill; that is what it has to
        # stand out against.
        ring = browser.eval("""
          (() => {
            const el = document.querySelector('#start-game');
            return window.__ratio(getComputedStyle(el).outlineColor,
                                  window.__behind(el.parentElement));
          })()
        """)
        results.at_least("{}: the focus ring reaches {}:1".format(scheme, UI_GRAPHIC),
                         ring, UI_GRAPHIC)

        # Game screen, with a round running so the board is in its live state.
        game.start_round(browser)
        text(browser, results, scheme, ".hud__label", "the score label", NORMAL_TEXT)
        text(browser, results, scheme, "#score", "the score value", LARGE_TEXT)
        text(browser, results, scheme, ".status__message", "the status message", NORMAL_TEXT)
        # The icon controls: the glyph is drawn in the text colour, so it is
        # measured as a user-interface graphic against the button.
        text(browser, results, scheme, "#pause-game", "the pause icon", UI_GRAPHIC)
        text(browser, results, scheme, "#restart-round", "the restart icon", UI_GRAPHIC)

        # The countdown bar: its accent fill against its own track.
        bar = browser.eval("""
          (() => {
            const fill = getComputedStyle(document.querySelector('#score')).color;
            const track = getComputedStyle(document.querySelector('#time-bar')).backgroundColor;
            return window.__ratio(fill, track);
          })()
        """)
        results.at_least("{}: the countdown bar reaches {}:1".format(scheme, UI_GRAPHIC),
                         bar, UI_GRAPHIC)

        # The board: the recessed opening is where a hit is aimed, so it has to
        # read against the grass around it. The round above put the holes live,
        # so the muted disabled colours do not apply.
        opening = browser.eval("""
          (() => {
            const hole = document.querySelector('.hole');
            const grass = getComputedStyle(hole).backgroundColor;
            const soil = getComputedStyle(hole, '::before').backgroundColor;
            return window.__ratio(soil, grass);
          })()
        """)
        results.at_least("{}: the hole opening reads against the grass at {}:1".format(scheme, UI_GRAPHIC),
                         opening, UI_GRAPHIC)

        # Settings screen.
        reveal(browser, "screen-settings")
        text(browser, results, scheme, ".field__label", "a settings label", NORMAL_TEXT)
        text(browser, results, scheme, "#difficulty", "the difficulty control", NORMAL_TEXT)
        text(browser, results, scheme, "#close-settings", "the Back button label", NORMAL_TEXT)
        text(browser, results, scheme, ".field__reading", "the volume reading", NORMAL_TEXT)

        # Game-over screen. Play Again is enabled here so its true colours are
        # measured rather than its disabled ones.
        reveal(browser, "screen-over")
        browser.eval("document.querySelector('#restart-game').disabled = false")
        browser.eval("document.querySelector('#record-note').hidden = false")
        text(browser, results, scheme, ".over__label", "a game-over label", NORMAL_TEXT)
        text(browser, results, scheme, "#final-score", "the final score", LARGE_TEXT)
        text(browser, results, scheme, ".over__record", "the record note", NORMAL_TEXT)
        text(browser, results, scheme, "#restart-game", "the Play Again label", NORMAL_TEXT)
        text(browser, results, scheme, "#main-menu", "the Menu label", NORMAL_TEXT)
