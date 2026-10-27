import assert from 'node:assert/strict';
import { applyMove, checkBoard, decode, initialBoard, solutionMoves, trueEquation, type Puzzle } from '../src/lib/engine';
import { setCatalog } from '../src/lib/catalog';
import verifyPuzzle from '../src/lib/verifier';

export async function checkGenerated(puzzle: Puzzle) {
  const start = initialBoard(puzzle);
  assert.equal(decode(puzzle.glyphs, start), puzzle.title);
  assert.equal(trueEquation(puzzle.title), false, 'the playable start must be false');
  setCatalog([puzzle]);
  const verification = await verifyPuzzle(puzzle);
  assert.equal(verification.status, 'complete');
  assert.equal(verification.minDistance, puzzle.movesAllowed);
  assert.deepEqual([...puzzle.acceptedSolutions].sort(), [...verification.equations].sort());
  for (let i = 0; i < verification.solutions.length; i++) {
    let board = start;
    const moves = verification.solutions[i];
    assert.equal(moves.length, puzzle.movesAllowed);
    for (const move of moves) {
      const next = applyMove(board, move, puzzle.glyphs);
      assert(next, 'every verified step must replay through the game');
      board = next;
    }
    assert.equal(checkBoard(puzzle, board, moves.length), 'solved');
  }
  assert.equal(solutionMoves(puzzle, start)?.length, puzzle.movesAllowed, 'hint and reveal path is available');
}
