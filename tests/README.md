# Tests

Automated checks for the game. No framework, no packages to install, nothing downloaded.

```sh
python3 tests/run.py              # every suite
python3 tests/run.py theme audio  # only the named suites
python3 tests/run.py --list       # what is available
```

The exit status is zero only when every check passed.

## What it needs

| Requirement | Used for | If it is missing |
| --- | --- | --- |
| Python 3 | running the suites | nothing runs |
| Chrome or Chromium | the browser suites | those suites are reported as **skipped** |
| Any engine that loads ES modules | the module suite | that suite is reported as **skipped** |

The browser is looked for in the usual install locations. Point `CHROME` at the executable to use another
one, and `JS_ENGINE` at a JavaScript engine for the module suite. On macOS the JavaScriptCore shell that ships
with the system is found automatically, so nothing has to be installed there.

A suite that cannot run is reported as skipped and never counted as passing. A run that skips everything still
exits zero, so read the summary rather than the exit status alone when checking coverage.

## How it works

`support/browser.py` speaks the Chrome DevTools Protocol over a raw WebSocket, which is enough to drive a
headless browser: navigate, evaluate, emulate a viewport or a media preference, dispatch real mouse, touch, and
keyboard input, and read the accessibility tree. `support/server.py` serves the project on an unused loopback
port, because ES modules are not loaded over `file://`.

Suites drive the real interface rather than calling internal functions, so what they check is what a player
would meet. Where a test needs to make time pass it installs a clock running ten times real speed before the
game's modules load, so a sixty-second round finishes in about six seconds and the end of a round can be
measured instead of assumed.

## The suites

| Suite | Covers |
| --- | --- |
| `modules` | configuration, best scores, settings, the round timer, and the mole cycle, each given its dependencies by the test |
| `structure` | semantic markup, heading order, accessible names, and that Game Status is the only announcing region |
| `screens` | which screen is shown, that hidden screens leave the tab order, focus moving to each heading on navigation, Escape leaving settings, game over announced once, and the round transitions that drive them |
| `lifecycle` | which controls are available in every round state, the status messages, and pause and resume |
| `scoring` | hits by mouse, keyboard, and touch; one point per mole; nothing scored when paused or finished |
| `difficulty` | the timing each level promises, the fallback for anything unrecognised, and the in-round lock |
| `persistence` | best scores per difficulty, and storage that is denied, empty, or holding nonsense |
| `audio` | the sound control, music volume, and browsers that offer audio then refuse it |
| `theme` | following the system, an explicit choice outranking it, and what does not count as a choice, judged on whether the canvas stays light or dark rather than on fixed colours |
| `contrast` | WCAG contrast ratios computed from the colours the browser resolves, across both themes and every screen, asserted against the AA thresholds |
| `hammer` | that the decoration never takes a pointer event, enters the tab order, or affects the score |
| `responsive` | nine viewports in portrait and landscape, sideways overflow, the board fitting on screen without scrolling, target sizes, and a focus ring reached with Tab |
| `edge-cases` | the back/forward cache, hammering the controls, resizing mid-round, and cleanup |

## Writing a suite

A suite is a module in `suites/` exposing `NAME`, `DESCRIPTION`, and `run(browser, url, results)`. Record
outcomes with `results.check`, `results.ok`, or `results.at_least`; each records what was expected alongside what
was found, so a failure reads as a fact rather than a label.

Two things are worth knowing before writing assertions against this game:

- **Emulate the colour scheme before navigating.** The theme is resolved once at load and pinned to the root
  element, so setting it afterwards leaves the page rendered under the previous scheme.
- **Reach controls with Tab, not `focus()`.** The focus ring is drawn with `:focus-visible`, which a
  programmatic focus deliberately does not satisfy.
- **Only one screen is on show at a time.** Anything on another screen is hidden, so it has no size to measure
  and is absent from the accessibility tree. Reach the screen first, then measure.
