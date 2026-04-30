/**
 * Square Component
 * 
 * Single cell on the chessboard. Handles visual states:
 * fog, selected, legal move, capture, observer beam, etc.
 */

import Piece from '../Piece/Piece.jsx';
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
      className={classNames}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      {isVisible && piece && (
        <Piece piece={piece} isRevealed={isRevealed} />
      )}
    </div>
  );
}
