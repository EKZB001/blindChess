/**
 * Radar Pawn System
 * 
 * Pawns act as detectors — they can only capture diagonally if:
 * 1. The target square is "highlighted" by another friendly pawn's attack zone, OR
 * 2. An enemy piece was revealed on that square (temporary reveal from prior capture)
 * 
 * Additionally: if something blocks a pawn from moving forward, the player gets
 * a "Przeszkoda!" notification (without revealing what the blocker is).
 */

import {
  squareToCoords,
  coordsToSquare,
  isInBounds,
  COLORS,
  PIECE_TYPES,
} from '../config/constants.js';

/**
 * Check if a pawn can capture at a given target square.
 * Allowed only if the square is highlighted by another pawn (obstacle) or is fully visible.
 * 
 * @param {string} from - Pawn's current square
 * @param {string} to - Target capture square
 * @param {Set<string>} visibleSquares - Fully visible squares (revealed, observers, etc.)
 * @param {Set<string>} obstacles - Obstacles detected by pawns
 * @param {Array<Array<object|null>>} board
 * @param {string} color - Pawn's color
 * @returns {{ allowed: boolean, reason: string | null }}
 */
export function canPawnCapture(from, to, visibleSquares, obstacles, board, color) {
  const target = squareToCoords(to);
  const targetPiece = board[target.row][target.col];

  // No piece to capture
  if (!targetPiece) {
    return { allowed: false, reason: 'Brak bierki na polu docelowym.' };
  }

  // Can't capture friendly pieces
  if (targetPiece.color === color) {
    return { allowed: false, reason: 'Nie można zbić własnej bierki.' };
  }

  // Allowed if the target square is visibly highlighted to the player
  // This includes: observer beams, capture reveals (both in visibleSquares), and pawn detectors (obstacles)
  if (visibleSquares.has(to) || obstacles.has(to)) {
    return { allowed: true, reason: null };
  }

  return {
    allowed: false,
    reason: 'Pole nie jest podświetlone. Przeciwnik musi być widoczny.',
  };
}

/**
 * Check if a pawn is blocked from moving forward.
 * Returns a notification without revealing the blocker's identity.
 * 
 * @param {string} pawnSquare 
 * @param {Array<Array<object|null>>} board 
 * @param {string} color 
 * @returns {{ blocked: boolean, message: string | null }}
 */
export function checkPawnBlocked(pawnSquare, board, color) {
  const { row, col } = squareToCoords(pawnSquare);
  const moveDir = color === COLORS.WHITE ? -1 : 1;
  const nextRow = row + moveDir;

  if (!isInBounds(nextRow, col)) {
    return { blocked: true, message: null }; // At the edge, not a "block" notification
  }

  const blockingPiece = board[nextRow][col];
  if (blockingPiece) {
    return {
      blocked: true,
      message: 'Przeszkoda! Coś blokuje drogę pionkowi.',
    };
  }

  return { blocked: false, message: null };
}
