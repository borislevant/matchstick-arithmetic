import { test } from 'node:test';
import assert from 'node:assert/strict';
import generateHorizontal from '../src/lib/generator';
import { checkGenerated } from './generated-puzzle-check';

test('generated horizontal puzzles round-trip through catalog, gameplay, hints and verifier', async () => {
  for (const settings of [{seed:1,digits:1,movesAllowed:1 as const}, {seed:7,digits:2,movesAllowed:1 as const}, {seed:12,digits:1,movesAllowed:2 as const}]) {
    const result = await generateHorizontal(settings);
    assert(result, `expected supported settings to generate a puzzle: ${JSON.stringify(settings)}`);
    await checkGenerated(result.puzzle);
    assert.deepEqual(result.startBoard, result.puzzle.glyphs.map(g=>g.initialSegments));
  }
});

test('seed and settings reproduce identical puzzles including their IDs', async () => {
  const options={seed:1,digits:1,movesAllowed:1 as const};
  assert.deepEqual(await generateHorizontal(options), await generateHorizontal(options));
});

test('unsupported horizontal settings reject and exhausted requests do not change settings', async () => {
  for (const options of [{operands:3}, {digits:0}, {digits:3}, {maxAttempts:-1}, {timeoutMs:Infinity}]) {
    await assert.rejects(generateHorizontal(options), RangeError);
  }
  assert.equal(await generateHorizontal({digits:2,maxAttempts:0}), null);
  assert.equal(await generateHorizontal({timeoutMs:0}), null);
});
