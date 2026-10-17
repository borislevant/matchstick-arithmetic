import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import generateHorizontal from '../src/lib/generator';

describe('generator', () => {
  it('generates a verified horizontal puzzle', async () => {
    const res = await generateHorizontal({ seed: 1, digits: 1, movesAllowed: 1, maxAttempts: 50 });
    assert(res !== null, 'expected a generated puzzle');
    if (res) {
      assert(res.puzzle.verificationStatus === 'complete', 'puzzle should be verified complete');
      assert(res.puzzle.minDistance === res.puzzle.movesAllowed, 'minDistance should equal movesAllowed');
    }
  });
});
