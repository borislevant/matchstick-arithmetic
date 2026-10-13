import {grantTestAccess} from './access-fixture.mjs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const url = process.env.TEST_URL || 'http://127.0.0.1:5174';
const browser = await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
const errors=[];
let checks=0;
const ok=(condition,message)=>{assert.ok(condition,message);checks++;};
const attach=page=>page.on('pageerror',e=>errors.push(e.message));
const center=async(page,key)=>page.locator(`[data-slot="${key}"]`).evaluate(el=>{const p=new DOMPoint(0,0).matrixTransform(el.getScreenCTM()),v=visualViewport;return {x:p.x-(v?.offsetLeft||0),y:p.y-(v?.offsetTop||0)};});
const drag=async(page,from,to)=>{const a=await center(page,from);const b=typeof to==='string'?await center(page,to):to;await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:15});await page.mouse.up();};
const tap=async(page,key)=>{const p=await center(page,key);await page.touchscreen.tap(p.x,p.y);};
const progress=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('matchstick-arithmetic-v1')));
const route=async(page,id)=>{await page.goto(`${url}/#/puzzle/${id}`);await page.waitForSelector('.puzzle-board');};
await mkdir('artifacts',{recursive:true});
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});attach(page);await grantTestAccess(page);
  await page.goto(url);await page.waitForSelector('.puzzle-card');
  ok(await page.locator('html').getAttribute('lang')==='ru','Russian default');
  ok(await page.locator('html').getAttribute('dir')==='ltr','Russian LTR');
  ok(await page.locator('.puzzle-card').count()===40,'40 cards');
  ok(await page.locator('.puzzle-pack').count()===3,'Three catalog packs');
  ok((await page.locator('.pack-header h3').allTextContents()).join('|')==='Старт|Знаки|Чемпион','Russian pack headings');
  await page.locator('select').selectOption('he');
  await page.screenshot({path:'artifacts/catalog-he.png',fullPage:true});
  await page.locator('select').selectOption('ru');
  await page.getByRole('button',{name:'Сложно 10',exact:true}).click();
  ok(await page.locator('.puzzle-card').count()===10,'Difficulty filter');
  await page.getByRole('button',{name:'Все 40',exact:true}).click();
  await page.screenshot({path:'artifacts/catalog-ru.png',fullPage:true});
  await page.locator('.puzzle-card').first().click();
  await page.waitForSelector('.puzzle-board');
  await page.screenshot({path:'artifacts/play-ru.png'});
  await drag(page,'4:2',{x:40,y:120});
  ok((await page.locator('.move-counter').innerText()).includes('0 / 1'),'Invalid drop costs no move');
  await drag(page,'4:2','4:4');
  await page.getByRole('heading',{name:'Верно!',exact:true}).waitFor();
  ok((await progress(page)).solvedIds.includes('spark-01'),'Mouse drag solves and saves');
  await page.getByRole('heading',{name:'Верно!',exact:true}).waitFor();
  ok((await page.locator('.move-counter').innerText()).includes('1 / 1'),'Language switching preserves board');
  await page.getByRole('button',{name:'Отменить ход',exact:true}).click();
  ok((await page.locator('.move-counter').innerText()).includes('0 / 1'),'Undo restores a solved board');
  await page.getByRole('button',{name:'Подсказка',exact:true}).click();
  ok(await page.locator('.hint-match').count()===1 && await page.locator('.target-slot').count()===0,'First hint shows source only');
  await page.getByRole('button',{name:/Подсказка/}).click();
  ok(await page.locator('.target-slot').count()===1,'Second hint shows destination');
  await page.screenshot({path:'artifacts/play-ru-hint.png'});
  // Keyboard-only placement.
  await page.locator('[data-slot="4:2"]').focus();await page.keyboard.press('Enter');
  await page.locator('[data-slot="4:4"]').focus();await page.keyboard.press('Enter');
  await page.getByRole('heading',{name:'Верно!',exact:true}).waitFor();checks++;
  await page.reload();await page.waitForSelector('.puzzle-board');
  ok(await page.locator('html').getAttribute('lang')==='ru','Language persists after refresh');
  ok((await progress(page)).solvedIds.includes('spark-01'),'Progress persists after refresh');
  // A wrong, complete move is counted, rejected and blocks extra placements.
  await drag(page,'4:2','0:4');
  ok((await page.locator('.move-counter').innerText()).includes('1 / 1'),'Wrong move counts');
  ok(await page.locator('.puzzle-board.locked').count()===1,'Move budget locks placement');
  ok(!(await page.locator('.play-intro h1').innerText()).includes('Beautifully'),'Malformed glyph never wins');
  await drag(page,'4:1','4:4');
  ok((await page.locator('.move-counter').innerText()).includes('1 / 1'),'No extra moves');
  await page.getByRole('button',{name:'Заново',exact:true}).click();
  ok((await page.locator('.move-counter').innerText()).includes('0 / 1'),'Reset restores move budget');
  // Compatible demonstration does not award a solve.
  await route(page,'spark-03');
  await page.getByRole('button',{name:'Решение',exact:true}).click();
  await page.getByRole('button',{name:'Показать',exact:true}).click();
  await page.getByRole('heading',{name:'Решение, шаг за шагом.',exact:true}).waitFor();
  ok((await page.locator('.move-counter').innerText()).includes('1 / 1'),'Compatible demonstration completes');
  ok(!(await progress(page)).solvedIds.includes('spark-03'),'Demonstration does not award a solve');
  ok((await progress(page)).hintedIds.includes('spark-03'),'Demonstration records hint use');
  await route(page,'flame-01-v2');
  for(let i=0;i<2;i++){
    await page.getByRole('button',{name:'Подсказка',exact:true}).click();
    await page.getByRole('button',{name:/Подсказка/}).click();
    const point=el=>{const p=new DOMPoint(0,0).matrixTransform(el.getScreenCTM());return {x:p.x,y:p.y};};
    const from=await page.locator('.hint-match').evaluate(point),to=await page.locator('.target-slot').evaluate(point);
    await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:15});await page.mouse.up();
  }
  await page.getByRole('heading',{name:'Верно!',exact:true}).waitFor();
  ok((await page.locator('.move-counter').innerText()).includes('2 / 2'),'Hard catalog puzzle solves in two legal moves');
  // Modal Escape and destructive progress-reset confirmation.
  await page.getByRole('button',{name:'Как играть',exact:true}).click();await page.keyboard.press('Escape');
  ok(await page.locator('dialog').count()===0,'Escape closes modal');
  await page.getByRole('button',{name:'Все задачи',exact:true}).click();
  await page.getByRole('button',{name:'Сбросить прогресс',exact:true}).click();
  await page.getByRole('button',{name:'Оставить прогресс',exact:true}).click();
  ok((await progress(page)).solvedIds.length>0,'Reset cancellation preserves progress');
  await page.getByRole('button',{name:'Сбросить прогресс',exact:true}).click();await page.locator('dialog').getByRole('button',{name:'Сбросить прогресс',exact:true}).click();
  ok((await progress(page)).solvedIds.length===0,'Progress reset works');
  // Catalog + long equation layouts in all languages on narrow screens.
  for(const width of [320,390]){
    const mobile=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true});attach(mobile);await grantTestAccess(mobile);
    await mobile.goto(url);await mobile.waitForSelector('.puzzle-card');
    for(const lang of ['he','ru']){
      await mobile.locator('select').selectOption(lang);
      ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${lang} catalog fits ${width}px`);
      await route(mobile,'ember-08');
      ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${lang} long equation fits ${width}px`);
      await mobile.goto(url);await mobile.waitForSelector('.puzzle-card');
    }
    await mobile.locator('select').selectOption('he');
    if(width===390)await mobile.screenshot({path:'artifacts/mobile-he.png',fullPage:true});
    await mobile.locator('.puzzle-card').first().click();await mobile.waitForSelector('.puzzle-board');
    await tap(mobile,'4:2');await tap(mobile,'4:4');await mobile.getByRole('heading',{name:'בדיוק! הצלחתם.',exact:true}).waitFor();
    ok((await progress(mobile)).solvedIds.includes('spark-01'),`Touch selection solves at ${width}px`);
    await mobile.waitForTimeout(250);
    if(width===390)await mobile.screenshot({path:'artifacts/mobile-solved.png'});
    await mobile.close();
  }
  // Bad/blocked storage must never turn into a blank screen.
  const corrupt=await browser.newPage();attach(corrupt);
  await corrupt.addInitScript(()=>localStorage.setItem('matchstick-arithmetic-v1','broken json'));
  await corrupt.goto(url);await corrupt.waitForSelector('.puzzle-card');ok(await corrupt.locator('.puzzle-card').count()===40,'Malformed storage is tolerated');
  const blocked=await browser.newPage();attach(blocked);
  await blocked.addInitScript(()=>{Storage.prototype.setItem=()=>{throw new Error('Storage unavailable');};});
  await blocked.goto(url);await blocked.waitForSelector('.puzzle-card');ok(await blocked.locator('.storage-warning').count()===1,'Unavailable storage leaves game playable');
  ok(errors.length===0,`No runtime exceptions: ${errors.join(', ')}`);
  console.log(`PASS: ${checks} browser checks — mouse, touch, keyboard, languages, mobile layouts, hints, move limits, solutions and persistence.`);
} finally {await browser.close();}
