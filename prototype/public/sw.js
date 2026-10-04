const PREFIX='harvestlink:'+new URL(self.registration.scope).pathname+':';const CACHE=PREFIX+'v11';const assets=['./','./index.html','./app.js','./i18n.js','./core.js','./account.js','./style.css','./model.json','./manifest.json','./icon.svg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(assets)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin||new URL(e.request.url).pathname.startsWith('/api/'))return;e.respondWith(caches.open(CACHE).then(cache=>cache.match(e.request).then(c=>c||fetch(e.request))));});


