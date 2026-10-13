import { useEffect, useId, useMemo, useRef, useState, type PointerEvent } from 'react';
import { compatibleSlots, layout, sameSlot, slotKey, snapTarget, type BoardState, type Move, type Puzzle, type Slot, type SlotGeometry } from '../lib/engine';
import type { Copy } from '../lib/i18n';

export type Match = {id: string; slot: Slot};
export function initialMatches(board: BoardState): Match[] { return board.flatMap((row,glyph) => row.flatMap((filled,segment) => filled ? [{id:`${glyph}:${segment}`,slot:{glyph,segment}}] : [])); }
export function WoodMatch({wood,head}:{wood:string;head:string}) {
  return <><rect x="-22" y="-3.7" width="44" height="7.4" rx="2.8" fill={`url(#${wood})`}/><path d="M-14-1h29M-10 1.5h22" stroke="#f7e0b3" strokeOpacity=".22" strokeWidth=".65"/><rect x="-23" y="-4.6" width="10" height="9.2" rx="4.2" fill={`url(#${head})`}/><path d="M-20-2.8h3" stroke="#a96640" strokeOpacity=".65" strokeWidth="1.4" strokeLinecap="round"/></>;
}
function MatchDefs({id}:{id:string}) {
  return <defs><linearGradient id={`${id}-wood`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#e7cba0"/><stop offset=".45" stopColor="#c4a574"/><stop offset="1" stopColor="#94714b"/></linearGradient><linearGradient id={`${id}-head`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#925a39"/><stop offset=".4" stopColor="#593420"/><stop offset="1" stopColor="#321e13"/></linearGradient></defs>;
}
export function Preview({puzzle,className=''}:{puzzle:Puzzle;className?:string}) {
  const id = useId().replace(/:/g,'');
  const geo = useMemo(()=>layout(puzzle.glyphs),[puzzle]);
  return <svg className={`equation-preview ${className}`} viewBox={`0 0 ${geo.width} ${geo.height}`} aria-label={puzzle.title} role="img"><MatchDefs id={id}/>{geo.slots.filter(s=>puzzle.glyphs[s.glyph].initialSegments[s.segment]).map(s=><g key={slotKey(s)} transform={`translate(${s.x} ${s.y}) rotate(${s.angle})`}><WoodMatch wood={`${id}-wood`} head={`${id}-head`}/></g>)}</svg>;
}
type Drag = {from: Slot; x:number; y:number; angle:number; target:Slot|null};
type Press = {id:number; from:Slot; x:number; y:number; moved:boolean; offsetX:number;offsetY:number; tapTarget?:Slot};
export function Board({puzzle,board,matches,onMove,disabled,hint,copy,celebrate,resetKey,demonstrating}:{puzzle:Puzzle;board:BoardState;matches:Match[];onMove:(move:Move)=>void;disabled:boolean;hint:Partial<Move>|null;copy:Copy;celebrate:boolean;resetKey:number;demonstrating:boolean}) {
  const id = useId().replace(/:/g,'');
  const svgRef = useRef<SVGSVGElement>(null);
  const geo = useMemo(()=>layout(puzzle.glyphs),[puzzle]);
  const [selected,setSelected] = useState<Slot|null>(null);
  const [drag,setDrag] = useState<Drag|null>(null);
  const press = useRef<Press|null>(null);
  const raf = useRef(0);
  const dragRef = useRef<Drag|null>(null);
  useEffect(()=>{cancelDrag();},[board,disabled,resetKey]);
  useEffect(()=>()=>cancelAnimationFrame(raf.current),[]);
  const position = (slot:Slot) => geo.slots.find(s=>sameSlot(s,slot))!;
  function point(clientX:number,clientY:number) {
    const svg = svgRef.current!;
    const p = new DOMPoint(clientX,clientY).matrixTransform(svg.getScreenCTM()!.inverse());
    return {x:p.x,y:p.y};
  }
  function scale() { return svgRef.current?.getScreenCTM()?.a ?? 1; }
  // Nearest distance to a segment gives every match a 44 CSS-pixel touch area,
  // without overlapping transparent rectangles stealing neighboring matches.
  function distance(p:{x:number;y:number},s:SlotGeometry) {
    const a = s.angle*Math.PI/180, dx=p.x-s.x,dy=p.y-s.y;
    const along = dx*Math.cos(a)+dy*Math.sin(a), across = -dx*Math.sin(a)+dy*Math.cos(a);
    return Math.hypot(Math.max(0,Math.abs(along)-22),across)*scale();
  }
  function hit(p:{x:number;y:number},includeEmpty=false) {
    return geo.slots.filter(s=>includeEmpty||board[s.glyph][s.segment]).map(s=>({s,d:distance(p,s)})).filter(x=>x.d<=22).sort((a,b)=>a.d-b.d)[0]?.s ?? null;
  }
  function target(p:{x:number;y:number},from:Slot) {
    return snapTarget(geo.slots,board,from,p,scale());
  }
  function pointerDown(event:PointerEvent<SVGSVGElement>) {
    if(disabled||press.current||event.button!==0)return;
    const p=point(event.clientX,event.clientY), found=hit(p,!!selected);
    if(!found){setSelected(null);return;}
    if(selected&&!board[found.glyph][found.segment]&&!compatibleSlots(position(selected),found)){setSelected(null);return;}
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    if(selected&&!board[found.glyph][found.segment]) {
      press.current={id:event.pointerId,from:selected,x:event.clientX,y:event.clientY,moved:false,offsetX:0,offsetY:0,tapTarget:found};
      return;
    }
    if(!board[found.glyph][found.segment])return;
    setSelected(found);
    press.current={id:event.pointerId,from:found,x:event.clientX,y:event.clientY,moved:false,offsetX:p.x-found.x,offsetY:p.y-found.y};
  }
  function pointerMove(event:PointerEvent<SVGSVGElement>) {
    const active=press.current;
    if(!active||active.id!==event.pointerId||active.tapTarget)return;
    if(Math.hypot(event.clientX-active.x,event.clientY-active.y)>5)active.moved=true;
    if(!active.moved)return;
    const p=point(event.clientX,event.clientY);
    p.x-=active.offsetX;p.y-=active.offsetY;
    const nearest=target(p,active.from), source=position(active.from);
    dragRef.current={from:active.from,x:p.x,y:p.y,angle:source.angle,target:nearest};
    if(!raf.current)raf.current=requestAnimationFrame(()=>{setDrag(dragRef.current);raf.current=0;});
  }
  function pointerUp(event:PointerEvent<SVGSVGElement>) {
    const active=press.current;
    if(!active||active.id!==event.pointerId||disabled)return;
    const p=point(event.clientX,event.clientY);
    p.x-=active.offsetX;p.y-=active.offsetY;
    const destination=active.tapTarget ? (Math.hypot(event.clientX-active.x,event.clientY-active.y)<10 ? active.tapTarget : null) : active.moved ? target(p,active.from) : null;
    cancelAnimationFrame(raf.current);raf.current=0;press.current=null;dragRef.current=null;setDrag(null);
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
    if(destination){onMove({from:active.from,to:destination});setSelected(null);}
    else if(active.moved)setSelected(null);
  }
  function cancelDrag(){const active=press.current;press.current=null;dragRef.current=null;setDrag(null);setSelected(null);cancelAnimationFrame(raf.current);raf.current=0;if(active&&svgRef.current?.hasPointerCapture(active.id))svgRef.current.releasePointerCapture(active.id);}
  function activate(slot:Slot){
    if(disabled)return;
    if(board[slot.glyph][slot.segment])setSelected(sameSlot(slot,selected)?null:slot);
    else if(selected&&compatibleSlots(position(selected),position(slot))){onMove({from:selected,to:slot});setSelected(null);}
  }
  function label(s:SlotGeometry){
    const g=puzzle.glyphs[s.glyph];
    const names=g.type==='digit'?copy.segmentNames:g.type==='equals'?copy.equalityNames:g.type==='times'?copy.timesNames:copy.operatorNames;
    return `${copy.position} ${s.glyph+1}, ${names[s.segment]}, ${board[s.glyph][s.segment]?copy.occupied:copy.empty}${sameSlot(s,selected)?`, ${copy.selected}`:''}`;
  }
  return <svg ref={svgRef} className={`puzzle-board ${celebrate?'celebrating':''} ${disabled?'locked':''} ${demonstrating?'demonstrating':''}`} viewBox={`0 0 ${geo.width} ${geo.height}`} role="group" aria-label={copy.currentEquation} aria-describedby="board-keyboard-help" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={e=>{if(press.current?.id===e.pointerId)cancelDrag();}} onLostPointerCapture={e=>{if(press.current?.id===e.pointerId)cancelDrag();}} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();cancelDrag();}}}>
    <MatchDefs id={id}/>
    {geo.slots.map(s=>{const active=sameSlot(drag?.target??null,s)||sameSlot(hint?.to??null,s), picked=sameSlot(selected,s);return <g key={slotKey(s)} transform={`translate(${s.x} ${s.y}) rotate(${s.angle})`} className={`segment-slot ${active?'target-slot':''} ${picked?'picked-slot':''}`} role="button" tabIndex={disabled?-1:board[s.glyph][s.segment]||selected?0:-1} aria-label={label(s)} aria-disabled={disabled||(!board[s.glyph][s.segment]&&!selected)} aria-pressed={picked} data-slot={slotKey(s)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate(s);}}}>
      <rect className="slot-focus" x="-25" y="-12" width="50" height="24" rx="8"/>
      <rect className="slot-line" x="-21" y="-3.4" width="42" height="6.8" rx="3"/>
      {active&&<circle className="target-dot" cx="0" cy="0" r="3"/>}
    </g>;})}
    {[...matches].sort((a,b)=>Number(sameSlot(a.slot,selected))-Number(sameSlot(b.slot,selected))).map(match=>{
      const s=position(match.slot), dragging=drag&&sameSlot(drag.from,match.slot), picked=sameSlot(selected,match.slot), glow=sameSlot(hint?.from??null,match.slot);
      const x=dragging?drag.x:s.x,y=dragging?drag.y:s.y,angle=dragging?drag.angle:s.angle;
      return <g key={match.id} data-match={match.id} className={`match ${dragging?'dragging':''} ${picked?'picked':''} ${glow?'hint-match':''}`} style={{transform:`translate(${x}px,${y}px) rotate(${angle}deg) scale(${picked?1.06:1})`}} pointerEvents="none"><WoodMatch wood={`${id}-wood`} head={`${id}-head`}/></g>;
    })}
  </svg>;
}
