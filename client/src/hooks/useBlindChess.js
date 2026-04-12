import { useState, useCallback, useEffect } from 'react';
import { io } from 'socket.io-client';
import { COLORS, GAME_RESULT, squareToCoords, coordsToSquare } from '../config/constants.js';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

export default function useBlindChess() {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lobbyError, setLobbyError] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [myColor, setMyColor] = useState(null);
  const [matchStarted, setMatchStarted] = useState(false);
  
  // Oznaczamy czy pokój był nasz, czy dołączyliśmy
  const [isCreator, setIsCreator] = useState(false);

  // Globalny alert o stanie gry (toast banner) z serwera
  const [gameAlert, setGameAlert] = useState(null);
  
  // Status rewanżu: 'none', 'requested' (ja chcę), 'offered' (przeciwnik prosi)
  const [rematchStatus, setRematchStatus] = useState('none');

  // Zamiast instancji engine lokalnego, trzymamy tylko "Głupi Terminal" danych dla renderowania
  const [boardState, setBoardState] = useState({
    board: Array(8).fill(Array(8).fill(null)),
    visibleSquares: {}, // słownik
    currentTurn: COLORS.WHITE,
    whiteLives: 5,
    blackLives: 5,
    capturedPieces: { w: [], b: [] },
    gameResult: GAME_RESULT.NONE,
    inCheck: false,
    legalMovesMap: {}, // otrzymywane z "Opcji A"
  });

  const [selectedSquare, setSelectedSquare] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [lastMove, setLastMove] = useState(null);

  // Tryb Boga usunięto zgodnie z wytycznymi bezpieczeństwa (nie ma go w multiplayer)

  // Generowanie lub pobieranie trwałej sesji z przeglądarki
  const getSessionId = useCallback(() => {
    let sid = sessionStorage.getItem('blindchess_session_id');
    if (!sid) {
       sid = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
       sessionStorage.setItem('blindchess_session_id', sid);
    }
    return sid;
  }, []);

  // Setup SocketIO
  useEffect(() => {
    const newSocket = io(SERVER_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
      setLobbyError(null);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      setMatchStarted(false);
    });

    newSocket.on('matchStarted', (data) => {
      setRoomId(data.roomId);
      setMatchStarted(true);
      setLobbyError(null);
      setNotifications(prev => [...prev, { type: 'system', message: data.message, timestamp: Date.now() }]);
      // Koniec gry to reset planszy na start
      setLastMove(null);
      setSelectedSquare(null);
      setLegalMoves([]);
      setRematchStatus('none');
      setGameAlert(null);
    });

    newSocket.on('opponentDisconnected', (data) => {
      setNotifications(prev => [...prev, { type: 'system', message: data.message, timestamp: Date.now() }]);
      setBoardState(prev => ({ ...prev, gameResult: GAME_RESULT.ABORTED }));
      setRematchStatus('none');
    });

    // --- REWANŻ ---
    newSocket.on('rematchOffered', (data) => {
      setRematchStatus('offered');
      setNotifications(prev => [...prev, { type: 'system', message: data.message, timestamp: Date.now() }]);
    });

    newSocket.on('gameRestarted', (data) => {
      // Odśwież kolor po zamianie stron
      setMyColor(data.color);
      setMatchStarted(true);
      setGameAlert(null); // Zdejmij modal końcowy
      setRematchStatus('none');
      setLastMove(null);
      setSelectedSquare(null);
      setLegalMoves([]);
      setNotifications([{ type: 'system', message: data.message, timestamp: Date.now() }]);
    });
    // --------------

    newSocket.on('updateBoard', (data) => {
      setBoardState({
        board: data.board,
        visibleSquares: data.visibleSquares, // Zachowanie w postaci obiektu (Dictionary)
        currentTurn: data.currentTurn,
        whiteLives: data.whiteLives,
        blackLives: data.blackLives,
        capturedPieces: { w: data.whiteCaptured, b: data.blackCaptured },
        gameResult: data.gameResult,
        inCheck: data.inCheck,
        legalMovesMap: data.legalMoves,
      });
    });

    newSocket.on('gameAlert', (data) => {
      setGameAlert(data);
      // Auto zniknięcie powiadomienia typu "check", 
      // Mat (checkmate) i Remis (draw) zostają na ekranie na stałe
      if (data.type === 'check') {
        setTimeout(() => setGameAlert(null), 3500);
      }
    });
    
    newSocket.on('moveInvalid', (data) => {
      if (data.notifications) {
        setNotifications(data.notifications);
      } else if (data.message) {
        setNotifications([{ type: 'error', message: data.message, timestamp: Date.now(), color: 'system' }]);
      }
      setSelectedSquare(null);
      setLegalMoves([]);
    });

    return () => newSocket.close();
  }, []);

  const createRoom = useCallback((preferredColor = 'w') => {
    if (!socket) return;
    const sessionId = getSessionId();
    socket.emit('createRoom', { preferredColor, sessionId }, (res) => {
      if (res.success) {
        setRoomId(res.roomId);
        setMyColor(res.color);
        setIsCreator(true);
        setLobbyError(null);
      } else {
        setLobbyError(res.reason);
      }
    });
  }, [socket, getSessionId]);

  const joinRoom = useCallback((id) => {
    if (!socket || !id) return;
    const sessionId = getSessionId();
    socket.emit('joinRoom', { roomId: id, sessionId }, (res) => {
      if (res.success) {
        setRoomId(res.roomId);
        setMyColor(res.color);
        setIsCreator(false);
        setLobbyError(null);
      } else {
        setLobbyError(res.reason);
      }
    });
  }, [socket, getSessionId]);

  const requestRematch = useCallback(() => {
    if (!socket || !roomId) return;
    setRematchStatus('requested');
    socket.emit('requestRematch', { roomId });
  }, [socket, roomId]);

  const leaveRoom = useCallback(() => {
    if (!socket || !roomId) return;
    socket.emit('leaveRoom', roomId);
    // Powrót do menu
    setMatchStarted(false);
    setRoomId(null);
    setMyColor(null);
    setIsCreator(false);
    setGameAlert(null);
    setRematchStatus('none');
    setBoardState(prev => ({ ...prev, gameResult: GAME_RESULT.NONE }));
  }, [socket, roomId]);

  /** Pasywna metoda odpytująca mapę - krok 3 (Opcja A) */
  const handleSquareClick = useCallback((square) => {
    if (boardState.gameResult !== GAME_RESULT.NONE) return;
    
    // Jeżeli nasza kolej nie trwa, a klikamy cokolwiek, ignoruj lub wybierz figurę na zaś jeśli system pozwala,
    // ale lepiej blokować jeśli w MP ma sens całkowity "turn lock". Zróbmy tak długo jak trwa ruch:
    if (boardState.currentTurn !== myColor) {
      return;
    }

    const { row, col } = squareToCoords(square);
    const clickedPiece = boardState.board[row][col];

    // Kliknięto w cel do bicia/ruchu
    if (selectedSquare && legalMoves.includes(square)) {
      // Optymistycznie zapisujemy lokalnie, ale nie psujemy weryfikacji serwera
      setLastMove({ from: selectedSquare, to: square });
      setSelectedSquare(null);
      setLegalMoves([]);
      
      // Wysyłamy do serwera (SSOT)
      socket.emit('attemptMove', { roomId, from: selectedSquare, to: square });
      return;
    }

    // Kliknięcie we własną bierkę
    if (clickedPiece && clickedPiece.color === myColor) {
      if (selectedSquare === square) {
        setSelectedSquare(null);
        setLegalMoves([]);
        return;
      }

      // Opcja A (Podgląd legalnych ruchów dostarczonych w pakiecie z Mglą Wojny)
      const cachedMoves = boardState.legalMovesMap[square] || [];
      setSelectedSquare(square);
      setLegalMoves(cachedMoves);
      return;
    }

    // W ubiegłych wersjach można było "ślepo oddać strzał" w nieistniejącą bierkę u Obserwatora! 
    // Ponieważ nasza Opcja A dodaje kropeczkę na nieodkryte pole, będzie to obsłużone wyżej w warunku legalMoves.includes(square).
    // Anuluj selekcję dla pustej podłogi.
    setSelectedSquare(null);
    setLegalMoves([]);
  }, [socket, roomId, myColor, boardState, selectedSquare, legalMoves]);

  // Te funkcje nie mają sensu w MP - godMode psuje ideę mpeg, a endTurn działa sam 
  const handleNewGame = () => { window.location.reload(); };

  // Żeby App.jsx i Board poprawnie wyświetlało mapę:
  const isViewingWhite = myColor === COLORS.WHITE;
  
  // W SSOT nie mamy radaru, paski obserwatora są dostarczane już po stronie klienta, a radar nie istnieje.
  const observerBeamSquares = new Set();
  const radarSquares = new Set();
  const flashReveal = null; 
  let kingSquare = null; 
  // Odszukiwanie własnego króla dla Check
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = boardState.board[r][c];
      if (p && p.type === 'k' && p.color === myColor) kingSquare = coordsToSquare(r, c);
    }
  }

  return {
    ...boardState,
    selectedSquare,
    legalMoves,
    notifications,
    lastMove,
    // Tryb Hotseat został usunięty, nikt nie klika "Zakończ Turę"
    hasMoved: false,
    observerBeamSquares,
    radarSquares,
    flashReveal,
    kingSquare,
    gameAlert,

    // Funkcje dla gry
    handleSquareClick,
    handleNewGame,
    
    // Sieć
    isConnected,
    lobbyError,
    roomId,
    myColor,
    matchStarted,
    isCreator,
    rematchStatus,
    createRoom,
    joinRoom,
    requestRematch,
    leaveRoom
  };
}
