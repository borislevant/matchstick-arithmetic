import assert from 'node:assert/strict';
import {chromium,devices,webkit} from 'playwright';
import {mkdir} from 'node:fs/promises';

const url=process.env.TEST_URL||'http://127.0.0.1:4173';
const chromePath=process.env.CHROMIUM_PATH;
const results=[];
await mkdir('artifacts/session-10',{recursive:true});

const boardReady=async(page,label)=>{
  const started=Date.now();
  await page.goto(`${url}/#/puzzle/spark-01`);
  await page.waitForSelector('.puzzle-board');
  const elapsed=Date.now()-started;
  assert.ok(elapsed<2000,`${label}: first board took ${elapsed}ms`);
  results.push(`${label}: first board interactive in ${elapsed} ms`);
};
const center=(page,key)=>page.locator(`[data-slot="${key}"]`).evaluate(el=>{const p=new DOMPoint(0,0).matrixTransform(el.getScreenCTM()),v=visualViewport;return{x:p.x-(v?.offsetLeft||0),y:p.y-(v?.offsetTop||0)};});
const touchMove=async(page,from,to)=>{const a=await center(page,from),b=await center(page,to);await page.touchscreen.tap(a.x,a.y);await page.touchscreen.tap(b.x,b.y);};
const mouseMove=async(page,from,to)=>{const a=await center(page,from),b=await center(page,to);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:12});await page.mouse.up();};
const assertHealthy=async(page,errors,label)=>{
  assert.equal(errors.length,0,`${label}: ${errors.join(', ')}`);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${label}: horizontal overflow`);
};

// iPhone-width Safari engine: touch, hints, reset, and RTL chrome with an LTR board.
{
  const browser=await webkit.launch({headless:true});
  const context=await browser.newContext({...devices['iPhone 13'],serviceWorkers:'block'});
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await boardReady(page,'iPhone 13 / WebKit');
  await page.getByRole('button',{name:'Подсказка',exact:true}).tap();
  assert.equal(await page.locator('.hint-match').count(),1);
  await page.getByRole('button',{name:'Заново',exact:true}).tap();
  await touchMove(page,'4:2','4:4');
  await page.getByRole('heading',{name:'Верно!',exact:true}).waitFor();
  await page.getByRole('button',{name:'Заново',exact:true}).tap();
  assert.match(await page.locator('.move-counter').innerText(),/0\s*\/\s*1/);
  await page.locator('select').selectOption('he');
  assert.equal(await page.locator('html').getAttribute('dir'),'rtl');
  assert.equal(await page.locator('.puzzle-board').evaluate(el=>getComputedStyle(el).direction),'ltr');
  await page.screenshot({path:'artifacts/session-10/iphone-webkit.png',fullPage:true});
  await assertHealthy(page,errors,'iPhone 13 / WebKit');
  results.push('iPhone 13 / WebKit: hint, reset, touch solve, Hebrew RTL chrome, and centered LTR board passed');
  await browser.close();
}

// Android-width Chrome: lock gate and a mocked unlock-code restore when no hosted keys exist.
{
  const browser=await chromium.launch({headless:true,...(chromePath?{executablePath:chromePath}:{})});
  const context=await browser.newContext({...devices['Pixel 5'],serviceWorkers:'block'});
  await context.route('**/api/unlock/*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,product:'full_version'})}));
  await context.route('**/api/checkout/session',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'checkout_unavailable'})}));
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await boardReady(page,'Pixel 5 / Chrome');
  await page.goto(`${url}/#/puzzle/champion-01`);await page.waitForSelector('.access-gate');
  assert.equal(await page.getByRole('heading',{name:'Доступно в полной версии',exact:true}).count(),1);
  await page.getByRole('button',{name:'Разблокировать',exact:true}).tap();
  await page.getByLabel('Родительский PIN',{exact:true}).fill('2468');
  await page.getByLabel('Повторите PIN',{exact:true}).fill('2468');
  await page.getByRole('button',{name:'Сохранить PIN',exact:true}).tap();
  await page.getByRole('button',{name:'У меня есть код',exact:true}).tap();
  await page.getByLabel('Код разблокировки',{exact:true}).fill('QA-MOCK-CODE');
  await page.getByRole('button',{name:'Восстановить',exact:true}).tap();
  await page.getByText('Полная версия разблокирована.',{exact:true}).waitFor();
  assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('matchstick-arithmetic-v1')))).unlockCode,'QA-MOCK-CODE');

  // Re-lock locally to exercise the Russian payment-failure state behind the saved PIN.
  await page.evaluate(()=>{const key='matchstick-arithmetic-v1',value=JSON.parse(localStorage.getItem(key));value.unlocked=false;delete value.unlockCode;localStorage.setItem(key,JSON.stringify(value));window.dispatchEvent(new StorageEvent('storage',{key,newValue:JSON.stringify(value)}));});
  await page.waitForSelector('.access-gate');
  await page.reload();await page.waitForSelector('.access-gate');
  await page.getByRole('button',{name:'Разблокировать',exact:true}).tap();
  await page.getByLabel('Родительский PIN',{exact:true}).fill('2468');
  await page.getByRole('button',{name:'Продолжить',exact:true}).tap();
  await page.getByRole('button',{name:'Купить один раз',exact:true}).tap();
  await page.getByText('Тестовая оплата пока не настроена.',{exact:true}).waitFor();
  assert.equal((await page.locator('.checkout-error').innerText()).includes('Error'),false);
  await page.screenshot({path:'artifacts/session-10/android-chrome.png',fullPage:true});
  await assertHealthy(page,errors,'Pixel 5 / Chrome');
  results.push('Pixel 5 / Chrome: lock, parent PIN, mocked code restore, and Russian payment failure passed');
  await browser.close();
}

// Desktop mouse: drag solve plus the Russian catalog-load failure page with no stack trace.
{
  const browser=await chromium.launch({headless:true,...(chromePath?{executablePath:chromePath}:{})});
  const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await boardReady(page,'Desktop Chrome / mouse');
  await mouseMove(page,'4:2','4:4');
  await page.getByRole('heading',{name:'Верно!',exact:true}).waitFor();
  await page.screenshot({path:'artifacts/session-10/desktop-mouse.png'});
  await assertHealthy(page,errors,'Desktop Chrome / mouse');
  results.push('Desktop Chrome / mouse: drag solve and victory passed');

  const failed=await context.newPage(),failedErrors=[];failed.on('pageerror',error=>failedErrors.push(error.message));
  await failed.route('**/puzzles.json',route=>route.fulfill({status:503,contentType:'application/json',body:'{}'}));
  await failed.goto(`${url}/?qa=empty-error`);
  await failed.getByRole('heading',{name:'Нужен интернет, чтобы загрузить задачи',exact:true}).waitFor();
  const visibleText=await failed.locator('body').innerText();
  assert.equal(/(?:Error:|at https?:\/\/|node_modules|\.tsx?:\d+)/.test(visibleText),false);
  assert.equal(failedErrors.length,0,failedErrors.join(', '));
  results.push('Desktop Chrome / mouse: Russian catalog error is friendly and exposes no stack trace');
  await browser.close();
}

console.log(results.join('\n'));
