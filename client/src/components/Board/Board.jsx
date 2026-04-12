/**
 * Board Component
 * 
 * 8×8 CSS Grid chessboard with fog of war rendering.
 * Handles click-based piece selection and move execution.
 */

import { useState, useCallback } from 'react';
import Square from '../Square/Square.jsx';
import { coordsToSquare } from '../../config/constants.js';
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
  onSquareClick,
}) {
  const isFlipped = myColor === 'b';

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
  ].filter(Boolean).join(' ');

  return (
    <div className="board-container">
      <div className="board__turn-indicator">
        <span className={`board__turn-dot board__turn-dot--${currentTurn === 'w' ? 'white' : 'black'}`} />
        <span>
          {currentTurn === 'w' ? 'Białe' : 'Czarne'} — Twój ruch
        </span>
      </div>

      <div className={boardClasses}>
        {renderSquares()}
      </div>
    </div>
  );
}
