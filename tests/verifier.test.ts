import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { puzzles } from '../src/data/puzzles';
import verifyPuzzle from '../src/lib/verifier';

// Pick a puzzle that's known to be solvable within its movesAllowed (first puzzle)
const sample = puzzles[0];

describe('verifier', () => {
  it('computes minDistance and enforces exact-move policy for a sample puzzle', async () => {
    const res = await verifyPuzzle(sample, { timeoutMs: 2000 });
    assert(res.minDistance !== undefined, 'minDistance should be computed');
    assert.equal(res.minDistance, sample.movesAllowed, 'minDistance must equal puzzle.movesAllowed');
    assert(res.status === 'complete', `expected status 'complete' but got ${res.status}`);
  });
});
