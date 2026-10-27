import { type Puzzle, type Glyph, DIGITS, bits, encodeSolution, layout, applyMove, trueEquation, evaluate, decode } from './engine';
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
function scrambleSolutionToStart(solutionExpr: string, moves: number, rng: RNG, deadline: number) {
  const glyphs = glyphsFromExpression(solutionExpr);
  const solutionBoard = encodeSolution({ glyphs } as Puzzle, solutionExpr);
  let board = solutionBoard.map(row => [...row]);
  const slots = layout(glyphs).slots;

  for (let attempt = 0; attempt < 1000 && performance.now() < deadline; attempt++) {
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
    if (!trueEquation(solutionExpr)) continue; // solution must be true
    // If board equals solution, skip
    let same = true;
    for (let i = 0; i < board.length; i++) { if (board[i].join('') !== solutionBoard[i].join('')) { same = false; break; } }
    if (same) continue;
    // ensure the scrambled board decodes to a readable (but incorrect) expression
    const decoded = decode(glyphs, board);
    if (decoded && decoded.split('=').length === 2 && decoded.split('=').every(side => evaluate(side) !== null) && !trueEquation(decoded)) return { glyphs, startBoard: board };
  }
  return null;
}

export type GeneratorOptions = { seed?: number; digits?: number; operands?: number; movesAllowed?: 1 | 2; maxAttempts?: number; timeoutMs?: number };

export async function generateHorizontal(options: GeneratorOptions = {}) {
  const seed = options.seed ?? 1;
  const rng = makeRng(seed);
  const digits = options.digits ?? 1;
  const operands = options.operands ?? 2;
  const movesAllowed = options.movesAllowed ?? 1 as 1 | 2;
  const maxAttempts = options.maxAttempts ?? 200;

  const timeoutMs = options.timeoutMs ?? 5000;
  if (!Number.isInteger(digits) || digits < 1 || digits > 2 || operands !== 2 ||
      ![1, 2].includes(movesAllowed) || !Number.isInteger(maxAttempts) || maxAttempts < 0 || maxAttempts > 200 ||
      !Number.isFinite(timeoutMs) || timeoutMs < 0 || timeoutMs > 10000 || !Number.isSafeInteger(seed)) {
    throw new RangeError('Supported horizontal settings: 1–2 digits, two operands, 1–2 moves, up to 200 attempts and 10 seconds');
  }
  const deadline = performance.now() + timeoutMs;
  for (let attempt = 0; attempt < maxAttempts && performance.now() < deadline; attempt++) {
    // Build a simple expression: a op b = c (support mixed ops when operands>2 in future)
    // For now, generate two operands with given digit counts
    const a = (rng.next() % Math.pow(10, digits)).toString();
    const b = (rng.next() % Math.pow(10, digits)).toString();
    // For each random pair, try multiple operator variants and swapped operands to increase chance of a valid scramble
    const candidateOps = ['+','-','×'];
    const candidates: string[] = [];
    for (const o of candidateOps) candidates.push(`${a}${o}${b}`);
    // also try swapped operands
    for (const o of candidateOps) candidates.push(`${b}${o}${a}`);

    for (const expr of candidates) {
      if (performance.now() >= deadline) return null;
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
      const scrambled = scrambleSolutionToStart(solution, movesAllowed, rng, deadline);
      if (!scrambled) continue;
      const { glyphs, startBoard } = scrambled;

      // build a Puzzle-shaped object
      const id = `gen-v1-${seed}-${digits}-${movesAllowed}-${attempt}-${candidates.indexOf(expr)}`;
      const title = decode(glyphs, startBoard)!;
      const p: Puzzle = { id, title, difficulty: 'easy', pack: 'start', movesAllowed, glyphs: glyphs.map((glyph, i) => ({...glyph, initialSegments: [...startBoard[i]]})), acceptedSolutions: [solution], verificationStatus: 'unsupported', version: 1 } as Puzzle;

      // verify via verifier (pass startBoard explicitly)
      const res = await verifyPuzzle(p, { timeoutMs: Math.min(2000, Math.max(0, deadline - performance.now())) });
      if (res.status === 'complete' && res.minDistance === movesAllowed) {
        p.minDistance = res.minDistance;
        p.verificationStatus = 'complete';
        p.acceptedSolutions = res.equations;
        return { puzzle: p, startBoard, solution, attempts: attempt + 1 };
      }
    }
  }
  return null;
}

export default generateHorizontal;
