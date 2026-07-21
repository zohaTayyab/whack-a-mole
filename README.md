# Whack-a-Mole

A small browser game built with semantic HTML5, modern CSS, and vanilla JavaScript ES modules. No build step, no
dependencies.

Development follows an incremental milestone workflow.

## Status

Milestone 9 (theme, hammer, and volume) is complete. A round lasts 60 seconds at every difficulty. Moles appear
in random holes, one at a time, and hitting the visible mole with a mouse, a touch screen, or the keyboard adds
one point; each mole counts at most once. Restart Game begins a fresh round at any point, and when the countdown
reaches zero the round ends and reports the final score. Backgrounding the page pauses the round and returns to
it with the same remaining time.

A broader accessibility review is Milestone 10 and has not been carried out yet.

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
```

## Running locally

The page loads ES modules, which browsers only allow over an HTTP origin, so serve the project rather than
opening `index.html` from the `file://` protocol:

```sh
python3 -m http.server 8000
```

Then visit <http://localhost:8000>.

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
- [ ] **Milestone 10 — Accessibility and edge cases.** Labels, focus states, announcements, reduced motion.
- [ ] **Milestone 11 — Final testing, documentation, and GitHub Pages.** Cross-browser checks and deployment.

Milestones are implemented one at a time, each leaving the application in a working state.
