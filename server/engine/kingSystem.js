/**
 * King System — 5 Lives, Vampirism, Spider Sense
 * 
 * Manages the king's life pool per player:
 * - Invalid check escape: -1 life
 * - Moving into attacked/occupied square: -1 life + brief flash
 * - Capturing enemy piece (by any friendly): +1 life (vampirism)
 * - 0 lives = instant loss
 */

import { MAX_KING_LIVES, COLORS } from '../config/constants.js';

/**
 * Manages king life points for both players.
 */
export class KingLifeManager {
  constructor() {
    this.lives = {
      [COLORS.WHITE]: MAX_KING_LIVES,
      [COLORS.BLACK]: MAX_KING_LIVES,
    };
  }

  /**
   * Get remaining lives for a color.
   * @param {string} color 
   * @returns {number}
   */
  getLives(color) {
    return this.lives[color];
  }

  /**
   * Lose 1 life.
   * @param {string} color 
   * @returns {{ livesRemaining: number, isDead: boolean }}
   */
  loseLife(color) {
    this.lives[color] = Math.max(0, this.lives[color] - 1);
    return {
      livesRemaining: this.lives[color],
      isDead: this.lives[color] === 0,
    };
  }

  /**
   * Gain 1 life (vampirism — capped at MAX_KING_LIVES).
   * @param {string} color 
   * @returns {{ newLives: number, gained: boolean }}
   */
  gainLife(color) {
    const oldLives = this.lives[color];
    this.lives[color] = Math.min(MAX_KING_LIVES, this.lives[color] + 1);
    return {
      newLives: this.lives[color],
      gained: this.lives[color] > oldLives,
    };
  }

  /**
   * Check if a king is still alive.
   * @param {string} color 
   * @returns {boolean}
   */
  isAlive(color) {
    return this.lives[color] > 0;
  }

  /** Reset both kings to full lives */
  reset() {
    this.lives[COLORS.WHITE] = MAX_KING_LIVES;
    this.lives[COLORS.BLACK] = MAX_KING_LIVES;
  }
}

/**
 * Validate a king move against fog-of-war rules.
 * In Blind Chess the king can attempt to move onto attacked squares —
 * it just costs a life and the move is blocked.
 * 
 * @param {string} targetSquare - Where the king wants to go
 * @param {Array<Array<object|null>>} board - Full board state
 * @param {string} color - King's color
 * @param {import('chess.js').Chess} chess - chess.js instance for attack detection
 * @returns {{
 *   valid: boolean,
 *   penalty: boolean,
 *   revealSquare: string | null,
 *   reason: string | null
 * }}
 */
export function validateKingMove(targetSquare, board, color, chess) {
  const enemyColor = color === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;

  // Check if square is attacked by enemy
  const isAttacked = chess.isAttacked(targetSquare, enemyColor);

  if (isAttacked) {
    return {
      valid: false,
      penalty: true,
      revealSquare: targetSquare,
      reason: 'Pole atakowane przez wroga! -1 życie.',
    };
  }

  return {
    valid: true,
    penalty: false,
    revealSquare: null,
    reason: null,
  };
}

/**
 * Check whether a move resolves an active check.
 * Called after a player's move when they were in check.
 * 
 * @param {import('chess.js').Chess} chessAfterMove - chess instance after the move
 * @param {string} color - Color that was in check
 * @returns {{
 *   resolved: boolean,
 *   penalty: boolean,
 *   reason: string | null
 * }}
 */
export function validateCheckEscape(chessAfterMove, color) {
  // After the move, check if the same color is still in check
  // chess.js switches turn after a move, so we need to check the previous side
  const enemyColor = color === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;

  // The turn has flipped, so current turn's in-check = enemy is checking us after our move
  // We need to undo/redo or check differently. Actually, after our move chess.js
  // switches to the opponent's turn. If our king is STILL attacked, the move didn't escape check.
  // chess.js wouldn't allow such a move normally. But our engine might bypass that.

  // Since we use manual board manipulation, just check if king is attacked
  const kingSquares = chessAfterMove.board().flat().filter(
    p => p && p.type === 'k' && p.color === color
  );

  if (kingSquares.length === 0) {
    return { resolved: false, penalty: true, reason: 'Król został zbity!' };
  }

  const kingSquare = kingSquares[0].square;
  const isStillAttacked = chessAfterMove.isAttacked(kingSquare, enemyColor);

  if (isStillAttacked) {
    return {
      resolved: false,
      penalty: true,
      reason: 'Ruch nie zdjął szacha! -1 życie.',
    };
  }

  return { resolved: true, penalty: false, reason: null };
}
