import { type Puzzle, type BoardState, type Move, layout, initialBoard, decode, applyMove, trueEquation } from './engine';

export type VerificationStatus = 'complete' | 'incomplete' | 'unsupported';
export type VerificationResult = {
  status: VerificationStatus;
  minDistance?: number; // minimal moves found to reach any accepted solution
  solutions: Move[][]; // list of move sequences (each sequence is array of Move)
  timeMs: number;
  reason?: string; // optional human-friendly note (e.g., 'timeout')
};

function boardKey(board: BoardState) {
  return board.map(r => r.map(v => (v ? '1' : '0')).join('')).join('|');
}

// BFS enumerator for legal moves up to maxDepth. Returns all solution paths found within depth.
export async function verifyPuzzle(puzzle: Puzzle, options?: { timeoutMs?: number; startBoard?: BoardState }): Promise<VerificationResult> {
  const startTime = Date.now();
  const timeoutMs = options?.timeoutMs ?? 5000;
  const glyphs = puzzle.glyphs;
  const slots = layout(glyphs).slots;
  const start = options?.startBoard ?? initialBoard(puzzle);

  const maxDepth = puzzle.movesAllowed;
  const solutions: Move[][] = [];
  let minFound: number | undefined = undefined;

  const visited = new Set<string>();
  type Node = { board: BoardState; path: Move[] };
  const queue: Node[] = [{ board: start, path: [] }];
  visited.add(boardKey(start));

  while (queue.length) {
    if (Date.now() - startTime > timeoutMs) return { status: 'unsupported', solutions, timeMs: Date.now() - startTime, reason: 'timeout' };
    const node = queue.shift()!;
    const depth = node.path.length;

    // Check for solution at this node (only accept concrete acceptedSolutions via decode)
    const expr = decode(glyphs, node.board);
    if (expr !== null) {
      // engine.checkBoard uses acceptedSolutions to decide solved; here we accept any true accepted solution
      if (puzzle.acceptedSolutions.includes('*')) {
        if (trueEquation(expr)) {
          // wildcard but must still be true equation
          if (minFound === undefined || depth < minFound) minFound = depth;
          if (depth <= maxDepth) solutions.push([...node.path]);
        }
      } else if (puzzle.acceptedSolutions.includes(expr)) {
        if (minFound === undefined || depth < minFound) minFound = depth;
        if (depth <= maxDepth) solutions.push([...node.path]);
      }
    }

    // If we've reached the max search depth, don't expand
    if (depth >= maxDepth) continue;

    // Enumerate all possible relocations: from occupied -> empty compatible slots
    for (const fromSlot of slots) {
      if (!node.board[fromSlot.glyph]?.[fromSlot.segment]) continue;
      for (const toSlot of slots) {
        if (node.board[toSlot.glyph]?.[toSlot.segment]) continue;
        // quick orientation/length check
        if (fromSlot.length !== toSlot.length) continue;
        // angles must match modulo 180
        if ((((fromSlot.angle - toSlot.angle) % 180) + 180) % 180 !== 0) continue;
        const move: Move = { from: { glyph: fromSlot.glyph, segment: fromSlot.segment }, to: { glyph: toSlot.glyph, segment: toSlot.segment } };
        const next = applyMove(node.board, move, glyphs);
        if (!next) continue;
        const key = boardKey(next);
        if (visited.has(key)) continue;
        visited.add(key);
        queue.push({ board: next, path: [...node.path, move] });
      }
    }
  }

  const timeMs = Date.now() - startTime;
  // If no solutions found within maxDepth, mark incomplete
  if (solutions.length === 0) return { status: 'incomplete', minDistance: minFound, solutions, timeMs, reason: minFound === undefined ? 'no-solution-within-depth' : undefined };

  // If minimal distance differs from puzzle.movesAllowed, it's an incomplete verification (shortcut exists)
  if (minFound !== undefined && minFound !== puzzle.movesAllowed) return { status: 'incomplete', minDistance: minFound, solutions, timeMs, reason: 'minDistance-mismatch' };

  return { status: 'complete', minDistance: minFound, solutions, timeMs };
}

export default verifyPuzzle;
