import type { ModeId } from '../modes';
import type { Scene } from './GuideBoard';

// The guidebook (Caleb's request in Stage 4): for each mode, its rules in short
// sections, most with an animated scene. The text follows SPEC.md and the
// choices in docs/decisions.md; keep it in step when a rule changes.

export interface GuideSection {
  title: string;
  text: string[];
  scene?: Scene;
}

// ---------------------------------------------------------------- shared: orthodox chess

const PIECES: GuideSection[] = [
  {
    title: 'The king',
    text: ['One square in any direction.'],
    scene: { setup: ['wKd4', 'bKh8'], ranks: [2, 6], steps: [{ t: 'mark', squares: ['c3', 'd3', 'e3', 'c4', 'e4', 'c5', 'd5', 'e5'] }, { t: 'move', from: 'd4', to: 'e5' }, { t: 'wait', ms: 600 }] },
  },
  {
    title: 'The queen',
    text: ['Any number of squares in a straight line or diagonally, until something is in the way.'],
    scene: {
      setup: ['wQd4', 'bPd7', 'wKa1', 'bKh8'],
      steps: [{ t: 'mark', squares: ['d1', 'd2', 'd3', 'd5', 'd6', 'd7', 'a4', 'b4', 'c4', 'e4', 'f4', 'g4', 'h4', 'a7', 'b6', 'c5', 'e5', 'f6', 'g7', 'b2', 'c3', 'e3', 'f2', 'g1'] }, { t: 'move', from: 'd4', to: 'd7' }],
    },
  },
  {
    title: 'The rook',
    text: ['Any number of squares in a straight line.'],
    scene: { setup: ['wRd4', 'wKa1', 'bKh8'], steps: [{ t: 'mark', squares: ['d1', 'd2', 'd3', 'd5', 'd6', 'd7', 'd8', 'a4', 'b4', 'c4', 'e4', 'f4', 'g4', 'h4'] }, { t: 'move', from: 'd4', to: 'h4' }] },
  },
  {
    title: 'The bishop',
    text: ['Any number of squares diagonally. It stays on its color.'],
    scene: { setup: ['wBd4', 'wKa1', 'bKh8'], steps: [{ t: 'mark', squares: ['b2', 'c3', 'e5', 'f6', 'g7', 'a7', 'b6', 'c5', 'e3', 'f2', 'g1'] }, { t: 'move', from: 'd4', to: 'g7' }] },
  },
  {
    title: 'The knight',
    text: ['Jumps in an L: two squares one way, one square to the side. It jumps over anything in between.'],
    scene: { setup: ['wNd4', 'wPc4', 'wPd5', 'wPe4', 'wPd3', 'wKa1', 'bKh8'], steps: [{ t: 'mark', squares: ['b3', 'b5', 'c2', 'c6', 'e2', 'e6', 'f3', 'f5'] }, { t: 'move', from: 'd4', to: 'e6' }] },
  },
  {
    title: 'The pawn',
    text: ['Moves one square forward (two from its starting square) and captures one square diagonally forward. It never moves backward.'],
    scene: {
      setup: ['wPe2', 'bPd5', 'wKa1', 'bKh8'],
      steps: [{ t: 'mark', squares: ['e3', 'e4'] }, { t: 'move', from: 'e2', to: 'e4' }, { t: 'move', from: 'd5', to: 'd4' }, { t: 'mark', squares: ['e5'] }, { t: 'wait', ms: 300 }],
    },
  },
];

const SPECIAL: GuideSection[] = [
  {
    title: 'Castling',
    text: [
      'The king moves two squares toward a rook, and the rook jumps to the square the king crossed.',
      'Only if neither piece has moved, the squares between them are empty, and the king is not in check, does not cross an attacked square and does not land on one.',
    ],
    scene: { setup: ['wKe1', 'wRh1', 'wRa1', 'bKe8'], ranks: [1, 3], steps: [{ t: 'mark', squares: ['f1', 'g1'], tone: 'good' }, { t: 'move', from: 'e1', to: 'g1' }, { t: 'move', from: 'h1', to: 'f1' }, { t: 'caption', text: 'Castled on the king side.' }] },
  },
  {
    title: 'En passant',
    text: ['When a pawn steps two squares and lands beside an enemy pawn, that pawn may capture it as if it had stepped only one, on the very next move only.'],
    scene: {
      setup: ['wPe5', 'bPd7', 'wKa1', 'bKh8'],
      ranks: [4, 8],
      steps: [{ t: 'move', from: 'd7', to: 'd5' }, { t: 'mark', squares: ['d6'], tone: 'good' }, { t: 'move', from: 'e5', to: 'd6' }, { t: 'remove', sq: 'd5' }, { t: 'caption', text: 'The pawn on d5 is taken.' }],
    },
  },
  {
    title: 'Promotion',
    text: ['A pawn that reaches the last rank becomes a queen, rook, bishop or knight (you choose).'],
    scene: { setup: ['wPb7', 'wKa1', 'bKh8'], ranks: [5, 8], steps: [{ t: 'move', from: 'b7', to: 'b8', promo: 'Q' }, { t: 'caption', text: 'A new queen.' }] },
  },
];

const CHECKMATE: GuideSection = {
  title: 'Check and checkmate',
  text: [
    'A king under attack is in check, and its player must get it out: move the king, block, or capture the attacker.',
    'If there is no way out, it is checkmate and that player loses.',
  ],
  scene: {
    setup: ['wKe1', 'wPf2', 'wPg2', 'wPe2', 'wPd2', 'bQd8', 'bPe7', 'bKe8'],
    steps: [{ t: 'move', from: 'f2', to: 'f3' }, { t: 'move', from: 'e7', to: 'e5' }, { t: 'move', from: 'g2', to: 'g4' }, { t: 'move', from: 'd8', to: 'h4' }, { t: 'mark', squares: ['e1'], tone: 'danger' }, { t: 'fall', sq: 'e1' }, { t: 'caption', text: 'Checkmate: White has no way out.' }],
  },
};

const STANDARD_DRAWS: GuideSection = {
  title: 'Draws',
  text: [
    'Stalemate: the player to move has no legal move and is not in check.',
    'Threefold repetition: the same position for the third time (same player to move, same castling and en passant chances).',
    'Fifty-move rule: fifty moves by each player with no capture and no pawn move.',
    'Insufficient material: neither side can ever checkmate (for example king against king, or king and one knight against king).',
    'These end the game by themselves. You can also offer a draw at any time; it stays open until your opponent answers or makes a move.',
  ],
  scene: { setup: ['bKa8', 'wKb6', 'wQc1'], ranks: [5, 8], steps: [{ t: 'move', from: 'c1', to: 'c7' }, { t: 'mark', squares: ['a8'], tone: 'good' }, { t: 'caption', text: 'Stalemate: Black is not in check but has no move. A draw.' }] },
};

const CLOCKS: GuideSection = {
  title: 'Clocks and leaving',
  text: [
    'With a time control, each player has their own clock, and the increment is added after each of their moves. Running out of time loses, unless the opponent could never checkmate with their own pieces: then it is a draw.',
    'Resigning loses (you are asked first). Leaving the room during a game forfeits it. If a connection drops, that player has 30 seconds to come back, with their clock running, or they forfeit.',
  ],
};

// ---------------------------------------------------------------- the guides

export const GUIDES: Partial<Record<ModeId, GuideSection[]>> = {
  standard: [
    { title: 'The aim', text: ['Checkmate the other king. White moves first; then players take turns, one move each.'] },
    ...PIECES,
    ...SPECIAL,
    CHECKMATE,
    STANDARD_DRAWS,
    CLOCKS,
  ],

  bastille: [
    {
      title: 'The palaces',
      text: ['Normal pieces, normal moves, normal setup. Each side has a palace of four squares: White d1, e1, d2, e2; Black d8, e8, d7, e7.'],
      scene: { setup: ['wKe1', 'wQd1', 'wPd2', 'wPe2', 'bKe8', 'bQd8', 'bPd7', 'bPe7'], palaces: true, steps: [{ t: 'mark', squares: ['d1', 'e1', 'd2', 'e2', 'd8', 'e8', 'd7', 'e7'], tone: 'good' }, { t: 'wait', ms: 800 }] },
    },
    {
      title: 'How to win',
      text: [
        'You win when your opponent has none of their own pieces inside their palace, even if they emptied it themselves.',
        'Your pieces inside the enemy palace do not keep it occupied for them. If one move empties both palaces, the game is a draw.',
      ],
      scene: {
        setup: ['wKe1', 'wPe2', 'wRd3', 'bKa8', 'bPd7'],
        palaces: true,
        steps: [{ t: 'mark', squares: ['d7'], tone: 'danger' }, { t: 'caption', text: 'Black has one piece left in its palace.' }, { t: 'move', from: 'd3', to: 'd7' }, { t: 'caption', text: 'The Black palace is empty (the White rook does not count): White wins.' }, { t: 'wait', ms: 600 }],
      },
    },
    {
      title: 'Kings are not royal',
      text: ['There is no check or checkmate. A king can move onto an attacked square and can be captured like any piece; the game goes on.'],
      scene: { setup: ['wRa1', 'wKe1', 'wPd2', 'bKa8', 'bPe7'], palaces: true, steps: [{ t: 'move', from: 'a1', to: 'a8' }, { t: 'caption', text: 'The Black king is captured, but Black still has a pawn in its palace: play goes on.' }] },
    },
    { title: 'Special moves', text: ['Castling, en passant and promotion work as in Standard Chess. Castling keeps its usual limits: not while the king is attacked, across an attacked square, or onto one.'] },
    {
      title: 'Draws and clocks',
      text: [
        'A player with no legal move: draw. Threefold repetition and the fifty-move rule apply. Insufficient material does not (any piece can reach a palace).',
        'Running out of time always loses in Bastille.',
      ],
    },
    ...PIECES,
  ],

  pothole: [
    { title: 'The idea', text: ['Standard Chess, plus random pits. After every move, a die is rolled for both players to see.'] },
    {
      title: 'The roll',
      text: ['Even: a pothole opens. Odd: nothing happens. The square is picked by two eight-sided rolls, one for the file (a to h) and one for the rank (1 to 8). If it lands on a king, it is rolled again.'],
      scene: {
        setup: ['wKe1', 'bKe8', 'wNg1', 'bPc6', 'bPd7'],
        steps: [{ t: 'move', from: 'g1', to: 'f3' }, { t: 'die', value: 4 }, { t: 'caption', text: 'Even: a pothole opens. The dice say c6.' }, { t: 'die', value: null }, { t: 'mark', squares: ['c6'], tone: 'danger' }, { t: 'remove', sq: 'c6' }, { t: 'hole', sq: 'c6' }, { t: 'caption', text: 'The pawn on c6 falls in and is gone for good.' }, { t: 'wait', ms: 900 }],
      },
    },
    {
      title: 'Nothing passes a pothole but a knight',
      text: [
        'No piece can stand on or move onto a pothole. Rooks, bishops, queens and pawns cannot pass over it either, and their attacks (check) stop at it.',
        'A knight jumps over it. Castling and en passant must obey the pothole too.',
      ],
      scene: {
        setup: ['wRa4', 'wNb1', 'wKe1', 'bKh8'],
        steps: [{ t: 'hole', sq: 'd4' }, { t: 'mark', squares: ['b4', 'c4', 'a5', 'a6', 'a7', 'a8', 'a3', 'a2', 'a1'] }, { t: 'caption', text: 'The rook stops before the pothole on d4.' }, { t: 'hole', sq: 'b2' }, { t: 'move', from: 'b1', to: 'c3' }, { t: 'caption', text: 'The knight jumps over the pothole on b2.' }],
      },
    },
    {
      title: 'How long it stays open',
      text: [
        'Base rule (the default): the pothole blocks its square for the next turn of the player who did not open it, then closes. Only one is open at a time.',
        'Random duration (the host’s option): a six-sided roll decides how many turns it stays open, 1 to 6; a turn is one player’s move. While it is open, an even roll opens nothing.',
      ],
      scene: { setup: ['wKe1', 'bKe8'], ranks: [3, 6], steps: [{ t: 'hole', sq: 'e4', turns: 3 }, { t: 'caption', text: 'Random duration: three turns left (the pips).' }, { t: 'hole', sq: 'e4', turns: 2 }, { t: 'hole', sq: 'e4', turns: 1 }, { t: 'hole', sq: null }, { t: 'caption', text: 'Closed.' }] },
    },
    {
      title: 'Endings',
      text: [
        'Checkmate wins, as in Standard Chess. Mate, stalemate and the draws are judged after the roll. There is no roll after a move that ends the game.',
        'A pothole can leave a king under attack on the other player’s turn; it still cannot be captured, and its owner must get out of check on their move.',
        'The open pothole (and its turns left) is part of the position for threefold repetition. A piece falling in does not reset the fifty-move count.',
      ],
    },
    CLOCKS,
    ...PIECES,
  ],

  megaknight: [
    {
      title: 'The mega knight',
      text: ['Standard Chess plus one neutral mega knight: a knight as big as four squares. It starts in the centre (d4, e4, d5, e5), belongs to nobody, and either player can move it.'],
      scene: { setup: ['wKe1', 'bKe8', 'wPd2', 'wPe2', 'bPd7', 'bPe7'], mk: ['d4'], steps: [{ t: 'mark', squares: ['d4', 'e4', 'd5', 'e5'], tone: 'good' }, { t: 'wait', ms: 800 }] },
    },
    {
      title: 'Move or roll',
      text: [
        'On your turn, either move one of your pieces or roll a die. A 6 means you move a mega knight as that turn’s move. Anything else does nothing, and your turn is used.',
        'If there is more than one mega knight, you pick which one. If none of its moves is allowed, the 6 does nothing.',
      ],
      scene: { setup: ['wKe1', 'bKe8'], mk: ['d4'], ranks: [2, 7], steps: [{ t: 'die', value: 3 }, { t: 'caption', text: 'A 3: nothing happens.' }, { t: 'die', value: null }, { t: 'die', value: 6 }, { t: 'caption', text: 'A 6: move the mega knight.' }, { t: 'die', value: null }, { t: 'mk', at: ['f5'] }] },
    },
    {
      title: 'How it moves, and what it crushes',
      text: [
        'It jumps like a knight, two one way and one to the side, measured along the corners of the squares, and must land fully on the board.',
        'Every piece under its four new squares is crushed, of either color, kings included.',
      ],
      scene: { setup: ['wKa1', 'bKh8', 'bPf5', 'wNg6', 'bRf6'], mk: ['d3'], steps: [{ t: 'mark', squares: ['f5', 'g5', 'f6', 'g6'], tone: 'danger' }, { t: 'mk', at: ['f5'] }, { t: 'remove', sq: 'f5' }, { t: 'remove', sq: 'g6' }, { t: 'remove', sq: 'f6' }, { t: 'caption', text: 'Three pieces crushed, both colors.' }] },
    },
    {
      title: 'A wall nobody passes',
      text: [
        'No ordinary piece can enter, capture or pass through the mega knight’s squares, so it also blocks lines of check. Knights jump over it but cannot land on it.',
        'Only another mega knight can take it, by landing exactly on all four of its squares. A move that covers it only partly is not allowed.',
      ],
      scene: { setup: ['wRa4', 'wKa1', 'bKh8'], mk: ['c4'], steps: [{ t: 'mark', squares: ['b4', 'a5', 'a6', 'a7', 'a8', 'a3', 'a2'] }, { t: 'caption', text: 'The rook stops at the mega knight.' }] },
    },
    {
      title: 'Four knights make one',
      text: ['If four knights of any colors end up in a 2x2 square, all four are removed and a new mega knight stands there.'],
      scene: { setup: ['wNc3', 'bNd3', 'wNc4', 'wKa1', 'bKh8', 'bNf6'], ranks: [2, 7], steps: [{ t: 'move', from: 'f6', to: 'd4' }, { t: 'remove', sq: 'c3' }, { t: 'remove', sq: 'd3' }, { t: 'remove', sq: 'c4' }, { t: 'remove', sq: 'd4' }, { t: 'mk', at: ['c3'] }, { t: 'caption', text: 'A new mega knight.' }] },
    },
    {
      title: 'Check, checkmate and crushed kings',
      text: [
        'The squares a mega knight could land on are not threats: they do not give check.',
        'You may roll while in check: a 6 whose move gets you out (for example by crushing the checking piece) saves you. A roll that is not a 6, or a 6 that does not get you out, is checkmate.',
        'A crushed king’s owner loses. If one move crushes both kings, the player who moved loses.',
      ],
      scene: { setup: ['wKe1', 'bRe5', 'bKh8'], mk: ['c3'], ranks: [1, 6], steps: [{ t: 'mark', squares: ['e1'], tone: 'danger' }, { t: 'die', value: 6 }, { t: 'die', value: null }, { t: 'mk', at: ['d4'] }, { t: 'remove', sq: 'e5' }, { t: 'caption', text: 'A 6 crushes the checking rook: out of check.' }] },
    },
    {
      title: 'Draws',
      text: [
        'A player with no legal piece move who is not in check: stalemate, a draw. Threefold repetition (the mega knights are part of the position) and the fifty-move rule apply; a roll counts as a move, and a crush as a capture. No insufficient-material draw: the mega knight can crush kings.',
      ],
    },
    CLOCKS,
    ...PIECES,
  ],

  remorse: [
    {
      title: 'Remorse',
      text: ['Standard Chess, except that capturing changes the piece that did it. When a piece with no status captures, a die is rolled for it.'],
      scene: { setup: ['wKe1', 'bKe8', 'wNc3', 'bPd5'], ranks: [2, 6], steps: [{ t: 'move', from: 'c3', to: 'd5' }, { t: 'die', value: 4 }, { t: 'caption', text: 'A 4: unaffected.' }, { t: 'die', value: null }] },
    },
    {
      title: '1: devastated',
      text: ['The piece cannot do anything. If a bishop does not absolve it within its owner’s next three turns, it captures itself (it is removed).'],
      scene: { setup: ['wKa1', 'bKh8', 'wRd1', 'bPd6'], ranks: [1, 7], steps: [{ t: 'move', from: 'd1', to: 'd6' }, { t: 'die', value: 1 }, { t: 'tag', sq: 'd6', text: 'Devastated 3', tone: 'navy' }, { t: 'die', value: null }, { t: 'tag', sq: 'd6', text: 'Devastated 2', tone: 'navy' }, { t: 'tag', sq: 'd6', text: 'Devastated 1', tone: 'navy' }, { t: 'remove', sq: 'd6' }, { t: 'tag', sq: 'd6', text: null }, { t: 'caption', text: 'Three turns later it is gone.' }] },
    },
    {
      title: '2 or 3: guilt-ridden',
      text: ['The piece can move but can never capture.'],
      scene: { setup: ['wKa1', 'bKh8', 'wBc4', 'bPe6'], ranks: [2, 8], steps: [{ t: 'tag', sq: 'c4', text: 'Guilt', tone: 'navy' }, { t: 'mark', squares: ['b5', 'a6', 'd5', 'b3', 'd3', 'e2', 'f1'] }, { t: 'caption', text: 'e6 is in its path, but it cannot take it.' }] },
    },
    {
      title: '4 or 5: unaffected',
      text: ['No status. The piece rolls again the next time it captures.'],
    },
    {
      title: '6: psychopath',
      text: [
        'After capturing, the piece gets an extra move straight away (you may skip it): another move by the same piece. It does not chain: a capture during the extra move gives no further extra move.',
        'Each later capture by a psychopath gives an extra move too. After three captures (counting the one that rolled the 6) it gains bloodlust.',
      ],
      scene: { setup: ['wKa1', 'bKh8', 'wQd1', 'bPd5', 'bPg5'], steps: [{ t: 'move', from: 'd1', to: 'd5' }, { t: 'die', value: 6 }, { t: 'tag', sq: 'd5', text: 'Psycho 1' }, { t: 'die', value: null }, { t: 'caption', text: 'Extra move!' }, { t: 'move', from: 'd5', to: 'g5' }, { t: 'tag', sq: 'g5', text: 'Psycho 2' }, { t: 'caption', text: 'Its second capture; no further extra move this turn.' }] },
    },
    {
      title: 'Bloodlust',
      text: ['A bloodlust piece can only move to capture, and it can capture its own side’s pieces too (no roll: it already has a status). If it captures its own king, that player loses.'],
      scene: { setup: ['wKa1', 'bKh8', 'wRd4', 'wNd7', 'bPg4'], steps: [{ t: 'tag', sq: 'd4', text: 'Bloodlust' }, { t: 'mark', squares: ['d7', 'g4'], tone: 'danger' }, { t: 'caption', text: 'It may only take: the black pawn or its own knight.' }, { t: 'move', from: 'd4', to: 'd7' }] },
    },
    {
      title: 'Absolving',
      text: ['Only bishops absolve, and they absolve every status. When one of your bishops ends its move next to (on any of the eight squares around) one of your afflicted pieces, that piece is cured: no status, and its psychopath count starts over. A bishop cannot absolve itself.'],
      scene: { setup: ['wKa1', 'bKh8', 'wPe4', 'wBb1'], ranks: [1, 6], steps: [{ t: 'tag', sq: 'e4', text: 'Devastated 2', tone: 'navy' }, { t: 'move', from: 'b1', to: 'd3' }, { t: 'tag', sq: 'e4', text: null }, { t: 'caption', text: 'Absolved.' }] },
    },
    {
      title: 'Check, kings and draws',
      text: [
        'Devastated and guilt-ridden pieces do not give check. A bloodlust piece does not give check to its own king.',
        'If a devastated king captures itself, or a bloodlust piece takes its own king, that player loses. Checkmate wins as usual.',
        'Draws as in Standard Chess; statuses are part of the position for threefold repetition. A pawn that promotes keeps its status.',
      ],
    },
    CLOCKS,
    ...PIECES,
  ],

  bario: [
    {
      title: 'Quantum pieces',
      text: [
        'Each side has a king, eight pawns, and seven undefined Quantum pieces where the queen, rooks, bishops and knights would be.',
        'A Quantum chooses what it is (queen, rook, bishop or knight) on its move, by moving as that piece, and stays that until its cycle ends. If a move fits more than one type, you pick from a small menu.',
      ],
      scene: { setup: ['wXa1', 'wXb1', 'wXc1', 'wXd1', 'wKe1', 'wXf1', 'wXg1', 'wXh1', 'wPd2', 'wPe2', 'bKe8'], ranks: [1, 4], steps: [{ t: 'move', from: 'g1', to: 'f3', promo: 'N' }, { t: 'caption', text: 'This Quantum moved as a knight: it is a knight now.' }] },
    },
    {
      title: 'One set per cycle',
      text: [
        'Each side can define one standard set per cycle: 1 queen, 2 rooks, 2 bishops, 2 knights. A type is available while it is not used up (a defined piece that is captured frees its slot).',
        'A cycle ends when your last undefined Quantum is defined: then all your defined Quantums turn back into undefined Quantums and a new cycle begins.',
      ],
      scene: { setup: ['wNc3', 'wNf3', 'wXb1', 'wKe1', 'bKe8'], ranks: [1, 4], steps: [{ t: 'caption', text: 'Both knights are used this cycle, so b1 cannot become a knight.' }, { t: 'move', from: 'b1', to: 'b4', promo: 'R' }, { t: 'caption', text: 'It became a rook. That was the last undefined Quantum: cycle over.' }, { t: 'remove', sq: 'b4' }, { t: 'add', piece: 'wXb4' }, { t: 'remove', sq: 'c3' }, { t: 'add', piece: 'wXc3' }, { t: 'remove', sq: 'f3' }, { t: 'add', piece: 'wXf3' }] },
    },
    {
      title: 'Check',
      text: ['The goal is checkmate. An undefined Quantum gives check if any type still available to it could attack the king, and the king must answer it like any threat. It also guards those squares from the enemy king.'],
      scene: { setup: ['wXe1', 'wKg1', 'bKe8'], steps: [{ t: 'mark', squares: ['e8'], tone: 'danger' }, { t: 'caption', text: 'A rook or queen is still available: the Quantum on e1 gives check.' }] },
    },
    {
      title: 'Promotion, castling, en passant',
      text: [
        'A pawn can promote to anything (queen, rook, bishop or knight). It is a fixed piece, not a Quantum, and every promotion raises the cap of every type by 1 for that side.',
        'Castling is allowed with an unmoved undefined Quantum on the rook’s square, which turns into a rook (a rook must be available). En passant: pawns only, as usual.',
      ],
    },
    {
      title: 'Draws',
      text: ['Stalemate, threefold repetition (defined and undefined pieces and the cycles count) and the fifty-move rule. Insufficient material only for king against king, since a Quantum could become anything.'],
    },
    CLOCKS,
    ...PIECES,
  ],

  rental: [
    {
      title: 'The money',
      text: [
        'Orthodox chess with a treasury each. Every turn, in order: you receive income (3 for each of your units, king included), you make a legal move, then you pay rent for the squares your pieces stand on.',
        'White receives 48 before the first move. Treasuries show beside each player.',
      ],
    },
    {
      title: 'Rent',
      text: [
        'Edge squares cost 1, the centre four (d4, e4, d5, e5) cost 4, all others 2. Each square shows its rent in its corner.',
        'Every 5 full rounds (both players have moved) the rent on every square goes up by 1, and keeps adding up (+1 after 5 rounds, +2 after 10, and so on). Income never goes up.',
      ],
      scene: { setup: ['wKe1', 'wPe2', 'bKe8'], ranks: [1, 5], steps: [{ t: 'move', from: 'e2', to: 'e4' }, { t: 'mark', squares: ['e4'], tone: 'danger' }, { t: 'caption', text: 'e4 is a centre square: 4 a turn.' }] },
    },
    {
      title: 'Can’t pay?',
      text: [
        'If you cannot pay the rent, you give up units of your choice, one at a time (tap them), until you can.',
        'If you would have to give up your king, you are bankrupt and lose.',
      ],
      scene: { setup: ['wKe1', 'wQd4', 'wNb1', 'bKe8'], ranks: [1, 5], steps: [{ t: 'caption', text: 'Rent due 9, treasury 5.' }, { t: 'mark', squares: ['d4', 'b1'], tone: 'danger' }, { t: 'remove', sq: 'd4' }, { t: 'caption', text: 'The queen goes; now the rent can be paid.' }] },
    },
    {
      title: 'Endings',
      text: [
        'Checkmate wins and stalemate is a draw, as usual. Threefold repetition and the fifty-move rule do not apply.',
        'When only the two kings are left, the game ends at once (after that turn’s rent): the smaller treasury loses. Equal treasuries are a draw.',
      ],
    },
    CLOCKS,
    ...PIECES,
  ],

  revival: [
    {
      title: 'Two boards',
      text: [
        'Orthodox chess on the main board, plus an auxiliary board that starts empty. Only one board shows at a time: the button under the board flips to the other.',
        'Each turn you make one move on the main board and one on the auxiliary board, in either order. A board where you have no legal move is skipped.',
      ],
    },
    {
      title: 'Captured on the main board',
      text: ['A piece captured on the main board is not gone: it goes to the auxiliary board and appears on its own starting square there. Its owner chooses which square when there is more than one (rooks, knights: either; bishops: the one of their colour; pawns: any square of the second rank).'],
      scene: { setup: ['wKe1', 'bKe8', 'wRe4', 'bNe6'], ranks: [3, 8], steps: [{ t: 'move', from: 'e4', to: 'e6' }, { t: 'caption', text: 'The black knight leaves the main board for the auxiliary board.' }] },
    },
    {
      title: 'Fighting your way back',
      text: [
        'A piece that captures on the auxiliary board goes back to the main board, onto its starting square. The piece it captured is gone for good.',
        'A pawn that promotes on the auxiliary board keeps its promotion, and comes back on the second rank like a pawn. A promoted piece captured on the main board arrives on the auxiliary board on the second rank too.',
      ],
      scene: { setup: ['wNc3', 'bPd5'], steps: [{ t: 'caption', text: 'On the auxiliary board:' }, { t: 'move', from: 'c3', to: 'd5' }, { t: 'remove', sq: 'd5' }, { t: 'caption', text: 'The pawn is gone for good; the knight returns to b1 or g1 on the main board.' }, { t: 'wait', ms: 800 }] },
    },
    {
      title: 'No room',
      text: [
        'If none of a piece’s starting squares is free, its owner chooses a piece standing on one of them to remove (never a king). The removed piece counts as captured, even if it is your own: from the main board it goes to the auxiliary board, from the auxiliary board it is gone.',
      ],
    },
    {
      title: 'Check and the end',
      text: [
        'Check exists on the main board only, and the game ends by checkmate there. If you begin your turn in check, your main-board move must get you out.',
        'Stalemate: no legal move on either board and not in check. Threefold repetition counts both boards; the fifty-move rule is reset by a capture or pawn move on either board. No insufficient-material draws (captured pieces can come back).',
      ],
    },
    CLOCKS,
    ...PIECES,
  ],
};

