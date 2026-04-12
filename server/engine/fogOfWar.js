/**
 * Fog of War Visibility System
 * 
 * Computes which squares are visible to a given player based on:
 * - Own pieces (always visible)
 * - Temporarily revealed enemy pieces (after captures)
 * - Observer lighthouse beams
 */

import {
  squareToCoords,
  coordsToSquare,
  isInBounds,
  DIRECTIONS,
  PIECE_TYPES,
  COLORS,
} from '../config/constants.js';

/**
 * Manages the fog of war state, tracking revealed squares and their durations.
 */
export class FogOfWarManager {
  constructor() {
    /** @type {Map<string, number>} square → remaining turns of visibility */
    this.revealedSquares = new Map();
  }

  /**
   * Add a temporarily revealed square.
   * @param {string} square - Algebraic notation (e.g. 'e4')
   * @param {number} duration - Number of turns to stay visible
   */
  addReveal(square, duration = 1) {
    this.revealedSquares.set(square, duration);
  }

  /**
   * Tick down all reveal durations at end of turn.
   * Removes expired reveals.
   */
  tickReveals() {
    for (const [square, remaining] of this.revealedSquares.entries()) {
      if (remaining <= 1) {
        this.revealedSquares.delete(square);
      } else {
        this.revealedSquares.set(square, remaining - 1);
      }
    }
  }

  /**
   * Check if a square is temporarily revealed.
   */
  isRevealed(square) {
    return this.revealedSquares.has(square);
  }

  /**
   * Get all currently revealed squares.
   * @returns {Set<string>}
   */
  getRevealedSquares() {
    return new Set(this.revealedSquares.keys());
  }

  /** Reset all reveals */
  reset() {
    this.revealedSquares.clear();
  }
}

/**
 * Compute the set of visible squares for a player.
 * 
 * @param {Array<Array<object|null>>} board - 8x8 board from chess.js
 * @param {string} color - 'w' or 'b'
 * @param {FogOfWarManager} fogManager - manages temporary reveals
 * @param {Array<{square: string}>} observers - observer positions for this color
 * @param {boolean} godMode - if true, everything is visible
 * @returns {Set<string>} set of visible square names
 */
export function computeVisibility(board, color, fogManager, observers = [], godMode = false) {
  const visible = new Map();
  const obstacles = new Set();

  if (godMode) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        visible.set(coordsToSquare(r, c), 'standard');
      }
    }
    return { visible, obstacles };
  }

  // 1. Own pieces are always visible (and the squares they sit on)
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.color === color) {
        visible.set(coordsToSquare(r, c), 'standard');
      }
    }
  }

  // 2. Temporarily revealed squares (from captures, king collisions, etc.)
  for (const sq of fogManager.getRevealedSquares()) {
    visible.set(sq, 'standard');
  }

  // 3. Observer lighthouse beams
  for (const obs of observers) {
    if (!obs.square) continue;
    const beamSquares = computeObserverBeams(obs.square, board);
    for (const sq of beamSquares) {
      if (!visible.has(sq)) {
        visible.set(sq, 'observer_glow');
      }
    }
  }

  // 4. Pawns highlight enemy pieces directly in front of them (detector function)
  const forwardDir = color === COLORS.WHITE ? -1 : 1;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.type === PIECE_TYPES.PAWN && piece.color === color) {
        const fwdR = r + forwardDir;
        if (isInBounds(fwdR, c)) {
          const targetPiece = board[fwdR][c];
          if (targetPiece && targetPiece.color !== color) {
            // Only add to obstacles if not already fully visible
            const sq = coordsToSquare(fwdR, c);
            if (!visible.has(sq)) {
              obstacles.add(sq);
            }
          }
        }
      }
    }
  }

  return { visible, obstacles };
}

/**
 * Compute all squares illuminated by an Observer at a given position.
 * Reveals squares in all 8 directions (like a queen) until blocked.
 * 
 * @param {string} position - Observer's square
 * @param {Array<Array<object|null>>} board 
 * @returns {Set<string>}
 */
export function computeObserverBeams(position, board) {
  const beams = new Set();
  if (!position) return beams;
  const { row, col } = squareToCoords(position);

  for (const dir of DIRECTIONS.QUEEN) {
    let r = row + dir.dr;
    let c = col + dir.dc;

    while (isInBounds(r, c)) {
      const sq = coordsToSquare(r, c);
      beams.add(sq);

      // Stop at first piece (but reveal it)
      // Bezpieczny odczyt z tablicy board
      const pieceAtSquare = board[r] ? board[r][c] : null;
      if (pieceAtSquare !== null) {
        break;
      }

      r += dir.dr;
      c += dir.dc;
    }
  }

  return beams;
}
