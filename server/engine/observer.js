/**
 * Observer Piece (Latarnia Morska)
 * 
 * A promoted pawn becomes an Observer:
 * - Moves like a Queen (all 8 directions, any distance)
 * - CANNOT capture any piece
 * - Reveals all squares in its line of sight (like a lighthouse)
 */

import {
  squareToCoords,
  coordsToSquare,
  isInBounds,
  DIRECTIONS,
  PIECE_TYPES,
} from '../config/constants.js';

/**
 * Check if a piece is an Observer.
 * Observers are tracked in the engine's custom state, not in chess.js
 * (chess.js represents them as queens on the board).
 * 
 * @param {string} square - Square to check
 * @param {Set<string>} observerSquares - Set of squares with observers
 * @returns {boolean}
 */
export function isObserver(square, observerSquares) {
  return observerSquares.has(square);
}

/**
 * Get all legal moves for an Observer (queen-like movement, no captures).
 * 
 * @param {string} position - Observer's current square
 * @param {Array<Array<object|null>>} board - 8x8 board
 * @param {string} color - Observer's color
 * @returns {string[]} List of valid target squares
 */
export function getObserverMoves(position, board, color) {
  const moves = [];
  const { row, col } = squareToCoords(position);

  for (const dir of DIRECTIONS.QUEEN) {
    let r = row + dir.dr;
    let c = col + dir.dc;

    while (isInBounds(r, c)) {
      const piece = board[r][c];

      if (piece) {
        // Observer cannot capture — blocked by any piece
        break;
      }

      moves.push(coordsToSquare(r, c));
      r += dir.dr;
      c += dir.dc;
    }
  }

  return moves;
}

/**
 * Get squares revealed by an observer's lighthouse ability.
 * Same as queen range — all lines and diagonals until first obstacle (inclusive).
 * 
 * @param {string} position - Observer's square
 * @param {Array<Array<object|null>>} board
 * @returns {Set<string>} Revealed squares
 */
export function getObserverRevealedSquares(position, board) {
  const revealed = new Set();
  const { row, col } = squareToCoords(position);

  for (const dir of DIRECTIONS.QUEEN) {
    let r = row + dir.dr;
    let c = col + dir.dc;

    while (isInBounds(r, c)) {
      revealed.add(coordsToSquare(r, c));

      // Stop after first obstacle (but it IS revealed)
      if (board[r][c] !== null) {
        break;
      }

      r += dir.dr;
      c += dir.dc;
    }
  }

  return revealed;
}

/**
 * Validate that an Observer move doesn't attempt a capture.
 * 
 * @param {string} targetSquare 
 * @param {Array<Array<object|null>>} board 
 * @returns {boolean} true if target is empty
 */
export function canObserverMoveTo(targetSquare, board) {
  const { row, col } = squareToCoords(targetSquare);
  return board[row][col] === null;
}
