"""Document structure, accessible names, and announcing regions.

The rule this suite exists to hold: Game Status is the only live region on the
page. The score, the countdown, and the best score are readings to consult, and
announcing them would interrupt the player every second.
"""

NAME = "structure"
DESCRIPTION = "semantic markup, accessible names, and live regions"

# In document order, which is also the order Tab visits them: the title
# screen, then the board, then the settings, then game over.
EXPECTED_NAMES = [
    "Start Game", "Settings",
    "Pause", "Restart",
    "Hole 1", "Hole 2", "Hole 3", "Hole 4", "Hole 5",
    "Hole 6", "Hole 7", "Hole 8", "Hole 9",
    "Back", "Difficulty", "Sound", "Music Volume", "Dark theme",
    "Play Again", "Menu",
]

SCREENS = ["screen-title", "screen-game", "screen-settings", "screen-over"]


def run(browser, url, results):
    browser.viewport(1280, 800)
    browser.color_scheme("light")
    browser.navigate(url)

    results.check("page title", browser.eval("document.title"), "Whack-a-Mole")
    results.check("document language", browser.eval("document.documentElement.lang"), "en")
    results.check("one main landmark", browser.eval("document.querySelectorAll('main').length"), 1)
    results.check("one banner", browser.eval("document.querySelectorAll('header').length"), 1)
    results.check("nine holes", browser.eval("document.querySelectorAll('.hole').length"), 9)

    results.check("one h1", browser.eval("document.querySelectorAll('h1').length"), 1)

    # Four screens, each a section carrying its own heading, so the game reads
    # as four places rather than one page.
    results.check("four screens, in order",
                  browser.eval("[...document.querySelectorAll('.stage > .screen')]"
                               ".map(screen => screen.id)"), SCREENS)
    results.check(
        "every screen is a section named by its own heading",
        browser.eval("""
          [...document.querySelectorAll('.stage > .screen')].every(screen => {
            if (screen.tagName !== 'SECTION') { return false; }
            const heading = document.getElementById(
              screen.getAttribute('aria-labelledby'));
            return Boolean(heading) && heading.tagName === 'H2'
              && heading.parentElement === screen
              && heading.textContent.trim().length > 0;
          })
        """),
        True,
    )
    results.check(
        "the screens name themselves",
        browser.eval("[...document.querySelectorAll('.stage > .screen')]"
                     ".map(screen => document.getElementById("
                     "screen.getAttribute('aria-labelledby')).textContent.trim())"),
        ["Start a Round", "Game Board", "Game Settings", "Game Over"],
    )
    results.check(
        "no screen is nested inside another",
        browser.eval("document.querySelectorAll('.screen .screen').length"), 0,
    )
    results.check(
        "every section is titled",
        browser.eval("""
          [...document.querySelectorAll('main > section')]
            .every(section => {
              const id = section.getAttribute('aria-labelledby');
              return Boolean(id) && Boolean(document.getElementById(id));
            })
        """),
        True,
    )
    results.check(
        "heading levels descend without a gap",
        browser.eval("""
          (() => {
            const levels = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
              .map(h => Number(h.tagName[1]));
            return levels.every((level, i) => i === 0 || level - levels[i - 1] <= 1);
          })()
        """),
        True,
    )

    # The readings are description lists, not form output. An output element
    # maps to role=status, which is an announcing region, so the score and the
    # countdown would each be announced on every change.
    results.check("the heads-up readings are a description list",
                  browser.eval("document.querySelectorAll('.hud__readings').length"), 1)
    results.check(
        "the heads-up display names the score and the countdown",
        browser.eval("[...document.querySelectorAll('.hud__readings dt')]"
                     ".map(term => term.textContent.trim())"),
        ["Score", "Time Remaining"],
    )
    results.check("the countdown bar is decoration, hidden from assistive technology",
                  browser.eval("document.querySelector('#time-bar')"
                               ".getAttribute('aria-hidden')"), "true")
    results.check("the game over readings are a description list",
                  browser.eval("document.querySelectorAll('.over__readings').length"), 1)
    results.check(
        "game over names the final score and the best score",
        browser.eval("[...document.querySelectorAll('.over__readings dt')]"
                     ".map(term => term.textContent.trim())"),
        ["Final Score", "Best Score"],
    )
    results.check(
        "no output element outside the status region",
        browser.eval("[...document.querySelectorAll('output')]"
                     ".every(node => node.id === 'game-status')"),
        True,
    )
    results.check(
        "nothing declares aria-live directly",
        browser.eval("document.querySelectorAll('[aria-live]').length"), 0,
    )

    names = browser.eval("""
      [...document.querySelectorAll('button, select, input')].map(el =>
        (el.labels && el.labels[0] ? el.labels[0].textContent : el.textContent).trim())
    """)
    results.check("every control keeps its name", names, EXPECTED_NAMES)
    results.check(
        "no control is named by an ARIA attribute instead of a real label",
        browser.eval("document.querySelectorAll("
                     "'button[aria-label], select[aria-label], input[aria-label]').length"),
        0,
    )
    results.check(
        "every form control has a real label",
        browser.eval("""
          [...document.querySelectorAll('select, input')]
            .every(control => control.labels && control.labels.length > 0)
        """),
        True,
    )
    results.check(
        "the holes are buttons",
        browser.eval("[...document.querySelectorAll('.hole')]"
                     ".every(hole => hole.tagName === 'BUTTON')"),
        True,
    )
    results.check(
        "no inline event handlers",
        browser.eval("""
          [...document.querySelectorAll('*')].some(el =>
            [...el.attributes].some(a => a.name.startsWith('on')))
        """),
        False,
    )
    results.check(
        "no inline styles",
        browser.eval("document.querySelectorAll('[style]').length"), 0,
    )
    results.check(
        "the hammer is hidden from assistive technology",
        browser.eval("document.querySelector('#hammer').getAttribute('aria-hidden')"),
        "true",
    )
    results.check(
        "the hammer is not focusable",
        browser.eval("document.querySelector('#hammer').hasAttribute('tabindex')"),
        False,
    )

    # Last, because it starts a round: a visible mole extends that hole's own
    # accessible name, which the checks above read.
    #
    # A hidden screen leaves the accessibility tree entirely, so the status
    # region is only exposed once the board is on show.
    results.check("no region announces before a round begins",
                  len(browser.live_regions()), 0)
    browser.eval("document.querySelector('#start-game').click()")
    regions = browser.live_regions()
    results.check("exactly one announcing region", len(regions), 1)
    if regions:
        results.check("and it is the status region", regions[0]["role"], "status")
        results.check("announcing politely", regions[0]["live"], "polite")
