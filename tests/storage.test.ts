import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {puzzles} from '../src/data/puzzles';
import {setCatalog} from '../src/lib/catalog';
setCatalog(puzzles);
import {FREE_PUZZLE_IDS,canPlay} from '../src/data/access';
import {PROGRESS_KEY,readProgress,saveProgress} from '../src/lib/storage';
const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
afterEach(()=>{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else Reflect.deleteProperty(globalThis,'localStorage');});
function storage(raw:string|null){let value=raw;Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>{assert.equal(key,PROGRESS_KEY);return value;},setItem:(key:string,v:string)=>{assert.equal(key,PROGRESS_KEY);value=v;}}});return ()=>value;}
test('free IDs are exactly the first twelve easy/medium catalog entries',()=>{
 assert.deepEqual(FREE_PUZZLE_IDS,puzzles.filter(p=>p.difficulty!=='hard').slice(0,12).map(p=>p.id));
 assert.equal(new Set(FREE_PUZZLE_IDS).size,12);
 assert.equal(puzzles.filter(p=>canPlay(p.id,false)).length,12);
 assert.ok(puzzles.every(p=>canPlay(p.id,true)));
});
test('old progress migrates without losing valid solved/hinted IDs or granting access',()=>{
 storage(JSON.stringify({solvedIds:['spark-01','spark-01','old-id',4,'ember-03-v2'],hintedIds:['spark-03','bad']}));
 assert.deepEqual(readProgress(),{solvedIds:['spark-01','ember-03-v2'],hintedIds:['spark-03'],unlocked:false});
});
test('only a boolean true restores unlocked access',()=>{
 for(const unlocked of [false,'true',1,[],{},null]){storage(JSON.stringify({unlocked}));assert.equal(readProgress().unlocked,false);}
 storage('{"unlocked":true}');assert.equal(readProgress().unlocked,true);
});
test('missing, corrupt and non-object storage safely defaults to locked empty progress',()=>{
 for(const value of [null,'broken','null','42','[]','{"solvedIds":{},"hintedIds":"oops"}']){
  storage(value);assert.deepEqual(readProgress(),{solvedIds:[],hintedIds:[],unlocked:false});
 }
});
test('progress and temporary access round-trip together under the existing key',()=>{
 const saved=storage(null),p={solvedIds:['spark-01'],hintedIds:['spark-03'],unlocked:true};
 assert.equal(saveProgress(p),true);assert.deepEqual(JSON.parse(saved()!),p);assert.deepEqual(readProgress(),p);
});
test('a verified unlock code is stored with access and malformed codes are discarded',()=>{
 const saved=storage(null),p={solvedIds:[],hintedIds:[],unlocked:true,unlockCode:'un_test_paid_code'};
 assert.equal(saveProgress(p),true);assert.deepEqual(readProgress(),p);
 storage(JSON.stringify({...p,unlockCode:4}));assert.deepEqual(readProgress(),{solvedIds:[],hintedIds:[],unlocked:true});
});
test('unavailable local storage fails safely',()=>{
 Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw Error('blocked');}});
 assert.deepEqual(readProgress(),{solvedIds:[],hintedIds:[],unlocked:false});
 assert.equal(saveProgress({solvedIds:[],hintedIds:[],unlocked:true}),false);
});
