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
    // Jeżeli wysyłaliśmy callback jako pierwszy argument (wcześniejsza struktura), trzeba pomyślec o failback.
    // Teraz z forntendu będzie to options: { preferredColor: string }, callback: func
    let prefColor = 'w';
    let cb = callback;
    if (typeof options === 'function') {
      cb = options;
    } else if (options && options.preferredColor) {
      prefColor = options.preferredColor;
    }

    // Profilaktycznie weryfikujemy: jeden socket powinen być tylko w jednym pokoju gry na raz
    if (roomManager.getRoomBySocket(socket.id)) {
       if (typeof cb === 'function') cb({ success: false, reason: 'Znajdujesz się już w pokoju.' });
       return;
    }

    const { room, color } = roomManager.createRoom(socket.id, prefColor);
    socket.join(room.id);
    
    console.log(`[Room] Pokój utworzony: ${room.id} przez ${socket.id} (preferowany kolor: ${color})`);
    
    // Zwrócenie wygenerowanego kodu dla frontend-u
    if (typeof cb === 'function') {
      cb({ success: true, roomId: room.id, color });
    }
  });

  // 2. Zdarzenie dołączenia do pokoju
  socket.on('joinRoom', (roomId, callback) => {
    // Normalizacja - zamieniamy na duże litery na wypadek pomyłki gracza podczas wpisywania
    const normalizedRoomId = String(roomId).toUpperCase();

    const result = roomManager.joinRoom(normalizedRoomId, socket.id);
    
    if (!result.success) {
      if (typeof callback === 'function') {
        callback({ success: false, reason: result.reason });
      }
      return;
    }

    socket.join(normalizedRoomId);
    console.log(`[Room] Gracz ${socket.id} dołączył do pokoju ${normalizedRoomId} jako kolor ${result.color}`);

    if (typeof callback === 'function') {
      callback({ success: true, roomId: normalizedRoomId, color: result.color });
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
    const isWhite = socket.id === room.players.w;
    const isBlack = socket.id === room.players.b;

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

  // Zdarzenie wyjścia z pokoju (dobrowolne)
  socket.on('leaveRoom', (roomId) => {
    // Używamy zunifkowanej funkcji disconnect logic pod spodem
    handlePlayerDisconnect(socket);
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
      if (room.players.w) io.to(room.players.w).emit('gameRestarted', { color: 'w', message: 'Rewanż zaakceptowany. Grasz Białymi!' });
      if (room.players.b) io.to(room.players.b).emit('gameRestarted', { color: 'b', message: 'Rewanż zaakceptowany. Grasz Czarnymi!' });
      
      // Wyślij czystą planszę z nowej instancji
      roomManager.broadcastGameState(roomId, io);
    } else if (result.notifyOpponent) {
      // Wyślij do drugiego gracza powiadomienie z opcją na akceptację
      socket.to(roomId).emit('rematchOffered', { message: 'Przeciwnik prosi o rewanż!' });
    }
  });

  // Odłączenie
  socket.on('disconnect', () => {
    console.log(`[Socket] Klient rozłączony: ${socket.id}`);
    handlePlayerDisconnect(socket);
  });

  function handlePlayerDisconnect(s) {
    const result = roomManager.removePlayer(s.id);
    
    if (result) {
      // Usunięto gracza. Jak pokój nie został skasowany - powiadom pozostałego gracza (jeśli jest).
      if (!result.roomDeleted) {
        io.to(result.roomId).emit('opponentDisconnected', { 
           message: 'Przeciwnik opuścił pokój.' 
        });
      }
      console.log(`[Room] Gracz usunięty z pokoju ${result.roomId}. Usunięto całkowicie pokój: ${result.roomDeleted}`);
      s.leave(result.roomId);
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
