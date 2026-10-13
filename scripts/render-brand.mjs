import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
try{
 for(const [source,target,width,height] of [['icon.svg','icon-192.png',192,192],['icon.svg','icon-512.png',512,512],['icon.svg','apple-touch-icon.png',180,180],['favicon.svg','favicon-32.png',32,32],['og-image.svg','og-image.png',1200,630]]){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
  await page.setContent(`<style>html,body{margin:0;width:100%;height:100%;overflow:hidden}svg{display:block;width:100%;height:100%}</style>${await readFile(`public/${source}`,'utf8')}`);
  await page.screenshot({path:`public/${target}`,omitBackground:true});await page.close();
 }
}finally{await browser.close();}
