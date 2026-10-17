import { bits, DIGITS, initialBoard, solutionMoves, type Difficulty, type Glyph, type Puzzle, type PuzzlePack } from '../lib/engine';

function puzzle(id: string, title: string, difficulty: Difficulty, pack: PuzzlePack, movesAllowed: 1 | 2, acceptedSolutions: string[], unary = false): Puzzle {
  const glyphs: Glyph[] = [];
  for (const char of title) {
    glyphs.push(/\d/.test(char) ? { type:'digit', initialSegments:bits(DIGITS[Number(char)]) }
      : { type: char === '+' ? 'plus' : char === '-' ? 'minus' : char === '=' ? 'equals' : 'times', initialSegments:bits(char === '-' ? '10' : '11') });
    if (char === '=' && unary) glyphs.push({type:'minus',initialSegments:[false,false],optional:true});
  }
  const p: Puzzle = {id,title,difficulty,pack,movesAllowed,glyphs,acceptedSolutions,
    // auto-populated metadata for new difficulty schema
    minDistance: movesAllowed,
    verificationStatus: 'complete',
    version: 1
  };
  const first = solutionMoves(p, initialBoard(p))?.[0];
  if (first) Object.assign(p, {hintRemoveGlyphIndex:first.from.glyph,hintRemoveSegmentIndex:first.from.segment,hintPlaceGlyphIndex:first.to.glyph,hintPlaceSegmentIndex:first.to.segment});
  return p;
}

// Every accepted reading is tested through applyMove with the current no-rotation
// rule and exactly movesAllowed relocations. Changed starts use new IDs so saved
// progress cannot silently award a different puzzle. See docs/catalog.md.
export const puzzles: Puzzle[] = [
  // Старт: the original 12 free puzzles. Keep these IDs and order stable.
  puzzle('spark-01','1+1=3','easy','start',1,['1+1=2']),
  puzzle('spark-02-v2','7-1=9','easy','start',1,['7-1=6']),
  puzzle('spark-03','4+5=6','easy','start',1,['4+5=9']),
  puzzle('spark-04','3+3=8','easy','start',1,['5+3=8']),
  puzzle('spark-05','8-3=3','easy','start',1,['8-3=5','8-5=3']),
  puzzle('spark-06','6-1=6','easy','start',1,['5+1=6']),
  puzzle('spark-07','7+7=0','easy','start',1,['7+1=8','1+7=8']),
  puzzle('spark-08','6+1=5','easy','start',1,['5+1=6']),
  puzzle('spark-09','5+1=4','easy','start',1,['3+1=4']),
  puzzle('ember-02','0+3=5','easy','start',1,['0+3=3','0+5=5']),
  puzzle('ember-01','9+3=6','easy','start',1,['5+3=8']),
  puzzle('spark-10','8-3=6','easy','start',1,['8-2=6']),

  // Знаки: operator changes, multiplication, and longer readings.
  puzzle('ember-03-v2','3+4=9','medium','signs',1,['5+4=9']),
  puzzle('ember-04-v2','11-6=9','medium','signs',1,['11-8=3']),
  puzzle('ember-05','5+9=11','medium','signs',1,['5+6=11']),
  puzzle('ember-07','6+4=3','medium','signs',1,['5+4=9']),

  puzzle('flame-01-v2','6×9=39','hard','signs',2,['6×6=36']),
  puzzle('flame-02-v2','6+7=9','hard','signs',2,['5+4=9']),

  // Six additional verified easy/medium puzzles.
  puzzle('spark-11','2+3=6','easy','signs',1,['3+3=6']),
  puzzle('spark-12','9-5=9','easy','signs',1,['8-5=3','9-6=3']),
  puzzle('ember-06','9-7=12','medium','signs',1,['5+7=12']),
  puzzle('ember-08','9+5=19','medium','signs',1,['8+5=13','9+6=15']),
  puzzle('ember-09','11-3=9','medium','signs',1,['11-2=9']),
  puzzle('ember-10','8+2=11','medium','signs',1,['8+3=11']),

  // Чемпион: eight exact two-move challenges and eight compact one-move finishers.
  puzzle('champion-01','1-1=6','hard','champion',2,['1+1=2']),
  puzzle('champion-02','1-6=3','hard','champion',2,['1+2=3']),
  puzzle('champion-03','1+3=5','hard','champion',2,['1+2=3']),
  puzzle('champion-04','1+7=9','hard','champion',2,['1+3=4']),
  puzzle('champion-05','4+3=1','hard','champion',2,['1+3=4']),
  puzzle('champion-06','1+9=7','hard','champion',2,['1+3=4']),
  puzzle('champion-07','7+1=9','hard','champion',2,['1+4=5']),
  puzzle('champion-08','4×4=1','hard','champion',2,['1×4=4']),
  puzzle('champion-09','1-2=9','medium','champion',1,['1+2=3']),
  puzzle('champion-10','1+3=3','medium','champion',1,['1+2=3']),
  puzzle('champion-11','1×3=2','medium','champion',1,['1×2=2']),
  puzzle('champion-12','1-9=4','medium','champion',1,['1+3=4']),
  puzzle('champion-13','1×5=3','medium','champion',1,['1×3=3']),
  puzzle('champion-14','1-4=9','medium','champion',1,['1+4=5']),
  puzzle('champion-15','1-8=7','medium','champion',1,['1+6=7']),
  puzzle('champion-16','1+11=13','medium','champion',1,['1+11=12']),
];
