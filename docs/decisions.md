# Decisions made by Claude Code

The spec leaves these items to Claude Code (**[Claude Code]** in `SPEC.md`, and section 8 "Left to Claude Code"). Each choice is written down here so Caleb can read it, test it and change it. Anything about *what* the app does that is not here or in `SPEC.md` is asked first.

## Build stages (proposed by Claude Code; Caleb: "the plan is good")

Macro to micro, with a test checkpoint at the end of each stage. Each mode stage starts with that mode's rule questions and a proposal for its visual effects, for Caleb's review.

1. **Foundation and Standard Chess:** the app shell in the Portal style; the board and piece art; click and drag input; the legal-move and last-move highlight settings; the full Standard rules with the section 6 draws; rooms by code, the room setup (mode, time control), random colors and clocks; resign with confirm, draw offers, disconnect forfeit with a reconnect grace period, Rematch and Back to mode pick; the installable app and publishing. **(done)**
2. **Audio and Standard's effects:** the sound engine, music, and the capture, check and checkmate effects. The effects plan is shown to Caleb before it is built. This sets up how every later mode plugs in its own effects. **(done)**
3. **Bastille and Pot-Hole.** **(done)**
4. **Remorse and Mega Knight**, plus the guidebook (Caleb's request). The guidebook is done and merged; the two modes are not built yet (see Questions for Caleb).
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
| Timeout against insufficient material: which test? | The own-pieces test: a draw when the side with time left could not mate with its own pieces (a lone king, a king and one knight, or a king and bishops all on one color). This is looser than FIDE's "any series of legal moves" test; for example, a king and knight against a king and queen is a draw here. |
| Leaving on purpose during a game | Keep the instant forfeit: leaving with the Leave button (after a confirm) forfeits at once, without the grace period. Closing or reloading the tab counts as a lost connection. |
| Stage 2 effects (Claude Code's proposal for Standard Chess: captures, check, checkmate, plus every move, castling, promotion, game start, draws, low time and timeout, resignation, and small sounds) | All of them. |
| Music | Unique music: each mode gets its own game track, plus the menu theme. |
| The phone's or computer's "reduce motion" setting | Do not follow it: the effects always play in full. |
| Menu music (Stage 3) | A rendition of Caleb's piano piece (MIDI file). |
| Stage 3 rule questions, effects and music | "Compose everything. For all the other stuff you can decide what to do": the Bastille and Pot-Hole tracks are Claude Code's, and the six rule readings below are Claude Code's calls (revisable). |

## Questions for Caleb (from Stage 1)

All answered (see above).

## Builder's additions in Stage 1 (not named in the spec; easy to remove)

- **Board coordinates:** file letters along the bottom edge and rank numbers along the left edge, inside the edge squares.
- **The king in check glows red.**
- **Pieces slide** to their new square instead of jumping (Stage 2 adds the real effects).
- **A Leave button during the game** (asks first, because leaving forfeits). The spec only names the end-of-game choices.
- **A third player** trying the code is told the room already has its players.
- **"Stage N" tags** on the modes that are not built yet. The tags go away as the stages land. (The volume settings had one until Stage 2.)

## Builder's additions in Stage 2 (not named in the spec or the approved effects list; easy to remove)

- **Button click sounds** on the menus, as in Stickman Arena.
- **A win or loss sting** for the endings that have no sound of their own in the effects list (out of time, resignation, a disconnect, leaving).
- **The effects volume slider plays a sample capture** when it is let go, so the level can be heard.

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
| Leaving | Leaving on purpose forfeits at once (Caleb's answer). The browser's back button leaves the same way, without the confirm. If the guest leaves, the room stays open with the same code and a new player can join. If the host leaves, the room closes. | |
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
| Timeout test | Caleb's answer: the side with time left cannot mate with its own pieces (lone king, king and one knight, king and bishops on one color). |
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

## Sound and music (Stage 2)

- All sound is made in the browser with the Web Audio API (`src/lib/audio/`), the same engine as Stickman Arena. There are no audio files.
- Sound starts after the first tap or key press (a browser rule) and pauses while the app is in the background. Music and effects have their own volume (Settings; defaults 50% and 80%).
- Music (Caleb's answer: unique music per mode, plus the menu theme):
  - **Menu theme** (Caleb's request in Stage 3): a rendition of Caleb's piano piece, from the MIDI file he gave. Sixteen seventh chords in C major (Cmaj7, Dm7, Cmaj7, Bm7♭5, Am7, G7, Fmaj7, Em7, Dm7, Cmaj7 and back up), each arpeggiated 1-3-5-7-5-3 twice in quarter notes at 240 beats a minute over a held bass note an octave below the root, on a ringing piano-like voice (the score holds the sustain pedal). The score plays the sixteen chords twice; the theme loops them. Plays on Home, Settings and the room setup. (Replaces "Opening", the Stage 2 menu theme.)
  - **Gambit**, Standard Chess: thoughtful but driving, A minor, 100 beats a minute, a soft triangle lead over a pulsing bass.
  - **Tension layer** (game tracks): four-on-the-floor kicks, running hats and a sawtooth arpeggio fade in while a king is in check or a running clock is under 30 seconds, and fade out when that ends.
  - Each later mode gets its own game track in its own stage (`MODE_TRACK` in `src/modes.ts`).
- Effects: a wooden clack for a move; a double clack for castling; a crunch for a capture, heavier for a more valuable piece (pawn 1, knight and bishop 3, rook 5, queen 9; rook and queen add a deep thud); a sharp alarm sting for check; for checkmate a big impact, then a short fanfare on the winner's screen and a low falling sting on the loser's; a rising arpeggio for promotion; a start chime; a neutral chord for every draw; a buzzer when a clock reaches zero; a tick each second in the last ten seconds of your own running clock; a thud for a resigning king; short sounds for a draw offer arriving, the opponent joining the room, and a connection dropping or coming back.

## Effects: Standard Chess (Stage 2)

Proposed by Claude Code, approved by Caleb ("all effects"). Display only: nothing here touches the game, the clocks or what is sent between players, and nothing waits for an effect before you can move. Drawn on two full-screen canvases (one behind the board for the checkmate rays, one in front for everything else) plus CSS animations on the board (`src/effects/`, `src/board/Board.tsx`, `src/index.css`). Caleb's answer: the system "reduce motion" setting is not followed; effects always play in full.

| Moment | Effect |
| --- | --- |
| Every move | The piece slides (0.15 s); a navy ink ring spreads where it lands. |
| Capture | The captured piece stays on its square until the attacker arrives, then a split-second freeze with a cream flash, then it breaks into flat triangular shards in its own colors that fly off and fall with gravity. A red star-burst on the square. The screen shakes, harder for a more valuable piece. |
| Check | A red glowing line shoots from each checking piece to the king, the board's frame flashes red, a red burst at the king, a small shake. The king's square pulses red while the check lasts. |
| Checkmate | The check line, then a version of Stickman Arena's kill spark: behind the board the whole screen floods with slowly turning rays in the winner's color (cream for White, navy for Black) and red, a navy and cream ring bursts from the mated king, the screen shakes hard, and the Portal's staggered stripes sweep across the screen with CHECKMATE on the navy band. The mated king topples onto its side and stays down. About two seconds in all. |
| Castling | King and rook slide together with speed lines (navy and red) behind them, a ring under the rook, a small shake. |
| Promotion | Navy and red stripes rise up from below into the promotion square, then the new piece bursts out (it grows in with a bounce) with a red and a navy star-burst. |
| Game start | The pieces drop onto the board from above, row by row from your side, with a bounce; thin staggered stripes sweep across the screen. |
| Draws (every kind) | The board drains to grey for a moment; the stripes sweep across with the draw's name (Stalemate, Threefold repetition, Fifty-move rule, Insufficient material, Draw agreed, Out of time · Draw). |
| Low time | In the last ten seconds a running clock turns red and pulses. |
| Out of time | The empty clock flashes, jolts, and stays red with a cream crack across its face. |
| Resignation | The resigning player's king slowly tips over and stays down. |

## Bastille and Pot-Hole (Stage 3)

### Claude Code's calls (Caleb: "you can decide"; revisable)

| Question | Choice | Why |
| --- | --- | --- |
| Bastille: castling with no check | The orthodox limits stay: no castling while the king is attacked, across an attacked square, or onto one. | The source permits castling; chessvariants.org's castling page says variants on the standard board keep castling unchanged. The Bastille page itself could not be opened from the build machine. |
| Bastille: running out of time | Always loses. | Section 6 says insufficient material does not apply to Bastille; any piece, even a king, can take a palace. |
| Pot-Hole: an even roll while a pothole is open (random duration) | Nothing opens. | The base rules allow one pothole at a time. |
| Pot-Hole: lines through a pothole | A rook, bishop or queen cannot move across a pothole, and its attack (check) stops there too. A knight's does not. | Follows Caleb's rule that only knights pass over a pothole. |
| Pot-Hole: a move that ends the game | No roll after it. | Otherwise a pothole could open after checkmate. |
| Pot-Hole: repetition | The open pothole and its turns left are part of the position. | Section 6 counts the pothole; the turns left decide what can move next. |
| Pot-Hole: a pothole exposes a king | The other player still cannot capture it (kings are royal in Pot-Hole); the exposed king's owner must get out of check on their next turn. | Kings are never captured in orthodox chess; the spec adds nothing here. |
| Pot-Hole: the fifty-move rule | A piece falling into a pothole does not count as a capture (it does not reset the count). | Only moves are counted by the rule. |

### How the modes work

- **Bastille** (`src/chess/standard.ts`, `status.ts`): kings are not royal, so there is no check and every move that follows the pieces' rules is legal, including moving onto attacked squares and capturing a king. After every move: if a side has none of its own pieces in its palace, the other side wins (even if self-inflicted); both at once is a draw. No legal move: draw. Repetition and the fifty-move rule apply; insufficient material does not.
- **Pot-Hole** (`src/chess/pothole.ts`): after every move that does not end the game, the host's device rolls (secure random numbers): the open pothole ages first (and closes when its turns are used up), then the six-sided die; on an even roll with no pothole open, two eight-sided rolls pick the square, again if it is a king; a piece there is removed; the pothole is open for 1 turn (base rule) or a six-sided roll of turns (random duration). A turn is one player's move. No piece but a knight crosses or enters a pothole, and castling and en passant obey that too. Mate, stalemate, insufficient material and repetition are judged after the roll.
- **Mode option:** with Pot-Hole picked, the host chooses "One turn (base rule)" (the default) or "1 to 6 turns (random)"; the guest sees the choice.

### Effects (Caleb: "compose everything" / decide)

| Mode | Moment | Effect |
| --- | --- | --- |
| Bastille | Always | Each palace has a crenellated navy wall around its four squares. |
| Bastille | Last defender | When a palace is down to one of its own pieces, its wall turns red and pulses. |
| Bastille | Palace falls | The wall breaks into flying navy and red bricks with a dust cloud, a heavy shake, and the stripe banner "PALACE FALLS" ("BOTH PALACES FALL" for the draw); the empty palace's wall stays as a faded, broken outline. Then a fanfare or a low sting. |
| Bastille | King captured | The usual capture, plus the king's cross flies up spinning with a red ring and a chime. |
| Pot-Hole | Every roll | A six-sided die tumbles across the board and lands on its number (red pips when even). |
| Pot-Hole | A pothole opens | Two eight-sided dice roll in with the file letter and rank number; a red crosshair drops on the square ("RE-ROLL" stamp each time it lands on a king); the square cracks with dust and a shake; a piece there spins and shrinks into the pit with a falling whistle. The board shows the pit only from that moment. |
| Pot-Hole | Open | A dark pit with a broken earth rim; in random duration, cream pips show the turns left. |
| Pot-Hole | Closes | A grey asphalt patch slams down over it with a puff. |

### Music

- **Storming** (Bastille Chess): a revolutionary march, G minor, 120 beats a minute, a square-wave fife lead over snare-heavy drums. Tension: a snare roll and a sawtooth arpeggio.
- **Bumpy Road** (Pot-Hole Chess): a lurching, swung tune in D, 104 beats a minute, a bouncing octave bass and a lead that keeps jumping. Tension: doubled kicks and a square-wave arpeggio.

## Guidebook (Stage 4, Caleb's request)

Caleb: "a visual animated guidebook for each mode accessible in game at all times. Manuals can also be accessible by any player in the menu."

| Item | Choice |
| --- | --- |
| Where | Home → **Manuals** (a list of all eight modes, each opening its manual page), for anyone. In a game, a **book button** beside Leave (and a **Manual** button on the end-of-game panel) opens the current mode's flipbook over the game. The game keeps running behind it (it is an online game; the clock does not stop). |
| Flipbook (Caleb's request after Stage 4) | The manual is a book that drops down from the top of the screen (with a small bounce and a landing thud) onto a navy cover, then opens to cream pages. Each spread on a wide screen is one section: its words on the left page, its animated scene on the right, a shadowed spine between; on phones one page holds both. Pages turn with a 3D page flip and a paper swish: the next/previous arrows, a swipe, or the arrow keys. Page dots show where you are. Escape, the close button or a tap outside lifts the book away. |
| What | Each manual is a set of short sections in the spec's words, most with an animated scene on a small board that plays and loops: pieces moving, highlighted squares, captures, dice, potholes, palace walls, captions (`src/guide/`). Scenes start only when scrolled into view. |
| Content | Standard: the aim, the six pieces, castling, en passant, promotion, check and checkmate, draws, clocks and leaving. Bastille and Pot-Hole: their rules (including Claude Code's Stage 3 calls), then the pieces. Modes not built yet say their manual arrives with them. Remorse and Mega Knight get theirs in this stage. |

## Testing (Stage 3)

- `npm run check:rules` adds 10 Bastille checks (no check, king capture, palace wins including self-inflicted and both-at-once, castling) and 18 Pot-Hole checks (blocked lines, knights jumping, pawns, castling, checks across a pothole, kings not capturable, dice: odd roll, re-roll off a king, closing, random duration, one at a time, repetition).
- Two-browser run: a Bastille game where Black empties its own palace (White wins, both screens), the Pot-Hole random-duration option seen by the guest, and a Pot-Hole game played until potholes opened and closed, with host and guest showing the same pothole. Frames of every new effect checked by eye; no errors in either console. The Stage 1 test still passes (its one check that Bastille is locked now fails, as it should).
- The new music and sounds could not be listened to from the build machine.

## Testing (Stage 1)

- `npm run check:rules`: move generation matches the published perft counts (Chess Programming Wiki) for the start position and five standard test positions, up to depth 4; and every ending above is checked on hand-made positions.
- While building, 400 random games (135,409 positions) were compared move by move with python-chess, an independent chess library: the legal moves, check, checkmate, stalemate, repetition and fifty-move results all matched.
- A two-browser run through a local signaling server (`npm run peer`): joining with a lowercase code, a third player turned away, live setup on the guest, click and drag moves, illegal and out-of-turn moves refused, fool's mate, host-only rematch with colors swapped, draw offer declined, offered again and accepted, an offer lapsing when the receiver moves, resign with confirm, promotion through the picker, Back to mode pick, a cut connection reconnecting within the grace period, leaving mid-game, a new player joining after, a player who never comes back forfeiting (about 36 seconds: up to 6 to notice, then 30), a 1+0 game lost on time, and the host leaving mid-game.

## Testing (Stage 2)

- `npm run check:rules` also checks that the pieces found to be giving check (used by the check effect) agree with the check test, over 6,643 positions.
- Frames of every effect were captured in two browsers (computer and phone layouts) and checked by eye: the start drop and sweep, capture shards and flash, check lines and frame flash, castling streaks, promotion, checkmate rays, banner and toppled king, the draw drain and banner, low time, the cracked clock, and the resigning king.
- The Stage 1 two-browser test was run again with the effects in: all checks passed. No errors in either browser's console.
- The sounds and music could not be listened to from the build machine; they are made the same way as Stickman Arena's.
