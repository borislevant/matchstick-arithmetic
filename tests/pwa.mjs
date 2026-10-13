import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
const url=process.env.TEST_URL||'http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
let checks=0;const ok=(value,label)=>{assert.ok(value,label);checks++;};
await mkdir('artifacts',{recursive:true});
const ready=async page=>{await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);};
try{
 for(const width of [320,390]){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.waitForSelector('.puzzle-card');await ready(page);
  ok(await page.locator('.puzzle-card').count()===40,'Catalog loads from JSON');
  const manifest=await (await context.request.get(`${url}/manifest.webmanifest`)).json();
  ok(manifest.name==='Спички: уравнения'&&manifest.display==='standalone'&&manifest.theme_color==='#1a120b','Manifest name/display/theme');
  ok(manifest.icons.some(i=>i.sizes==='192x192')&&manifest.icons.some(i=>i.sizes==='512x512'),'Required icon sizes');
  for(const icon of manifest.icons){const response=await context.request.get(new URL(icon.src,url).href);ok(response.ok()&&(await response.body()).subarray(1,4).toString()==='PNG',icon.src);}
  const cdp=await context.newCDPSession(page);const install=await cdp.send('Page.getInstallabilityErrors');
  ok(install.installabilityErrors.every(e=>e.errorId==='in-incognito'),JSON.stringify(install.installabilityErrors));await cdp.detach();
  const keys=await page.evaluate(async()=>{const cache=await caches.open((await caches.keys()).find(k=>k.startsWith('matchsticks-shell-')));return (await cache.keys()).map(r=>new URL(r.url).pathname);});
  ok(keys.includes('/')&&keys.includes('/parents/'),'Shell and information pages are cached');
  ok(!keys.some(k=>k.endsWith('.json')),'Puzzle JSON is absent from offline cache');
  for(const [path,title] of [['parents','Родителям'],['privacy','Приватность'],['rules','Как играть']]){
   const response=await page.goto(`${url}/${path}`);ok(response.ok(),`/${path} direct URL works`);
   await page.getByRole('heading',{name:title,exact:true}).waitFor();
   ok(await page.locator('html').getAttribute('lang')==='ru',`${path}: Russian`);
   ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${path} fits ${width}`);
   if(path==='rules')ok(await page.locator('main:not([hidden]) .info-rules li').count()===5,'Exactly five rule bullets');
   await page.reload();await page.getByRole('heading',{name:title,exact:true}).waitFor();
   if(width===390)await page.screenshot({path:`artifacts/session6-${path}.png`,fullPage:true});
  }
  await page.locator('.install-help summary').click();ok((await page.locator('.install-help').innerText()).includes('Safari'),'Home screen instructions visible');
  await context.setOffline(true);await page.goto(`${url}/privacy`);await page.getByRole('heading',{name:'Приватность',exact:true}).waitFor();checks++;
  await page.goto(url);await page.getByRole('heading',{name:'Нужен интернет, чтобы загрузить задачи',exact:true}).waitFor();
  ok(await page.locator('.puzzle-card').count()===0,'Offline refresh does not reuse puzzle data');
  await context.setOffline(false);await page.getByRole('button',{name:'Попробовать снова',exact:true}).click();await page.waitForSelector('.puzzle-card');checks++;
  ok(errors.length===0,errors.join(', '));await context.close();
 }
 // Verify actual installability in a regular temporary Chrome profile too.
 const profile=await mkdtemp('/tmp/matchsticks-install-');
 const installed=await chromium.launchPersistentContext(profile,{headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 try{
  const page=await installed.newPage();
  await page.addInitScript(()=>window.addEventListener('beforeinstallprompt',()=>{window.installOffered=true;}));
  await page.goto(url);await page.waitForSelector('.puzzle-card');await ready(page);
  const cdp=await installed.newCDPSession(page),result=await cdp.send('Page.getInstallabilityErrors');
  ok(result.installabilityErrors.length===0,JSON.stringify(result.installabilityErrors));
  await page.waitForFunction(()=>window.installOffered===true);
  await page.locator('.install-help summary').click();
  ok(await page.locator('[data-install-app]').isVisible(),'Browser install offer is exposed in home-screen help');
 }finally{await installed.close();await rm(profile,{recursive:true,force:true});}
 // A real HTTP fixture proves refresh bypasses even long-lived HTTP JSON cache,
 // and a new worker removes only obsolete shell caches.
 if(!process.env.SKIP_PWA_FIXTURE){
  let catalog=JSON.parse(await readFile('dist/puzzles.json','utf8')),requests=0,revision=1;
  const server=createServer(async(req,res)=>{
   try{
    let path=new URL(req.url,'http://localhost').pathname;
    if(path==='/puzzles.json'){requests++;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','public,max-age=31536000');res.end(JSON.stringify(catalog));return;}
    if(path==='/'||['/parents','/privacy','/rules'].includes(path))path=path==='/'?'/index.html':`${path}/index.html`;
    else if(path.endsWith('/'))path+='index.html';
    if(path.includes('..'))throw Error();
    let body=await readFile(`dist${path}`);
    if(path==='/sw.js'&&revision===2)body=Buffer.from(body.toString().replaceAll('matchsticks-shell-','matchsticks-shell-revision2-'));
    const type=path.endsWith('.js')?'application/javascript':path.endsWith('.css')?'text/css':path.endsWith('.html')?'text/html':path.endsWith('.webmanifest')?'application/manifest+json':path.endsWith('.svg')?'image/svg+xml':'image/png';
    res.setHeader('Content-Type',type);res.end(body);
   }catch{res.statusCode=404;res.end('Not found');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const context=await browser.newContext(),page=await context.newPage(),fixture=`http://127.0.0.1:${server.address().port}`;
  try{
   await page.goto(fixture);await page.waitForSelector('.puzzle-card');await ready(page);
   ok(await page.locator('.puzzle-card .equation-preview').first().getAttribute('aria-label')==='1+1=3','Fixture initial catalog');
   const old=(await page.evaluate(()=>caches.keys())).find(k=>k.startsWith('matchsticks-shell-'));
   await page.evaluate(()=>caches.open('unrelated-cache'));
   catalog=[{...catalog[1],id:catalog[0].id},...catalog.slice(1)];
   await page.reload();await page.waitForSelector('.puzzle-card');
   ok(await page.locator('.puzzle-card .equation-preview').first().getAttribute('aria-label')==='7-1=9'&&requests>=2,'Refresh obtains changed JSON despite max-age=1 year');
   revision=2;await page.evaluate(async()=>{const reg=await navigator.serviceWorker.getRegistration();await reg.update();});
   await page.waitForFunction(async old=>!(await caches.keys()).includes(old),old);
   const cachesAfter=await page.evaluate(()=>caches.keys());
   ok(cachesAfter.includes('unrelated-cache')&&cachesAfter.some(k=>k.startsWith('matchsticks-shell-revision2-')),'Worker upgrade deletes only old app shell cache');
  }finally{await context.close();await new Promise(resolve=>server.close(resolve));}
 }
 const plain=await browser.newContext({javaScriptEnabled:false});const p=await plain.newPage();
 await p.goto(`${url}/parents`);ok(await p.locator('main:not([hidden]) h1').innerText()==='Родителям','Information pages work without JavaScript');await plain.close();
 console.log(`PASS: ${checks} PWA, Russian page, installability, offline and catalog freshness checks.`);
}finally{await browser.close();}
