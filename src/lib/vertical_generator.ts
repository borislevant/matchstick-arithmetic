import { type Puzzle, type Glyph, DIGITS, bits, encodeSolution, layout, applyMove, trueEquation, evaluate, decode } from './engine';
import { verticalSpecToExpression, type VerticalSpec } from './vertical';
import verifyPuzzle from './verifier';

type RNG = { next: () => number };
function makeRng(seed = 1): RNG {
  let s = seed >>> 0;
  return { next: () => (s = Math.imul(1664525, s) + 1013904223) >>> 0 };
}
function rnd(rng: RNG, n: number) { return rng.next() % n; }

export type VerticalGeneratorOptions = { seed?: number; digits?: number; operands?: number; movesAllowed?: 1 | 2; maxAttempts?: number; timeoutMs?: number };

// Build addends by choosing random digits per column and computing result with carries
function buildVerticalAddends(rng: RNG, digits: number, operands: number): VerticalSpec {
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
function scrambleSolutionToStart(solutionExpr: string, moves: number, rng: RNG, deadline: number) {
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

  for (let attempt = 0; attempt < 1000 && performance.now() < deadline; attempt++) {
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
    if (decoded && decoded.split('=').length === 2 && decoded.split('=').every(side => evaluate(side) !== null) && !trueEquation(decoded)) return { glyphs, startBoard: board };
  }
  return null;
}

// Legacy name: generates addition content on the existing horizontal board.
// A playable column layout is not implemented or exposed in this release.
export default async function generateVertical(options: VerticalGeneratorOptions = {}) {
  const seed = options.seed ?? 1;
  const rng = makeRng(seed);
  const digits = options.digits ?? 2;
  const operands = options.operands ?? 2;
  const movesAllowed = options.movesAllowed ?? 1 as 1 | 2;
  const maxAttempts = options.maxAttempts ?? 200;

  const timeoutMs = options.timeoutMs ?? 5000;
  if (!Number.isInteger(digits) || digits < 1 || digits > 2 || !Number.isInteger(operands) || operands < 2 || operands > 4 ||
      ![1, 2].includes(movesAllowed) || !Number.isInteger(maxAttempts) || maxAttempts < 0 || maxAttempts > 200 ||
      !Number.isFinite(timeoutMs) || timeoutMs < 0 || timeoutMs > 10000 || !Number.isSafeInteger(seed)) {
    throw new RangeError('Supported addition settings: 1–2 digits, 2–4 addends, 1–2 moves, up to 200 attempts and 10 seconds');
  }
  const deadline = performance.now() + timeoutMs;
  for (let attempt = 0; attempt < maxAttempts && performance.now() < deadline; attempt++) {
    const spec = buildVerticalAddends(rng, digits, operands);
    const solution = verticalSpecToExpression(spec);
    // scramble
    const scrambled = scrambleSolutionToStart(solution, movesAllowed, rng, deadline);
    if (!scrambled) continue;
    const { glyphs, startBoard } = scrambled;

    const id = `addition-v1-${seed}-${digits}-${operands}-${movesAllowed}-${attempt}`;
    const title = decode(glyphs, startBoard)!;
    const p: Puzzle = { id, title, difficulty: 'easy', pack: 'start', movesAllowed, glyphs: glyphs.map((glyph, i) => ({...glyph, initialSegments: [...startBoard[i]]})), acceptedSolutions: [solution], verificationStatus: 'unsupported', version: 1 } as Puzzle;

    const res = await verifyPuzzle(p, { timeoutMs: Math.min(2000, Math.max(0, deadline - performance.now())) });
    if (res.status === 'complete' && res.minDistance === movesAllowed) {
      p.minDistance = res.minDistance;
      p.verificationStatus = 'complete';
      p.acceptedSolutions = res.equations;
      return { puzzle: p, startBoard, solution, attempts: attempt + 1, layout: 'horizontal' as const };
    }
  }
  return null;
}
