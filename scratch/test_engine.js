import { BlindChessEngine } from '../server/engine/BlindChessEngine.js';
import { COLORS } from '../server/config/constants.js';

async function testObserver() {
  const engine = new BlindChessEngine();
  
  // 1. Manually add an observer (as a Queen in chess.js)
  // Promotion would happen normally, but let's test the move logic
  engine.chess.clear(); // Clear board for simple test
  engine.chess.put({ type: 'k', color: 'w' }, 'e1');
  engine.chess.put({ type: 'k', color: 'b' }, 'e8');
  engine.chess.put({ type: 'q', color: 'w' }, 'd1'); // The observer
  engine.observerSquares.add('d1');
  
  console.log('--- TEST 1: Ruch Obserwatora na puste pole ---');
  const res1 = engine.makeMove('d1', 'd7');
  console.log('Success:', res1.success);
  console.log('Current Turn:', engine.getCurrentTurn()); // Should be 'b'
  console.log('In Check:', engine.chess.inCheck()); // Black should be in check from d7
  
  if (res1.success && engine.chess.inCheck()) {
    console.log('PASSED: Obserwator zajął pole i szachuje.');
  } else {
    console.log('FAILED: Coś nie tak z d7.');
  }

  console.log('\n--- TEST 2: Zakaz bicia przez Obserwatora ---');
  // Back to white's turn for test
  engine.chess.load('4k3/3q4/8/8/8/8/8/4K3 w - - 0 1');
  engine.observerSquares.clear();
  engine.observerSquares.add('d7');
  
  // Attempt to capture black king (just for test)
  const res2 = engine.makeMove('d7', 'e8');
  console.log('Success (expected false):', res2.success);
  if (!res2.success) {
    console.log('PASSED: Obserwator nie może bić.');
  } else {
    console.log('FAILED: Obserwator zbijał!');
  }

  console.log('\n--- TEST 3: Mat Obserwatorem ---');
  // Fool's Mate equivalent with Observer
  engine.chess.load('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3');
  // Let's pretend h4 is an observer
  engine.observerSquares.clear();
  engine.observerSquares.add('h4');
  
  console.log('Is Checkmate:', engine.chess.isCheckmate());
  if (engine.chess.isCheckmate()) {
    console.log('PASSED: Obserwator (jako Queen) poprawnie matuje.');
  } else {
    console.log('FAILED: Brak mata.');
  }
}

testObserver().catch(console.error);
