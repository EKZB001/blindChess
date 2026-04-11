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
  onEndTurn,
  onNewGame,
  godMode,
  onToggleGodMode,
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

      <div
        id="toggle-god-mode"
        className={`controls__toggle controls__toggle--god-mode ${godMode ? 'controls__toggle--active' : ''}`}
        onClick={onToggleGodMode}
        role="switch"
        aria-checked={godMode}
        tabIndex={0}
      >
        <span className="controls__toggle-label">
          👁 Tryb Boga
        </span>
        <span className="controls__toggle-switch" />
      </div>

      <div className="controls__divider" />

      <button
        id="btn-new-game"
        className="controls__btn controls__btn--new-game"
        onClick={onNewGame}
      >
        ♟ Nowa Gra
      </button>
    </div>
  );
}
