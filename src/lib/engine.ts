export type Difficulty = 'trivial' | 'easy' | 'medium' | 'hard' | 'very_hard';
export type PuzzlePack = 'start' | 'signs' | 'champion';
export type Glyph = { type: 'digit' | 'plus' | 'minus' | 'equals' | 'times'; initialSegments: boolean[]; optional?: boolean };
export type Slot = { glyph: number; segment: number };
export type Move = { from: Slot; to: Slot };
export type BoardState = boolean[][];
export type Puzzle = {
  id: string; title: string; difficulty: Difficulty; pack: PuzzlePack; movesAllowed: 1 | 2;
  glyphs: Glyph[]; acceptedSolutions: string[];
  // Optional metadata
  minDistance?: number;
  verificationStatus?: 'complete' | 'incomplete' | 'unsupported';
  version?: number;
  // Hints for first move (optional)
  hintRemoveGlyphIndex?: number; hintRemoveSegmentIndex?: number;
  hintPlaceGlyphIndex?: number; hintPlaceSegmentIndex?: number;
};
export const DIGITS = ['1111110','0110000','1101101','1111001','0110011','1011011','1011111','1110000','1111111','1111011'];
export const bits = (pattern: string) => [...pattern].map(x => x === '1');
export const initialBoard = (p: Puzzle): BoardState => p.glyphs.map(g => [...g.initialSegments]);
export const sameSlot = (a: Slot | null, b: Slot | null) => !!a && !!b && a.glyph === b.glyph && a.segment === b.segment;
export const slotKey = (s: Slot) => `${s.glyph}:${s.segment}`;
export function decode(glyphs: Glyph[], board: BoardState): string | null {
  if (glyphs.length !== board.length) return null;
  const chars = glyphs.map((g, i) => {
    if (board[i].length !== g.initialSegments.length) return null;
    const b = board[i].map(Number).join('');
    if (g.type === 'digit') { const n = DIGITS.indexOf(b); return n < 0 ? null : String(n); }
    if (g.optional && !board[i].some(Boolean)) return '';
    if (g.type === 'equals') return b === '11' ? '=' : null;
    if (g.type === 'times') return b === '11' ? '×' : null;
    return b === '11' && !g.optional ? '+' : b === '10' ? '-' : null;
  });
  return chars.includes(null) ? null : chars.join('');
}
// Small integer-only parser: unary minus, multiplication precedence, then +/−. Never eval.
export function evaluate(expression: string): number | null {
  if (!/^-?\d+(?:[+\-×]-?\d+)*$/.test(expression)) return null;
  const tokens = expression.match(/\d+|[+\-×]/g)!;
  let index = 0;
  const number = () => {
    let sign = 1;
    if (tokens[index] === '-') { sign = -1; index++; }
    const token = tokens[index++];
    if (!token || !/^\d+$/.test(token) || (token.length > 1 && token[0] === '0')) return NaN;
    const n = sign * Number(token); return Number.isSafeInteger(n) ? n : NaN;
  };
  const term = () => { let n = number(); while (tokens[index] === '×') { index++; n *= number(); if (!Number.isSafeInteger(n)) return NaN; } return n; };
  let value = term();
  while (index < tokens.length) { const op = tokens[index++]; const next = term(); value = op === '+' ? value + next : value - next; if (!Number.isSafeInteger(value)) return null; }
  return Number.isSafeInteger(value) ? value : null;
}
export function trueEquation(expression: string): boolean {
  const sides = expression.split('=');
  if (sides.length !== 2) return false;
  const a = evaluate(sides[0]), b = evaluate(sides[1]);
  return a !== null && b !== null && a === b;
}
export function checkBoard(puzzle: Puzzle, board: BoardState, moves: number): 'solved' | 'invalid' | 'incorrect' {
  const equation = decode(puzzle.glyphs, board);
  if (equation === null || equation.split('=').length !== 2 || equation.split('=').some(x => evaluate(x) === null)) return 'invalid';
  if (moves !== puzzle.movesAllowed || !trueEquation(equation)) return 'incorrect';
  return puzzle.acceptedSolutions.includes('*') || puzzle.acceptedSolutions.includes(equation) ? 'solved' : 'incorrect';
}
export function applyMove(board: BoardState, move: Move, glyphs: Glyph[]): BoardState | null {
  if (sameSlot(move.from, move.to) || !board[move.from.glyph]?.[move.from.segment] || board[move.to.glyph]?.[move.to.segment] !== false) return null;
  const slots=layout(glyphs).slots;
  const from=slots.find(s=>sameSlot(s,move.from)), to=slots.find(s=>sameSlot(s,move.to));
  if(!from||!to||!compatibleSlots(from,to))return null;
  const next = board.map(row => [...row]);
  next[move.from.glyph][move.from.segment] = false;
  next[move.to.glyph][move.to.segment] = true;
  return next;
}
export function encodeSolution(puzzle: Puzzle, expression: string): BoardState {
  let index = 0;
  return puzzle.glyphs.map(g => {
    const char = expression[index];
    if (g.optional && char !== '-') return [false, false];
    index++;
    if (g.type === 'digit') { if (!/\d/.test(char ?? '')) throw new Error('Incompatible solution digit'); return bits(DIGITS[Number(char)]); }
    if (g.type === 'equals' && char === '=' || g.type === 'times' && char === '×') return [true, true];
    if ((g.type === 'plus' || g.type === 'minus') && (char === '+' || char === '-')) return bits(char === '+' ? '11' : '10');
    throw new Error(`Incompatible solution: ${expression}`);
  });
}
export function movesBetween(from: BoardState, to: BoardState, glyphs?: Glyph[]): Move[] | null {
  const removed: Slot[] = [], added: Slot[] = [];
  from.forEach((row, glyph) => row.forEach((value, segment) => {
    if (value && !to[glyph][segment]) removed.push({glyph, segment});
    if (!value && to[glyph][segment]) added.push({glyph, segment});
  }));
  if(removed.length!==added.length)return null;
  if(!glyphs)return removed.map((s,i)=>({from:s,to:added[i]}));
  const slots=layout(glyphs).slots, remaining=[...added], moves:Move[]=[];
  for(const from of removed){
    const source=slots.find(s=>sameSlot(s,from))!;
    const index=remaining.findIndex(to=>compatibleSlots(source,slots.find(s=>sameSlot(s,to))!));
    if(index<0)return null;
    moves.push({from,to:remaining.splice(index,1)[0]});
  }
  return moves;
}
export function solutionMoves(puzzle: Puzzle, board = initialBoard(puzzle), remaining: number = puzzle.movesAllowed): Move[] | null {
  for (const s of puzzle.acceptedSolutions) {
    if (s === '*') continue;
    const moves = movesBetween(board, encodeSolution(puzzle, s), puzzle.glyphs);
    if (moves && moves.length <= remaining) return moves;
  }
  return null;
}
export type SlotGeometry = Slot & { x: number; y: number; angle: number; length:number };
export const compatibleSlots=(a:SlotGeometry,b:SlotGeometry)=>a.length===b.length&&((a.angle-b.angle)%180+180)%180===0;
export function snapTarget(slots:SlotGeometry[],board:BoardState,from:Slot,p:{x:number;y:number},scale:number):SlotGeometry|null {
  const source=slots.find(s=>sameSlot(s,from));
  if(!source||!board[from.glyph]?.[from.segment]||scale<=0)return null;
  // Include occupied and incompatible slots when finding the nearest: a drop
  // on one must not jump into a nearby legal slot at small mobile scales.
  const nearest=slots.map(s=>({s,d:Math.hypot(s.x-p.x,s.y-p.y)*scale})).filter(x=>x.d<28).sort((a,b)=>a.d-b.d)[0]?.s;
  if(!nearest)return null;
  // Crossed operator slots share a center. Resolve that center by orientation,
  // without falling through to a different nearby center or rotating a stick.
  const target=slots.find(s=>s.x===nearest.x&&s.y===nearest.y&&compatibleSlots(source,s));
  return target&&!sameSlot(source,target)&&board[target.glyph]?.[target.segment]===false?target:null;
}
export function layout(glyphs: Glyph[]) {
  const slots: SlotGeometry[] = [];
  let x = 28;
  glyphs.forEach((g, glyph) => {
    const points = g.type === 'digit' ? [[32,12,0],[57,37,90],[57,87,90],[32,112,0],[7,87,90],[7,37,90],[32,62,0]]
      : g.type === 'equals' ? [[28,46,0],[28,78,0]]
      : g.type === 'times' ? [[28,62,45],[28,62,-45]] : [[28,62,0],[28,62,90]];
    points.forEach(([dx,y,angle],segment) => slots.push({glyph,segment,x:x+dx,y:y+26,angle,length:44}));
    x += g.type === 'digit' ? 80 : 68;
  });
  return { slots, width: x + 12, height: 176 };
}
