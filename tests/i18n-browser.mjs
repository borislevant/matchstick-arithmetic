import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const url=process.env.TEST_URL||'http://127.0.0.1:5174';
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
let checks=0;
const ok=(condition,message)=>{assert.ok(condition,message);checks++;};

try{
  for(const width of [320,390]){
    const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true});
    await page.goto(`${url}/parents`);
    await page.waitForSelector('[data-page-language]');
    ok(await page.locator('html').getAttribute('lang')==='ru',`legal pages default to Russian at ${width}px`);
    ok(await page.getByRole('heading',{name:'Родителям',exact:true}).isVisible(),`Russian parents copy is visible at ${width}px`);
    await page.locator('[data-page-language]').selectOption('he');
    ok(await page.locator('html').getAttribute('dir')==='rtl',`Hebrew legal page is RTL at ${width}px`);
    ok(await page.getByRole('heading',{name:'להורים',exact:true}).isVisible(),`Hebrew parents copy is visible at ${width}px`);
    ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Hebrew parents page fits ${width}px`);
    await page.goto(`${url}/privacy`);
    await page.waitForSelector('[data-page-language]');
    ok(await page.locator('html').getAttribute('lang')==='he','language persists on the privacy page');
    ok(await page.getByRole('heading',{name:'פרטיות',exact:true}).isVisible(),`Hebrew privacy copy is visible at ${width}px`);
    await page.goto(`${url}/rules`);
    await page.waitForSelector('[data-page-language]');
    ok(await page.locator('html').getAttribute('lang')==='he','language persists between legal pages');
    ok(await page.locator('main:not([hidden]) .info-rules li').count()===5,'Hebrew rules page contains five rules');
    await page.goto(url);
    await page.waitForSelector('.puzzle-card');
    ok(await page.locator('html').getAttribute('dir')==='rtl','language persists from legal page to app');
    ok(await page.locator('select').inputValue()==='he','app selector reflects persisted Hebrew');
    ok(await page.getByRole('link',{name:'להורים',exact:true}).isVisible(),'catalog footer is translated to Hebrew');
    ok(await page.locator('.install-help summary').innerText()==='הוספה למסך הבית','install help is translated to Hebrew');
    await page.goto(`${url}/#/puzzle/spark-01`);
    await page.waitForSelector('.puzzle-board');
    ok(await page.locator('.puzzle-board').evaluate(element=>getComputedStyle(element).direction)==='ltr','puzzle board stays LTR in Hebrew');
    const centered=await page.locator('.puzzle-board').evaluate(element=>{
      const board=element.getBoundingClientRect();
      const stage=element.parentElement.getBoundingClientRect();
      return Math.abs((board.left+board.right-stage.left-stage.right)/2)<1;
    });
    ok(centered,`puzzle board stays centered at ${width}px`);
    ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Hebrew play screen fits ${width}px`);
    await page.close();
  }
  console.log(`PASS: ${checks} Russian/Hebrew browser checks — persistence, RTL legal pages and LTR board.`);
}finally{await browser.close();}
