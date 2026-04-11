/**
 * useBlindChess — Custom React Hook
 * 
 * Bridges BlindChessEngine with React state management.
 * Handles all user interactions: square clicks, turn ending, god mode, etc.
 * 
 * Key design: `viewingColor` tracks whose perspective the board shows.
 * This only changes on "Zakończ Turę", not on move execution.
 * `activeColor` (engine turn) changes after each move.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { BlindChessEngine } from '../engine/BlindChessEngine.js';
import {
  COLORS,
  GAME_RESULT,
  squareToCoords,
  coordsToSquare,
} from '../config/constants.js';
import { getObserverRevealedSquares } from '../engine/observer.js';

export default function useBlindChess() {
  const engineRef = useRef(null);
  if (!engineRef.current) {
    engineRef.current = new BlindChessEngine();
  }
  const engine = engineRef.current;

  /** Whose perspective the board is showing (changes on End Turn only) */
  const [viewingColor, setViewingColor] = useState(COLORS.WHITE);

  /** Whether the current viewing player has already made their move */
  const [hasMoved, setHasMoved] = useState(false);

  const [boardState, setBoardState] = useState(() => getInitialState(engine));
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [godMode, setGodMode] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [lastMove, setLastMove] = useState(null);

  /**
   * Refresh all board state from the engine.
   * Uses `viewingColor` for perspective, not engine turn.
   */
  const refreshState = useCallback((gm = godMode, viewColor = viewingColor) => {
    const { board, visibleSquares } = engine.getVisibleBoard(viewColor, gm);
    const fullBoard = engine.getFullBoard();

    // Compute observer beams for viewing player
    const observerBeams = new Set();
    for (const sq of engine.observerSquares) {
      const { row, col } = squareToCoords(sq);
      const piece = fullBoard[row][col];
      if (piece && piece.color === viewColor) {
        const beams = getObserverRevealedSquares(sq, fullBoard);
        for (const b of beams) observerBeams.add(b);
      }
    }

    // Radar squares are no longer a separate invisible entity, they are fully replaced by visual obstacles
    const radarSquares = new Set();

    // Find king square for check highlight
    let kingSquare = null;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = fullBoard[r][c];
        if (p && p.type === 'k' && p.color === viewColor) {
          kingSquare = coordsToSquare(r, c);
        }
      }
    }

    // Check if the VIEWING player is in check
    // (engine turn may differ if they already moved)
    const inCheck = engine.chess.inCheck() && engine.getCurrentTurn() === viewColor;

    setBoardState({
      board,
      visibleSquares,
      currentTurn: viewColor,
      whiteLives: engine.getKingLives(COLORS.WHITE),
      blackLives: engine.getKingLives(COLORS.BLACK),
      capturedPieces: engine.getCapturedPieces(),
      moveLog: engine.getMoveLog(),
      gameResult: engine.getGameResult(),
      inCheck,
      kingSquare,
      observerBeamSquares: observerBeams,
      radarSquares,
      flashReveal: engine.getFlashReveal(),
    });
  }, [engine, godMode, viewingColor]);

  /**
   * Handle square click — selection and move execution.
   */
  const handleSquareClick = useCallback((square) => {
    if (engine.isGameOver()) return;
    if (hasMoved) return; // Can't move again until "Zakończ Turę"

    const fullBoard = engine.getFullBoard();
    const { row, col } = squareToCoords(square);
    const clickedPiece = fullBoard[row][col];

    // If a piece is selected and clicking a legal move target → execute move
    if (selectedSquare && legalMoves.includes(square)) {
      const result = engine.makeMove(selectedSquare, square);

      if (result.success) {
        setLastMove({ from: selectedSquare, to: square });
        setSelectedSquare(null);
        setLegalMoves([]);
        setNotifications(result.notifications);
        setHasMoved(true);
        refreshState();
      } else {
        setNotifications(result.notifications);
        refreshState();
      }
      return;
    }

    // If clicking own piece (of current viewing color) → select it
    if (clickedPiece && clickedPiece.color === viewingColor) {
      if (selectedSquare === square) {
        setSelectedSquare(null);
        setLegalMoves([]);
        return;
      }

      setSelectedSquare(square);
      const moves = engine.getLegalMoves(square);
      setLegalMoves(moves);
      return;
    }

    // Deselect
    setSelectedSquare(null);
    setLegalMoves([]);
  }, [engine, selectedSquare, legalMoves, refreshState, viewingColor, hasMoved]);

  /**
   * End the current turn — swap perspective to the other player.
   */
  const handleEndTurn = useCallback(() => {
    if (engine.isGameOver()) return;

    const nextColor = viewingColor === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;

    engine.endTurn();
    engine.clearFlashReveal();
    setViewingColor(nextColor);
    setSelectedSquare(null);
    setLegalMoves([]);
    setNotifications([]);
    setLastMove(null);
    setHasMoved(false);
    refreshState(godMode, nextColor);
  }, [engine, refreshState, viewingColor, godMode]);

  /**
   * Automatyczne kończenie tury po ruchu.
   */
  useEffect(() => {
    if (hasMoved && !engine.isGameOver()) {
      const timer = setTimeout(() => {
        handleEndTurn();
      }, 1200); // 1.2s delay to let the player see their move outcome
      return () => clearTimeout(timer);
    }
  }, [hasMoved, handleEndTurn, engine]);

  /**
   * Toggle God Mode.
   */
  const toggleGodMode = useCallback(() => {
    const newGodMode = !godMode;
    setGodMode(newGodMode);
    refreshState(newGodMode);
  }, [godMode, refreshState]);

  /**
   * Start a new game.
   */
  const handleNewGame = useCallback(() => {
    engine.reset();
    setViewingColor(COLORS.WHITE);
    setHasMoved(false);
    setSelectedSquare(null);
    setLegalMoves([]);
    setGodMode(false);
    setNotifications([]);
    setLastMove(null);
    refreshState(false, COLORS.WHITE);
  }, [engine, refreshState]);

  return {
    ...boardState,
    selectedSquare,
    legalMoves,
    godMode,
    notifications,
    lastMove,
    hasMoved,
    handleSquareClick,
    handleEndTurn,
    toggleGodMode,
    handleNewGame,
  };
}

function getInitialState(engine) {
  const { board, visibleSquares } = engine.getVisibleBoard(COLORS.WHITE, false);

  return {
    board,
    visibleSquares,
    currentTurn: COLORS.WHITE,
    whiteLives: engine.getKingLives(COLORS.WHITE),
    blackLives: engine.getKingLives(COLORS.BLACK),
    capturedPieces: engine.getCapturedPieces(),
    moveLog: [],
    gameResult: GAME_RESULT.NONE,
    inCheck: false,
    kingSquare: null,
    observerBeamSquares: new Set(),
    radarSquares: new Set(),
    flashReveal: null,
  };
}
