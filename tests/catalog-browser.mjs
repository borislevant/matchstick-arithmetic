import {grantTestAccess} from './access-fixture.mjs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { puzzles } from '../src/data/puzzles.ts';
import { solutionMoves } from '../src/lib/engine.ts';

const url=process.env.TEST_URL||'http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
try {
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await grantTestAccess(page);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.waitForSelector('.puzzle-card');
  await page.locator('select').selectOption('ru');
  for(const [label,difficulty] of [['Все','all'],['Легко','easy'],['Средне','medium'],['Сложно','hard']]){
    const expected=difficulty==='all'?puzzles:puzzles.filter(p=>p.difficulty===difficulty);
    await page.locator('.filters button').filter({hasText:label}).click();
    assert.equal(await page.locator('.puzzle-card').count(),expected.length,label);
    for(const [i,p] of expected.entries()){
      const card=page.locator('.puzzle-card').nth(i);
      assert.equal(await card.locator('.equation-preview').getAttribute('aria-label'),p.title);
      assert.equal((await card.locator('.card-moves').innerText()).trim(),p.movesAllowed===1?'1 ход':'2 хода');
    }
  }
  const cdp=await page.context().newCDPSession(page);
  const center=s=>page.locator(`[data-slot="${s.glyph}:${s.segment}"]`).evaluate(el=>{const p=new DOMPoint(0,0).matrixTransform(el.getScreenCTM()),v=visualViewport;return {x:p.x-(v?.offsetLeft||0),y:p.y-(v?.offsetTop||0)};});
  for(const p of puzzles){
    await page.goto(`${url}/#/puzzle/${p.id}`);await page.waitForSelector('.puzzle-board');
    assert.ok((await page.locator('.play-main > .sr-only[aria-live]').innerText()).includes(p.title));
    for(const [i,move] of solutionMoves(p).entries()){
      const from=await center(move.from),to=await center(move.to);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...from,id:0}]});
      for(let step=1;step<=6;step++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+(to.x-from.x)*step/6,y:from.y+(to.y-from.y)*step/6,id:0}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      assert.ok((await page.locator('.move-counter').innerText()).includes(`${i+1} / ${p.movesAllowed}`),`${p.id}: move ${i+1}`);
    }
    assert.equal(await page.locator('.play-intro h1').innerText(),'Верно!',p.title);
    console.log(`Solved ${p.id}: ${p.title}`);
  }
  assert.deepEqual(errors,[]);
  await cdp.detach();
  console.log('PASS: all 40 catalog puzzles solved with native touch at 390px; all packs, filters, previews and move badges verified.');
} finally {await browser.close();}
