const CACHE = '__CACHE_NAME__';
const SHELL = __SHELL_FILES__;
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL.map(path=>new Request(path,{cache:'reload'})))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('matchsticks-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin)return;
  if(url.pathname.startsWith('/api/'))return;
  // Never cache puzzle data, even if a previous HTTP response had a long max-age.
  if(url.pathname==='/puzzles.json'){
    event.respondWith(fetch(new Request(request,{cache:'no-store'})));return;
  }
  let path=url.pathname;
  if(['/parents','/privacy','/rules'].includes(path))path+='/';
  if(!SHELL.includes(path))return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(new Request(request,{cache:'no-store'})).catch(()=>caches.match(path)));return;
  }
  event.respondWith(caches.match(path).then(cached=>cached||fetch(request)));
});
