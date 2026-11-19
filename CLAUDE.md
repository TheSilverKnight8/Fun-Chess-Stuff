# Notes for Claude Code

`SPEC.md` is Caleb's. It holds what the app does and each mode's rules. Follow it and do not add rules or features that are not in it. Items it marks **[Claude's call]** were decided in the concept conversation and can be revised; items marked **[Claude Code]** are the builder's.

- The ideas are Caleb's; the design and implementation are the builder's. When a question is about *what* the app should do and `SPEC.md` does not answer it, ask Caleb before building it (SPEC: "If a rule is missing, flag it to Caleb rather than inventing it"). The builder's choices and Caleb's answers are recorded in `docs/decisions.md`.
- Build in the stages listed in `docs/decisions.md` (approved by Caleb). Each stage ends at a test checkpoint: Caleb tries it before the next stage starts. Bring each stage's open questions to Caleb before starting it. Each mode's visual effects are proposed to Caleb before they are built (SPEC section 5).
- Work on a branch per stage. Ask Caleb before merging to `main`: a push to `main` publishes the site.
- This project is independent of Caleb's other projects. The only links are the workflow and the visual style.
- Look (Caleb's answer): the Engineering Management Portal's style (cream, navy and red, Norwester headings, Archivo body text, staggered stripes, flat cards). Light mode only. Logo rule, as in the other apps: the full Croswell Industries logo on Home only; the C mark on every other screen, in the gap left of the bottom stripes.
- Free plans only. No accounts, no database, nothing saved between sessions (settings last until the app closes). Hosting is GitHub Pages; rooms use the free PeerJS signaling server and direct WebRTC connections, as in Stickman Arena.
- The host's device is the referee: it checks every move, runs both clocks and (from Stage 3) rolls every die, then sends the guest the whole picture. The guest never decides an outcome while the host is reachable.
- Rules live in `src/chess/` and know nothing about React, rooms or clocks. `npm run check:rules` must pass: it compares move generation with published perft counts and checks every Standard ending.
- `npm run typecheck` and `npm run build` must pass.
