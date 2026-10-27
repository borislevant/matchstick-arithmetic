import {test} from 'node:test';
import assert from 'node:assert/strict';
import {puzzles as authored} from '../src/data/puzzles';
import {setCatalog,loadCatalog,puzzles} from '../src/lib/catalog';
test('runtime catalog accepts authored data and rejects incomplete or unreadable input',()=>{
 setCatalog(authored);assert.equal(puzzles.length,40);
 for(const bad of [null,[],[{}],[{...authored[0],title:'wrong'}],[{...authored[0],pack:'unknown'}],[{...authored[0],glyphs:[null]}],[authored[0],authored[0]]])assert.throws(()=>setCatalog(bad));
});
test('catalog requests explicitly bypass HTTP cache on every load',async()=>{
 const original=globalThis.fetch;let count=0;
 globalThis.fetch=(async(url,options)=>{assert.equal(url,'/puzzles.json');assert.equal(options?.cache,'no-store');count++;return new Response(JSON.stringify(authored));}) as typeof fetch;
 try{await loadCatalog();await loadCatalog();assert.equal(count,2);}finally{globalThis.fetch=original;}
});
test('failed catalog fetch does not silently fall back to stale puzzles',async()=>{
 const original=globalThis.fetch;globalThis.fetch=(async()=>new Response('unavailable',{status:503})) as typeof fetch;
 try{await assert.rejects(loadCatalog());}finally{globalThis.fetch=original;}
});
test('catalog rejects solved starts and awaits complete verification before publishing',async()=>{
 const previous=[...puzzles];
 const shortcut=authored.find(p=>p.title==='1+9=7')!;
 await assert.rejects(setCatalog([structuredClone(shortcut)],{verify:true})!);
 assert.deepEqual(puzzles,previous);
 await setCatalog([structuredClone(authored[0])],{verify:true});
 assert.equal(puzzles.length,1);
 assert.equal(puzzles[0].minDistance,1);
 const solved={...structuredClone(authored[0]),title:'1+1=2'};
 solved.glyphs[4].initialSegments=[true,true,false,true,true,false,true];
 assert.throws(()=>setCatalog([solved]));
 setCatalog(authored);
});
