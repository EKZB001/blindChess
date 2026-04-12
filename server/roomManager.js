// server/roomManager.js
/**
 * RoomManager - zarządzanie stanem pokoi dla gry multiplayer.
 */

// Wykluczyliśmy: O, 0, I, 1 zgodnie z wymogiem o ułatwieniu dyktowania.
const VALID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

import { BlindChessEngine } from './engine/BlindChessEngine.js';
import { COLORS } from './config/constants.js';
import logger from './utils/logger.js';

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
  createRoom(socketId, sessionId, preferredColor = 'w') {
    let roomId;
    // Zapobieganie unikalnej kolizji
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
        w: finalColor === 'w' ? { sessionId, socketId } : null,
        b: finalColor === 'b' ? { sessionId, socketId } : null
      },
      rematchRequests: new Set(),
      disconnectTimers: { w: null, b: null },
      engine: null
    };

    this.rooms.set(roomId, newRoom);
    return { room: newRoom, color: finalColor };
  }

  /**
   * Weryfikuje i dołącza socket do istniejącego pokoju lub obsługuje powrót (Reconnect).
   */
  joinRoom(roomId, socketId, sessionId) {
    const room = this.rooms.get(roomId);

    if (!room) {
      return { success: false, reason: 'Pokój o podanym kodzie nie istnieje.' };
    }

    // Sprawdzenie powrotu (Reconnect)
    if (room.players.w && room.players.w.sessionId === sessionId) {
      room.players.w.socketId = socketId;
      if (room.disconnectTimers.w) {
        clearTimeout(room.disconnectTimers.w);
        room.disconnectTimers.w = null;
      }
      return { success: true, room, color: 'w', reconnected: true };
    }
    if (room.players.b && room.players.b.sessionId === sessionId) {
      room.players.b.socketId = socketId;
      if (room.disconnectTimers.b) {
        clearTimeout(room.disconnectTimers.b);
        room.disconnectTimers.b = null;
      }
      return { success: true, room, color: 'b', reconnected: true };
    }

    if (room.players.w && room.players.b) {
      return { success: false, reason: 'Lobby jest już pełne (2 graczy).' };
    }

    // Przypisanie do jedynego wolnego miejsca
    let assignedColor = null;
    if (!room.players.w) {
      room.players.w = { sessionId, socketId };
      assignedColor = 'w';
    } else {
      room.players.b = { sessionId, socketId };
      assignedColor = 'b';
    }

    return { success: true, room, color: assignedColor, reconnected: false };
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  getRoomBySocket(socketId) {
    for (const room of this.rooms.values()) {
      if (room.players.w?.socketId === socketId || room.players.b?.socketId === socketId) {
        return room;
      }
    }
    return null;
  }

  // Funkcja wywoływana pod disconnect (odlicza Grace Period 60 sekund).
  // Natomiast explicit 'leaveRoom' wyrzuca gracza szybciej w index.js.
  removePlayer(socketId, forceDelete = false) {
    const room = this.getRoomBySocket(socketId);
    if (!room) return null;

    let colorLeft = null;
    if (room.players.w?.socketId === socketId) colorLeft = 'w';
    else if (room.players.b?.socketId === socketId) colorLeft = 'b';

    if (forceDelete && colorLeft) {
      room.players[colorLeft] = null;
      if (room.disconnectTimers[colorLeft]) {
        clearTimeout(room.disconnectTimers[colorLeft]);
      }
    }
    
    // Jeśli permanentnie obaj usunięci to usuwamy - logic delete depends on timers checked in index.js.
    // Zwracam referencję dla `index.js`, która sama tym zarządzi.
    return { room, colorLeft };
  }

  /**
   * Obsługuje prośbę o rewanż. Gdy zbierze od obojga graczy - zwraca true wymuszając zamianę barw.
   */
  requestRematch(roomId, socketId) {
    const room = this.rooms.get(roomId);
    if (!room) return { ready: false };

    room.rematchRequests.add(socketId);

    // Upewniamy się, że obaj gracze istnieją 
    const p1 = room.players.w?.socketId;
    const p2 = room.players.b?.socketId;

    if (p1 && p2 && room.rematchRequests.has(p1) && room.rematchRequests.has(p2)) {
      // Wyzeruj requests
      room.rematchRequests.clear();
      
      // Zamień graczy
      const temp = room.players.w;
      room.players.w = room.players.b;
      room.players.b = temp;
      
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
   * Wysyła aktualny stan gry do konkretnego gracza (Sync Request).
   */
  sendGameStateToSelectedPlayer(roomId, socketId, io) {
    const room = this.getRoom(roomId);
    if (!room || !room.engine) return;

    let color = null;
    if (room.players.w?.socketId === socketId) color = COLORS.WHITE;
    else if (room.players.b?.socketId === socketId) color = COLORS.BLACK;

    if (!color) return;

    const payload = this._prepareGameStatePayload(room, color);
    io.to(socketId).emit('updateBoard', payload);
  }

  /**
   * Pomocnicza metoda przygotowująca paczkę danych dla konkretnego koloru.
   */
  _prepareGameStatePayload(room, color) {
    const { board, visibleSquares } = room.engine.getVisibleBoard(color, false);
    
    const payload = {
      board,
      visibleSquares,
      currentTurn: room.engine.getCurrentTurn(),
      whiteLives: room.engine.getKingLives(COLORS.WHITE),
      blackLives: room.engine.getKingLives(COLORS.BLACK),
      whiteCaptured: room.engine.getCapturedPieces()[COLORS.WHITE],
      blackCaptured: room.engine.getCapturedPieces()[COLORS.BLACK],
      gameResult: room.engine.getGameResult(),
      inCheck: room.engine.chess.inCheck() && room.engine.getCurrentTurn() === color,
    };

    // Obliczamy legalne ruchy tylko dla bierek gracza
    const legalMovesMap = {};
    const fullBoard = room.engine.chess.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = fullBoard[r][c];
        if (piece && piece.color === color) {
          const sq = `${String.fromCharCode(97 + c)}${8 - r}`;
          legalMovesMap[sq] = room.engine.getLegalMoves(sq);
        }
      }
    }
    payload.legalMoves = legalMovesMap;

    return payload;
  }

  /**
   * Publikuje stan gry (Fog Of War Filter) 
   * indywidualnie do gracza białego i gracza czarnego.
   */
  broadcastGameState(roomId, io) {
    const room = this.rooms.get(roomId);
    if (!room || !room.engine) return;

    // Perspektywa Bieli
    if (room.players.w && room.players.w.socketId) {
      const payloadWhite = this._prepareGameStatePayload(room, COLORS.WHITE);
      io.to(room.players.w.socketId).emit('updateBoard', payloadWhite);
    }

    // Perspektywa Czerni
    if (room.players.b && room.players.b.socketId) {
      const payloadBlack = this._prepareGameStatePayload(room, COLORS.BLACK);
      io.to(room.players.b.socketId).emit('updateBoard', payloadBlack);
    }
  }
}
