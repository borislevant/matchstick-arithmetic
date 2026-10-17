import { type Puzzle, type Glyph, DIGITS, bits, encodeSolution, layout, applyMove, trueEquation, decode } from './engine';
import { verticalSpecToExpression, verticalSpecToGlyphs, VerticalSpec } from './vertical';
import verifyPuzzle from './verifier';

type RNG = { next: () => number };
function makeRng(seed = 1): RNG {
  let s = seed >>> 0;
  return { next: () => (s = Math.imul(1664525, s) + 1013904223) >>> 0 };
}
function rnd(rng: RNG, n: number) { return rng.next() % n; }

export type VerticalGeneratorOptions = { seed?: number; digits?: number; operands?: number; movesAllowed?: 1 | 2; maxAttempts?: number };

// Build addends by choosing random digits per column and computing result with carries
function buildVerticalAddends(rng: RNG, digits: number, operands: number): VerticalSpec {
  // currently support 2 operands only
  operands = Math.max(2, Math.min(operands, 4));
  const addendDigits: number[][] = Array.from({ length: operands }, () => Array(digits).fill(0));
  // fill digits from least significant (0) to most
  for (let col = 0; col < digits; col++) {
    for (let op = 0; op < operands; op++) {
      addendDigits[op][col] = rnd(rng, 10);
    }
  }
  // compute result digits with carries
  const resultDigits: number[] = Array(digits).fill(0);
  let carry = 0;
  for (let col = 0; col < digits; col++) {
    const sum = carry + addendDigits.reduce((s, a) => s + a[col], 0);
    resultDigits[col] = sum % 10;
    carry = Math.floor(sum / 10);
  }
  // if final carry remains, append as new most-significant digit
  let resultNum = 0;
  for (let i = digits - 1; i >= 0; i--) resultNum = resultNum * 10 + resultDigits[i];
  if (carry > 0) {
    resultNum = Number(String(carry) + String(resultNum).padStart(digits, '0'));
  }
  const addends = addendDigits.map(arr => {
    let n = 0;
    for (let i = digits - 1; i >= 0; i--) n = n * 10 + arr[i];
    return n;
  });
  return { addends, result: resultNum, digits };
}

// Try moving `moves` sticks on the solution board to produce a readable but incorrect start.
function scrambleSolutionToStart(solutionExpr: string, moves: number, rng: RNG) {
  const glyphs = (function exprToGlyphs(expr: string): Glyph[] {
    const g: Glyph[] = [];
    for (const ch of expr) {
      if (/\d/.test(ch)) g.push({ type: 'digit', initialSegments: bits(DIGITS[Number(ch)]) });
      else if (ch === '+') g.push({ type: 'plus', initialSegments: bits('11') });
      else if (ch === '-') g.push({ type: 'minus', initialSegments: bits('10') });
      else if (ch === '=') g.push({ type: 'equals', initialSegments: bits('11') });
      else if (ch === '×' || ch === 'x' || ch === '*') g.push({ type: 'times', initialSegments: bits('11') });
    }
    return g;
  })(solutionExpr);

  const solutionBoard = encodeSolution({ glyphs } as Puzzle, solutionExpr);
  let board = solutionBoard.map(row => [...row]);
  const slots = layout(glyphs).slots;

  for (let attempt = 0; attempt < 1000; attempt++) {
    board = solutionBoard.map(row => [...row]);
    let ok = true;
    for (let m = 0; m < moves; m++) {
      const occupied = slots.filter(s => board[s.glyph]?.[s.segment]);
      const empty = slots.filter(s => !board[s.glyph]?.[s.segment]);
      if (occupied.length === 0 || empty.length === 0) { ok = false; break; }
      const from = occupied[rnd(rng, occupied.length)];
      const candidates = empty.filter(e => e.length === from.length && (((from.angle - e.angle) % 180) + 180) % 180 === 0);
      if (candidates.length === 0) { ok = false; break; }
      const to = candidates[rnd(rng, candidates.length)];
      const move = { from: { glyph: from.glyph, segment: from.segment }, to: { glyph: to.glyph, segment: to.segment } };
      const next = applyMove(board, move, glyphs as Glyph[]);
      if (!next) { ok = false; break; }
      board = next;
    }
    if (!ok) continue;
    const decoded = decode(glyphs, board);
    if (decoded && !trueEquation(decoded)) return { glyphs, startBoard: board };
  }
  // deterministic search
  const glyphsLocal = glyphs;
  const solutionBoardLocal = solutionBoard;
  const slotsLocal = layout(glyphsLocal).slots;
  const occupied = slotsLocal.filter(s => solutionBoardLocal[s.glyph]?.[s.segment]);
  const empty = slotsLocal.filter(s => !solutionBoardLocal[s.glyph]?.[s.segment]);
  if (moves === 1) {
    for (const from of occupied) {
      for (const to of empty) {
        if (from.length !== to.length) continue;
        if ((((from.angle - to.angle) % 180) + 180) % 180 !== 0) continue;
        const mv = { from: { glyph: from.glyph, segment: from.segment }, to: { glyph: to.glyph, segment: to.segment } };
        const next = applyMove(solutionBoardLocal.map(r => [...r]), mv, glyphsLocal as Glyph[]);
        if (!next) continue;
        const decoded = decode(glyphsLocal, next);
        if (decoded && !trueEquation(decoded)) return { glyphs: glyphsLocal, startBoard: next };
      }
    }
  }
  if (moves === 2) {
    for (const from1 of occupied) {
      for (const to1 of empty) {
        if (from1.length !== to1.length) continue;
        if ((((from1.angle - to1.angle) % 180) + 180) % 180 !== 0) continue;
        const mv1 = { from: { glyph: from1.glyph, segment: from1.segment }, to: { glyph: to1.glyph, segment: to1.segment } };
        const b1 = applyMove(solutionBoardLocal.map(r => [...r]), mv1, glyphsLocal as Glyph[]);
        if (!b1) continue;
        const occupied2 = slotsLocal.filter(s => b1[s.glyph]?.[s.segment]);
        const empty2 = slotsLocal.filter(s => !b1[s.glyph]?.[s.segment]);
        for (const from2 of occupied2) {
          for (const to2 of empty2) {
            if (from2.length !== to2.length) continue;
            if ((((from2.angle - to2.angle) % 180) + 180) % 180 !== 0) continue;
            const mv2 = { from: { glyph: from2.glyph, segment: from2.segment }, to: { glyph: to2.glyph, segment: to2.segment } };
            const next = applyMove(b1.map(r=>[...r]), mv2, glyphsLocal as Glyph[]);
            if (!next) continue;
            const decoded = decode(glyphsLocal, next);
            if (decoded && !trueEquation(decoded)) return { glyphs: glyphsLocal, startBoard: next };
          }
        }
      }
    }
  }
  return null;
}

export default async function generateVertical(options: VerticalGeneratorOptions = {}) {
  const rng = makeRng(options.seed ?? Date.now());
  const digits = options.digits ?? 2;
  const operands = options.operands ?? 2;
  const movesAllowed = options.movesAllowed ?? 1 as 1 | 2;
  const maxAttempts = options.maxAttempts ?? 200;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const spec = buildVerticalAddends(rng, digits, operands);
    const solution = verticalSpecToExpression(spec);
    // scramble
    const scrambled = scrambleSolutionToStart(solution, movesAllowed, rng);
    if (!scrambled) continue;
    const { glyphs, startBoard } = scrambled;

    const id = `vgen-${Date.now()}-${attempt}`;
    const title = solution;
    const p: Puzzle = { id, title, difficulty: 'easy', pack: 'start', movesAllowed, glyphs, acceptedSolutions: [solution], minDistance: movesAllowed, verificationStatus: 'unsupported', version: 1 } as Puzzle;

    const res = await verifyPuzzle(p, { timeoutMs: 3000, startBoard });
    if (res.status === 'complete' && res.minDistance === movesAllowed) {
      p.verificationStatus = 'complete';
      return { puzzle: p, startBoard, solution, attempts: attempt + 1 };
    }
  }
  return null;
}
