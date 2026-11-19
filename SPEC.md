# Chess App: Build Spec (working title)

Spec for Claude Code. Source: Caleb's decisions across the concept conversation. Anything marked **[Claude's call]** was not decided by Caleb; it is the minimal choice needed to make the rule work and is revisable. Anything marked **[Claude Code]** is left to the implementer.

Rule: each mode's rules stay at what is officially documented (or what Caleb described). Do not add rules beyond what is written here. If a rule is missing, flag it to Caleb rather than inventing it.

---

## 1. What it is

A web app in Caleb's series (Engineering Portal, synthesizer, Stickman Arena, Worldbuilding Sandbox, Society Sandbox, group games app, Scaling Factor). Online two-player chess containing Standard Chess plus unconventional variants that are only practical digitally.

## 2. Platform and style (Caleb)

- Web app on GitHub Pages, installable (PWA). Works on computer and phone.
- Visual style: the Engineering Portal's style (shop manual lineage). Pieces are classic shapes drawn in that style.
- Online play only, via room code. No CPU opponent, no same-device play.
- Networking approach: **[Claude Code]**, as in Stickman Arena. (Earlier conclusion: Supabase free-tier limits make peer-to-peer/WebRTC the likely fit for real-time play.)
- Nothing is saved between sessions (play-and-leave).

## 3. Room and match flow (Caleb)

- Two players per room, joined by room code. Room code format: **[Claude Code]**.
- The host picks the mode when creating the room, and sets any mode options (see modes) and the time control.
- Colors are assigned randomly.
- After a game: Rematch (colors swap) or Back to mode pick. Both are offered.
- Disconnect: the disconnected player forfeits. (Differs from Stickman Arena, where it was a draw.) Reconnect grace period: **[Claude Code]**.
- Draw offers and resignation exist. Resign shows a confirm window by default (default behavior, not a setting).
- No takebacks. No in-room chat. No move list.

### Clocks (Caleb)

- The host picks a time control in the room. Any mode can be timed or untimed. No per-mode limits.
- Time control presets and increment options: **[Claude Code]**.
- **[Claude's call]** Running out of time loses the game. A die roll (Mega Knight, Remorse, Pot-Hole) happens within the turn and the clock keeps running.

## 4. Input and interface

- Move input: click source then target, and drag and drop. Both supported (Caleb).
- Each player sees an indicator of their own color (Caleb). **[Claude's call]** A "You are White/Black" label beside the player's own side of the board, always visible.
- Legal-move highlighting is a setting, on by default (Caleb).
- **[Claude's call]** Settings: music volume, effects volume, brightness, legal-move highlighting (default on), last-move highlight.

## 5. Audio and effects

- Sound effects and music are made by code, as in Stickman Arena and Scaling Factor (Caleb). No audio files.
- Visual effects are excessive: like Stickman Arena but more dynamic, and unique to each game mode (Caleb). The specific effects per mode are **[Claude Code]** and should be proposed to Caleb for review before being locked in, since he wants a say in how they feel. Rule-driven moments that obviously want an effect: captures, check/checkmate, potholes opening, Quantum definition and cycle reset, respawns and board transfers, rent payments and bankruptcy, mega knight moves and crushes, status rolls and statuses, palace emptying.

---

## 6. Draw rules (Caleb, with per-mode application as Claude's calls)

**Decided (Caleb):** standard draws apply in every orthodox-based mode: stalemate, threefold repetition, fifty-move rule, insufficient material, plus draw offers. A mode with its own stated rule keeps it.

Per-mode application, where a standard rule is undefined or meaningless **[Claude's call, revisable]**:

| Mode | Stalemate | Threefold repetition | Fifty-move | Insufficient material |
|---|---|---|---|---|
| Standard | yes | yes | yes | yes |
| Pot-Hole | yes | yes (position includes the open pothole) | yes | yes |
| Bario | yes | yes (position includes defined/undefined state and cycle count) | yes | only king vs king (a Quantum could become anything) |
| Revival | yes (main board; see below) | yes (position includes both boards) | yes, reset by a capture or pawn move on either board | no (captured pieces can return) |
| Rental | yes | not applicable in practice (treasuries change) | not applicable | its own kings-only rule |
| Mega Knight | yes | yes (position includes the mega knight) | yes, a die roll counts as a move | no (the mega knight can crush kings) |
| Remorse | yes | yes (position includes statuses) | yes | yes (statuses do not change it) |
| Bastille | no legal move = draw | yes | yes | no (win condition is the palace, not royals) |

- Draw offers exist in every mode.
- Bastille: Caleb's "standard draws in every orthodox-based mode" and Bastille's lack of royal pieces conflict, so stalemate/insufficient material are not applied as chess concepts. Repetition and the fifty-move rule were applied because they do not depend on royals. This is the one place a draw rule was adapted; flag it to Caleb if he wants it changed.
- "Stalemate" in a mode with checks means: the side to move has no legal move and is not in check. Where a mode's rules decide what happens when a player is in check with no legal move, that mode's rule wins (Mega Knight, Remorse, Revival).

---

## 7. Game modes

Mode headings give the name, author, and where the rules came from.

### 7.1 Standard Chess
Orthodox chess. Draws per section 6.

### 7.2 Bastille Chess (Paul DeWitte)
Source: chessvariants.com, matches Caleb's description.
- Standard 8x8 board, standard setup, standard piece moves.
- Each side has a Palace, a 2x2 square: White d1/e1/d2/e2, Black d8/e8/d7/e7.
- **Win:** you win when your opponent has no pieces inside their palace, even if self-inflicted.
- The king is not royal. It can be captured like any piece. The game continues if kings are captured. There is no check or checkmate.
- Castling, en passant and promotion are permitted as in the source.
- **Decided (Caleb):** only the owner's own pieces count toward occupying their palace. An enemy piece in your palace does not keep it occupied.
- **[Claude's call]** If one move empties both palaces, the game is a draw (the source does not cover it; neither player is "first").
- **[Claude's call]** A player with no legal move: draw. Other draws per section 6.

### 7.3 Pot-Hole Chess (Peter Spicer and Michael Chamberlain, 2001)
Source: chessvariants.com. Orthodox chess plus random pits.
- After every move by either player, a die is rolled. Even = a pothole opens. Odd = nothing.
- The square is chosen by two eight-sided rolls (file, rank). If it lands on a king, re-roll.
- A non-king piece on the square is removed from the game. An empty square just becomes unusable.
- The pothole blocks its square for the next turn of the player who did not open it, then closes. Only one active at a time in the base rules. A pothole square cannot be entered.
- **Decided (Caleb):** only knights can pass over an open pothole (as they jump). All other pieces cannot pass over or enter it.
- **Decided (Caleb):** castling and other special moves must obey pothole rules too.
- **Decided (Caleb):** duration is a toggle between the base rule (one turn, one pothole) and the authors' random-duration suggestion. The host sets it in the room. Default is the base rule.
- **[Claude's call]** Random duration = one six-sided roll, giving 1 to 6 turns. A "turn" is one player's move, as in the base rule.
- Authors note the variant is not thoroughly tested.

### 7.4 Bario (Panos Louridas)
Source: the chessvariants.org version (Caleb's choice), with the check rule from the Mats Winther implementation page.
- Goal is checkmate. Each side has a king, 8 pawns and 7 undefined "Quantum" pieces in place of Q/R/B/N.
- A Quantum is defined by choosing its identity (queen, rook, bishop or knight) on its first move, and keeps it until a cycle ends. A cycle ends when the last undefined piece is defined; then all defined pieces revert to undefined.
- Identity is limited to one standard set: 1 queen, 2 rooks, 2 bishops, 2 knights.
- **Decided (Caleb):** en passant is allowed (pawns only).
- **Decided (Caleb):** castling is allowed as long as the piece used to castle turns into a rook.
- **Decided (Caleb):** check rule: a Quantum gives check if a piece type that could attack the enemy king is still available to it. The king must respond as to any threat.
- **Decided (Caleb):** a type is "available" if it is not yet used up in the current cycle (still under its cap).
- **Decided (Caleb):** promotion: a pawn can promote to anything (queen, rook, bishop or knight). Each promotion raises the cap of every piece type by 1.
- The source does not address draws; see section 6.

### 7.5 Revival Chess (Bardelo Bardalini)
No source page found. Rules are Caleb's description.
- Orthodox chess plus an auxiliary board.
- A piece captured on the main board goes to the auxiliary board and spawns at its starting position. Pieces with several starting positions can spawn on any valid one.
- A piece that makes a capture on the auxiliary board respawns at its starting position on the main board.
- A piece captured on the auxiliary board is gone forever.
- Each turn, a player makes one move on the main board and one on the auxiliary board, in either order.
- A pawn that promotes on the auxiliary board keeps its promotion if it respawns on the main board, on the second rank like a pawn. A pawn can spawn on any file. A promoted piece captured on the main board arrives on the auxiliary board as the promoted piece, on the second rank like a pawn.
- If a respawn has no valid point, a piece in a valid location is removed and replaced by the respawned piece. The removed piece is treated as captured, even if friendly, and follows the board hierarchy (a piece removed from the main board goes to the auxiliary board; one removed from the auxiliary board is gone forever).
- **Decided (Caleb):** the respawning player chooses which piece is removed. A blocked respawn cannot remove a king.
- **Decided (Caleb):** no legal move on one board means that board's move is skipped.
- **Decided (Caleb):** the game ends by checkmate on the main board.
- Draws: section 6. Check applies on the main board only.

### 7.6 Rental Chess (inspired by Ralph Betza)
Source: Caleb's rules, with Betza's phase order and kings-only tiebreaker (Betza's original differs, which fits "inspired by").
- Orthodox chess with a treasury and rent.
- **Income:** each unit (king included) generates 3 per turn, received in the income step (see phase order). 16 units = 48 at the start.
- **Rent:** paid for the squares your pieces occupy: edge squares 1, the center four squares (d4, e4, d5, e5) 4 each, all other squares 2 each.
- **Phase order (Caleb, Betza's order, from move one):** receive income, make a legal move, pay rent on the squares after the move. There is no separate starting rent.
- **Rent increase:** every 5 turns the rent on all squares rises by 1. A "turn" here is a full round (both players have moved). The increase stacks (+1 at 5 rounds, +2 at 10, and so on). Income never rises.
- If rent cannot be paid, the player removes units of their choice until they can. If forced to remove the king, they go bankrupt and lose (a second lose condition).
- **Kings-only endgame (Caleb, Betza's tiebreaker):** not a draw. The player with the smaller treasury loses.
- **[Claude's call]** The kings-only check happens when the position first becomes kings-only, after that turn's rent is paid. Equal treasuries are a draw (Betza gives no rule for it).
- **[Claude's call]** Stalemate: draw, as in section 6. Draw offers apply.

### 7.7 Mega Knight Chess (Bardelo Bardalini)
No source page found. Rules are Caleb's description.
- Orthodox chess plus one neutral "mega knight" occupying a 2x2 block of squares. It starts in the center of the board. Either player can move it.
- On a turn a player either moves one of their own pieces or rolls a D6. On a 6 they move the mega knight as that turn's move. A non-6 does nothing that turn. Rolling uses the turn.
- The mega knight moves like a knight, but along vertices (as a 2x2 block). Any piece under it after it moves is crushed, including a king.
- **Blocking (Caleb):** ordinary pieces cannot enter, capture or pass through the mega knight's squares. Only another mega knight can capture it.
- If 4 knights of any color end up in a 2x2 formation, all 4 knights are removed and replaced by a mega knight (Caleb).
- Mega knights can capture each other if all 4 squares overlap. A move that only partly overlaps another mega knight is invalid (Caleb).
- **Check (Caleb):** the mega knight's possible landing squares do not count as threats for check. A player may roll while in check; a 6 that crushes the checking piece counts as resolving it.
- **Crushed king (Caleb):** a crushed king's owner loses. If one move crushes both kings, the mover loses (this also covers the mover crushing only their own king).
- **Checkmate (Caleb):** if a player in check rolls a non-6, or a 6 whose mega knight move does not resolve the check, it is checkmate and they lose.
- Draws: section 6.

### 7.8 Remorse Chess: Psychos and Devastation (Bardelo Bardalini)
No source page found. Caleb saw it only on Instagram; rules are his description.
- Orthodox chess. When a piece captures another piece, a D6 is rolled for the capturing piece to determine a status effect. A piece rolls only when it has no status. A piece with a status keeps it and does not roll on capture.
  - 1: **devastated.** The piece cannot take an action. If not absolved within the owner's next 3 turns, it self-captures.
  - 2 or 3: **guilt-ridden.** The piece can move but cannot capture.
  - 4 or 5: **unaffected.** No status, so it rolls again on its next capture.
  - 6: **psychopath.** The piece gains an extra action after capturing: an extra move by the same piece. It does not chain; a capture during the extra move grants no further extra move. After 3 captures the piece gains **bloodlust**: it can only move if it can capture, and it can capture friendlies.
- A bloodlust piece capturing a friendly piece triggers no roll (it has a status).
- **Absolving (Caleb):** statuses can only be absolved by the owner's bishops moving next to the inflicted piece. Bishops can absolve every status (devastated, guilt-ridden, psychopath, bloodlust). An absolved piece has no status (so it rolls again on its next capture) and its psychopath capture count resets.
- **Check (Caleb):** devastated and guilt-ridden pieces do not give check.
- **King (Caleb):** if a devastated king self-captures, or a bloodlust piece captures its own king, that player loses.
- Draws: section 6.

---

## 8. Left to Claude Code

- Networking, room code format, reconnect grace period.
- Time control presets and increment.
- Music and sound design (by code).
- Per-mode visual effects, to be proposed to Caleb for review before locking in.
- Piece art in the Engineering Portal style; board and mode-select visuals; auxiliary board layout for Revival; Quantum and status display.
- Anything this spec does not cover: raise it with Caleb rather than deciding it.
