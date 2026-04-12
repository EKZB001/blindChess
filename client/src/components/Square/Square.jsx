/**
 * Square Component
 * 
 * Single cell on the chessboard. Handles visual states:
 * fog, selected, legal move, capture, observer beam, etc.
 */

import Piece from '../Piece/Piece.jsx';
import { FILES, RANKS } from '../../config/constants.js';
import './Square.css';

export default function Square({
  row,
  col,
  piece,
  isVisible,
  isSelected,
  isLegalMove,
  isLegalCapture,
  isLastMoveFrom,
  isLastMoveTo,
  isObserverBeam,
  isRadar,
  isFlash,
  isCheck,
  isRevealed,
  onClick,
}) {
  const isLight = (row + col) % 2 === 0;
  const showCoordFile = row === 7;
  const showCoordRank = col === 0;

  const classNames = [
    'square',
    isLight ? 'square--light' : 'square--dark',
    !isVisible && 'square--fog',
    isSelected && 'square--selected',
    isLegalMove && !piece && 'square--legal-move',
    isLegalCapture && 'square--legal-capture',
    (isLastMoveFrom || isLastMoveTo) && 'square--last-move',
    isObserverBeam && 'square--observer-beam',
    isRadar && 'square--radar',
    isFlash && 'square--flash',
    isCheck && 'square--check',
  ].filter(Boolean).join(' ');

  return (
    <div
      id={`square-${FILES[col]}${RANKS[row]}`}
      className={classNames}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`${FILES[col]}${RANKS[row]}${piece ? ` - ${piece.color === 'w' ? 'biały' : 'czarny'} ${piece.type}` : ''}`}
    >
      {isVisible && piece && (
        <Piece piece={piece} isRevealed={isRevealed} />
      )}

      {showCoordFile && (
        <span className="square__file-label">{FILES[col]}</span>
      )}
      {showCoordRank && (
        <span className="square__rank-label">{RANKS[row]}</span>
      )}
    </div>
  );
}
