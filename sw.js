const V='mg-v5-fix',SHELL=['games/snake/','games/tank/','fonts/PressStart2P.woff2','./','index.html','style.css','ads.js','games.json','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(n=>n!==V).map(n=>caches.delete(n)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const r=e.request,u=new URL(r.url);if(r.method!=='GET'||u.origin!==location.origin)return;
  const put=res=>{if(res.ok){const cp=res.clone();caches.open(V).then(c=>c.put(r,cp))}return res};
  if(u.pathname.endsWith('games.json')||r.mode==='navigate'&&u.pathname.endsWith('/')&&!u.pathname.includes('/games/'))
    e.respondWith(fetch(r).then(put).catch(()=>caches.match(r,{ignoreSearch:true})));       // network-first
  else e.respondWith(caches.match(r,{ignoreSearch:true}).then(c=>c||fetch(r).then(put)));    // cache-first
});
