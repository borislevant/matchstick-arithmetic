import {grantTestAccess} from './access-fixture.mjs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const url=process.env.TEST_URL||'http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
let checks=0;
const ok=(value,label)=>{assert.ok(value,label);checks++;};
await mkdir('artifacts',{recursive:true});
try {
  for(const width of [320,390]){
    const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true});
    await grantTestAccess(page);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`${url}/#/puzzle/spark-01`);await page.waitForSelector('.puzzle-board');
    await page.locator('select').selectOption('ru');
    const cdp=await page.context().newCDPSession(page);
    const center=key=>page.locator(`[data-slot="${key}"]`).evaluate(el=>{const p=new DOMPoint(0,0).matrixTransform(el.getScreenCTM()),v=visualViewport;return {x:p.x-(v?.offsetLeft||0),y:p.y-(v?.offsetTop||0)};});
    const touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map((p,i)=>({...p,id:i,radiusX:1,radiusY:1,force:1}))});
    const drag=async(from,to,cancel=false)=>{
      const a=typeof from==='string'?await center(from):from,b=typeof to==='string'?await center(to):to;
      await touch('touchStart',[a]);
      for(let i=1;i<=8;i++)await touch('touchMove',[{x:a.x+(b.x-a.x)*i/8,y:a.y+(b.y-a.y)*i/8}]);
      await touch(cancel?'touchCancel':'touchEnd',[]);
    };
    const counter=async expected=>ok((await page.locator('.move-counter').innerText()).includes(expected),`${width}px counter ${expected}`);
    const reset=()=>page.getByRole('button',{name:'Заново',exact:true}).click();
    const equation=()=>page.locator('.play-main > .sr-only[aria-live]').innerText();
    for(const [label,to,cancel] of [
      ['source','4:2',false],['occupied','4:3',false],['perpendicular','0:0',false],
      ['off-board',{x:30,y:120},false],['cancelled','4:4',true],
    ]){
      await drag('4:2',to,cancel);await counter('0 / 1');
      ok((await equation()).includes('1+1=3'),`${label} drop leaves equation unchanged`);
      await page.waitForTimeout(250);
      ok(await page.locator('.match.dragging').count()===0,`${label} springs back`);
    }
    // Tap and keyboard alternatives use the same orientation guard.
    const tap=async key=>{const p=await center(key);await page.touchscreen.tap(p.x,p.y);};
    await tap('4:2');await tap('0:0');await counter('0 / 1');
    await page.locator('[data-slot="4:2"]').focus();await page.keyboard.press('Enter');
    await page.locator('[data-slot="0:0"]').focus();await page.keyboard.press('Enter');await counter('0 / 1');
    await page.keyboard.press('Escape');
    // Losing pointer capture must return the stick without spending a move.
    await page.locator('.puzzle-board').evaluate(svg=>svg.addEventListener('pointerdown',e=>svg.dataset.testPointer=String(e.pointerId),{once:true}));
    await touch('touchStart',[await center('4:2')]);
    await touch('touchMove',[await center('4:4')]);
    await page.locator('.puzzle-board').evaluate(svg=>svg.releasePointerCapture(Number(svg.dataset.testPointer)));
    await touch('touchEnd',[]);await counter('0 / 1');
    // A cancellation from an unrelated second finger cannot cancel the drag.
    const source=await center('4:2'),destination=await center('4:4');
    await touch('touchStart',[source]);
    await page.locator('.puzzle-board').dispatchEvent('pointercancel',{pointerId:99999,pointerType:'touch'});
    await touch('touchMove',[destination]);await touch('touchEnd',[]);
    await page.getByRole('heading',{name:'Верно!',exact:true}).waitFor();await counter('1 / 1');
    ok((await equation()).includes('1+1=2'),`${width}px required path ends at 1+1=2`);
    ok((await page.locator('.board-message[role="status"]').innerText()).includes('Верно!'),`${width}px victory toast`);
    ok(await page.evaluate(()=>JSON.parse(localStorage.getItem('matchstick-arithmetic-v1')).solvedIds.includes('spark-01')),'Victory saves progress');
    await page.screenshot({path:`artifacts/session2-touch-${width}.png`});
    await reset();
    // Grab 21 CSS pixels from a stick's centerline, inside its 44px hit area.
    const broadHit=await center('0:2');broadHit.x-=21;
    const broadTarget=await center('0:4');broadTarget.x-=21;
    await drag(broadHit,broadTarget);await counter('1 / 1');
    ok((await page.locator('.play-table').innerText()).includes('Непонятная фигура'),'Unreadable final glyph loses');
    await reset();
    await drag('4:1','4:5');await counter('1 / 1');
    ok((await page.locator('.board-message').innerText()).includes('Ходы закончились'),'Readable false equation exhausts moves');
    await drag('4:2','4:4');await counter('1 / 1');
    // Unreadable intermediate states report immediately without blocking a
    // remaining move needed for a multi-move construction.
    await page.goto(`${url}/#/puzzle/flame-01-v2`);await page.waitForSelector('.puzzle-board');
    await drag('0:2','0:1');await counter('1 / 2');
    ok((await page.locator('.board-message').innerText()).includes('Непонятная фигура'),'Unreadable intermediate glyph is reported');
    ok(await page.locator('.puzzle-board.locked').count()===0,'One move remains');
    ok(errors.length===0,errors.join(', '));
    await cdp.detach();await page.close();
  }
  console.log(`PASS: ${checks} mobile checks; 1+1=3 -> 1+1=2 -> victory toast at 320px and 390px.`);
} finally {await browser.close();}
