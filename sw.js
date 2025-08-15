
const CACHE='heatpro-autoend-v1';
const CORE=['./','./index.html','./style.css','./main.js','./manifest.webmanifest','./icons/icon-192x192.png','./icons/icon-512x512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE))); self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(self.clients.claim());});
self.addEventListener('fetch',e=>{e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(resp=>{const copy=resp.clone(); caches.open(CACHE).then(c=>c.put(e.request,copy)); return resp;}).catch(()=>caches.match('./index.html'))));});
