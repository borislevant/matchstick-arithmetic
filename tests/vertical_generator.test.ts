import { test } from 'node:test';
import assert from 'node:assert/strict';
import generateVertical from '../src/lib/vertical_generator';
import { checkGenerated } from './generated-puzzle-check';

test('addition candidates are playable horizontal puzzles and explicitly declare their layout', async () => {
  const options={seed:42,digits:2,operands:2,movesAllowed:1 as const};
  const result = await generateVertical(options);
  assert(result);
  assert.equal(result.layout, 'horizontal');
  await checkGenerated(result.puzzle);
  assert.deepEqual(result.startBoard, result.puzzle.glyphs.map(g=>g.initialSegments));
  assert.deepEqual(result, await generateVertical(options));
});

test('addition generator rejects unsupported requests without silently clamping operands', async () => {
  for (const options of [{operands:1}, {operands:5}, {digits:0}, {digits:3}, {maxAttempts:-1}]) {
    await assert.rejects(generateVertical(options), RangeError);
  }
  assert.equal(await generateVertical({maxAttempts:0}),null);
  assert.equal(await generateVertical({timeoutMs:0}),null);
});
