import {afterEach,test} from 'node:test';
import assert from 'node:assert/strict';
import {PARENT_PIN_KEY,hasParentPin,isParentPin,saveParentPin,verifyParentPin} from '../src/lib/parent-pin';

const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
afterEach(()=>{if(original)Object.defineProperty(globalThis,'localStorage',original);else Reflect.deleteProperty(globalThis,'localStorage');});
function memory(){let saved:string|null=null;return {getItem:(key:string)=>{assert.equal(key,PARENT_PIN_KEY);return saved;},setItem:(key:string,value:string)=>{assert.equal(key,PARENT_PIN_KEY);saved=value;},raw:()=>saved};}

test('parent PIN accepts exactly four Western digits',()=>{
  assert.equal(isParentPin('2468'),true);
  for(const value of ['123','12345','12a4','１２３４',''])assert.equal(isParentPin(value),false);
});

test('parent PIN is salted and hashed before local persistence',async()=>{
  const storage=memory();
  assert.equal(await saveParentPin('2468',storage),true);
  assert.equal(hasParentPin(storage),true);
  assert.equal(await verifyParentPin('2468',storage),true);
  assert.equal(await verifyParentPin('2469',storage),false);
  const raw=storage.raw()!;
  assert.equal(raw.includes('2468'),false);
  const parsed=JSON.parse(raw);
  assert.deepEqual(Object.keys(parsed).sort(),['hash','iterations','salt','version']);
  assert.notEqual(parsed.salt,parsed.hash);
});

test('missing, malformed, or unavailable PIN storage fails closed',async()=>{
  const storage=memory();
  assert.equal(hasParentPin(storage),false);
  assert.equal(await verifyParentPin('1234',storage),false);
  storage.setItem(PARENT_PIN_KEY,'{"version":1,"salt":"bad","hash":"bad","iterations":120000}');
  assert.equal(hasParentPin(storage),false);
  const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
  assert.equal(hasParentPin(blocked),false);
  assert.equal(await saveParentPin('1234',blocked),false);
});
