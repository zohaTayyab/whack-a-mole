# Whack-a-Mole

A small browser game built with semantic HTML5, modern CSS, and vanilla JavaScript ES modules. No build step, no
dependencies.

Development follows an incremental milestone workflow.

## Status

Milestone 3 (responsive CSS layout) is complete. The interface is styled and responsive, but has no behaviour
yet: interactivity arrives in Milestone 4.

## Project structure

Files not yet written are listed with the milestone that introduces them:

```
index.html        semantic markup           (complete)
styles/base.css   tokens, resets, utilities (complete)
styles/game.css   layout and components     (complete)
src/              JavaScript ES modules     (milestone 4 onward)
```

## Running locally

Open `index.html` directly, or serve it. Later milestones use ES modules, which require an HTTP origin rather
than the `file://` protocol:

```sh
python3 -m http.server 8000
```

Then visit <http://localhost:8000>.

## Roadmap

- [x] **Milestone 1 — Documentation and roadmap.** Project README, incremental workflow rules, repository setup.
- [x] **Milestone 2 — Semantic static HTML.** Accessible page structure and game board markup.
- [x] **Milestone 3 — Responsive CSS layout.** Board grid, styling, responsive behaviour.
- [ ] **Milestone 4 — Minimal JavaScript initialization.** ES module entry point wired to the DOM.
- [ ] **Milestone 5 — Random mole appearance.** Game state and randomised mole timing.
- [ ] **Milestone 6 — Hit detection and scoring.** Mouse, touch, and keyboard input; score tracking.
- [ ] **Milestone 7 — Timer and game lifecycle.** Start, countdown, end, and reset.
- [ ] **Milestone 8 — Best score, difficulty, and sound.** Persistence, difficulty ramp, audio feedback.
- [ ] **Milestone 9 — Accessibility and edge cases.** Labels, focus states, announcements, reduced motion.
- [ ] **Milestone 10 — Final testing, documentation, and GitHub Pages.** Cross-browser checks and deployment.

Milestones are implemented one at a time, each leaving the application in a working state.
