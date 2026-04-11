/**
 * Dummy AI Placeholder
 * 
 * Stub module for future AI opponent implementation.
 * Currently only provides the interface and a random-move fallback.
 */

/**
 * Get a random legal move from the engine.
 * Uses the BlindChessEngine's own legal move computation.
 * 
 * @param {import('./BlindChessEngine.js').BlindChessEngine} engine 
 * @returns {{ from: string, to: string } | null}
 */
export function getRandomLegalMove(engine) {
  const board = engine.getFullBoard();
  const color = engine.getCurrentTurn();
  const allMoves = [];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.color === color) {
        const square = piece.square;
        const moves = engine.getLegalMoves(square);
        for (const target of moves) {
          allMoves.push({ from: square, to: target });
        }
      }
    }
  }

  if (allMoves.length === 0) return null;

  const randomIndex = Math.floor(Math.random() * allMoves.length);
  return allMoves[randomIndex];
}
