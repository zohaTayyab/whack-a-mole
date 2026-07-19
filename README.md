# Whack-a-Mole

A small browser game built with semantic HTML5, modern CSS, and vanilla JavaScript ES modules. No build step, no
dependencies.

Development follows an incremental milestone workflow.

## Status

Milestone 1 (documentation and roadmap) is complete. There is no application to run yet; the game is built from
Milestone 2 onward.

## Planned project structure

None of these files exist yet. They are added across milestones 2–4:

```
index.html        semantic markup           (milestone 2)
styles/main.css   responsive layout         (milestone 3)
src/              JavaScript ES modules     (milestone 4 onward)
```

## Running locally

From Milestone 2 onward, once `index.html` exists. ES modules require an HTTP origin, so serve the project rather
than opening it via the `file://` protocol:

```sh
python3 -m http.server 8000
```

Then visit <http://localhost:8000>.

## Roadmap

- [x] **Milestone 1 — Documentation and roadmap.** Project README, incremental workflow rules, repository setup.
- [ ] **Milestone 2 — Semantic static HTML.** Accessible page structure and game board markup.
- [ ] **Milestone 3 — Responsive CSS layout.** Board grid, styling, responsive behaviour.
- [ ] **Milestone 4 — Minimal JavaScript initialization.** ES module entry point wired to the DOM.
- [ ] **Milestone 5 — Random mole appearance.** Game state and randomised mole timing.
- [ ] **Milestone 6 — Hit detection and scoring.** Mouse, touch, and keyboard input; score tracking.
- [ ] **Milestone 7 — Timer and game lifecycle.** Start, countdown, end, and reset.
- [ ] **Milestone 8 — Best score, difficulty, and sound.** Persistence, difficulty ramp, audio feedback.
- [ ] **Milestone 9 — Accessibility and edge cases.** Labels, focus states, announcements, reduced motion.
- [ ] **Milestone 10 — Final testing, documentation, and GitHub Pages.** Cross-browser checks and deployment.

Milestones are implemented one at a time, each leaving the application in a working state.
