const CACHE='whatsup-dog-v11-smart-report-v2';
const CORE=['./','./index.html','./styles.css?v=5','./home.css?v=5','./app.js?v=5','./official-areas.js?v=6','./home.js?v=5','./smart-report.css?v=2','./smart-report-v2.js?v=2','./manifest.webmanifest','./icon.svg','./waldo-mark.png','./data/nijkerk-losloopgebieden.geojson'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==location.origin){event.respondWith(fetch(event.request));return}
  if(event.request.mode==='navigate'){event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{const clone=response.clone();caches.open(CACHE).then(cache=>cache.put('./index.html',clone));return response}).catch(()=>caches.match('./index.html')));return}
  event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{const clone=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,clone));return response}).catch(()=>caches.match(event.request)))
});