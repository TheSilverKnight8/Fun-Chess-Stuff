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
};

