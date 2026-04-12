/**
 * App — Root Component
 * 
 * Assembles the Blind Chess game: Board, GameInfo, Controls, Notifications.
 */

import useBlindChess from './hooks/useBlindChess.js';
import Board from './components/Board/Board.jsx';
import GameInfo from './components/GameInfo/GameInfo.jsx';
import Controls from './components/Controls/Controls.jsx';
import Notifications from './components/Notifications/Notifications.jsx';
import './styles/index.css';
import './styles/animations.css';
import { useState } from 'react';

export default function App() {
  const {
    board,
    visibleSquares,
    currentTurn,
    whiteLives,
    blackLives,
    capturedPieces,
    moveLog,
    gameResult,
    inCheck,
    kingSquare,
    observerBeamSquares,
    radarSquares,
    flashReveal,
    selectedSquare,
    legalMoves,
    notifications,
    lastMove,
    gameAlert,
    handleSquareClick,
    handleNewGame,
    // Network props
    isConnected,
    lobbyError,
    roomId,
    myColor,
    role,
    isSpectator,
    matchStarted,
    isCreator,
    rematchStatus,
    createRoom,
    joinRoom,
    requestRematch,
    leaveRoom
  } = useBlindChess();

  const [joinCode, setJoinCode] = useState('');
  const [prefColor, setPrefColor] = useState('random');

  if (!matchStarted) {
    return (
      <div className="app">
        <header className="app__header">
          <h1 className="app__title" onClick={leaveRoom} style={{ cursor: isConnected ? 'pointer' : 'default' }}>
            <span className="text-gradient">♟ Blind Chess</span>
            <span className="app__subtitle">Multiplayer</span>
          </h1>
        </header>
        <main className="app__main" style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: '2rem', height: '60vh' }}>
          {!isConnected ? (
            <h2 style={{ color: '#aaa' }}>Łączenie z serwerem...</h2>
          ) : roomId ? (
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ color: 'white', marginBottom: '1rem' }}>Lobby: <span style={{ color: '#4ade80' }}>{roomId}</span></h2>
              <p style={{ color: '#aaa' }}>Oczekiwanie na dołączenie drugiego gracza...</p>
              <br />
              <p style={{ color: '#777' }}>Przekaż ten kod znajomemu.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '320px', background: '#1a1a1a', padding: '2rem', borderRadius: '12px', border: '1px solid #333' }}>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <h3 style={{ margin: 0, color: 'white', fontSize: '1.1rem' }}>Stwórz nowy pokój</h3>
                <select
                  value={prefColor}
                  onChange={(e) => setPrefColor(e.target.value)}
                  style={{ padding: '0.5rem', background: '#222', color: 'white', border: '1px solid #444', borderRadius: '4px' }}
                >
                  <option value="random">Kolor: Losowy</option>
                  <option value="w">Kolor: Białe</option>
                  <option value="b">Kolor: Czarne</option>
                </select>
                <button className="controls__btn" style={{ background: 'linear-gradient(135deg, #4ade80, #16a34a)' }} onClick={() => createRoom(prefColor)}>
                  Generuj kod
                </button>
              </div>

              <div style={{ position: 'relative', margin: '0.5rem 0' }}>
                <hr style={{ borderColor: '#333', width: '100%', margin: 0 }} />
                <span style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', background: '#1a1a1a', padding: '0 10px', color: '#777', fontSize: '0.9rem' }}>LUB</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <h3 style={{ margin: 0, color: 'white', fontSize: '1.1rem' }}>Dołącz do gry</h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="KOD"
                    style={{ width: '80px', textAlign: 'center', padding: '0.5rem', background: '#111', color: 'white', border: '1px solid #444', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 'bold' }}
                    maxLength={4}
                  />
                  <button className="controls__btn" onClick={() => joinRoom(joinCode)}>
                    Dołącz
                  </button>
                </div>
              </div>

              {lobbyError && <div style={{ color: '#ff4444', fontSize: '0.9rem', textAlign: 'center', marginTop: '0.5rem', padding: '0.5rem', background: 'rgba(255,0,0,0.1)', borderRadius: '4px' }}>{lobbyError}</div>}
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title" onClick={leaveRoom} style={{ cursor: 'pointer' }}>
          <span className="text-gradient">♟ Blind Chess</span>
          <span className="app__subtitle">
            Pokój: {roomId} {isSpectator ? '' : `| Twój kolor: ${myColor === 'w' ? 'Białe' : 'Czarne'}`}
          </span>
        </h1>
      </header>

      {isSpectator && (
        <div className="spectator-banner">
          <span className="spectator-banner__text">👁️ TRYB WIDZA — Oglądasz rozgrywkę</span>
        </div>
      )}

      <main className="app__main">
        <aside className="app__sidebar app__sidebar--left">
          <GameInfo
            currentTurn={currentTurn}
            whiteLives={whiteLives}
            blackLives={blackLives}
            capturedPieces={capturedPieces}
            moveLog={moveLog}
            gameResult={gameResult}
          />
        </aside>

        <section className="app__board">
          <Board
            board={board}
            visibleSquares={visibleSquares}
            currentTurn={currentTurn}
            selectedSquare={selectedSquare}
            legalMoves={legalMoves}
            lastMove={lastMove}
            observerBeamSquares={observerBeamSquares}
            radarSquares={radarSquares}
            flashReveal={flashReveal}
            inCheck={inCheck}
            kingSquare={kingSquare}
            isSpectator={isSpectator}
            myColor={isSpectator ? 'w' : myColor}
            onSquareClick={handleSquareClick}
          />
        </section>

        <aside className="app__sidebar app__sidebar--right">
          <Controls
            onNewGame={leaveRoom}
            gameOver={gameResult !== null}
          />
        </aside>
      </main>

      {/* SYSTEM POWIADOMIEŃ O STANIE GRY (Zamiast alert()) */}
      {gameAlert && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          padding: '1.5rem 3rem',
          borderRadius: '12px',
          background: gameAlert.type === 'check'
            ? 'linear-gradient(135deg, #ff8a00, #e52e71)'
            : gameAlert.type === 'checkmate'
              ? 'linear-gradient(135deg, #8B0000, #4A0000)'
              : 'linear-gradient(135deg, #444, #222)',
          color: '#fff',
          boxShadow: gameAlert.type === 'check'
            ? '0 0 25px rgba(255, 138, 0, 0.6)'
            : '0 0 35px rgba(0,0,0,0.8)',
          textAlign: 'center',
          animation: 'slideDownFade 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
          border: '1px solid rgba(255,255,255,0.1)',
          pointerEvents: gameAlert.type === 'check' ? 'none' : 'auto'
        }}>
          <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: '800', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
            {gameAlert.type === 'check' ? '⚠️ SZACH!' : gameAlert.type === 'checkmate' ? '💀 MAT!' : '🤝 REMIS'}
          </h2>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '1.1rem', opacity: 0.9 }}>
            {gameAlert.message}
          </p>

          {gameAlert.type !== 'check' && (
            <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {isSpectator ? (
                <button className="controls__btn" style={{ background: '#ef4444', width: 'auto', padding: '0 40px', alignSelf: 'center' }} onClick={leaveRoom}>
                  Wyjdź z pokoju
                </button>
              ) : rematchStatus === 'offered' ? (
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '8px' }}>
                  <p style={{ marginTop: 0, marginBottom: '10px', fontWeight: 'bold' }}>Przeciwnik prosi o rewanż!</p>
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                    <button className="controls__btn" style={{ background: '#4ade80' }} onClick={requestRematch}>Akceptuj</button>
                    <button className="controls__btn" style={{ background: '#ef4444' }} onClick={leaveRoom}>Odrzuć i Wyjdź</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                  <button
                    className="controls__btn"
                    onClick={requestRematch}
                    disabled={rematchStatus === 'requested'}
                    style={{ opacity: rematchStatus === 'requested' ? 0.6 : 1, background: '#3b82f6', width: 'auto', padding: '0 20px' }}
                  >
                    {rematchStatus === 'requested' ? 'Oczekiwanie...' : 'Poproś o rewanż'}
                  </button>
                  <button className="controls__btn" style={{ background: '#ef4444', width: 'auto', padding: '0 20px' }} onClick={leaveRoom}>
                    Wyjdź z pokoju
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Globalne modale zaciemnienia dla checkmate/draw */}
      {gameAlert && gameAlert.type !== 'check' && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)',
          zIndex: 9998,
          pointerEvents: 'none',
          animation: 'fadeIn 1s ease forwards'
        }} />
      )}

      <Notifications notifications={notifications} />
    </div>
  );
}
