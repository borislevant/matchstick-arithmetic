import { type Puzzle, type BoardState, type Move, layout, initialBoard, decode, applyMove, trueEquation, compatibleSlots } from './engine';

export type VerificationStatus = 'complete' | 'incomplete' | 'unsupported';
export type VerificationResult = {
  status: VerificationStatus;
  minDistance?: number;
  // One shortest legal path per distinct final board, rather than move-order permutations.
  solutions: Move[][];
  equations: string[];
  timeMs: number;
  reason?: string;
  version: 1;
};

const boardKey = (board: BoardState) => board.map(row => row.map(Number).join('')).join('|');

// Offline bounded reference search. A seed answer must not hide alternative equalities.
export async function verifyPuzzle(puzzle: Puzzle, options: { timeoutMs?: number; startBoard?: BoardState; maxStates?: number } = {}): Promise<VerificationResult> {
  const startTime = performance.now();
  const timeoutMs = options.timeoutMs ?? 5000;
  const maxStates = options.maxStates ?? 50000;
  const glyphs = puzzle.glyphs;
  const slots = layout(glyphs).slots;
  const start = options.startBoard ?? initialBoard(puzzle);
  const solutions: Move[][] = [];
  const equations: string[] = [];
  const result = (status: VerificationStatus, reason?: string, minDistance?: number): VerificationResult => ({
    status, solutions, equations, timeMs: performance.now() - startTime, version: 1, reason,
    ...(minDistance === undefined ? {} : { minDistance }),
  });
  if (![1, 2].includes(puzzle.movesAllowed) || glyphs.length > 24 ||
      !Number.isFinite(timeoutMs) || timeoutMs < 0 || timeoutMs > 10000 || !Number.isInteger(maxStates) || maxStates < 1 || maxStates > 50000 ||
      start.length !== glyphs.length || start.some((row, i) => row.length !== glyphs[i].initialSegments.length || row.some(value => typeof value !== 'boolean'))) {
    return result('unsupported', 'unsupported-search-settings');
  }

  type Node = { board: BoardState; path: Move[] };
  const queue: Node[] = [{ board: start, path: [] }];
  const visited = new Set([boardKey(start)]);
  const destinations = slots.map(from => slots.filter(to => compatibleSlots(from, to)));
  let minFound: number | undefined;

  for (let index = 0; index < queue.length; index++) {
    if (performance.now() - startTime >= timeoutMs) return result('incomplete', 'timeout');
    const node = queue[index];
    const depth = node.path.length;
    const expression = decode(glyphs, node.board);
    if (expression !== null && trueEquation(expression)) {
      minFound ??= depth;
      solutions.push(node.path);
      equations.push(expression);
      if (depth < puzzle.movesAllowed) return result('incomplete', 'minDistance-mismatch', depth);
    }
    if (depth >= puzzle.movesAllowed) continue;

    for (let sourceIndex = 0; sourceIndex < slots.length; sourceIndex++) {
      const from = slots[sourceIndex];
      if (!node.board[from.glyph][from.segment]) continue;
      for (const to of destinations[sourceIndex]) {
        if (performance.now() - startTime >= timeoutMs) return result('incomplete', 'timeout');
        if (node.board[to.glyph][to.segment]) continue;
        const move: Move = { from: { glyph: from.glyph, segment: from.segment }, to: { glyph: to.glyph, segment: to.segment } };
        const next = applyMove(node.board, move, glyphs);
        if (!next) continue;
        const key = boardKey(next);
        if (visited.has(key)) continue;
        if (visited.size >= maxStates) return result('incomplete', 'state-limit');
        visited.add(key);
        queue.push({ board: next, path: [...node.path, move] });
      }
    }
  }
  if (minFound === undefined) return result('incomplete', 'no-solution-within-depth');
  return result('complete', undefined, minFound);
}

export default verifyPuzzle;
