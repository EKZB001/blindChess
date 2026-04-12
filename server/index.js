import dotenv from 'dotenv';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { RoomManager } from './roomManager.js';

// Absolute priority: Security. All environment variables loaded from .env.
// Żadne poufne dane nie są wpisane na sztywno.
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Basic middleware
app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());

const server = createServer(app);
const io = new Server(server, {
  pingInterval: 25000,
  pingTimeout: 60000,
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST']
  }
});

const roomManager = new RoomManager();

// Setup WebSocket connection
io.on('connection', (socket) => {
  console.log(`[Socket] Klient podłączony: ${socket.id}`);

  // 1. Zdarzenie tworzenia pokoju
  socket.on('createRoom', (options, callback) => {
    let prefColor = 'w';
    let sessionId = 'unknown';
    let cb = callback;

    if (typeof options === 'function') {
      cb = options;
    } else if (options) {
      if (options.preferredColor) prefColor = options.preferredColor;
      if (options.sessionId) sessionId = options.sessionId;
    }

    // Profilaktycznie weryfikujemy
    if (roomManager.getRoomBySocket(socket.id)) {
       if (typeof cb === 'function') cb({ success: false, reason: 'Znajdujesz się już w pokoju.' });
       return;
    }

    const { room, color } = roomManager.createRoom(socket.id, sessionId, prefColor);
    socket.join(room.id);
    
    console.log(`[Room] Pokój utworzony: ${room.id} przez ${socket.id} (preferowany kolor: ${color}, sesja: ${sessionId})`);
    
    if (typeof cb === 'function') {
      cb({ success: true, roomId: room.id, color });
    }
  });

  // 2. Zdarzenie dołączenia do pokoju
  socket.on('joinRoom', (options, callback) => {
    let roomId = options;
    let sessionId = 'unknown';
    let cb = callback;

    if (typeof options === 'object' && options !== null) {
      roomId = options.roomId;
      sessionId = options.sessionId;
    }

    const normalizedRoomId = String(roomId).toUpperCase();
    const result = roomManager.joinRoom(normalizedRoomId, socket.id, sessionId);
    
    if (!result.success) {
      if (typeof cb === 'function') {
        cb({ success: false, reason: result.reason });
      }
      return;
    }

    socket.join(normalizedRoomId);

    if (result.reconnected) {
      console.log(`[Room] Gracz powrócił do pokoju ${normalizedRoomId} (Sesja: ${sessionId}, nowy socket: ${socket.id})`);
      if (typeof cb === 'function') cb({ success: true, roomId: normalizedRoomId, color: result.color });
      
      // Powiedz klientowi, że mecz już trwa, żeby wyszedł z Lobby
      socket.emit('matchStarted', { 
        message: 'Połączono ponownie. Przywracanie partii...',
        roomId: normalizedRoomId,
      });

      roomManager.broadcastGameState(normalizedRoomId, io);
      return;
    }

    console.log(`[Room] Gracz ${socket.id} dołączył do pokoju ${normalizedRoomId} jako kolor ${result.color} (sesja: ${sessionId})`);

    if (typeof cb === 'function') {
      cb({ success: true, roomId: normalizedRoomId, color: result.color });
    }

    // Sprawdzenie, czy lobby jest pełne - w takim wypadku "mecz wystartował"
    const room = roomManager.getRoom(normalizedRoomId);
    if (room && room.players.w && room.players.b) {
      if (!room.engine) {
         roomManager.initEngine(normalizedRoomId);
      }
      
      io.to(normalizedRoomId).emit('matchStarted', { 
        message: 'Lobby pełne. Gra się rozpoczyna!',
        roomId: normalizedRoomId,
      });
      console.log(`[Room] Mecz w pokoju ${normalizedRoomId} wystartował.`);
      
      // Wyślij pierwszy cenzurowany widok do poszczególnych graczy (Krok 3)
      roomManager.broadcastGameState(normalizedRoomId, io);
    }
  });

  // 3. Wykonywanie ruchu jako SSOT (Server-Side)
  socket.on('attemptMove', ({ roomId, from, to }) => {
    const room = roomManager.getRoom(roomId);
    if (!room || !room.engine) return;

    // Sprawdzenie czyja to tura
    const isWhite = socket.id === room.players.w?.socketId;
    const isBlack = socket.id === room.players.b?.socketId;

    if (!isWhite && !isBlack) return; // Obserwatorzy bez prawa głosu?
    
    // Sprawdzenie poprawności tury
    const playerColor = isWhite ? 'w' : 'b';
    if (room.engine.getCurrentTurn() !== playerColor) {
      socket.emit('moveInvalid', { message: 'To nie twoja tura!' });
      return;
    }

    // Wykonaj ruch z użyciem zmigrowanej logiki (BlindChessEngine)
    const result = room.engine.makeMove(from, to);

    if (result.success) {
      // Automatycznie przełącz turę (zgodnie z najnowszą łatką)
      room.engine.endTurn();
      room.engine.clearFlashReveal(); // Reset błysku
    } else {
      // Odrzucenie ruchu na kliencie
      // Używamy emit na socket, ew. array powiadomień
      socket.emit('moveInvalid', { notifications: result.notifications });
    }

    // AKTUALIZACJA KROK 1: Sprawdzamy status gry dla obu graczy, niezależnie od sukcesu ruchu (bo kary za błąd też zabijają króla)
    const gameResult = room.engine.getGameResult();
    if (gameResult) {
      if (gameResult === 'white_king_dead' || gameResult === 'black_wins') {
        io.to(roomId).emit('gameAlert', { type: 'checkmate', message: 'Koniec gry! Wygrywają Czarne.' });
      } else if (gameResult === 'black_king_dead' || gameResult === 'white_wins') {
        io.to(roomId).emit('gameAlert', { type: 'checkmate', message: 'Koniec gry! Wygrywają Białe.' });
      } else if (gameResult.startsWith('draw')) {
        io.to(roomId).emit('gameAlert', { type: 'draw', message: 'Koniec gry! Mamy remis.' });
      }
    } else if (result.success && room.engine.chess.inCheck()) {
      io.to(roomId).emit('gameAlert', { type: 'check', message: `Szach! Król gracza ${isWhite ? 'Czarnego' : 'Białego'} jest bezpośrednio atakowany!` });
    }

    // Aktualizuj wszystkich graczy ocenzurowanymi widokami (Krok 3)
    roomManager.broadcastGameState(roomId, io);
  });

  // Zdarzenie wyjścia z pokoju (dobrowolne - permamentne wyrzucenie)
  socket.on('leaveRoom', (roomId) => {
    handlePlayerDisconnect(socket, true);
  });

  // Mechanika Rewanżu
  socket.on('requestRematch', ({ roomId }) => {
    const result = roomManager.requestRematch(roomId, socket.id);
    if (!result.notifyOpponent && !result.ready) return; // Np. zły pokój

    if (result.ready) {
      // Obaj gracze się zgodzili, zresetowano silnik i zamieniono sockety
      console.log(`[Room] Rewanż w pokoju ${roomId}! Zamieniam kolory.`);
      const room = roomManager.getRoom(roomId);
      
      // Powiadamiamy oba sockety indywidualnie by odświeżyły myColor
      if (room.players.w?.socketId) io.to(room.players.w.socketId).emit('gameRestarted', { color: 'w', message: 'Rewanż zaakceptowany. Grasz Białymi!' });
      if (room.players.b?.socketId) io.to(room.players.b.socketId).emit('gameRestarted', { color: 'b', message: 'Rewanż zaakceptowany. Grasz Czarnymi!' });
      
      // Wyślij czystą planszę z nowej instancji
      roomManager.broadcastGameState(roomId, io);
    } else if (result.notifyOpponent) {
      socket.to(roomId).emit('rematchOffered', { message: 'Przeciwnik prosi o rewanż!' });
    }
  });

  // Odłączenie (Network drop / Refresh)
  socket.on('disconnect', () => {
    console.log(`[Socket] Klient rozłączony: ${socket.id}`);
    handlePlayerDisconnect(socket, false);
  });

  function handlePlayerDisconnect(s, manualLeave) {
    const rmInfo = roomManager.removePlayer(s.id, manualLeave);
    
    if (rmInfo && rmInfo.room && rmInfo.colorLeft) {
      const { room, colorLeft } = rmInfo;

      if (manualLeave) {
         // Permamentne wyjście
         io.to(room.id).emit('opponentDisconnected', { message: 'Przeciwnik opuścił pokój.' });
         console.log(`[Room] Gracz jawnie opuścił pokój ${room.id}.`);
         
         // Zniszcz resztki pokoju
         room.players.w = null;
         room.players.b = null;
         roomManager.rooms.delete(room.id);
         s.leave(room.id);
      } else {
         // Grace Period: 60 sekund nim zniszczy pokój.
         console.log(`[Room] Rozpoczynam Grace Period (60s) dla utraconego gniazda w: ${room.id}`);
         
         // Ustawiamy timer:
         room.disconnectTimers[colorLeft] = setTimeout(() => {
            console.log(`[Room] Grace period upłynął dla pokoju ${room.id}. Wyrzucam gracza ${colorLeft}.`);
            // Usuwamy go permenentnie z pokoju
            room.players[colorLeft] = null;
            io.to(room.id).emit('opponentDisconnected', { message: 'Przeciwnik utracił połączenie z serwerem.' });
            
            // Jeśli pokój stał się całkowicie pusty, usuwamy go
            if (!room.players.w && !room.players.b) {
               roomManager.rooms.delete(room.id);
            }
         }, 60000);
      }
    }
  }
});

// Weryfikacyjna ścieżka zdrowia (Health Check)
app.get('/health', (req, res) => {
   res.status(200).json({ status: 'ok', message: 'Blind Chess Server is running' });
});

// Uruchomienie serwera
server.listen(PORT, () => {
  console.log(`[Serwer] Authoritative Multiplayer Server uruchomiony na porcie ${PORT}`);
});
