# Fun Chess Stuff

Online two-player chess: Standard Chess plus unconventional variants that are only practical on a screen. Play a friend with a room code.

It is an installable web app (PWA) for phones and computers, hosted on GitHub Pages. There are no accounts and nothing is saved.

The app is built in stages, each tried before the next starts. What the app does is in [`SPEC.md`](SPEC.md) (Caleb's spec); the stage plan and every choice left to the builder are in [`docs/decisions.md`](docs/decisions.md).

## What is in it so far (Stages 1 to 4)

| Area | What it does |
| --- | --- |
| Home | Create a room, or join one with its 5-character code. Settings. |
| Room setup | The host picks the mode and the time control while waiting for the opponent; the guest sees the picks live. Standard, Bastille, Pot-Hole, Mega Knight and Remorse Chess are playable (Pot-Hole has the host's pothole-duration option); the other three modes are listed with the stage they arrive in. Untimed, ten presets, or a custom time with increment. |
| Standard Chess | Full orthodox rules: castling, en passant, promotion with a piece picker, check and checkmate. Draws by stalemate, threefold repetition, the fifty-move rule and insufficient material end the game by themselves; draw offers and resignation (with a confirm). Running out of time loses, or draws if the opponent cannot checkmate. |
| Playing | Click a piece then a square, or drag it. Your color is at the bottom with "You are White/Black" beside it. Colors are random; Rematch swaps them. Only the host chooses Rematch or Back to mode pick. |
| Connection | Game data goes directly between the two devices (WebRTC); the free PeerJS server only introduces them. A player who loses connection has 30 seconds to come back before they forfeit. |
| Variants | Bastille: no royal pieces; empty your opponent's palace to win. Pot-Hole: after every move the host's device rolls for a pothole that removes a piece and blocks its square. Mega Knight: roll a 6 to move a neutral 2x2 knight that crushes whatever it lands on. Remorse: captures roll statuses (devastated, guilt-ridden, psychopath, bloodlust) that bishops can absolve. |
| Manuals | A flipbook manual for every mode, with animated examples: Home → Manuals, or the book button during a game. |
| Effects | Standard Chess: shattering captures, check lines, a full-screen checkmate burst with a falling king, castling streaks, promotion stripes, pieces dropping in at the start, draws that drain the board to grey, a pulsing and cracking clock, a tipping king on resignation. Bastille: walled palaces that crumble. Pot-Hole: tumbling dice, cracking potholes, asphalt patches. |
| Sound | Music and sound effects made in the browser; no audio files. A menu theme (a rendition of Caleb's piano piece) and a track for each mode, which gets tenser during check and low time. |
| Settings | Brightness, music volume, effects volume, legal-move dots, last-move highlight. Kept until the app closes. |

## Run it on your computer

Needs Node.js 20.19 or newer.

```bash
npm install
```

```bash
npm run dev
```

Open the address it prints (usually http://localhost:5173).

To check the rules (move generation against published counts, and every way a game can end, in each built mode):

```bash
npm run check:rules
```

### Testing rooms on one computer

Rooms normally use the free PeerJS cloud server. To test without it, run a local copy of the server and point the app at it:

```bash
npm run peer
```

```bash
VITE_PEER_HOST=127.0.0.1 VITE_PEER_PORT=9000 npm run dev
```

Then open the app in two browser windows: create a room in one and join it from the other.

## Put it online (GitHub Pages)

1. The repository must be **public** (Pages is free for public repositories).
2. **Settings > Pages > Build and deployment > Source**: choose **GitHub Actions**.
3. Push to `main`. [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds and publishes the app to `https://<your-username>.github.io/<repo-name>/`.

To install it:
- **iPhone / iPad (Safari):** Share > Add to Home Screen.
- **Android (Chrome)** and **computers (Chrome / Edge):** the browser offers Install.

## Project layout

```
src/
  chess/        the rules: positions, legal moves, endings (no React, no networking)
  game/         a game in a room: clocks, draw offers, results; the room session (host is the referee)
  net/          rooms: codes, PeerJS connection, heartbeat, seat tokens for reconnecting
  board/        the board (input, highlights, promotion picker) and the piece drawings
  effects/      the game's visual effects (what happened in the game → what to draw)
  lib/audio/    sound engine, sound effects, music
  pages/        Home, the room (setup and game), Settings
  components/   page frames, buttons, dialogs
  graphics/     app icon, Croswell Industries logo
  lib/          settings, small shared store
  modes.ts      the eight modes and the stage each arrives in
scripts/        check-rules (perft and endings)
docs/           the builder's decisions
```

Built with React, TypeScript, Vite, Tailwind CSS, vite-plugin-pwa and PeerJS. Headings use Norwester by Jamie Wilson (SIL Open Font License, `src/assets/fonts/`).
