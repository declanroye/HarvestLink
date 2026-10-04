const PREFIX='harvestlink:'+new URL(self.registration.scope).pathname+':';const CACHE=PREFIX+'v29';const assets=['./style.css?release=v29','./','./index.html','./app.js','./i18n.js','./core.js','./account.js','./marketplace.js','./assistant.js','./conversation-language.js','./linking.js','./export.js','./ai/load.js','./ai/predict.mjs','./ai/model/metadata.json','./ai/model/vocabulary.json','./ai/model/weights.f32','./style.css','./model.json','./manifest.json','./icon.svg','./brand-mark.svg'];
assets.push(...assets.filter(a=>/\.(?:js|mjs)$/.test(a)).map(a=>a+'?release=v29'));
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(assets)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin||new URL(e.request.url).pathname.startsWith('/api/')||new URL(e.request.url).pathname.includes('/companion/'))return;e.respondWith(caches.open(CACHE).then(cache=>cache.match(e.request).then(c=>c||fetch(e.request))));});


