/**
 * BlindChessEngine — Core Game Engine
 * 
 * Wraps chess.js with custom Blind Chess mechanics:
 * - Fog of War (hidden enemy pieces)
 * - Blind Shot (long-range pieces through fog)
 * - King's 5 Lives + Vampirism
 * - Observer promotion (lighthouse piece)
 * - Radar Pawns (conditional captures)
 */

import { Chess } from 'chess.js';
import {
  COLORS,
  PIECE_TYPES,
  LONG_RANGE_PIECES,
  PROMOTION_RANK,
  GAME_RESULT,
  MAX_KING_LIVES,
  squareToCoords,
  coordsToSquare,
  isInBounds,
  DIRECTIONS,
} from '../config/constants.js';
import { FogOfWarManager, computeVisibility } from './fogOfWar.js';
import logger from '../utils/logger.js';
import { computeBlindShot, isBlindShotPiece, getMoveDirection } from './blindShot.js';
import { KingLifeManager, validateKingMove, validateCheckEscape } from './kingSystem.js';
import { isObserver, getObserverMoves, canObserverMoveTo } from './observer.js';
import { canPawnCapture, checkPawnBlocked } from './radarPawn.js';

/**
 * Main game engine class — aggregates all subsystems.
 */
export class BlindChessEngine {
  constructor() {
    this.chess = new Chess();
    this.kingLives = new KingLifeManager();
    this.fogManager = {
      [COLORS.WHITE]: new FogOfWarManager(),
      [COLORS.BLACK]: new FogOfWarManager(),
    };

    /** @type {Set<string>} Squares containing Observer pieces */
    this.observerSquares = new Set();

    /** @type {Array<{ type: string, message: string, color: string }>} */
    this.notifications = [];

    /** @type {string | null} */
    this.gameResult = GAME_RESULT.NONE;

    /** @type {boolean} */
    this.wasInCheck = false;

    /** @type {Array<object>} Move history log */
    this.moveLog = [];

    /** @type {{ square: string, piece: object } | null} Flash reveal for king penalty */
    this.flashReveal = null;

    /** @type {Map<string, object>} Captured pieces per color */
    this.capturedPieces = { [COLORS.WHITE]: [], [COLORS.BLACK]: [] };
  }

  // ─── State Queries ──────────────────────────────────────────────

  getCurrentTurn() {
    return this.chess.turn();
  }

  getFullBoard() {
    return this.chess.board();
  }

  /**
   * Get the board as visible to a specific player.
   * Hidden squares show null.
   */
  getVisibleBoard(color, godMode = false) {
    try {
      // Izolacja stanu poprzez głęboką kopię (Deep Copy) - Krok 2
      const boardRaw = this.chess.board();
      const board = JSON.parse(JSON.stringify(boardRaw));

      const observers = this._getObserversForColor(color, board);
      const { visible, obstacles } = computeVisibility(
        board, color, this.fogManager[color], observers, godMode
      );

      const enemyColor = color === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;

      const visibleBoard = board.map(row =>
        row.map(cell => {
          if (!cell) return null;
          if (visible.has(cell.square)) {
            // Mark observers with custom type for rendering
            if (this.observerSquares.has(cell.square)) {
              return { ...cell, type: PIECE_TYPES.OBSERVER, isObserver: true };
            }
            return cell;
          } else if (obstacles.has(cell.square)) {
            // Obstacle detected by pawn (type 'obstacle' is used by Piece.jsx)
            return { ...cell, type: 'obstacle', color: enemyColor, colorHidden: true };
          }
          return null; // Hidden by fog
        })
      );

      // Merge obstacles into Map
      const visibilityMap = new Map(visible);
      for (const obsSq of obstacles) {
         if (!visibilityMap.has(obsSq)) visibilityMap.set(obsSq, 'standard');
      }

      const returnedVisibleSquares = Object.fromEntries(visibilityMap);
      return { board: visibleBoard, visibleSquares: returnedVisibleSquares };
    } catch (err) {
      logger.error('Error calculating visible board:', { error: err.message, stack: err.stack, color });
      // Zwracamy "bezpieczny" pusty stan, by nie wywalić klienta ani serwera
      return { board: Array(8).fill(Array(8).fill(null)), visibleSquares: {} };
    }
  }

  getKingLives(color) {
    return this.kingLives.getLives(color);
  }

  isGameOver() {
    return this.gameResult !== GAME_RESULT.NONE;
  }

  getGameResult() {
    return this.gameResult;
  }

  getNotifications() {
    return [...this.notifications];
  }

  clearNotifications() {
    this.notifications = [];
  }

  getFlashReveal() {
    return this.flashReveal;
  }

  clearFlashReveal() {
    this.flashReveal = null;
  }

  getCapturedPieces() {
    return { ...this.capturedPieces };
  }

  getMoveLog() {
    return [...this.moveLog];
  }

  // ─── Move Generation ────────────────────────────────────────────

  /**
   * Get legal moves for a piece at a given square.
   * Accounts for blind shot, observer, and radar pawn rules.
   * 
   * @param {string} square 
   * @returns {string[]}
   */
  getLegalMoves(square) {
    const board = this.chess.board();
    const { row, col } = squareToCoords(square);
    const piece = board[row][col];

    if (!piece || piece.color !== this.getCurrentTurn()) return [];

    // Observer has custom movement
    if (this.observerSquares.has(square)) {
      return getObserverMoves(square, board, piece.color);
    }

    // For blind shot pieces, generate extended moves
    if (isBlindShotPiece(piece.type)) {
      return this._getBlindShotMoves(square, piece, board);
    }

    // For pawns — standard moves + radar-filtered captures
    if (piece.type === PIECE_TYPES.PAWN) {
      return this._getPawnMoves(square, piece, board);
    }

    // King logic — bypasses chess.js check validation
    if (piece.type === PIECE_TYPES.KING) {
      return this._getKingMoves(square, piece, board);
    }

    // Knights — standard chess.js moves
    const standardMoves = this.chess.moves({ square, verbose: true });
    return standardMoves.map(m => m.to);
  }

  /**
   * Generates king moves, specifically allowing attempts to move to checked/occupied squares.
   * If a move is illegal under chess rules (like moving into check), the life penalty
   * is handled when executing the move.
   */
  _getKingMoves(square, piece, board) {
    const moves = [];
    const { row, col } = squareToCoords(square);
    const directions = [...DIRECTIONS.QUEEN]; // King moves 1 square in all 8 directions

    for (const dir of directions) {
      const r = row + dir.dr;
      const c = col + dir.dc;

      if (isInBounds(r, c)) {
        const targetPiece = board[r][c];
        // Can attempt move if empty or occupied by enemy
        if (!targetPiece || targetPiece.color !== piece.color) {
          moves.push(coordsToSquare(r, c));
        }
      }
    }

    // Include valid castling options if chess.js considers them legal
    const chessMoves = this.chess.moves({ square, verbose: true });
    for (const m of chessMoves) {
      if (m.flags.includes('c') || m.flags.includes('k') || m.flags.includes('q')) {
        if (!moves.includes(m.to)) moves.push(m.to);
      }
    }

    return moves;
  }

  /**
   * Generate extended moves for blind-shot capable pieces.
   * Includes moves to ALL squares along their lines, ignoring intermediate pieces.
   */
  _getBlindShotMoves(square, piece, board) {
    const { row, col } = squareToCoords(square);
    const directions = this._getDirectionsForPiece(piece.type);
    const moves = [];

    for (const dir of directions) {
      let r = row + dir.dr;
      let c = col + dir.dc;
      let blocked = false;

      while (isInBounds(r, c)) {
        const target = board[r][c];

        if (target) {
          if (target.color === piece.color) {
            // Friendly piece blocks the path
            break;
          } else {
            // Enemy piece, add it to dots, but for blind shots we don't stop the dots!
            // The shot execution itself will stop at the first enemy, but the player doesn't know it.
            moves.push(coordsToSquare(r, c));
          }
        } else {
          moves.push(coordsToSquare(r, c));
        }

        r += dir.dr;
        c += dir.dc;
      }
    }

    return moves;
  }

  /**
   * Generate pawn moves considering radar constraints.
   */
  _getPawnMoves(square, piece, board) {
    const moves = [];
    const { row, col } = squareToCoords(square);
    const dir = piece.color === COLORS.WHITE ? -1 : 1;

    // Forward one square
    const fwdRow = row + dir;
    if (isInBounds(fwdRow, col) && !board[fwdRow][col]) {
      moves.push(coordsToSquare(fwdRow, col));

      // Forward two squares from starting rank
      const startRank = piece.color === COLORS.WHITE ? 6 : 1;
      const fwd2Row = row + dir * 2;
      if (row === startRank && isInBounds(fwd2Row, col) && !board[fwd2Row][col]) {
        moves.push(coordsToSquare(fwd2Row, col));
      }
    }

    // Pawn captures — allowed ONLY if the target square is visibly highlighted to the player
    // (either an obstacle detected by another pawn, an observer beam, or a reveal)
    const observers = this._getObserversForColor(piece.color);
    const { visible: visibleSquares, obstacles } = computeVisibility(
      board, piece.color, this.fogManager[piece.color], observers, false
    );

    for (const dc of [-1, 1]) {
      const captureCol = col + dc;
      const captureRow = row + dir;
      if (!isInBounds(captureRow, captureCol)) continue;

      const targetSquare = coordsToSquare(captureRow, captureCol);
      const targetPiece = board[captureRow][captureCol];

      if (targetPiece && targetPiece.color !== piece.color) {
        const { allowed } = canPawnCapture(
          square, targetSquare, visibleSquares, obstacles, board, piece.color
        );
        if (allowed) {
          moves.push(targetSquare);
        }
      }
    }

    // En passant — check chess.js standard moves for this
    const chessMoves = this.chess.moves({ square, verbose: true });
    for (const m of chessMoves) {
      if (m.san && m.san.includes('x') && !moves.includes(m.to)) {
        // Chess.js reports a legal capture (en passant)
        const epTarget = m.to;
        const { allowed } = canPawnCapture(
          square, epTarget, visibleSquares, obstacles, board, piece.color
        );
        if (allowed) {
          moves.push(epTarget);
        }
      }
    }

    return moves;
  }

  _getDirectionsForPiece(type) {
    switch (type) {
      case PIECE_TYPES.ROOK: return DIRECTIONS.ROOK;
      case PIECE_TYPES.BISHOP: return DIRECTIONS.BISHOP;
      case PIECE_TYPES.QUEEN: return DIRECTIONS.QUEEN;
      default: return [];
    }
  }

  // ─── Move Execution ─────────────────────────────────────────────

  /**
   * Execute a move in Blind Chess.
   * Handles all custom mechanics before delegating to chess.js.
   * 
   * @param {string} from 
   * @param {string} to 
   * @returns {{ 
   *   success: boolean, 
   *   notifications: Array<object>,
   *   capturedPiece: object | null,
   *   moveData: object | null
   * }}
   */
  makeMove(from, to) {
    if (this.isGameOver()) {
      return { success: false, notifications: [{ type: 'error', message: 'Gra zakończona.' }], capturedPiece: null, moveData: null };
    }

    this.notifications = [];
    this.flashReveal = null;

    const board = this.chess.board();
    const { row: fromRow, col: fromCol } = squareToCoords(from);
    const piece = board[fromRow][fromCol];

    if (!piece || piece.color !== this.getCurrentTurn()) {
      return { success: false, notifications: [{ type: 'error', message: 'Nie Twoja bierka.' }], capturedPiece: null, moveData: null };
    }

    const currentColor = piece.color;
    const enemyColor = currentColor === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;

    // Check if we're currently in check
    const inCheck = this.chess.inCheck();

    // ── Observer moves ──
    if (this.observerSquares.has(from)) {
      return this._executeObserverMove(from, to, currentColor);
    }

    // ── King moves ──
    if (piece.type === PIECE_TYPES.KING) {
      return this._executeKingMove(from, to, piece, currentColor, enemyColor, inCheck);
    }

    // ── Blind Shot (long-range pieces) ──
    if (isBlindShotPiece(piece.type)) {
      return this._executeBlindShot(from, to, piece, currentColor, inCheck);
    }

    // ── Pawn moves ──
    if (piece.type === PIECE_TYPES.PAWN) {
      return this._executePawnMove(from, to, piece, currentColor, inCheck);
    }

    // ── Standard moves (Knight) ──
    return this._executeStandardMove(from, to, piece, currentColor, inCheck);
  }

  _executeObserverMove(from, to, color) {
    const targetPiece = this.chess.get(to);

    // Observer moves only to empty squares (pacifism)
    if (targetPiece) {
      this._addNotification('error', 'Obserwator nie może bić!');
      return { success: false, notifications: this.notifications, capturedPiece: null, moveData: null };
    }

    try {
      // Execute move natively. Observer is represented as Queen in chess.js.
      // This will automatically handle turn flip, check detection, and consistency.
      const moveResult = this.chess.move({ from, to });
      
      this.observerSquares.delete(from);
      this.observerSquares.add(to);

      this.moveLog.push({ 
        from, 
        to, 
        piece: { type: PIECE_TYPES.OBSERVER, color }, 
        color 
      });

      this._endTurnChecks(color);

      return { success: true, notifications: this.notifications, capturedPiece: null, moveData: moveResult };
    } catch {
      this._addNotification('error', 'Niedozwolony ruch Obserwatora.');
      return { success: false, notifications: this.notifications, capturedPiece: null, moveData: null };
    }
  }

  _executeKingMove(from, to, piece, color, enemyColor, inCheck) {
    const board = this.chess.board();
    const { row: toRow, col: toCol } = squareToCoords(to);
    const targetPiece = board[toRow][toCol];

    // Check if target square has enemy piece or is attacked
    const kingValidation = validateKingMove(to, board, color, this.chess);

    if (targetPiece && targetPiece.color === color) {
      this._addNotification('error', 'Nie można wejść na pole własnej bierki.');
      return { success: false, notifications: this.notifications, capturedPiece: null, moveData: null };
    }

    // Attempt the move via chess.js
    try {
      const moveResult = this.chess.move({ from, to });

      if (inCheck) {
        // Check if we escaped check
        const escape = validateCheckEscape(this.chess, color);
        if (!escape.resolved) {
          this.chess.undo();
          const lifeResult = this.kingLives.loseLife(color);
          this._addNotification('danger', escape.reason);
          this._addNotification('life', `♔ Życia: ${lifeResult.livesRemaining}/${MAX_KING_LIVES}`);

          if (lifeResult.isDead) {
            this._setGameOver(color === COLORS.WHITE ? GAME_RESULT.WHITE_KING_DEAD : GAME_RESULT.BLACK_KING_DEAD);
          }
          return { success: false, notifications: this.notifications, capturedPiece: null, moveData: null };
        }
      }

      // Handle capture vampirism
      let capturedPiece = null;
      if (moveResult.captured) {
        capturedPiece = { type: moveResult.captured, color: enemyColor };
        this._handleCapture(capturedPiece, color, enemyColor, to);
      }

      this.moveLog.push({ from, to, piece, color, captured: capturedPiece });
      this._endTurnChecks(color);

      return { success: true, notifications: this.notifications, capturedPiece, moveData: moveResult };
    } catch {
      // chess.js rejected the move — king tried to move into danger
      if (!kingValidation.valid) {
        const lifeResult = this.kingLives.loseLife(color);
        this._addNotification('danger', kingValidation.reason);
        this._addNotification('life', `♔ Życia: ${lifeResult.livesRemaining}/${MAX_KING_LIVES}`);

        // Flash-reveal the attacker's square
        if (kingValidation.revealSquare) {
          this.flashReveal = { square: to };
          // Temporarily reveal for the enemy
          if (targetPiece) {
            this.fogManager[color].addReveal(to, 1);
          }
        }

        if (lifeResult.isDead) {
          this._setGameOver(color === COLORS.WHITE ? GAME_RESULT.WHITE_KING_DEAD : GAME_RESULT.BLACK_KING_DEAD);
        }
      } else {
        this._addNotification('error', 'Niedozwolony ruch króla.');
      }

      return { success: false, notifications: this.notifications, capturedPiece: null, moveData: null };
    }
  }

  _executeBlindShot(from, to, piece, color, inCheck) {
    const board = this.chess.board();
    const enemyColor = color === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;

    // Compute blind shot result
    const shotResult = computeBlindShot(from, to, board, color);

    if (shotResult.actualTarget === from) {
      this._addNotification('info', 'Ruch zablokowany — bierka nie może się ruszyć.');
      return { success: false, notifications: this.notifications, capturedPiece: null, moveData: null };
    }

    // Clone chess state for validation without mutating the main instance
    const tempChess = new Chess(this.chess.fen());
    const movingPieceData = tempChess.get(from);
    
    // Execute the move manually on the temporary board
    tempChess.remove(from);
    let capturedPieceData = null;

    if (shotResult.collision === 'enemy' && shotResult.capturedPiece) {
      // Capture at the actual target
      capturedPieceData = tempChess.get(shotResult.actualTarget);
      tempChess.remove(shotResult.actualTarget);
    }
    tempChess.put(movingPieceData, shotResult.actualTarget);

    // Check if the move left our king in check (invalid)
    const kingSquares = tempChess.board().flat().filter(
      p => p && p.type === PIECE_TYPES.KING && p.color === color
    );

    if (kingSquares.length > 0) {
      const kingSquare = kingSquares[0].square;
      if (tempChess.isAttacked(kingSquare, enemyColor)) {
        if (inCheck) {
          const lifeResult = this.kingLives.loseLife(color);
          this._addNotification('danger', 'Ruch nie zdjął szacha! -1 życie.');
          this._addNotification('life', `♔ Życia: ${lifeResult.livesRemaining}/${MAX_KING_LIVES}`);
          if (lifeResult.isDead) {
            this._setGameOver(color === COLORS.WHITE ? GAME_RESULT.WHITE_KING_DEAD : GAME_RESULT.BLACK_KING_DEAD);
          }
        } else {
          this._addNotification('error', 'Ten ruch odsłania króla na szach.');
        }

        return { success: false, notifications: this.notifications, capturedPiece: null, moveData: null };
      }
    }

    // Move is valid -> Apply state to main instance
    // Since Blind Shot is non-standard, we load the FEN from simulation
    const simulatedFen = tempChess.fen();
    
    // We need to flip the turn in simulated fen manually if we didn't use .move()
    // The previous manual _flipTurn was here, but let's do it cleaner by editing the FEN
    const fenParts = simulatedFen.split(' ');
    fenParts[1] = (fenParts[1] === 'w' ? 'b' : 'w'); // flip turn
    fenParts[3] = '-'; // reset en passant
    
    this.chess.load(fenParts.join(' '));

    // Handle notifications for blind shot results
    if (shotResult.collision === 'enemy') {
      this._addNotification('capture', `Ślepy ostrzał! Zbito bierkę na ${shotResult.actualTarget}.`);
      this._handleCapture(capturedPieceData, color, enemyColor, shotResult.actualTarget);

      // Reveal the capturing piece for 2 turns to the enemy
      // (So they see it during their turn, then it fades)
      this.fogManager[enemyColor].addReveal(shotResult.actualTarget, 2);
    } else if (shotResult.collision === 'friendly') {
      this._addNotification('info', `Bierka zatrzymana przed przeszkodą na ${shotResult.actualTarget}.`);
    }

    this.moveLog.push({
      from, to: shotResult.actualTarget, piece, color,
      captured: capturedPieceData, blindShot: true,
      intendedTarget: to,
    });

    this._endTurnChecks(color);

    return {
      success: true,
      notifications: this.notifications,
      capturedPiece: capturedPieceData,
      moveData: { from, to: shotResult.actualTarget },
    };
  }

  _executePawnMove(from, to, piece, color, inCheck) {
    const board = this.chess.board();
    const enemyColor = color === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
    const { row: fromRow, col: fromCol } = squareToCoords(from);
    const { row: toRow, col: toCol } = squareToCoords(to);

    const isCapture = fromCol !== toCol;

    if (isCapture) {
      // Radar pawn — validate capture permission based on actual visual state
      const observers = this._getObserversForColor(color);
      const { visible: visibleSquares, obstacles } = computeVisibility(
        board, color, this.fogManager[color], observers, false
      );

      const captureCheck = canPawnCapture(from, to, visibleSquares, obstacles, board, color);

      if (!captureCheck.allowed) {
        this._addNotification('info', captureCheck.reason);
        return { success: false, notifications: this.notifications, capturedPiece: null, moveData: null };
      }
    }

    // Check forward block notification
    if (!isCapture) {
      const blockCheck = checkPawnBlocked(from, board, color);
      if (blockCheck.blocked && blockCheck.message) {
        this._addNotification('info', blockCheck.message);
        return { success: false, notifications: this.notifications, capturedPiece: null, moveData: null };
      }
    }

    // Check for promotion
    const isPromotion = toRow === PROMOTION_RANK[color];

    try {
      // chess.js move — promote to queen (we'll transform it to observer)
      const moveObj = { from, to };
      if (isPromotion) {
        moveObj.promotion = 'q'; // chess.js requires standard promotion
      }

      const moveResult = this.chess.move(moveObj);

      // Validate check escape if needed
      if (inCheck) {
        const escape = validateCheckEscape(this.chess, color);
        if (!escape.resolved) {
          this.chess.undo();
          const lifeResult = this.kingLives.loseLife(color);
          this._addNotification('danger', escape.reason);
          this._addNotification('life', `♔ Życia: ${lifeResult.livesRemaining}/${MAX_KING_LIVES}`);
          if (lifeResult.isDead) {
            this._setGameOver(color === COLORS.WHITE ? GAME_RESULT.WHITE_KING_DEAD : GAME_RESULT.BLACK_KING_DEAD);
          }
          return { success: false, notifications: this.notifications, capturedPiece: null, moveData: null };
        }
      }

      // Handle capture
      let capturedPiece = null;
      if (moveResult.captured) {
        capturedPiece = { type: moveResult.captured, color: enemyColor };
        this._handleCapture(capturedPiece, color, enemyColor, to);

        // Reveal capturing pawn for 2 turns
        this.fogManager[enemyColor].addReveal(to, 2);
      }

      // Handle Observer promotion
      if (isPromotion) {
        this.observerSquares.add(to);
        this._addNotification('promotion', `Pionek awansował na Obserwatora na ${to}!`);
      }

      this.moveLog.push({ from, to, piece, color, captured: capturedPiece, promotion: isPromotion });
      this._endTurnChecks(color);

      return { success: true, notifications: this.notifications, capturedPiece, moveData: moveResult };
    } catch {
      this._addNotification('error', 'Niedozwolony ruch pionka.');
      return { success: false, notifications: this.notifications, capturedPiece: null, moveData: null };
    }
  }

  _executeStandardMove(from, to, piece, color, inCheck) {
    const enemyColor = color === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;

    try {
      const moveResult = this.chess.move({ from, to });

      if (inCheck) {
        const escape = validateCheckEscape(this.chess, color);
        if (!escape.resolved) {
          this.chess.undo();
          const lifeResult = this.kingLives.loseLife(color);
          this._addNotification('danger', escape.reason);
          this._addNotification('life', `♔ Życia: ${lifeResult.livesRemaining}/${MAX_KING_LIVES}`);
          if (lifeResult.isDead) {
            this._setGameOver(color === COLORS.WHITE ? GAME_RESULT.WHITE_KING_DEAD : GAME_RESULT.BLACK_KING_DEAD);
          }
          return { success: false, notifications: this.notifications, capturedPiece: null, moveData: null };
        }
      }

      let capturedPiece = null;
      if (moveResult.captured) {
        capturedPiece = { type: moveResult.captured, color: enemyColor };
        this._handleCapture(capturedPiece, color, enemyColor, to);

        // Reveal piece position for 2 turns
        this.fogManager[enemyColor].addReveal(to, 2);
      }

      this.moveLog.push({ from, to, piece, color, captured: capturedPiece });
      this._endTurnChecks(color);

      return { success: true, notifications: this.notifications, capturedPiece, moveData: moveResult };
    } catch {
      this._addNotification('error', 'Niedozwolony ruch.');
      return { success: false, notifications: this.notifications, capturedPiece: null, moveData: null };
    }
  }

  // ─── End of Turn ────────────────────────────────────────────────

  /**
   * Process end-of-turn checks after a successful move.
   */
  _endTurnChecks(movingColor) {
    const enemyColor = movingColor === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;

    // Check if opponent is now in check
    if (this.chess.inCheck()) {
      this._addNotification('check', 'Szach! Twój król jest atakowany.');
    }

    // Check for checkmate
    if (this.chess.isCheckmate()) {
      this._setGameOver(
        movingColor === COLORS.WHITE ? GAME_RESULT.WHITE_WINS : GAME_RESULT.BLACK_WINS
      );
      this._addNotification('gameover', 'Mat! Koniec gry!');
    }

    // Check for stalemate
    if (this.chess.isStalemate()) {
      this._setGameOver(GAME_RESULT.DRAW_STALEMATE);
      this._addNotification('gameover', 'Pat! Remis.');
    }

    // Check for insufficient material
    if (this.chess.isInsufficientMaterial()) {
      this._setGameOver(GAME_RESULT.DRAW_INSUFFICIENT);
      this._addNotification('gameover', 'Brak materiału do mata. Remis.');
    }
  }

  /**
   * Called when player ends their turn (perspective swap in local mode).
   * Ticks fog reveals for the next player.
   */
  endTurn() {
    const currentColor = this.getCurrentTurn();
    // Tick reveals for the player whose turn it now is
    this.fogManager[currentColor].tickReveals();
  }

  // ─── Helpers ────────────────────────────────────────────────────

  _handleCapture(capturedPiece, captureColor, capturedColor, square) {
    if (!capturedPiece) return;

    // Record captured piece
    this.capturedPieces[capturedColor].push(capturedPiece);

    // Vampirism — capturing restores 1 king life
    const lifeResult = this.kingLives.gainLife(captureColor);
    if (lifeResult.gained) {
      this._addNotification('vampirism', `Wampiryzm! +1 życie. Życia: ${lifeResult.newLives}/${MAX_KING_LIVES}`);
    }

    // Reveal the capturing piece's position to the enemy for 2 turns
    // (So the enemy sees it during their turn, and it fades when they pass back)
    this.fogManager[capturedColor].addReveal(square, 2);

    // Remove observer if observer was captured
    if (this.observerSquares.has(square)) {
      this.observerSquares.delete(square);
    }
  }

  _addNotification(type, message) {
    this.notifications.push({
      type,
      message,
      color: this.getCurrentTurn(),
      timestamp: Date.now(),
    });
  }

  _setGameOver(result) {
    this.gameResult = result;
  }

  /**
   * Get observers belonging to a specific color.
   */
  _getObserversForColor(color, board) {
    const observers = [];
    const currentBoard = board || this.chess.board();
    for (const sq of this.observerSquares) {
      if (!sq) continue;
      const { row, col } = squareToCoords(sq);
      const piece = currentBoard[row] ? currentBoard[row][col] : null;
      // Obserwatorzy technicznie są reprezentowani jako hetmany (q) w chess.js
      if (piece && piece.color === color && piece.type === PIECE_TYPES.QUEEN) {
        observers.push({ square: sq, piece });
      }
    }
    return observers;
  }

  // ─── Reset ──────────────────────────────────────────────────────

  reset() {
    this.chess.reset();
    this.kingLives.reset();
    this.fogManager[COLORS.WHITE].reset();
    this.fogManager[COLORS.BLACK].reset();
    this.observerSquares.clear();
    this.notifications = [];
    this.gameResult = GAME_RESULT.NONE;
    this.wasInCheck = false;
    this.moveLog = [];
    this.flashReveal = null;
    this.capturedPieces = { [COLORS.WHITE]: [], [COLORS.BLACK]: [] };
  }
}
