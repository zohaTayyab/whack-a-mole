# Whack-a-Mole

A small browser game built with semantic HTML5, modern CSS, and vanilla JavaScript ES modules. No build step, no
dependencies.

Development follows an incremental milestone workflow.

## Status

Milestone 7 (timer and game lifecycle) is complete. A round lasts 60 seconds. Moles appear in random holes, one
at a time, and hitting the visible mole with a mouse, a touch screen, or the keyboard adds one point; each mole
counts at most once. Restart Game begins a fresh round at any point, and when the countdown reaches zero the
round ends and reports the final score. Backgrounding the page pauses the round and returns to it with the same
remaining time.

Best-score persistence, difficulty behaviour, and sound are not implemented yet; they arrive in Milestone 8. Best
Score currently shows a fixed value, and the Difficulty and Sound controls have no effect on play.

## Project structure

```
index.html                 semantic markup             (complete)
styles/base.css            tokens, resets, utilities   (complete)
styles/game.css            layout and components       (complete)
scripts/main.js            application entry point     (complete)
scripts/ui.js              interface and rendering     (complete)
scripts/config.js          mole-cycle configuration    (complete)
scripts/mole-cycle.js      mole appearance scheduling  (complete)
scripts/round-timer.js     round countdown             (complete)
scripts/game-controller.js round lifecycle and scoring (complete)
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
- [ ] **Milestone 8 — Best score, difficulty, and sound.** Persistence, difficulty ramp, audio feedback.
- [ ] **Milestone 9 — Accessibility and edge cases.** Labels, focus states, announcements, reduced motion.
- [ ] **Milestone 10 — Final testing, documentation, and GitHub Pages.** Cross-browser checks and deployment.

Milestones are implemented one at a time, each leaving the application in a working state.
