import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';

const url=process.env.TEST_URL||'http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
let checks=0;const ok=(value,label)=>{assert.ok(value,label);checks++;};
await mkdir('artifacts',{recursive:true});

async function mockPayments(context,paidCode){
  let checkouts=0;
  await context.route('**/api/checkout/session',route=>{checkouts++;return route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({url:`${url}/success?unlock=${encodeURIComponent(paidCode)}`})});});
  await context.route('**/api/unlock/*',route=>{
    const code=decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop());
    return route.fulfill({status:code===paidCode?200:404,contentType:'application/json',body:JSON.stringify(code===paidCode?{ok:true,product:'full_version'}:{ok:false})});
  });
  return ()=>checkouts;
}

async function setPin(page,pin='2468'){
  await page.getByLabel('Родительский PIN',{exact:true}).fill(pin);
  await page.getByLabel('Повторите PIN',{exact:true}).fill(pin);
  await page.getByRole('button',{name:'Сохранить PIN',exact:true}).click();
}

try{
  // 320px: settings first use, hashed PIN, wrong-PIN rejection, and code restore.
  {
    const context=await browser.newContext({viewport:{width:320,height:844},isMobile:true,hasTouch:true});
    const paidCode='un_session9_restore_320',checkoutCount=await mockPayments(context,paidCode),page=await context.newPage();
    await page.goto(`${url}/#/puzzle/spark-01`);await page.waitForSelector('.puzzle-board');
    ok(await page.getByRole('button',{name:'Разблокировать',exact:true}).count()===0,'Free child play screen has no checkout control');
    ok(checkoutCount()===0,'Free play does not call checkout');
    const settings=page.getByRole('button',{name:'Настройки для родителей',exact:true});
    const box=await settings.boundingBox();ok(box.width>=44&&box.height>=44,'Parent settings target is at least 44px');
    await settings.tap();await page.getByRole('heading',{name:'Задайте родительский PIN',exact:true}).waitFor();
    await page.getByLabel('Родительский PIN',{exact:true}).fill('123');await page.getByLabel('Повторите PIN',{exact:true}).fill('123');await page.getByRole('button',{name:'Сохранить PIN',exact:true}).tap();
    await page.getByText('Введите ровно 4 цифры.',{exact:true}).waitFor();
    await setPin(page);
    await page.getByRole('heading',{name:'Настройки для родителей',exact:true}).waitFor();
    const raw=await page.evaluate(()=>localStorage.getItem('matchstick-parent-pin-v1'));
    ok(!!raw&&!raw.includes('2468'),'Stored parent PIN record contains no plaintext PIN');
    const record=JSON.parse(raw);ok(typeof record.hash==='string'&&typeof record.salt==='string'&&record.hash!==record.salt,'Stored PIN has separate salt and hash');
    await page.getByRole('button',{name:'Закрыть',exact:true}).tap();
    await page.goto(`${url}/#/puzzle/ember-03-v2`);await page.waitForSelector('.access-gate');
    await page.getByRole('button',{name:'Разблокировать',exact:true}).tap();
    await page.getByRole('heading',{name:'Для родителей',exact:true}).waitFor();ok(checkoutCount()===0,'Locked screen cannot call checkout before PIN');
    await page.getByLabel('Родительский PIN',{exact:true}).fill('1111');await page.getByRole('button',{name:'Продолжить',exact:true}).tap();await page.getByText('Неверный PIN.',{exact:true}).waitFor();ok(checkoutCount()===0,'Wrong PIN cannot call checkout');
    await page.getByLabel('Родительский PIN',{exact:true}).fill('2468');await page.getByRole('button',{name:'Продолжить',exact:true}).tap();
    await page.getByRole('heading',{name:'Полная версия',exact:true}).waitFor();
    ok((await page.getByRole('dialog').innerText()).includes('«Полная версия» — единоразовая покупка. Подписки нет.'),'Offer says one-time and no subscription');
    await page.screenshot({path:'artifacts/session9-parent-320.png'});
    await page.getByRole('button',{name:'У меня есть код',exact:true}).tap();await page.getByRole('heading',{name:'Восстановить доступ',exact:true}).waitFor();
    await page.getByLabel('Код разблокировки',{exact:true}).fill('bad-code');await page.getByRole('button',{name:'Восстановить',exact:true}).tap();await page.getByText('Этот код не активирован.',{exact:true}).waitFor();
    await page.getByLabel('Код разблокировки',{exact:true}).fill(paidCode);await page.getByRole('button',{name:'Восстановить',exact:true}).tap();await page.waitForSelector('.puzzle-board');
    const progress=await page.evaluate(()=>JSON.parse(localStorage.getItem('matchstick-arithmetic-v1')));
    ok(progress.unlocked===true&&progress.unlockCode===paidCode,'Valid code restores and persists full access');
    ok(checkoutCount()===0,'Code restoration never opens checkout');
    ok(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),'Parent flow fits iPhone-width viewport');
    await context.close();
  }

  // 390px: unlock-first PIN setup, hosted checkout return, and Russian cancel page.
  {
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    const paidCode='un_session9_checkout_390',checkoutCount=await mockPayments(context,paidCode),page=await context.newPage();
    await page.goto(`${url}/#/puzzle/ember-03-v2`);await page.waitForSelector('.access-gate');await page.getByRole('button',{name:'Разблокировать',exact:true}).tap();
    await page.getByRole('heading',{name:'Задайте родительский PIN',exact:true}).waitFor();await setPin(page,'1357');
    await page.getByRole('heading',{name:'Полная версия',exact:true}).waitFor();ok(checkoutCount()===0,'PIN setup itself does not open checkout');
    await page.getByRole('button',{name:'Купить один раз',exact:true}).tap();
    await page.waitForURL(current=>current.pathname.replace(/\/$/,'')==='/success');await page.getByRole('heading',{name:'Покупка подтверждена',exact:true}).waitFor();await page.getByText('Полная версия разблокирована.',{exact:true}).waitFor();
    await page.screenshot({path:'artifacts/session9-success-390.png'});
    ok(checkoutCount()===1,'Correct parent flow opens checkout exactly once');
    ok((await page.evaluate(()=>JSON.parse(localStorage.getItem('matchstick-arithmetic-v1')))).unlockCode===paidCode,'Success page saves verified code');
    await page.goto(`${url}/cancel`);await page.getByRole('heading',{name:'Оплата отменена',exact:true}).waitFor();
    await page.screenshot({path:'artifacts/session9-cancel-390.png'});
    ok((await page.locator('.payment-return').innerText()).includes('Доступ не изменился.'),'Cancel page explains unchanged access in Russian');
    ok(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),'Return pages fit Android-width viewport');
    await context.close();
  }
  if(process.env.EXPECT_CHECKOUT_UNAVAILABLE==='1'){
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage();
    await page.goto(`${url}/#/puzzle/ember-03-v2`);await page.waitForSelector('.access-gate');await page.getByRole('button',{name:'Разблокировать',exact:true}).tap();await setPin(page,'8642');
    await page.getByRole('button',{name:'Купить один раз',exact:true}).tap();await page.getByText('Тестовая оплата пока не настроена.',{exact:true}).waitFor();checks++;
    await page.getByRole('button',{name:'У меня есть код',exact:true}).tap();await page.getByLabel('Код разблокировки',{exact:true}).fill('un_not_configured');await page.getByRole('button',{name:'Восстановить',exact:true}).tap();await page.getByText('Не удалось проверить код. Попробуйте снова при подключении к интернету.',{exact:true}).waitFor();checks++;
    await context.close();
  }
  console.log(`PASS: ${checks} parent purchase checks at 320px and 390px.`);
} finally { await browser.close(); }
