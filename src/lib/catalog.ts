import { decode, initialBoard, trueEquation, type Puzzle } from './engine';
// Populated before App mounts. Puzzle data is never bundled into the cached shell.
export let puzzles: Puzzle[] = [];
export function setCatalog(value: unknown) {
  if (!Array.isArray(value) || !value.length) throw new Error('Empty catalog');
  const ids = new Set<string>();
  for (const p of value) {
    if (!p || typeof p.id !== 'string' || ids.has(p.id) || typeof p.title !== 'string' ||
        !['easy','medium','hard'].includes(p.difficulty) || !['start','signs','champion'].includes(p.pack) || ![1,2].includes(p.movesAllowed) ||
        !Array.isArray(p.glyphs) || !Array.isArray(p.acceptedSolutions) || !p.acceptedSolutions.length ||
        !p.acceptedSolutions.every((s: unknown)=>typeof s==='string'&&trueEquation(s)) ||
        !p.glyphs.every((g: {type: string;initialSegments: unknown})=>g&&['digit','plus','minus','equals','times'].includes(g.type)&&Array.isArray(g.initialSegments)&&g.initialSegments.length===(g.type==='digit'?7:2)&&g.initialSegments.every(v=>typeof v==='boolean')) ||
        decode(p.glyphs,initialBoard(p))!==p.title) throw new Error('Invalid catalog');
    ids.add(p.id);
  }
  puzzles = value;
}
export async function loadCatalog() {
  const response = await fetch('/puzzles.json', {cache:'no-store'});
  if (!response.ok) throw new Error('Catalog unavailable');
  setCatalog(await response.json());
}
