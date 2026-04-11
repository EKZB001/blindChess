/**
 * GameInfo Component
 * 
 * Side panel showing:
 * - Player info with king lives (hearts)
 * - Captured pieces
 * - Move log
 * - Game result
 */

import { MAX_KING_LIVES, PIECE_SYMBOLS, GAME_RESULT } from '../../config/constants.js';
import './GameInfo.css';

export default function GameInfo({
  currentTurn,
  whiteLives,
  blackLives,
  capturedPieces,
  moveLog,
  gameResult,
}) {
  return (
    <div className="game-info">
      <PlayerPanel
        color="b"
        lives={blackLives}
        isActive={currentTurn === 'b'}
        capturedPieces={capturedPieces?.b || []}
      />

      {gameResult && gameResult !== GAME_RESULT.NONE && (
        <GameResult result={gameResult} />
      )}

      <MoveLog entries={moveLog} />

      <PlayerPanel
        color="w"
        lives={whiteLives}
        isActive={currentTurn === 'w'}
        capturedPieces={capturedPieces?.w || []}
      />
    </div>
  );
}

function PlayerPanel({ color, lives, isActive, capturedPieces }) {
  const name = color === 'w' ? 'Białe' : 'Czarne';

  return (
    <div className={`game-info__player ${isActive ? 'game-info__player--active' : ''}`}>
      <div className="game-info__player-header">
        <span className="game-info__player-name">
          <span className={`game-info__player-dot game-info__player-dot--${color === 'w' ? 'white' : 'black'}`} />
          {name}
        </span>
        <LivesDisplay lives={lives} />
      </div>

      <div className="game-info__captured">
        {capturedPieces.map((piece, i) => (
          <span key={i} className="game-info__captured-piece">
            {PIECE_SYMBOLS[piece.color]?.[piece.type] || '?'}
          </span>
        ))}
      </div>
    </div>
  );
}

function LivesDisplay({ lives }) {
  const hearts = [];
  for (let i = 0; i < MAX_KING_LIVES; i++) {
    hearts.push(
      <span
        key={i}
        className={`game-info__life ${i < lives ? 'game-info__life--full' : 'game-info__life--empty'}`}
      >
        ♥
      </span>
    );
  }

  return <div className="game-info__lives">{hearts}</div>;
}

function MoveLog({ entries }) {
  if (!entries || entries.length === 0) return null;

  return (
    <div className="game-info__log">
      <div className="game-info__log-title">Historia ruchów</div>
      {entries.slice(-20).map((entry, i) => {
        const prefix = entry.color === 'w' ? 'B' : 'C';
        const arrow = entry.captured ? '×' : '→';
        const label = entry.blindShot ? ' ⚡' : '';
        const cls = entry.captured
          ? 'game-info__log-entry game-info__log-entry--capture'
          : entry.blindShot
            ? 'game-info__log-entry game-info__log-entry--blind-shot'
            : 'game-info__log-entry';

        return (
          <div key={i} className={cls}>
            {prefix}: {entry.from} {arrow} {entry.to}{label}
          </div>
        );
      })}
    </div>
  );
}

function GameResult({ result }) {
  const resultMap = {
    [GAME_RESULT.WHITE_WINS]: { text: '♔ Białe wygrywają! Mat!', cls: 'win' },
    [GAME_RESULT.BLACK_WINS]: { text: '♚ Czarne wygrywają! Mat!', cls: 'win' },
    [GAME_RESULT.WHITE_KING_DEAD]: { text: '💀 Biały król zestrzelony!', cls: 'loss' },
    [GAME_RESULT.BLACK_KING_DEAD]: { text: '💀 Czarny król zestrzelony!', cls: 'loss' },
    [GAME_RESULT.DRAW_STALEMATE]: { text: '🤝 Remis — Pat', cls: 'draw' },
    [GAME_RESULT.DRAW_INSUFFICIENT]: { text: '🤝 Remis — Brak materiału', cls: 'draw' },
  };

  const info = resultMap[result] || { text: 'Gra zakończona', cls: 'draw' };

  return (
    <div className={`game-info__result game-info__result--${info.cls}`}>
      {info.text}
    </div>
  );
}
