import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {puzzles} from '../src/data/puzzles';
import {productChrome,productPages,type ProductLanguage,type ProductPage,type ProductPageId} from '../src/lib/product-content';

const origin=(process.env.PUBLIC_SITE_URL||'https://staging-matchstick-arithmetic-levant.xhostd.app').replace(/\/$/,'');
const index=await readFile('dist/index.html','utf8');
const appIndex=index.replaceAll('__SITE_ORIGIN__',origin);
const css=index.match(/<link[^>]*rel="stylesheet"[^>]*>/)?.[0]||'';
const routes:ProductPageId[]=['parents','privacy','rules'];
const languages:ProductLanguage[]=['ru','he'];

function escapeHtml(value:string){return value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');}
function renderPage(language:ProductLanguage,page:ProductPage){
  const sections=page.sections.map(section=>{
    const paragraphs=(section.paragraphs||[]).map(text=>`<p>${escapeHtml(text)}</p>`).join('');
    const bullets=section.bullets?`<ul class="info-rules">${section.bullets.map(text=>`<li>${escapeHtml(text)}</li>`).join('')}</ul>`:'';
    return `<h2>${escapeHtml(section.heading)}</h2>${paragraphs}${bullets}`;
  }).join('');
  return `<main class="info-page" data-language="${language}" data-title="${escapeHtml(page.title)}" data-description="${escapeHtml(page.description)}"${language==='he'?' hidden':''}><p class="eyebrow">${escapeHtml(page.eyebrow)}</p><h1>${escapeHtml(page.heading)}</h1><p class="info-lead">${escapeHtml(page.lead)}</p>${sections}<a class="primary-button" href="/" data-copy="play">${escapeHtml(productChrome[language].play)}</a></main>`;
}

const pageCopy=JSON.stringify(productChrome).replaceAll('<','\\u003c');
const footer=`<footer class="product-footer"><nav data-copy-aria-label="navLabel" aria-label="Об игре"><a href="/" data-copy="play">К задачам</a><a href="/parents" data-copy="parents">Родителям</a><a href="/privacy" data-copy="privacy">Приватность</a><a href="/rules" data-copy="rules">Правила</a></nav><details class="install-help"><summary data-copy="installTitle">На главный экран</summary><p data-copy="installHelp">Android: меню браузера → «Установить приложение». iPhone и iPad: Safari → «Поделиться» → «На экран Домой».</p><button class="secondary-button" data-install-app data-copy="installButton" hidden>Установить приложение</button></details></footer>`;

for(const route of routes){
  const russian=productPages.ru[route];
  const localizedPages=languages.map(language=>renderPage(language,productPages[language][route])).join('');
  await mkdir(`dist/${route}`,{recursive:true});
  await writeFile(`dist/${route}/index.html`,`<!doctype html><html lang="ru" dir="ltr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#1a120b"><title>${escapeHtml(russian.title)} — Спички: уравнения</title><meta name="description" content="${escapeHtml(russian.description)}"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="manifest" href="/manifest.webmanifest"><meta property="og:type" content="website"><meta property="og:title" content="${escapeHtml(russian.title)} — Спички: уравнения"><meta property="og:description" content="${escapeHtml(russian.description)}"><meta property="og:image" content="${origin}/og-image.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="Спички: уравнения. Одно движение — верное равенство.">${css}<script src="/register-sw.js" defer></script><script src="/page-i18n.js" defer></script></head><body><div class="app-shell"><header class="info-header"><a class="brand" href="/"><img src="/favicon.svg" width="40" height="40" alt=""><strong data-copy="appName">Спички</strong></a><div class="info-header-tools"><a href="/" data-copy="play">К задачам</a><label class="language-picker"><span class="sr-only" data-copy="language">Язык</span><select data-page-language><option value="ru">Русский</option><option value="he">עברית</option></select><svg aria-hidden="true" width="10" height="7" viewBox="0 0 10 7"><path d="m1 1 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></label></div></header>${localizedPages}${footer}</div><script id="page-copy" type="application/json">${pageCopy}</script></body></html>`);
}

for(const route of ['success','cancel']){
  await mkdir(`dist/${route}`,{recursive:true});
  await writeFile(`dist/${route}/index.html`,appIndex);
}

await writeFile('dist/puzzles.json',JSON.stringify(puzzles));
await writeFile('dist/index.html',appIndex);
const files=await readdir('dist',{recursive:true});
const shell=['/','/parents/','/privacy/','/rules/',...files.filter(f=>/\.(html|css|js|png|svg|webmanifest)$/.test(f)&&f!=='sw.js').map(f=>`/${f}`)];
const digest=createHash('sha256');
for(const path of shell.filter(path=>!path.endsWith('/')))digest.update(await readFile(`dist${path}`));
const template=await readFile('scripts/sw-template.js','utf8');
digest.update(template);
await writeFile('dist/sw.js',template.replace('__CACHE_NAME__',`matchsticks-shell-${digest.digest('hex').slice(0,12)}`).replace('__SHELL_FILES__',JSON.stringify(shell)));
console.log('Built Russian and Hebrew product pages, fresh puzzle JSON, and shell-only service worker.');
