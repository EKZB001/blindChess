/**
 * Game constants for Blind Chess (Szachy we Mgle)
 */

export const MAX_KING_LIVES = 5;

export const COLORS = {
  WHITE: 'w',
  BLACK: 'b',
};

export const PIECE_TYPES = {
  PAWN: 'p',
  KNIGHT: 'n',
  BISHOP: 'b',
  ROOK: 'r',
  QUEEN: 'q',
  KING: 'k',
  OBSERVER: 'o', // Custom piece — promoted pawn
};

export const LONG_RANGE_PIECES = new Set([
  PIECE_TYPES.BISHOP,
  PIECE_TYPES.ROOK,
  PIECE_TYPES.QUEEN,
]);

/** Unicode symbols for chess pieces */
export const PIECE_SYMBOLS = {
  w: {
    k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙', o: '◉', obstacle: '❓',
  },
  b: {
    k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟', o: '◎', obstacle: '❓',
  },
};

/** Reveal duration in turns for temporarily visible enemy pieces */
export const REVEAL_DURATION = 1;

/** Direction vectors for sliding pieces */
export const DIRECTIONS = {
  ROOK: [
    { dr: -1, dc: 0 }, // up
    { dr: 1, dc: 0 },  // down
    { dr: 0, dc: -1 }, // left
    { dr: 0, dc: 1 },  // right
  ],
  BISHOP: [
    { dr: -1, dc: -1 }, // up-left
    { dr: -1, dc: 1 },  // up-right
    { dr: 1, dc: -1 },  // down-left
    { dr: 1, dc: 1 },   // down-right
  ],
};

DIRECTIONS.QUEEN = [...DIRECTIONS.ROOK, ...DIRECTIONS.BISHOP];

/** Board dimensions */
export const BOARD_SIZE = 8;

/** Files and ranks for square-to-coordinate conversion */
export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
export const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

/** Convert algebraic notation to row/col indices */
export const squareToCoords = (square) => {
  const file = square.charCodeAt(0) - 97; // 'a' = 0
  const rank = 8 - parseInt(square[1], 10); // '8' = 0
  return { row: rank, col: file };
};

/** Convert row/col indices to algebraic notation */
export const coordsToSquare = (row, col) => {
  return FILES[col] + RANKS[row];
};

/** Check if coordinates are within the board */
export const isInBounds = (row, col) => {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
};

/** Promotion rank per color */
export const PROMOTION_RANK = {
  w: 0, // rank 8 (row index 0)
  b: 7, // rank 1 (row index 7)
};

/** Game result types */
export const GAME_RESULT = {
  NONE: null,
  WHITE_WINS: 'white_wins',
  BLACK_WINS: 'black_wins',
  DRAW_STALEMATE: 'draw_stalemate',
  DRAW_INSUFFICIENT: 'draw_insufficient',
  WHITE_KING_DEAD: 'white_king_dead',
  BLACK_KING_DEAD: 'black_king_dead',
};
