import {test} from 'node:test';
import assert from 'node:assert/strict';
import {puzzles} from '../src/data/puzzles';
import {applyMove,bits,checkBoard,decode,DIGITS,encodeSolution,evaluate,initialBoard,movesBetween,solutionMoves,trueEquation,layout,compatibleSlots,snapTarget} from '../src/lib/engine';
import {translations} from '../src/lib/i18n';

const count=(board:boolean[][])=>board.flat().filter(Boolean).length;
// Independent fixtures: changing DIGITS must not silently change expectations.
const sevenSegmentMaps=['1111110','0110000','1101101','1111001','0110011','1011011','1011111','1110000','1111111','1111011'];
for(const [digit,pattern] of sevenSegmentMaps.entries())test(`seven-segment ${digit}: ${pattern} in abcdefg order`,()=>{
  assert.equal(DIGITS[digit],pattern);
  assert.equal(decode([{type:'digit',initialSegments:bits(pattern)}],[bits(pattern)]),String(digit));
});
test('catalog contains 40 unique false starting equations across all difficulties and packs',()=>{
  assert.equal(puzzles.length,40);assert.equal(new Set(puzzles.map(p=>p.id)).size,40);
  for(const p of puzzles){assert.equal(decode(p.glyphs,initialBoard(p)),p.title);assert.equal(trueEquation(p.title),false,p.title);assert.equal(checkBoard(p,initialBoard(p),0),'incorrect');}
  assert.deepEqual([...new Set(puzzles.map(p=>p.difficulty))],['easy','medium','hard']);
  assert.deepEqual([...new Set(puzzles.map(p=>p.pack))],['start','signs','champion']);
});
for(const p of puzzles) test(`${p.title}: all accepted solutions conserve matches and require exactly ${p.movesAllowed} moves`,()=>{
  const start=initialBoard(p);
  assert.ok(p.acceptedSolutions.length);
  for(const expression of p.acceptedSolutions){
    assert.ok(trueEquation(expression),expression);
    const goal=encodeSolution(p,expression);assert.equal(decode(p.glyphs,goal),expression);
    const moves=movesBetween(start,goal,p.glyphs);assert.ok(moves);assert.equal(moves.length,p.movesAllowed,expression);
    let board=start;
    for(const [index,move] of moves.entries()){
      const next=applyMove(board,move,p.glyphs);assert.ok(next,`${expression}: each relocation must be legal`);
      assert.equal(count(next),count(start));board=next;
      if(index+1<p.movesAllowed)assert.notEqual(checkBoard(p,board,index+1),'solved');
    }
    assert.deepEqual(board,goal);assert.equal(checkBoard(p,board,moves.length),'solved');
    assert.notEqual(checkBoard(p,board,p.movesAllowed+1),'solved');
  }
  const path=solutionMoves(p);
  assert.ok(path,`${p.id}: a reachable solution is required`);assert.equal(path.length,p.movesAllowed);
  let legal=start;
  for(const move of path){const next=applyMove(legal,move,p.glyphs);assert.ok(next);legal=next;}
  assert.equal(checkBoard(p,legal,path.length),'solved');
  const first=path[0];
  assert.deepEqual(first.from,{glyph:p.hintRemoveGlyphIndex,segment:p.hintRemoveSegmentIndex});
  assert.deepEqual(first.to,{glyph:p.hintPlaceGlyphIndex,segment:p.hintPlaceSegmentIndex});
});
test('parser handles multiplication precedence, multiple digits and unary minus',()=>{
  assert.equal(evaluate('2+3×4'),14);assert.equal(evaluate('11-8'),3);assert.equal(evaluate('3-4'),-1);assert.equal(evaluate('-1'),-1);assert.equal(evaluate('2×-3+1'),-5);
  for(const expression of ['','01+2','1.5+2','1/0','2**3','2×','alert(1)','--1','2 3','NaN','Infinity','999999999999999999'])assert.equal(evaluate(expression),null,expression);
  for(const expression of ['1≠2','1≤2','1≥0','1=1=1','2+2=5','0=00'])assert.equal(trueEquation(expression),false,expression);
});
test('invalid segment sets are rejected and digit encodings round-trip',()=>{
  const p=puzzles[0],board=initialBoard(p);board[0]=bits('0000001');assert.equal(checkBoard(p,board,1),'invalid');
  for(let n=0;n<10;n++)assert.equal(decode([{type:'digit',initialSegments:bits(DIGITS[n])}],[bits(DIGITS[n])]),String(n));
});
test('only listed solutions count unless explicitly marked with wildcard',()=>{
  const p=puzzles.find(p=>p.title==='8-3=3')!;const board=encodeSolution(p,'0+3=3');
  assert.equal(checkBoard({...p,acceptedSolutions:['8-3=5']},board,1),'incorrect');
  assert.equal(checkBoard({...p,acceptedSolutions:['*']},board,1),'solved');
  assert.equal(checkBoard({...p,acceptedSolutions:['*']},initialBoard(p),1),'incorrect','Wildcard cannot accept a false equality');
  assert.equal(checkBoard({...p,acceptedSolutions:[p.title]},initialBoard(p),1),'incorrect','An explicitly listed false equality cannot win');
  const broken=board.map(row=>[...row]);broken[3]=[true,false];
  assert.equal(checkBoard({...p,acceptedSolutions:['*']},broken,1),'invalid','An incomplete equals sign cannot win');
});
test('required playtest: 1+1=3 -> lower-right to lower-left -> 1+1=2',()=>{
  const p=puzzles[0],start=initialBoard(p);
  const next=applyMove(start,{from:{glyph:4,segment:2},to:{glyph:4,segment:4}},p.glyphs)!;
  assert.equal(decode(p.glyphs,start),'1+1=3');
  assert.equal(decode(p.glyphs,next),'1+1=2');
  assert.equal(count(next),count(start));
  assert.equal(checkBoard(p,next,1),'solved');
  for(const used of [0,2,NaN,0.5])assert.notEqual(checkBoard(p,next,used),'solved');
});
test('moves cannot add, discard, overwrite or move an empty slot',()=>{
  const start=initialBoard(puzzles[0]);
  for(const move of [{from:{glyph:0,segment:1},to:{glyph:0,segment:1}},{from:{glyph:0,segment:1},to:{glyph:0,segment:2}},{from:{glyph:0,segment:0},to:{glyph:0,segment:3}},{from:{glyph:0,segment:1},to:{glyph:99,segment:0}}])assert.equal(applyMove(start,move,puzzles[0].glyphs),null);
  assert.deepEqual(start,initialBoard(puzzles[0]));
});
test('every puzzle is reachable with current no-rotation rules and catalog metadata is complete',()=>{
  assert.deepEqual(puzzles.filter(p=>!solutionMoves(p)).map(p=>p.id),[]);
  assert.equal(new Set(puzzles.map(p=>p.title)).size,40);
  assert.deepEqual(['easy','medium','hard'].map(d=>puzzles.filter(p=>p.difficulty===d).length),[14,16,10]);
  assert.deepEqual(['start','signs','champion'].map(pack=>puzzles.filter(p=>p.pack===pack).length),[12,12,16]);
  for(const p of puzzles){
    assert.ok(p.id);assert.ok(p.title);assert.ok(['start','signs','champion'].includes(p.pack));assert.ok([1,2].includes(p.movesAllowed));
    assert.ok(p.glyphs.every(g=>g.initialSegments.every(v=>typeof v==='boolean')));
    assert.ok(p.acceptedSolutions.every(s=>s!=='*'),'Catalog entries list concrete verified solutions');
  }
});
test('hints never suggest incompatible moves or moves beyond the remaining budget',()=>{
  for(const p of puzzles){
    const path=solutionMoves(p);assert.ok(path);
    assert.equal(solutionMoves(p,initialBoard(p),0),null);
    let board=initialBoard(p);for(const move of path){const next=applyMove(board,move,p.glyphs);assert.ok(next);board=next;}
  }
});
test('all locales have complete nonempty strings and segment labels',()=>{
  const keys=Object.keys(translations.en).sort();
  for(const lang of ['he','ru','en'] as const){assert.deepEqual(Object.keys(translations[lang]).sort(),keys);for(const value of Object.values(translations[lang])){assert.ok(value.length);if(Array.isArray(value))assert.ok(value.every(x=>x.length>0));}}
});
test('Russian empty, load-error, and payment-failure copy is friendly and contains no stack trace',()=>{
  assert.equal(translations.ru.catalogEmpty,'В этом разделе пока нет задач.');
  assert.equal(translations.ru.offlineTitle,'Нужен интернет, чтобы загрузить задачи');
  assert.equal(translations.ru.checkoutUnavailable,'Тестовая оплата пока не настроена.');
  for(const value of [translations.ru.catalogEmpty,translations.ru.offlineTitle,translations.ru.offlineBody,translations.ru.checkoutUnavailable])assert.equal(/(?:Error:|node_modules|\.tsx?:\d+)/.test(value),false);
});

test('segment layout locks abcdefg positions, orientations and equal stick lengths',()=>{
  const slots=layout([{type:'digit',initialSegments:bits('1111111')}]).slots;
  assert.deepEqual(slots.map(s=>[s.x,s.y,s.angle,s.length]),[[60,38,0,44],[85,63,90,44],[85,113,90,44],[60,138,0,44],[35,113,90,44],[35,63,90,44],[60,88,0,44]]);
  assert.ok(compatibleSlots(slots[1],slots[4]));
  assert.ok(!compatibleSlots(slots[1],slots[0]));
  assert.ok(!compatibleSlots(slots[1],{...slots[4],length:43}));
  assert.ok(compatibleSlots(slots[1],{...slots[4],angle:270}));
});
test('moves reject rotation consistently at the engine boundary',()=>{
  const p=puzzles[0],start=initialBoard(p);
  assert.equal(applyMove(start,{from:{glyph:4,segment:2},to:{glyph:0,segment:0}},p.glyphs),null);
  assert.deepEqual(start,initialBoard(p));
});
test('snap selects the nearest slot before checking occupancy and compatibility at mobile scales',()=>{
  const p=puzzles[0],board=initialBoard(p),slots=layout(p.glyphs).slots;
  const from=slots.find(s=>s.glyph===4&&s.segment===2)!;
  const dest=slots.find(s=>s.glyph===4&&s.segment===4)!;
  const occupied=slots.find(s=>s.glyph===4&&s.segment===3)!;
  const incompatible=slots.find(s=>s.glyph===0&&s.segment===0)!;
  for(const scale of [0.3,0.65,1,2]){
    assert.deepEqual(snapTarget(slots,board,from,dest,scale),dest);
    assert.equal(snapTarget(slots,board,from,from,scale),null,'Source must block neighboring targets');
    assert.equal(snapTarget(slots,board,from,occupied,scale),null,'Occupied must block neighboring targets');
    assert.equal(snapTarget(slots,board,from,incompatible,scale),null,'No rotation');
    assert.equal(snapTarget(slots,board,from,{x:-1000,y:-1000},scale),null);
  }
  assert.deepEqual(snapTarget([from,dest],board,from,{x:dest.x-27.9,y:dest.y},1),dest);
  assert.equal(snapTarget([from,dest],board,from,{x:dest.x-28,y:dest.y},1),null);
});
test('crossed operator slots choose the matching orientation at their shared center',()=>{
  const p=puzzles.find(p=>p.title==='6-1=6')!,board=initialBoard(p),slots=layout(p.glyphs).slots;
  const source=slots.find(s=>s.glyph===0&&s.segment===4)!;
  const horizontal=slots.find(s=>s.glyph===1&&s.segment===0)!;
  const vertical=slots.find(s=>s.glyph===1&&s.segment===1)!;
  for(const scale of [0.3,0.65,1,2]){
    assert.deepEqual(snapTarget(slots,board,source,horizontal,scale),vertical);
    assert.equal(snapTarget(slots,board,horizontal,vertical,scale),null,'Same source cannot become a move');
    const filled=board.map(row=>[...row]);filled[1][1]=true;
    assert.equal(snapTarget(slots,filled,source,vertical,scale),null,'Occupied compatible slot blocks drop');
  }
});
