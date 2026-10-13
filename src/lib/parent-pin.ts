export const PARENT_PIN_KEY = 'matchstick-parent-pin-v1';
const ITERATIONS = 120_000;

type PinStorage = Pick<Storage, 'getItem' | 'setItem'>;
type PinRecord = { version: 1; salt: string; hash: string; iterations: number };

const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const decode = (value: string) => {
  const normalized=value.replaceAll('-','+').replaceAll('_','/').padEnd(Math.ceil(value.length/4)*4,'=');
  return Uint8Array.from(atob(normalized),character=>character.charCodeAt(0));
};

function record(storage: PinStorage = localStorage): PinRecord | null {
  try {
    const value=JSON.parse(storage.getItem(PARENT_PIN_KEY)??'null');
    if(value?.version!==1||typeof value.salt!=='string'||typeof value.hash!=='string'||!Number.isInteger(value.iterations)||value.iterations<100_000||value.iterations>500_000)return null;
    const salt=decode(value.salt),hash=decode(value.hash);
    return salt.length===16&&hash.length===32?value:null;
  } catch { return null; }
}

async function derive(pin: string, salt: Uint8Array, iterations: number) {
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new Uint8Array(salt),iterations},key,256);
  return new Uint8Array(bits);
}

export const isParentPin = (pin: string) => /^\d{4}$/.test(pin);
export const hasParentPin = (storage: PinStorage = localStorage) => record(storage)!==null;

export async function saveParentPin(pin: string, storage: PinStorage = localStorage) {
  if(!isParentPin(pin))return false;
  try {
    const salt=crypto.getRandomValues(new Uint8Array(16));
    const hash=await derive(pin,salt,ITERATIONS);
    storage.setItem(PARENT_PIN_KEY,JSON.stringify({version:1,salt:encode(salt),hash:encode(hash),iterations:ITERATIONS} satisfies PinRecord));
    return true;
  } catch { return false; }
}

export async function verifyParentPin(pin: string, storage: PinStorage = localStorage) {
  if(!isParentPin(pin))return false;
  const saved=record(storage);if(!saved)return false;
  try {
    const actual=await derive(pin,decode(saved.salt),saved.iterations),expected=decode(saved.hash);
    let difference=actual.length^expected.length;
    for(let index=0;index<Math.min(actual.length,expected.length);index++)difference|=actual[index]^expected[index];
    return difference===0;
  } catch { return false; }
}
