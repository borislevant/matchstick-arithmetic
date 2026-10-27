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

it('detects an unlisted one-move answer instead of certifying a two-move shortcut', async () => {
  const puzzle = puzzles.find(p=>p.title==='1+9=7')!;
  const result = await verifyPuzzle(puzzle);
  assert.equal(result.status,'incomplete');
  assert.equal(result.reason,'minDistance-mismatch');
  assert.equal(result.minDistance,1);
  assert(result.equations.includes('1+6=7'));
});

it('reports time and state exhaustion without claiming a proven minimum', async () => {
  for (const options of [{timeoutMs:0}, {maxStates:1}]) {
    const result = await verifyPuzzle(sample,options);
    assert.equal(result.status,'incomplete');
    assert.equal(result.minDistance,undefined);
  }
});

it('matches an independent exhaustive one-move reference on small catalog fixtures', async () => {
  const { layout, initialBoard, decode, trueEquation } = await import('../src/lib/engine');
  for (const puzzle of puzzles.filter(p=>p.movesAllowed===1).slice(0,12)) {
    const start=initialBoard(puzzle);
    const slots=layout(puzzle.glyphs).slots;
    const expected=new Set<string>();
    // Do not use applyMove or the verifier traversal to compute the reference boards.
    for(const from of slots)for(const to of slots){
      if(!start[from.glyph][from.segment]||start[to.glyph][to.segment])continue;
      if(from.length!==to.length || Math.abs(from.angle-to.angle)%180!==0)continue;
      const board=start.map(row=>[...row]);
      board[from.glyph][from.segment]=false;
      board[to.glyph][to.segment]=true;
      const equation=decode(puzzle.glyphs,board);
      if(equation!==null&&trueEquation(equation))expected.add(equation);
    }
    const result=await verifyPuzzle(puzzle);
    assert.equal(result.status,'complete',puzzle.title);
    assert.deepEqual(new Set(result.equations),expected,puzzle.title);
  }
});
