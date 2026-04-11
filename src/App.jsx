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
    godMode,
    notifications,
    lastMove,
    hasMoved,
    handleSquareClick,
    handleEndTurn,
    toggleGodMode,
    handleNewGame,
  } = useBlindChess();

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">
          <span className="text-gradient">♟ Blind Chess</span>
          <span className="app__subtitle">Szachy we Mgle</span>
        </h1>
      </header>

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
            godMode={godMode}
            onSquareClick={handleSquareClick}
          />
        </section>

        <aside className="app__sidebar app__sidebar--right">
          <Controls
            onEndTurn={handleEndTurn}
            onNewGame={handleNewGame}
            godMode={godMode}
            onToggleGodMode={toggleGodMode}
            gameOver={gameResult !== null}
            hasMoved={hasMoved}
          />
        </aside>
      </main>

      <Notifications notifications={notifications} />
    </div>
  );
}
