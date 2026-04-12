/**
 * Piece Component
 * 
 * Renders a chess piece using Unicode symbols.
 * Supports visual states: normal, observer, revealed, captured.
 */

import { PIECE_SYMBOLS, PIECE_TYPES } from '../../config/constants.js';
import './Piece.css';

export default function Piece({ piece, isRevealed = false, isPlaced = false }) {
  if (!piece) return null;

  const { type, color, isObserver } = piece;
  const displayType = isObserver ? PIECE_TYPES.OBSERVER : type;
  const symbol = PIECE_SYMBOLS[color]?.[displayType] || PIECE_SYMBOLS[color]?.[type] || '?';

  const classNames = [
    'piece',
    `piece--${color === 'w' ? 'white' : 'black'}`,
    isObserver && 'piece--observer',
    isRevealed && 'piece--revealed',
    isPlaced && 'piece--placed',
  ].filter(Boolean).join(' ');

  return (
    <span className={classNames} role="img" aria-label={`${color === 'w' ? 'White' : 'Black'} ${displayType}`}>
      {symbol}
    </span>
  );
}
