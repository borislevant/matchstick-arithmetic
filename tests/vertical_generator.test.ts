import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import generateVertical from '../src/lib/vertical_generator';

describe('vertical generator', () => {
  it('generates a verified vertical puzzle', async () => {
    const res = await generateVertical({ seed: 42, digits: 2, operands: 2, movesAllowed: 1, maxAttempts: 100 });
    assert(res !== null, 'expected a generated puzzle');
    if (res) {
      assert(res.puzzle.verificationStatus === 'complete', 'puzzle should be verified complete');
      assert(res.puzzle.minDistance === res.puzzle.movesAllowed, 'minDistance should equal movesAllowed');
    }
  });
});
