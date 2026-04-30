/**
 * Board Component
 * 
 * 8×8 CSS Grid chessboard with fog of war rendering.
 * Handles click-based piece selection and move execution.
 * Coordinate labels are rendered OUTSIDE the board grid.
 */

import Square from '../Square/Square.jsx';
import { coordsToSquare, FILES, RANKS } from '../../config/constants.js';
import './Board.css';

export default function Board({
  board,
  visibleSquares,
  currentTurn,
  selectedSquare,
  legalMoves,
  lastMove,
  observerBeamSquares,
  radarSquares,
  flashReveal,
  inCheck,
  kingSquare,
  myColor,
  isSpectator,
  onSquareClick,
}) {
  const isFlipped = myColor === 'b';

  // Etykiety plików i rangów uwzględniające obrот planszy
  const fileLabels = isFlipped ? [...FILES].reverse() : FILES;
  const rankLabels = isFlipped ? [...RANKS].reverse() : RANKS;

  const renderSquares = () => {
    const squares = [];

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const square = coordsToSquare(row, col);
        const piece = board[row][col];
        const visibilityType = visibleSquares ? visibleSquares[square] : null;
        const isVisible = !!visibilityType;
        const isObserverGlow = visibilityType === 'observer_glow';
        const isSelected = selectedSquare === square;
        const isLegalTarget = legalMoves.includes(square);
        const hasPiece = piece !== null;

        squares.push(
          <Square
            key={square}
            row={row}
            col={col}
            piece={piece}
            isVisible={isVisible}
            isSelected={isSelected}
            isLegalMove={isLegalTarget && !hasPiece}
            isLegalCapture={isLegalTarget && hasPiece && isVisible}
            isLastMoveFrom={lastMove?.from === square}
            isLastMoveTo={lastMove?.to === square}
            isObserverBeam={isObserverGlow}
            isRadar={radarSquares?.has(square)}
            isFlash={flashReveal?.square === square}
            isCheck={inCheck && kingSquare === square}
            isRevealed={isVisible && piece?.color !== myColor}
            onClick={() => onSquareClick(square)}
          />
        );
      }
    }

    return squares;
  };

  const boardClasses = [
    'board',
    isFlipped && 'board--flipped',
    inCheck && 'board--in-check',
    isSpectator && 'board--spectator',
  ].filter(Boolean).join(' ');

  return (
    <div className="board-container">
      <div className="board__turn-indicator">
        <span className={`board__turn-dot board__turn-dot--${currentTurn === 'w' ? 'white' : 'black'}`} />
        <span>
          {currentTurn === 'w' ? 'Białe' : 'Czarne'} — {isSpectator ? 'Trwa tura' : (currentTurn === myColor ? 'Twój ruch' : 'Ruch przeciwnika')}
        </span>
      </div>

      {/* Wrapper planszy z etykietami na zewnątrz */}
      <div className="board-wrapper">
        {/* Etykiety rangów (1–8) po lewej stronie */}
        <div className="board__rank-labels">
          {rankLabels.map(rank => (
            <span key={rank} className="board__rank-label">{rank}</span>
          ))}
        </div>

        <div className="board__inner">
          <div className={boardClasses}>
            {renderSquares()}
          </div>

          {/* Etykiety plików (a–h) pod planszy */}
          <div className="board__file-labels">
            {fileLabels.map(file => (
              <span key={file} className="board__file-label">{file}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
