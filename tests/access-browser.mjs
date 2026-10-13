import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import {puzzles} from '../src/data/puzzles.ts';
import {FREE_PUZZLE_IDS} from '../src/data/access.ts';
const url=process.env.TEST_URL||'http://127.0.0.1:4173',key='matchstick-arithmetic-v1';
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
await mkdir('artifacts',{recursive:true});let checks=0;
const ok=(v,label)=>{assert.ok(v,label);checks++;};
try{
 for(const width of [320,390]){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true});
  const paidCode=`un_test_paid_${width}`;
  await context.route('**/api/checkout/session',route=>route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({url:`${url}/success?unlock=${paidCode}`})}));
  await context.route('**/api/unlock/*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,product:'full_version'})}));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const state=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
  const route=async id=>{await page.goto(`${url}/#/puzzle/${id}`);await page.waitForSelector('.puzzle-board,.access-gate');};
  const home=async()=>{await page.goto(url);await page.waitForSelector('.puzzle-card');};
  const button=name=>page.getByRole('button',{name,exact:true});
  await home();
  ok(await page.locator('.puzzle-card').count()===40,'All catalog entries remain visible');
  ok(await page.locator('.is-locked .locked-tag').count()===28,'Twenty-eight visible locks');
  ok((await page.locator('.solved-count').innerText()).replace(/\s+/g,' ')==='Решено 0 / 40','Solved X / Y counter');
  assert.deepEqual(await page.locator('.puzzle-card:not(.is-locked)').evaluateAll(els=>els.map(el=>el.dataset.puzzleId)),FREE_PUZZLE_IDS);checks++;
  assert.deepEqual(await state(),{solvedIds:[],hintedIds:[],unlocked:false});checks++;
  await page.screenshot({path:`artifacts/session5-catalog-${width}.png`,fullPage:true});
  // Every route is gated, including direct links, and the 12 free boards open.
  for(const p of puzzles){await route(p.id);ok(await page.locator(FREE_PUZZLE_IDS.includes(p.id)?'.puzzle-board':'.access-gate').count()===1,`${p.id}: correct access`);}
  await home();await page.locator('[data-puzzle-id="ember-03-v2"]').tap();
  await page.getByRole('heading',{name:'Доступно в полной версии',exact:true}).waitFor();
  ok(await page.locator('.puzzle-board,.play-actions').count()===0,'Locked puzzle cannot be played or hinted');
  await button('Разблокировать').tap();
  const dialog=page.getByRole('dialog');
  ok((await dialog.locator('.modal-intro').innerText())==='Придумайте PIN из 4 цифр. Он понадобится перед покупкой или восстановлением доступа.','First unlock asks for parent PIN');
  ok((await state()).unlocked===false,'Opening confirmation does not unlock');
  await button('Ещё подумаю').tap();ok((await state()).unlocked===false,'Cancellation preserves lock');
  await button('Разблокировать').tap();await page.keyboard.press('Escape');ok((await state()).unlocked===false,'Escape preserves lock');
  await button('Разблокировать').tap();
  await page.getByLabel('Родительский PIN',{exact:true}).fill('2468');await page.getByLabel('Повторите PIN',{exact:true}).fill('2468');await button('Сохранить PIN').tap();
  ok((await dialog.locator('.test-mode-note').innerText())==='Оплата Stripe работает в тестовом режиме. Настоящего списания не будет.','Exact Stripe test-mode notice follows parent gate');
  await button('Закрыть').tap();
  await page.screenshot({path:`artifacts/session5-gate-${width}.png`});
  await button('Все задачи').tap();await page.waitForSelector('.puzzle-card');await page.locator('[data-puzzle-id="spark-01"]').tap();
  await button('Подсказка').tap();
  await page.locator('[data-slot="4:2"]').focus();await page.keyboard.press('Enter');
  await page.locator('[data-slot="4:4"]').focus();await page.keyboard.press('Enter');
  await page.getByRole('heading',{name:'Верно!',exact:true}).waitFor();
  await button('Все задачи').tap();await page.waitForSelector('.puzzle-card');
  ok(await page.locator('[data-puzzle-id="spark-01"] .solved-tag').count()===1,'Solved card checkmark');
  ok((await page.locator('.solved-count').innerText()).includes('1 / 40'),'Counter advances');
  await page.reload();await page.waitForSelector('.puzzle-card');
  ok((await state()).solvedIds.includes('spark-01')&&(await state()).hintedIds.includes('spark-01'),'Solved and hinted marks persist');
  await route('spark-10');await page.getByRole('button',{name:'Задача 13',exact:true}).tap();await page.waitForSelector('.access-gate');
  ok(await page.locator('.access-gate').count()===1,'Puzzle stepper cannot bypass gate');
  await button('Разблокировать').tap();
  await page.getByLabel('Родительский PIN',{exact:true}).fill('2468');await button('Продолжить').tap();await dialog.getByRole('button',{name:'Купить один раз',exact:true}).tap();
  await page.waitForURL('**/success?unlock=*');await page.getByText('Полная версия разблокирована.',{exact:true}).waitFor();await button('К задачам').tap();await page.waitForSelector('.puzzle-card');
  ok((await state()).unlocked===true&&(await state()).unlockCode===paidCode&&(await state()).solvedIds.includes('spark-01'),'Verified code preserves progress and unlocks');
  await route('ember-03-v2');await page.waitForSelector('.puzzle-board');
  await page.reload();await page.waitForSelector('.puzzle-board');ok((await state()).unlocked,'Unlock and code persist after refresh');
  await home();ok(await page.locator('.is-locked').count()===0,'All lock icons removed after unlock');
  // Progress reset is confirmed and does not revoke access.
  await button('Сбросить прогресс').tap();await button('Оставить прогресс').tap();
  ok((await state()).solvedIds.length===1,'Cancelled reset preserves progress');
  await button('Сбросить прогресс').tap();await dialog.getByRole('button',{name:'Сбросить прогресс',exact:true}).tap();
  assert.deepEqual(await state(),{solvedIds:[],hintedIds:[],unlocked:true,unlockCode:paidCode});checks++;
  ok(await page.locator('.solved-tag').count()===0,'Confirmed reset clears checkmarks');
  // Changes made in another same-origin tab update the current gate.
  await route('ember-03-v2');
  const second=await context.newPage();await second.goto(url);await second.waitForSelector('.puzzle-card');
  await second.evaluate(k=>localStorage.removeItem(k),key);await page.waitForSelector('.access-gate');
  ok(await page.locator('.puzzle-board').count()===0,'Removing local access in another tab closes locked board');
  ok(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),'Gate fits mobile viewport');
  const target=await button('Разблокировать').boundingBox();ok(target.width>=44&&target.height>=44,'Unlock touch target');
  ok(errors.length===0,errors.join(', '));await context.close();
 }
 // Old saves retain progress but do not silently acquire full access.
 const legacy=await browser.newPage();
 await legacy.addInitScript(k=>{if(!sessionStorage.getItem('seeded')){localStorage.setItem(k,JSON.stringify({solvedIds:['spark-01','ember-03-v2'],hintedIds:['spark-03']}));sessionStorage.setItem('seeded','1');}},key);
 await legacy.goto(url);await legacy.waitForSelector('.puzzle-card');
 ok(await legacy.locator('.solved-tag').count()===2&&await legacy.locator('.is-locked').count()===28,'Old save migration preserves marks, defaults locked');
 // Unavailable storage reports the failure and cannot persist paid access after reload.
 const blocked=await browser.newPage();
  await blocked.addInitScript(()=>{Storage.prototype.getItem=()=>{throw Error('blocked');};Storage.prototype.setItem=()=>{throw Error('blocked');};});
  await blocked.route('**/api/checkout/session',route=>route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({url:`${url}/success?unlock=un_blocked_storage`})}));
  await blocked.route('**/api/unlock/*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,product:'full_version'})}));
  await blocked.goto(`${url}/#/puzzle/ember-03-v2`);await blocked.waitForSelector('.access-gate');
  await blocked.getByRole('button',{name:'Разблокировать',exact:true}).click();
  await blocked.getByLabel('Родительский PIN',{exact:true}).fill('2468');await blocked.getByLabel('Повторите PIN',{exact:true}).fill('2468');await blocked.getByRole('button',{name:'Сохранить PIN',exact:true}).click();
  await blocked.getByText('Браузер не смог сохранить PIN.',{exact:true}).waitFor();
  await blocked.goto(url);await blocked.waitForSelector('.puzzle-card');
  ok(await blocked.locator('.is-locked').count()===28,'Blocked PIN storage fails closed and keeps paid access locked');
 console.log(`PASS: ${checks} progress/access checks at 320px and 390px.`);
}finally{await browser.close();}
