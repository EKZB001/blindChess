/**
 * Controls Component
 * 
 * Game controls panel:
 * - End Turn button (glows when player has moved)
 * - God Mode toggle
 * - New Game button
 * - (Future) AI toggle placeholder
 */

import './Controls.css';

export default function Controls({
  onNewGame,
  gameOver,
  hasMoved,
}) {
  // endTurnClasses removed since the button was removed

  return (
    <div className="controls">
      {hasMoved ? (
        <div className="controls__hint controls__hint--pulse">
          Przekazywanie tury przeciwnikowi...
        </div>
      ) : (
        <div className="controls__hint controls__hint--subtle">
          {!gameOver ? "Wybierz bierkę i wykonaj ruch" : ""}
        </div>
      )}

      <div className="controls__divider" />

      <div className="controls__divider" />

      <button
        id="btn-new-game"
        className="controls__btn controls__btn--new-game"
        onClick={onNewGame}
      >
        ♟ Wyjdź z pokoju
      </button>
    </div>
  );
}
