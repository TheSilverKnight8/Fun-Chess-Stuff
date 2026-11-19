# Decisions made by Claude Code

The spec leaves these items to Claude Code (**[Claude Code]** in `SPEC.md`, and section 8 "Left to Claude Code"). Each choice is written down here so Caleb can read it, test it and change it. Anything about *what* the app does that is not here or in `SPEC.md` is asked first.

## Build stages (proposed by Claude Code; Caleb: "the plan is good")

Macro to micro, with a test checkpoint at the end of each stage. Each mode stage starts with that mode's rule questions and a proposal for its visual effects, for Caleb's review.

1. **Foundation and Standard Chess:** the app shell in the Portal style; the board and piece art; click and drag input; the legal-move and last-move highlight settings; the full Standard rules with the section 6 draws; rooms by code, the room setup (mode, time control), random colors and clocks; resign with confirm, draw offers, disconnect forfeit with a reconnect grace period, Rematch and Back to mode pick; the installable app and publishing. **(this stage)**
2. **Audio and Standard's effects:** the sound engine, music, and the capture, check and checkmate effects. The effects plan is shown to Caleb before it is built. This sets up how every later mode plugs in its own effects.
3. **Bastille and Pot-Hole.**
4. **Remorse and Mega Knight.**
5. **Bario and Rental.**
6. **Revival.**
7. **Tuning** from Caleb's playtests.

## Caleb's answers

| Question | Answer |
| --- | --- |
| Workflow | The same as Caleb's other projects. |
| Logo and theme | The full logo on Home and the C mark elsewhere, light mode only, as in the other apps. |
| Threefold repetition and the fifty-move rule: claimed or automatic? | Automatic only. The game ends by itself on the third occurrence of a position and at 50 moves by each side (100 half-moves) without a capture or pawn move. There is no claim button. |
| Running out of time when the opponent cannot checkmate | A draw when the opponent has insufficient material (see "Endings" for the exact test). Otherwise running out of time loses. |
| Rematch and Back to mode pick | Only the host chooses either one. The host has all the room's mode controls; the guest sees what the host picks. |
| Draw offers | An offer stays open until it is accepted or declined, or the player it was made to moves. No limit on how often. |
| Last-move highlight | On by default. |
| Stage plan | Approved as proposed. |
| App name (the spec's title is a working title) | "Fun Chess Stuff" is fine for now. |

## Questions for Caleb (from Stage 1)

| Question | What Stage 1 does until answered |
| --- | --- |
| **Timeout against insufficient material: which test?** The answer was "a draw with insufficient material". Stage 1 asks whether the side *with time left* could checkmate with its own pieces: a lone king, a king and one knight, or a king and bishops all on one color of square cannot, so the game is a draw. FIDE's rule is stricter: it asks whether *any* series of legal moves could end in mate, counting the flagged player's pieces as possible blockers. So, for example, a king and knight against a king and queen is a draw here but a loss on time under FIDE (a mate with the queen blocking is possible in theory). | The own-pieces test above. |
| **Leaving on purpose during a game.** The spec says the disconnected player forfeits, with a reconnect grace period. Leaving the room on purpose (the Leave button, after a confirm) is not a lost connection. | Leaving on purpose forfeits at once, without the grace period. Closing or reloading the tab counts as a lost connection (the grace period applies, but a reloaded page cannot rejoin, because nothing is saved). |

## Builder's additions in Stage 1 (not named in the spec; easy to remove)

- **Board coordinates:** file letters along the bottom edge and rank numbers along the left edge, inside the edge squares.
- **The king in check glows red.**
- **Pieces slide** to their new square instead of jumping (Stage 2 adds the real effects).
- **A Leave button during the game** (asks first, because leaving forfeits). The spec only names the end-of-game choices.
- **A third player** trying the code is told the room already has its players.
- **"Stage N" tags** on the modes that are not built yet, and on the music and effects volume settings (Stage 2). The tags go away as the stages land.

## Platform

| Item | Choice | Why |
| --- | --- | --- |
| Stack | React, TypeScript, Vite, Tailwind CSS, vite-plugin-pwa, react-router, PeerJS, at the same versions as Stickman Arena. | Same family as Caleb's other apps. |
| Hosting | GitHub Pages, published by `.github/workflows/deploy.yml` on every push to `main`. One-time setup: repository Settings > Pages > Source: GitHub Actions. | Spec (free plans). |
| Installable | PWA, portrait or landscape. The app opens without a connection once installed; rooms need one. | Spec. |
| Rules engine | Written in this repo (`src/chess/`), not taken from a chess library. | The variants change move generation itself (potholes block sliding pieces, Bastille has no check, Bario's check rule, the mega knight blocks squares), which a library cannot easily be bent to. |
| Saving | Nothing. Settings last until the app closes. | Spec. |

## Rooms and networking

| Item | Choice | Why |
| --- | --- | --- |
| Connection | The free PeerJS cloud server introduces the two browsers; game messages then go directly between them (WebRTC), as in Stickman Arena. PeerJS's default STUN and TURN servers help on networks that block direct connections. | No account, no server to run, no database. Supabase's free limits made peer-to-peer the fit (spec). |
| Room code | 5 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no 0/O or 1/I), about 33 million codes. Lowercase, spaces or a dash still work. The host sees it large, with a Copy code button. | Same as Stickman Arena. |
| Room flow | Create a room → the setup screen opens with the code. The host picks the mode and the time control while waiting; the guest sees the picks change live. The host starts the game once the guest is in. | Spec: "The host picks the mode when creating the room". |
| Who runs the game | The host's device: it checks every move, runs both clocks, decides the endings, and sends the guest the whole picture after every change. The guest's own moves show at once and are confirmed by the host. | One referee, so both players always see the same result. From Stage 3 the host also rolls every die. |
| Lost connection | No message for 6 seconds (a heartbeat goes every second) means the connection is lost. The player's seat is held for **30 seconds** (the reconnect grace period); the guest's device keeps trying to get back in during that time. Both screens show the countdown. If they do not come back, they forfeit. | Spec: "the disconnected player forfeits"; grace period left to Claude Code. |
| Clocks during the grace period | Keep running. If the away player's clock runs out first, the timeout rules apply. | The clock is part of the game; pausing it would let a player stop the clock by dropping out. |
| Who was disconnected? | A device that could not reach the room server, or that was asleep (a phone app in the background) for longer than the grace period, counts as the one that disconnected. A guest that reaches the server but not the host counts the host as disconnected. | Both screens should agree on the result where they can. |
| Leaving | Leaving on purpose forfeits at once (see Questions). The browser's back button leaves the same way, without the confirm. If the guest leaves, the room stays open with the same code and a new player can join. If the host leaves, the room closes. | |
| Seat | The guest gets a seat token on joining; only that token can come back into the seat during the grace period. | So nobody else can take the seat of a player who is reconnecting. |

**Free-plan check:** the PeerJS cloud server publishes no limit and no uptime promise. For two friends playing it is very unlikely to matter, but if it is ever down, rooms cannot be created. The fallback would be running our own copy of the signaling server; ask before doing that.

## Clocks

| Item | Choice |
| --- | --- |
| Time controls | Untimed (the default), presets 1+0, 3+0, 3+2, 5+0, 5+3, 10+0, 10+5, 15+10, 30+0, 30+20, and Custom: 1–180 minutes and 0–60 seconds of increment. Written as minutes + seconds. |
| Increment | Added to a player's clock after each of their moves (Fischer increment). |
| Start | White's clock starts when the game starts. |
| Timeout | Running out of time loses (spec), unless the opponent cannot checkmate (Caleb's answer): then a draw. |
| Network delay | The guest's device times its own thinking and reports it with the move. The host uses that, but never less than its own measurement minus 1 second, and flags the guest only 1 second after their time is up by the host's clock. The host's own moves are timed on the host's device. |
| Display | Minutes and seconds; tenths of a second in the last 10 seconds. The running clock is navy, and red in the last 10 seconds. |

## Endings (Standard)

| Item | Choice |
| --- | --- |
| Order | After every move: checkmate (it stands even if the same move completes a repetition or the hundredth half-move), then stalemate, insufficient material, threefold repetition, the fifty-move rule. |
| Same position (repetition) | Same side to move, same pieces on the same squares, same castling rights, and an en passant capture possible in both or neither (the en passant square only counts when the capture is really legal). This is FIDE's definition. |
| Insufficient material (whole board) | No pawns, rooks or queens left, and the minor pieces are none, a single knight, or bishops that all stand on one color of square (K v K, K+N v K, K+B v K, K+B v K+B with same-colored bishops, and so on). The game ends at once. |
| Timeout test | See Questions: the side with time left cannot mate with its own pieces (lone king, king and one knight, king and bishops on one color). |
| Draw offers | Either player can offer at any time, on either turn. The offer is open until it is accepted or declined, or the player it was made to moves. One offer can be open at a time. |
| Resign | A confirm window first ("Resign?"), as the spec says. |

## Interface

| Item | Choice |
| --- | --- |
| Board orientation | Your own color at the bottom. |
| Color indicator | A bar beside your side of the board: "You are White" or "You are Black" with a king of your color, always shown in full (spec). The opponent's bar is on the other side of the board. |
| Moving | Click a piece, then a square; or drag the piece. Clicking the picked piece again puts it down. Only the player whose turn it is can pick up pieces (no moves in advance; they are not in the spec). |
| Promotion | Moving a pawn to the last rank opens a picker of queen, rook, bishop and knight over that file. Tapping outside cancels. |
| Highlights | Legal moves: navy dots on empty squares, navy rings on captures. Last move: a light red wash on both squares. The picked piece's square is a stronger red. |
| Layout | Phones and narrow windows: opponent's bar, board, your bar, buttons below. Wide screens: the board on the left, the bars and buttons in a panel on the right. The board takes the largest square that fits. |
| End of a game | A panel with You win / You lose / Draw and the reason. The host gets Rematch (same mode and time control, colors swap) and Back to mode pick; the guest is told the host chooses. Both can leave the room. |

## Look

- The Portal's style for every screen: cream, navy and red; Norwester headings; Archivo body text; staggered stripes; flat cards. Light mode only. Menu screens use the Portal's page frame (stripes at the top, the logo in the gap left of the bottom stripes); the game screen uses the whole screen with a slim stripe and the C mark at the bottom, as Stickman Arena's matches do.
- Board: cream light squares (`#f4e4ca`), navy-tinted grey dark squares (`#9fabb8`), a navy frame.
- Pieces (`src/board/PieceArt.tsx`): classic Staunton outlines drawn like the Portal's tool illustrations, with flat fills, rounded navy outlines and a few inner construction lines. White pieces are cream with navy lines; Black pieces are navy with cream inner lines and a thin cream edge so their parts read apart.
- App icon: a cream knight on navy with the Portal's staggered stripes (cream, red, cream).

## Testing (Stage 1)

- `npm run check:rules`: move generation matches the published perft counts (Chess Programming Wiki) for the start position and five standard test positions, up to depth 4; and every ending above is checked on hand-made positions.
- While building, 400 random games (135,409 positions) were compared move by move with python-chess, an independent chess library: the legal moves, check, checkmate, stalemate, repetition and fifty-move results all matched.
- A two-browser run through a local signaling server (`npm run peer`): joining with a lowercase code, a third player turned away, live setup on the guest, click and drag moves, illegal and out-of-turn moves refused, fool's mate, host-only rematch with colors swapped, draw offer declined, offered again and accepted, an offer lapsing when the receiver moves, resign with confirm, promotion through the picker, Back to mode pick, a cut connection reconnecting within the grace period, leaving mid-game, a new player joining after, a player who never comes back forfeiting (about 36 seconds: up to 6 to notice, then 30), a 1+0 game lost on time, and the host leaving mid-game.
