import { type Puzzle, type Glyph, DIGITS, bits, encodeSolution, initialBoard, layout, applyMove, trueEquation, decode } from './engine';
import verifyPuzzle from './verifier';

type RNG = { next: () => number };
function makeRng(seed = 1): RNG {
  let s = seed >>> 0;
  return { next: () => (s = Math.imul(1664525, s) + 1013904223) >>> 0 };
}

function rnd(rng: RNG, n: number) { return rng.next() % n; }

function glyphsFromExpression(expr: string, unary = false): Glyph[] {
  const glyphs: Glyph[] = [];
  for (const ch of expr) {
    if (/\d/.test(ch)) glyphs.push({ type: 'digit', initialSegments: bits(DIGITS[Number(ch)]) });
    else if (ch === '+') glyphs.push({ type: 'plus', initialSegments: bits('11') });
    else if (ch === '-') glyphs.push({ type: 'minus', initialSegments: bits('10') });
    else if (ch === '=') glyphs.push({ type: 'equals', initialSegments: bits('11') });
    else if (ch === '×' || ch === 'x' || ch === '*') glyphs.push({ type: 'times', initialSegments: bits('11') });
  }
  if (unary) {
    // allow an optional extra minus after equals
    for (let i = 0; i < glyphs.length; i++) {
      if (glyphs[i].type === 'equals') { glyphs.splice(i+1, 0, { type: 'minus', initialSegments: bits('10'), optional: true }); break; }
    }
  }
  return glyphs;
}

// Try moving `moves` sticks on the solution board to produce a readable but incorrect start.
function scrambleSolutionToStart(solutionExpr: string, moves: number, rng: RNG) {
  const glyphs = glyphsFromExpression(solutionExpr);
  const solutionBoard = encodeSolution({ glyphs } as Puzzle, solutionExpr);
  let board = solutionBoard.map(row => [...row]);
  const slots = layout(glyphs).slots;

  for (let attempt = 0; attempt < 1000; attempt++) {
    // copy original solution board
    board = solutionBoard.map(row => [...row]);
    let ok = true;
    for (let m = 0; m < moves; m++) {
      // collect occupied and empty slots
      const occupied = slots.filter(s => board[s.glyph]?.[s.segment]);
      const empty = slots.filter(s => !board[s.glyph]?.[s.segment]);
      if (occupied.length === 0 || empty.length === 0) { ok = false; break; }
      // pick random compatible relocation
      // heuristic: prefer moving a stick from a digit segment to an operator segment or vice versa
      let from = occupied[rnd(rng, occupied.length)];
      // collect candidates preferring operator/digit cross moves
      let candidates = empty.filter(e => e.length === from.length && (((from.angle - e.angle) % 180) + 180) % 180 === 0);
      // sort candidates to prefer ones that change glyph type (digit <-> operator)
      const glyphType = (g: typeof glyphs[0]) => g.type === 'digit' ? 'digit' : 'op';
      candidates = candidates.sort((a, b) => {
        const at = glyphType(glyphs[a.glyph]);
        const bt = glyphType(glyphs[b.glyph]);
        const ft = glyphType(glyphs[from.glyph]);
        return (at === ft ? 1 : 0) - (bt === ft ? 1 : 0);
      });
      if (candidates.length === 0) { ok = false; break; }
      const to = candidates[rnd(rng, candidates.length)];
      const move = { from: { glyph: from.glyph, segment: from.segment }, to: { glyph: to.glyph, segment: to.segment } };
      const next = applyMove(board, move, glyphs as Glyph[]);
      if (!next) { ok = false; break; }
      board = next;
    }
    if (!ok) continue;
    // decode board to readable expression and ensure it's an incorrect equation
  // We can't import decode here safely (engine already provides encodeSolution, trueEquation used below)
  // For safety, ensure the resulting board is not exactly the solution and the solution expression is true
  if (!trueEquation(solutionExpr)) continue; // solution must be true
    // If board equals solution, skip
    let same = true;
    for (let i = 0; i < board.length; i++) { if (board[i].join('') !== solutionBoard[i].join('')) { same = false; break; } }
    if (same) continue;
    // ensure the scrambled board decodes to a readable (but incorrect) expression
    const decoded = decode(glyphs, board);
    if (decoded && !trueEquation(decoded)) return { glyphs, startBoard: board };
  }
  // deterministic fallback: try to find compatible relocations exhaustively
  function deterministicScramble(solutionExpr: string, moves: number) {
    const glyphsLocal = glyphsFromExpression(solutionExpr);
    const solutionBoardLocal = encodeSolution({ glyphs: glyphsLocal } as Puzzle, solutionExpr);
    const slotsLocal = layout(glyphsLocal).slots;
    // helper to apply a sequence of moves and validate
    const tryMoves = (movesSeq: Array<{ from: { glyph: number; segment: number }, to: { glyph: number; segment: number } }>) => {
      let boardLocal = solutionBoardLocal.map(r => [...r]);
      for (const mv of movesSeq) {
        const next = applyMove(boardLocal, mv, glyphsLocal as Glyph[]);
        if (!next) return null;
        boardLocal = next;
      }
      // validate
      const decoded = decode(glyphsLocal, boardLocal);
      if (!decoded) return null;
      if (decoded === solutionExpr) return null;
      if (trueEquation(decoded)) return null; // must be incorrect
      return { glyphs: glyphsLocal, startBoard: boardLocal };
    };

    // collect occupied and empty slots from the solution
    const occupied = slotsLocal.filter(s => solutionBoardLocal[s.glyph]?.[s.segment]);
    const empty = slotsLocal.filter(s => !solutionBoardLocal[s.glyph]?.[s.segment]);
    if (moves === 1) {
      for (const from of occupied) {
        for (const to of empty) {
          if (from.length !== to.length) continue;
          if ((((from.angle - to.angle) % 180) + 180) % 180 !== 0) continue;
          const mv = { from: { glyph: from.glyph, segment: from.segment }, to: { glyph: to.glyph, segment: to.segment } };
          const res = tryMoves([mv]);
          if (res) return res;
        }
      }
    }
    if (moves === 2) {
      // try pairs of compatible relocations (distinct source slots)
      for (const from1 of occupied) {
        for (const to1 of empty) {
          if (from1.length !== to1.length) continue;
          if ((((from1.angle - to1.angle) % 180) + 180) % 180 !== 0) continue;
          const mv1 = { from: { glyph: from1.glyph, segment: from1.segment }, to: { glyph: to1.glyph, segment: to1.segment } };
          // construct intermediate board
          const b1 = applyMove(solutionBoardLocal.map(r => [...r]), mv1, glyphsLocal as Glyph[]);
          if (!b1) continue;
          const occupied2 = slotsLocal.filter(s => b1[s.glyph]?.[s.segment]);
          const empty2 = slotsLocal.filter(s => !b1[s.glyph]?.[s.segment]);
          for (const from2 of occupied2) {
            for (const to2 of empty2) {
              // avoid trying to move back the same stick to same place
              if (from2.glyph === mv1.from.glyph && from2.segment === mv1.from.segment && to2.glyph === mv1.to.glyph && to2.segment === mv1.to.segment) continue;
              if (from2.length !== to2.length) continue;
              if ((((from2.angle - to2.angle) % 180) + 180) % 180 !== 0) continue;
              const mv2 = { from: { glyph: from2.glyph, segment: from2.segment }, to: { glyph: to2.glyph, segment: to2.segment } };
              // additional heuristic: skip pairs that restore a digit's original numeric value
              const res = tryMoves([mv1, mv2]);
              if (res) return res;
            }
          }
        }
      }
    }
    return null;
  }

  return deterministicScramble(solutionExpr, moves) ?? null;
}

export type GeneratorOptions = { seed?: number; digits?: number; operands?: number; movesAllowed?: 1 | 2; maxAttempts?: number };

export async function generateHorizontal(options: GeneratorOptions = {}) {
  const rng = makeRng(options.seed ?? Date.now());
  const digits = options.digits ?? 1;
  const operands = options.operands ?? 2;
  const movesAllowed = options.movesAllowed ?? 1 as 1 | 2;
  const maxAttempts = options.maxAttempts ?? 200;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Build a simple expression: a op b = c (support mixed ops when operands>2 in future)
    // For now, generate two operands with given digit counts
    const a = (rng.next() % Math.pow(10, digits)).toString();
    const b = (rng.next() % Math.pow(10, digits)).toString();
    // choose op
    const ops = ['+','-','×'];
    const op = ops[rnd(rng, ops.length)];
    // For each random pair, try multiple operator variants and swapped operands to increase chance of a valid scramble
    const candidateOps = ['+','-','×'];
    const candidates: string[] = [];
    for (const o of candidateOps) candidates.push(`${a}${o}${b}`);
    // also try swapped operands
    for (const o of candidateOps) candidates.push(`${b}${o}${a}`);

    for (const expr of candidates) {
      // evaluate expression safely
      const m = expr.match(/(-?\d+)([+\-×])(-?\d+)/);
      if (!m) continue;
      const aa = Number(m[1]), bb = Number(m[3]), opChar = m[2];
      let value: number | null = null;
      if (opChar === '+') value = aa + bb;
      else if (opChar === '-') value = aa - bb;
      else if (opChar === '×') value = aa * bb;
      if (value === null) continue;
      const solution = `${expr}=${value}`;

      // scramble to create starting board
      const scrambled = scrambleSolutionToStart(solution, movesAllowed, rng);
      if (!scrambled) continue;
      const { glyphs, startBoard } = scrambled;

      // build a Puzzle-shaped object
      const id = `gen-${Date.now()}-${attempt}`;
      const title = 'generated';
      const p: Puzzle = { id, title, difficulty: 'easy', pack: 'start', movesAllowed, glyphs, acceptedSolutions: [solution], minDistance: movesAllowed, verificationStatus: 'unsupported', version: 1 } as Puzzle;

      // verify via verifier (pass startBoard explicitly)
      const res = await verifyPuzzle(p, { timeoutMs: 2000, startBoard });
      if (res.status === 'complete' && res.minDistance === movesAllowed) {
        p.verificationStatus = 'complete';
        return { puzzle: p, startBoard, solution, attempts: attempt + 1 };
      }
    }
  }
  // If dynamic attempts failed, fall back to exhaustive deterministic search across small numbers and ops
  const candidateOps = ['+','-','×'];
  for (let a = 1; a <= 9; a++) {
    for (let b = 1; b <= 9; b++) {
      for (const op of candidateOps) {
        const expr = `${a}${op}${b}`;
        const value = op === '+' ? a + b : op === '-' ? a - b : a * b;
        const solution = `${expr}=${value}`;
        const scrambled = scrambleSolutionToStart(solution, movesAllowed, rng);
        if (!scrambled) continue;
        const { glyphs, startBoard } = scrambled;
        const id = `gen-exhaustive-${Date.now()}-${a}-${b}-${op}`;
        const p: Puzzle = { id, title: 'generated-exhaustive', difficulty: 'easy', pack: 'start', movesAllowed, glyphs, acceptedSolutions: [solution], minDistance: movesAllowed, verificationStatus: 'unsupported', version: 1 } as Puzzle;
        const res = await verifyPuzzle(p, { timeoutMs: 2000, startBoard });
        if (res.status === 'complete' && res.minDistance === movesAllowed) {
          p.verificationStatus = 'complete';
          return { puzzle: p, startBoard, solution, attempts: maxAttempts + 1 };
        }
      }
    }
  }

  // As a last resort, throw an error rather than returning null so callers know generation failed
  throw new Error('generateHorizontal: unable to produce a verified puzzle');
}

export default generateHorizontal;
