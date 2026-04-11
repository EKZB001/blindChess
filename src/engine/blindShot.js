/**
 * Blind Shot Mechanic
 * 
 * Long-range pieces (Bishop, Rook, Queen) can attempt moves to distant squares
 * even if the path isn't clear. The piece scans square-by-square and:
 * - If it hits an enemy: captures it at that square
 * - If it hits a friendly: stops one square before
 * - If path is clear: moves to the target square normally
 */

import {
  squareToCoords,
  coordsToSquare,
  isInBounds,
  LONG_RANGE_PIECES,
  PIECE_TYPES,
} from '../config/constants.js';

/**
 * Determine the direction vector from 'from' to 'to'.
 * Returns null if the move isn't along a straight line or diagonal.
 * 
 * @param {string} from 
 * @param {string} to 
 * @returns {{ dr: number, dc: number } | null}
 */
export function getMoveDirection(from, to) {
  const f = squareToCoords(from);
  const t = squareToCoords(to);

  const dr = t.row - f.row;
  const dc = t.col - f.col;

  // Must be on a line (horizontal, vertical, or diagonal)
  if (dr === 0 && dc === 0) return null;

  const absDr = Math.abs(dr);
  const absDc = Math.abs(dc);

  if (dr !== 0 && dc !== 0 && absDr !== absDc) return null; // Not a valid line

  return {
    dr: dr === 0 ? 0 : dr / absDr,
    dc: dc === 0 ? 0 : dc / absDc,
  };
}

/**
 * Compute the actual result of a blind shot move.
 * 
 * @param {string} from - Starting square
 * @param {string} to - Intended target square
 * @param {Array<Array<object|null>>} board - 8x8 board state
 * @param {string} movingColor - Color of the piece making the move
 * @returns {{
 *   actualTarget: string,
 *   collision: 'none' | 'enemy' | 'friendly',
 *   capturedPiece: object | null,
 *   blockedSquare: string | null
 * }}
 */
export function computeBlindShot(from, to, board, movingColor) {
  const direction = getMoveDirection(from, to);
  if (!direction) {
    return { actualTarget: from, collision: 'none', capturedPiece: null, blockedSquare: null };
  }

  const start = squareToCoords(from);
  let r = start.row + direction.dr;
  let c = start.col + direction.dc;
  const target = squareToCoords(to);

  // Scan along the path
  while (isInBounds(r, c)) {
    const piece = board[r][c];
    const currentSquare = coordsToSquare(r, c);

    if (piece) {
      if (piece.color !== movingColor) {
        // Hit an enemy → capture at this square
        return {
          actualTarget: currentSquare,
          collision: 'enemy',
          capturedPiece: piece,
          blockedSquare: null,
        };
      } else {
        // Hit a friendly → stop one square before
        const prevR = r - direction.dr;
        const prevC = c - direction.dc;
        const prevSquare = coordsToSquare(prevR, prevC);

        // If we'd stop at our own starting square, move is impossible
        if (prevSquare === from) {
          return {
            actualTarget: from,
            collision: 'friendly',
            capturedPiece: null,
            blockedSquare: currentSquare,
          };
        }

        return {
          actualTarget: prevSquare,
          collision: 'friendly',
          capturedPiece: null,
          blockedSquare: currentSquare,
        };
      }
    }

    // Reached intended target without obstruction
    if (r === target.row && c === target.col) {
      return {
        actualTarget: currentSquare,
        collision: 'none',
        capturedPiece: null,
        blockedSquare: null,
      };
    }

    r += direction.dr;
    c += direction.dc;
  }

  // Target was out of line, shouldn't happen if validated
  return { actualTarget: from, collision: 'none', capturedPiece: null, blockedSquare: null };
}

/**
 * Check if a piece type supports blind shot mechanics.
 */
export function isBlindShotPiece(pieceType) {
  return LONG_RANGE_PIECES.has(pieceType);
}
