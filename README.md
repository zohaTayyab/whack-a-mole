# Whack-a-Mole

A small browser game built with semantic HTML5, modern CSS, and vanilla JavaScript ES modules. No build step, no
dependencies.

Development follows an incremental milestone workflow.

## Status

Milestone 13 (final testing, documentation, and deployment) is complete. The game is published with GitHub Pages
and playable at <https://zohatayyab.github.io/whack-a-mole/>. It is organised into four screens — title,
game, settings, and game over — shown one at a time on a full-screen stage, set against hand-drawn scenery that
shifts from day to night with the theme. Focus moves to a screen's heading as it opens, and Escape leaves the
settings screen. A round lasts 60 seconds at every difficulty. Moles appear in random holes, one at a time, and
hitting the visible mole with a mouse, a touch screen, or the keyboard adds one point; each mole counts at most
once. The board is a turf field of raised mounds, and a character mole climbs out of the struck hole while an SVG
mallet swings for the attempt. During play a heads-up display shows the score and a countdown bar with the seconds
beside it, and two icon controls pause or restart the round. A shared motion system carries the screen changes,
the button lift and press, a score pop with a floating "+1", a hit ring, the countdown turning urgent in its last
seconds, and a game-over celebration — each with a reduced-motion form that keeps the feedback and drops the
travel. When the countdown reaches zero the round ends on the game-over screen, which reports the final score and
the best score and notes whether a record was set, with Play Again and Menu. The board is sized to fit the screen
in portrait and landscape, from small phones to desktops. Backgrounding the page pauses the round and returns to
it with the same remaining time; leaving and returning with the browser's Back button restores it ready to play.

The site is deployed with GitHub Pages. The browsers, viewports, and input methods actually exercised — and those
that were not — are listed under [Testing](#testing).

## Features

- **Illustrated identity.** The stage sits over hand-authored SVG scenery — a sky, a sun that becomes a moon, and
  rolling hills — with a day and a night variant that follows the theme. The board is a mown turf field of raised
  mounds, each opening a real recess with a lit rim and inner shadow. The mole is a drawn character with ears, a
  muzzle, and whiskers that climbs out of the struck hole, and the hammer is an SVG mallet. The wordmark and the
  screen titles are display lettering built from layered strokes and shadows on real text — no font file and no
  external request — and every piece of text sits on a plaque or scrim rather than directly on the illustration.
- **Motion.** One shared set of timings and one easing curve drive every animation: screens fade in as their
  content rises, buttons lift on hover and sink on press, the score pops with a floating "+1" and a burst of
  sparks from the struck hole, a ring flashes on a hit, the countdown turns urgent in its final seconds, and a
  new best score is met with a short fall of confetti. Every one has a reduced-motion form that keeps the
  feedback and drops the travel; the purely decorative flourishes — the sparks and the confetti — simply do not
  play when motion is reduced.
- **Screens.** The game is four screens — title, game, settings, and game over — shown one at a time on a
  full-screen stage. The title screen leads with the best score and a large Play control; settings gathers
  difficulty, sound, music volume, and theme as a stacked menu; game over reports the outcome. The round itself
  drives the screen changes, so the game is always where the play is.
- **Heads-up display.** During a round the score and a countdown bar with the seconds beside it sit on the play
  surface, and two icon controls pause or restart. Pause is the player's own: a round the player pauses stays
  paused when the page is hidden and shown again, rather than resuming on its own.
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
- **Hammer.** A hammer drawn as a scalable vector follows the pointer across the board on devices with a precise
  pointer, and strikes wherever a hole is activated by mouse, touch, or keyboard. It is decoration: it is hidden
  from assistive technology, never takes pointer events, and cannot affect the score, which is still decided
  solely by activating a hole. Its motion reduces to a still strike when reduced motion is preferred.
- **Stored settings.** The theme and the music volume are kept under their own storage key, separate from best
  scores. Missing, malformed, or unavailable storage falls back to documented defaults without interrupting play.

## Accessibility

- **One announcement region.** Game Status is the only live region on the page, so starting, pausing, resuming,
  and hitting a mole are announced, and nothing else is. The score and the countdown are a description list of
  readings rather than form output, so they can be consulted at any time without the countdown interrupting every
  second.
- **Screen navigation.** When a screen opens, focus moves to its heading, so a keyboard user is never left on a
  control that has gone; the settings screen is left with Escape or a visible Back control. Game over is announced
  exactly once: the status region is on the game screen and steps out of the tree with it, so the game-over
  heading is the single voice, and its description carries the final score and any record.
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
- **Reduced motion.** Where reduced motion is preferred, every animation keeps its feedback and drops its travel:
  transitions collapse, the mole and the game-over readings simply appear, the hammer's swing becomes a still
  strike, the floating "+1" and the hit ring hold in place instead of sliding and fading, and the countdown keeps
  its urgent colour without the pulse.
- **Decoration stays decoration.** The hammer, the scenery, the floating "+1", and the hit ring are hidden from
  assistive technology, take no pointer events, and are not in the tab order; none can change a hole's name or
  affect the score. The countdown's urgency is a colour and a pulse only — the reading it accompanies is still not
  a live region, so the last seconds are not announced.

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
scripts/screen-controller.js which screen is visible        (complete)
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

There are 555 checks across thirteen suites, covering markup and accessible names, the round lifecycle, scoring by
mouse, keyboard and touch, difficulty, persistence, audio, themes, colour contrast measured against the WCAG
thresholds, the hammer, the screen flow, responsive layout, and the awkward cases such as returning through the
back/forward cache.

Verified on macOS 14.8.4 with Google Chrome 151 running headless:

- Page structure, accessible names, and the accessibility tree for each of the four screens, including which
  regions announce changes.
- The screen flow: one screen visible at a time, hidden screens out of the tab order and the accessibility tree,
  focus moving to each screen's heading on navigation, Escape leaving settings, and game over announced once.
- The keyboard path through all four screens, with Tab, Enter, Space, Escape, the arrow keys, Home, and End.
- Mouse activation, and touch activation through the browser's touch emulation.
- Layout at 320, 375, 390, 768, 1024, 1280, and 1440 CSS pixels wide, in portrait and landscape, and at 200%
  zoom, with the board fitting on screen without scrolling in each.
- Colour contrast across every screen in both themes, computed from the colours the browser resolves and asserted
  against the WCAG AA thresholds rather than fixed values. Every pair clears its threshold in both variants, the
  tightest being the hole opening against the surrounding turf at 3.88:1 in day and 3.09:1 at night against a
  3:1 requirement.
- Reduced-motion behaviour: the suite confirms the interface transitions collapse and the hammer's swing is
  stilled, and each remaining animation was inspected under the reduced-motion media condition to confirm it lands
  on its end state — the floating "+1" and the hit ring hold in place rather than resolving to nothing.
- The illustrated scenery, turf board, mole, and mallet, and the motion feedback — the score pop, floating "+1",
  hit ring, countdown urgency, and game-over celebration — inspected in both themes at the states where they
  occur.
- Round lifecycle, scoring, timing, difficulty, persistence, audio, themes, volume, the hammer, and the player's
  Pause control.
- Behaviour when storage is denied or holds corrupt data, and when the browser refuses to create audio.
- The deployed GitHub Pages site, loaded in Google Chrome 151 on macOS outside headless mode: every asset resolves
  over the project subpath, no external request is made, the console stays clear on load, and a full round runs
  from the title screen through the countdown to game over, with focus landing on the game-over heading.

Not carried out:

- Screen-reader testing with an actual screen reader.
- Safari, Firefox, and Edge, and any browser on Windows, Linux, iOS, or Android.
- Any physical mobile or tablet device. Viewport emulation is not a substitute for one.
- Selecting a difficulty with the arrow keys, Home, or End. The control is a native select and the page does not
  intercept those keys, but headless Chrome provides no native select menu to act on them.

Chrome on macOS is therefore the only browser and operating system exercised directly. The code is written to
standards without browser or platform detection, but that is not a substitute for running it elsewhere, and the
platforms above are reported as untested rather than assumed to work.

## Deployment

The game is a set of static files with no build step, so it is served as-is. It is deployed with GitHub Pages from
the `main` branch and is live at <https://zohatayyab.github.io/whack-a-mole/>.

To publish your own copy:

1. Push the project to a GitHub repository.
2. In that repository, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select the `main` branch and the `/ (root)`
   folder, and save.
4. The site publishes at `https://<username>.github.io/<repository>/`, usually within a minute or two.

Every asset path in the project is relative, so the game runs correctly both from the subpath a GitHub Pages
project site uses and from a domain root, with no configuration change.

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
- [x] **Milestone 11 — Application shell and screen flow.** A full-screen stage with title, game, settings, and
      game-over screens, and accessible navigation between them.
- [x] **Milestone 12 — Visual identity and animation.** Illustrated scenery, board and character artwork, and a
      shared motion system for screen transitions, controls, and game feedback.
- [x] **Milestone 13 — Final testing, documentation, and GitHub Pages.** Full regression, deployment
      documentation, and publication with GitHub Pages.

Milestones are implemented one at a time, each leaving the application in a working state.
