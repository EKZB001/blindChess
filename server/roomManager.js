// server/roomManager.js
/**
 * RoomManager - zarządzanie stanem pokoi dla gry multiplayer.
 */

// Wykluczyliśmy: O, 0, I, 1 zgodnie z wymogiem o ułatwieniu dyktowania.
const VALID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

import { BlindChessEngine } from './engine/BlindChessEngine.js';
import { COLORS } from './config/constants.js';

export class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  /**
   * Generuje losowe, 4-znakowe ID.
   */
  _generateRoomId() {
    let id = '';
    for (let i = 0; i < 4; i++) {
        id += VALID_CHARS.charAt(Math.floor(Math.random() * VALID_CHARS.length));
    }
    return id;
  }

  /**
   * Tworzy nowy pokój dla socketa, uwzględniając wymuszenie lub wylosowanie preferowanego koloru.
   */
  createRoom(socketId, preferredColor = 'w') {
    let roomId;
    // Zapobieganie unikalnej kolizji (choć szansa to 1 na kilkaset tysięcy)
    do {
      roomId = this._generateRoomId();
    } while (this.rooms.has(roomId));

    let finalColor = preferredColor;
    if (preferredColor === 'random' || preferredColor === 'r') {
      finalColor = Math.random() > 0.5 ? 'w' : 'b';
    }

    const newRoom = {
      id: roomId,
      creatorId: socketId,
      players: {
        w: finalColor === 'w' ? socketId : null,
        b: finalColor === 'b' ? socketId : null
      },
      rematchRequests: new Set(),
      engine: null
    };

    this.rooms.set(roomId, newRoom);
    return { room: newRoom, color: finalColor };
  }

  /**
   * Weryfikuje i dołącza socket do istniejącego pokoju.
   */
  joinRoom(roomId, socketId) {
    const room = this.rooms.get(roomId);

    if (!room) {
      return { success: false, reason: 'Pokój o podanym kodzie nie istnieje.' };
    }

    if (room.players.w && room.players.b) {
      return { success: false, reason: 'Lobby jest już pełne (2 graczy).' };
    }

    // Przypisanie do jedynego wolnego miejsca
    let assignedColor = null;
    if (!room.players.w) {
      room.players.w = socketId;
      assignedColor = 'w';
    } else {
      room.players.b = socketId;
      assignedColor = 'b';
    }

    return { success: true, room, color: assignedColor };
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  getRoomBySocket(socketId) {
    for (const room of this.rooms.values()) {
      if (room.players.w === socketId || room.players.b === socketId) {
        return room;
      }
    }
    return null;
  }

  removePlayer(socketId) {
    const room = this.getRoomBySocket(socketId);
    if (!room) return null;

    if (room.players.w === socketId) room.players.w = null;
    if (room.players.b === socketId) room.players.b = null;
    room.rematchRequests.delete(socketId);

    // Jeżeli pokój stał się pusty niszczymy go
    if (!room.players.w && !room.players.b) {
      this.rooms.delete(room.id);
      return { roomId: room.id, roomDeleted: true };
    }

    return { roomId: room.id, roomDeleted: false };
  }

  /**
   * Obsługuje prośbę o rewanż. Gdy zbierze od obojga graczy - zwraca true wymuszając zamianę barw.
   */
  requestRematch(roomId, socketId) {
    const room = this.rooms.get(roomId);
    if (!room) return { ready: false };

    room.rematchRequests.add(socketId);

    // Jeżeli dwaj gracze (lub wszyscy z obcnych jeśli jeden jakimś cudem wszedł pod dwa, ale upewniamy się że obaj wyrazili chęć)
    const p1 = room.players.w;
    const p2 = room.players.b;

    if (p1 && p2 && room.rematchRequests.has(p1) && room.rematchRequests.has(p2)) {
      // Wyzeruj requests
      room.rematchRequests.clear();
      
      // Zamień graczy
      room.players.w = p2;
      room.players.b = p1;
      
      // Zainicjuj silnik na nowo!
      room.engine = new BlindChessEngine();
      return { ready: true };
    }

    return { ready: false, notifyOpponent: true };
  }

  /**
   * Inicjalizuje silnik po skompletowaniu pokoju.
   */
  initEngine(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    
    room.engine = new BlindChessEngine();
    return true;
  }

  /**
   * Publikuje stan gry (Krok 3 - Fog Of War Filter) 
   * indywidualnie do gracza białego i gracza czarnego.
   */
  broadcastGameState(roomId, io) {
    const room = this.rooms.get(roomId);
    if (!room || !room.engine) return;

    // Perspektywa Bieli
    if (room.players.w) {
      const { board, visibleSquares } = room.engine.getVisibleBoard(COLORS.WHITE, false);
      const payloadWhite = {
        board,
        visibleSquares: Array.from(visibleSquares), // Sockets prefer Arrays over Sets
        currentTurn: room.engine.getCurrentTurn(),
        whiteLives: room.engine.getKingLives(COLORS.WHITE),
        blackLives: room.engine.getKingLives(COLORS.BLACK),
        whiteCaptured: room.engine.getCapturedPieces()[COLORS.WHITE],
        blackCaptured: room.engine.getCapturedPieces()[COLORS.BLACK],
        gameResult: room.engine.getGameResult(),
        inCheck: room.engine.chess.inCheck() && room.engine.getCurrentTurn() === COLORS.WHITE,
      };
      
      // Opcja A: Dołączamy zbiór legalnych ruchów dla widocznych białych bierek
      const legalMovesMap = {};
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const piece = room.engine.chess.board()[r][c];
          if (piece && piece.color === COLORS.WHITE) {
            const sq = `${String.fromCharCode(97 + c)}${8 - r}`;
            legalMovesMap[sq] = room.engine.getLegalMoves(sq);
          }
        }
      }
      payloadWhite.legalMoves = legalMovesMap;

      io.to(room.players.w).emit('updateBoard', payloadWhite);
    }

    // Perspektywa Czerni
    if (room.players.b) {
      const { board, visibleSquares } = room.engine.getVisibleBoard(COLORS.BLACK, false);
      const payloadBlack = {
        board,
        visibleSquares: Array.from(visibleSquares),
        currentTurn: room.engine.getCurrentTurn(),
        blackLives: room.engine.getKingLives(COLORS.BLACK),
        whiteLives: room.engine.getKingLives(COLORS.WHITE),
        whiteCaptured: room.engine.getCapturedPieces()[COLORS.WHITE],
        blackCaptured: room.engine.getCapturedPieces()[COLORS.BLACK],
        gameResult: room.engine.getGameResult(),
        inCheck: room.engine.chess.inCheck() && room.engine.getCurrentTurn() === COLORS.BLACK,
      };

      // Opcja A: legal moves
      const legalMovesMap = {};
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const piece = room.engine.chess.board()[r][c];
          if (piece && piece.color === COLORS.BLACK) {
            const sq = `${String.fromCharCode(97 + c)}${8 - r}`;
            legalMovesMap[sq] = room.engine.getLegalMoves(sq);
          }
        }
      }
      payloadBlack.legalMoves = legalMovesMap;

      io.to(room.players.b).emit('updateBoard', payloadBlack);
    }
  }
}
