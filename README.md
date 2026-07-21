# Whack-a-Mole

A small browser game built with semantic HTML5, modern CSS, and vanilla JavaScript ES modules. No build step, no
dependencies.

Development follows an incremental milestone workflow.

## Status

Milestone 8 (best score, difficulty, and sound) is complete. A round lasts 60 seconds at every difficulty. Moles
appear in random holes, one at a time, and hitting the visible mole with a mouse, a touch screen, or the keyboard
adds one point; each mole counts at most once. Restart Game begins a fresh round at any point, and when the
countdown reaches zero the round ends and reports the final score. Backgrounding the page pauses the round and
returns to it with the same remaining time.

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
- **Playable without sound.** Music and effects are feedback, never information. The score, the countdown, the
  best score, and the status messages carry everything needed to play, so the game is equally understandable
  muted or on a browser that cannot play audio at all, where the Sound control is disabled.

## Project structure

```
index.html                  semantic markup                (complete)
styles/base.css             tokens, resets, utilities      (complete)
styles/game.css             layout and components          (complete)
scripts/main.js             application entry point        (complete)
scripts/ui.js               interface and rendering        (complete)
scripts/config.js           timing and difficulty profiles (complete)
scripts/mole-cycle.js       mole appearance scheduling     (complete)
scripts/round-timer.js      round countdown                (complete)
scripts/best-score-store.js best scores per difficulty     (complete)
scripts/audio-controller.js generated music and effects    (complete)
scripts/game-controller.js  round lifecycle and scoring    (complete)
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
- [ ] **Milestone 9 — Theme, hammer, and volume.** Light and dark themes, a hammer cursor and strike, and a
      background-music volume control.
- [ ] **Milestone 10 — Accessibility and edge cases.** Labels, focus states, announcements, reduced motion.
- [ ] **Milestone 11 — Final testing, documentation, and GitHub Pages.** Cross-browser checks and deployment.

Milestones are implemented one at a time, each leaving the application in a working state.
