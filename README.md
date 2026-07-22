# Whack-a-Mole

A small browser game built with semantic HTML5, modern CSS, and vanilla JavaScript ES modules. No build step, no
dependencies.

Development follows an incremental milestone workflow.

## Status

Milestone 10 (accessibility and edge cases) is complete. A round lasts 60 seconds at every difficulty. Moles
appear in random holes, one at a time, and hitting the visible mole with a mouse, a touch screen, or the keyboard
adds one point; each mole counts at most once. Restart Game begins a fresh round at any point, and when the
countdown reaches zero the round ends and reports the final score. Backgrounding the page pauses the round and
returns to it with the same remaining time, and leaving the page and returning with the browser's Back button
restores it ready to play.

The application shell and screen flow are Milestone 11, the visual identity and animation are Milestone 12, and
cross-browser checks and deployment are Milestone 13. None of these have been carried out yet.

## Features

- **Difficulty.** Easy, Normal, and Hard change how long each mole stays visible, and so how much time there is
  to react. The difficulty is fixed for the duration of a round and can be changed again once the round ends.
- **Best scores.** A best score is kept separately for each difficulty and survives a reload. Only a completed
  round can set a record; an abandoned or restarted round does not. The game stays fully playable when browser
  storage is unavailable, keeping the score for the current session instead.
- **Sound.** Optional background music and short effects for the start of a round, a successful hit, and game
  over. All of it is generated in the browser with the Web Audio API — there are no audio files and no external
  requests. Sound can be turned off at any time, and starts only from a deliberate action such as Start Game or
  enabling the Sound checkbox.
- **Music Volume.** A slider sets the background-music level from 0 to 100 percent, with the current value shown
  beside it. It affects the music only: the start, hit, and game-over effects keep their own level, and Sound
  remains the master control that silences everything. At 0 percent the music is silent while the effects still
  play. The chosen level is remembered.
- **Playable without sound.** Music and effects are feedback, never information. The score, the countdown, the
  best score, and the status messages carry everything needed to play, so the game is equally understandable
  muted, at zero volume, or on a browser that cannot play audio at all, where both the Sound control and the
  volume slider are disabled.
- **Light and dark themes.** The game follows the operating-system colour scheme on its own, and a Dark theme
  checkbox overrides it. An explicit choice is remembered and outranks the system on the next visit; simply
  matching the system is not treated as a choice, so the game keeps following it if it changes. Both palettes
  were checked for contrast.
- **Hammer.** A hammer drawn entirely in CSS follows the pointer across the board on devices with a precise
  pointer, and strikes wherever a hole is activated by mouse, touch, or keyboard. It is decoration: it is hidden
  from assistive technology, never takes pointer events, and cannot affect the score, which is still decided
  solely by activating a hole. Its motion reduces to a still strike when reduced motion is preferred.
- **Stored settings.** The theme and the music volume are kept under their own storage key, separate from best
  scores. Missing, malformed, or unavailable storage falls back to documented defaults without interrupting play.

## Accessibility

- **One announcement region.** Game Status is the only live region on the page, so starting, pausing, resuming,
  hitting a mole, and game over are announced, and nothing else is. The score, the countdown, and the best score
  are a description list of readings rather than form output, so they can be consulted at any time without the
  countdown interrupting every second.
- **Native controls.** Every control is the element the browser already understands: buttons for the holes and
  the actions, a select for difficulty, checkboxes for sound and theme, and a range for volume. Each has an
  associated label, its own keyboard behaviour, and a disabled state that matches the point the round has reached.
  No accessibility attribute stands in for a native element.
- **Keyboard.** Tab reaches every enabled control in document order. Enter and Space activate buttons and toggle
  checkboxes, and the volume slider answers to the arrow keys, Home, and End. Nothing takes focus on its own, and
  there is no point at which focus cannot be moved onward.
- **Visible focus.** Keyboard navigation draws a three-pixel focus ring, offset clear of the control, in both
  themes. The hammer is drawn within the hole it strikes and does not cover that ring.
- **Touch targets.** Interactive targets are at least 44 by 44 CSS pixels. Each checkbox sits inside its own
  label, so the whole row is one target rather than the small box alone.
- **Never colour alone.** A mole is distinguished by shape and size as well as by fill, and every state the game
  reports is also written out in words.
- **Reduced motion.** Where reduced motion is preferred, transitions collapse to nothing and the hammer's swing
  becomes a still strike, so the feedback survives without the movement.
- **Decoration stays decoration.** The hammer is hidden from assistive technology, takes no pointer events, is
  not in the tab order, and can neither change a hole's name nor affect the score.

Testing is described under [Testing](#testing) below, including which checks could not be carried out.

## Project structure

```
index.html                   semantic markup                (complete)
styles/base.css              design tokens and themes       (complete)
styles/game.css              layout and components          (complete)
scripts/main.js              application entry point        (complete)
scripts/ui.js                interface and rendering        (complete)
scripts/config.js            timing and difficulty profiles (complete)
scripts/mole-cycle.js        mole appearance scheduling     (complete)
scripts/round-timer.js       round countdown                (complete)
scripts/best-score-store.js  best scores per difficulty     (complete)
scripts/preferences-store.js theme and volume settings      (complete)
scripts/audio-controller.js  generated music and effects    (complete)
scripts/theme-controller.js  light and dark themes          (complete)
scripts/hammer-controller.js hammer cursor and strike       (complete)
scripts/game-controller.js   round lifecycle and scoring    (complete)
tests/run.py                 test runner                    (complete)
tests/modules/               checks that need no browser    (complete)
tests/suites/                browser-driven checks          (complete)
```

## Running locally

The page loads ES modules, which browsers only allow over an HTTP origin, so serve the project rather than
opening `index.html` from the `file://` protocol:

```sh
python3 -m http.server 8000
```

Then visit <http://localhost:8000>.

## Testing

The game has no build step and no test framework. It is verified in two ways: module-level checks run against the
source with dependencies supplied by the test, and behavioural checks driven against a real browser.

```sh
python3 tests/run.py
```

Nothing is installed and nothing is downloaded. The runner needs Python 3, plus Chrome or Chromium for the
browser suites and any engine that loads ES modules for the module suite; where one is missing, those suites are
reported as skipped rather than counted as passing. See [tests/README.md](tests/README.md).

There are 384 checks across eleven suites, covering markup and accessible names, the round lifecycle, scoring by
mouse, keyboard and touch, difficulty, persistence, audio, themes, the hammer, responsive layout, and the awkward
cases such as returning through the back/forward cache.

Verified so far, on macOS 14.8.4 with Google Chrome 150 running headless:

- Page structure, accessible names, and the accessibility tree, including which regions announce changes.
- Keyboard operation with Tab, Enter, Space, the arrow keys, Home, and End.
- Mouse activation, and touch activation through the browser's touch emulation.
- Layout at 320, 375, 768, 1280, and 1440 CSS pixels wide, in portrait and landscape, and at 200% zoom.
- Colour contrast in both themes, measured against the colours the browser actually resolves.
- Reduced-motion behaviour.
- Round lifecycle, scoring, timing, difficulty, persistence, audio, themes, volume, and the hammer.
- Behaviour when storage is denied or holds corrupt data, and when the browser refuses to create audio.

Not carried out:

- Screen-reader testing with an actual screen reader.
- Safari, Firefox, and Edge, and any browser on Windows, Linux, iOS, or Android.
- Any physical mobile or tablet device. Viewport emulation is not a substitute for one.
- Selecting a difficulty with the arrow keys, Home, or End. The control is a native select and the page does not
  intercept those keys, but headless Chrome provides no native select menu to act on them.

Cross-browser and device testing belongs to Milestone 13.

## Roadmap

- [x] **Milestone 1 — Documentation and roadmap.** Project README, incremental workflow rules, repository setup.
- [x] **Milestone 2 — Semantic static HTML.** Accessible page structure and game board markup.
- [x] **Milestone 3 — Responsive CSS layout.** Board grid, styling, responsive behaviour.
- [x] **Milestone 4 — Minimal JavaScript initialization.** ES module entry point wired to the DOM.
- [x] **Milestone 5 — Random mole appearance.** Game state and randomised mole timing.
- [x] **Milestone 6 — Hit detection and scoring.** Mouse, touch, and keyboard input; score tracking.
- [x] **Milestone 7 — Timer and game lifecycle.** Start, countdown, end, and reset.
- [x] **Milestone 8 — Best score, difficulty, and sound.** Persistence, difficulty ramp, audio feedback.
- [x] **Milestone 9 — Theme, hammer, and volume.** Light and dark themes, a hammer cursor and strike, and a
      background-music volume control.
- [x] **Milestone 10 — Accessibility and edge cases.** Labels, focus states, announcements, reduced motion.
- [ ] **Milestone 11 — Application shell and screen flow.** A full-screen stage with title, game, settings, and
      game-over screens, and accessible navigation between them.
- [ ] **Milestone 12 — Visual identity and animation.** Illustrated scenery, board and character artwork, and a
      shared motion system for screen transitions, controls, and game feedback.
- [ ] **Milestone 13 — Final testing, documentation, and GitHub Pages.** Cross-browser checks and deployment.

Milestones are implemented one at a time, each leaving the application in a working state.
