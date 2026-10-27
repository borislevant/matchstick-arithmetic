import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const url=process.env.TEST_URL||'http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
const copy={ru:['Очень легко','Легко','Средне','Сложно','Очень сложно'],he:['קל מאוד','קל','בינוני','קשה','קשה מאוד']};
await mkdir('artifacts/release-1.0.1',{recursive:true});
try{
  for(const width of [320,390])for(const language of ['ru','he']){
    const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(url);await page.waitForSelector('.puzzle-card');
    await page.locator('select').selectOption(language);
    const release=await (await page.request.get(`${url}/release.json`)).json();
    assert.equal(release.version,'1.0.1');assert.match(release.sourceRevision,/^[a-f0-9]{40}$/);
    for(const [i,label] of copy[language].entries()){
      const count=[0,14,16,10,0][i];
      const button=page.getByRole('button',{name:`${label} ${count}`,exact:true});
      await button.click();
      assert.equal(await button.getAttribute('aria-pressed'),'true');
      assert.equal(await page.locator('.puzzle-card').count(),count);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      if(count===0)assert.equal(await page.locator('.catalog-empty').count(),1);
    }
    const all=page.locator('.filters button').first();await all.click();
    await page.locator('.filter-row').scrollIntoViewIfNeeded();
    await page.screenshot({path:`artifacts/release-1.0.1/${language}-${width}.png`});
    assert.deepEqual(errors,[]);await page.close();
  }
  console.log('PASS: five translated difficulty filters, empty levels and release metadata at 320px/390px in Russian and Hebrew.');
}finally{await browser.close();}
