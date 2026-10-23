import {readdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const files=readdirSync('dist/assets').map(x=>`/assets/${x}`);
const workbenchFiles=existsSync('dist/training-workbench/assets') ? readdirSync('dist/training-workbench/assets').map(x=>`/training-workbench/assets/${x}`) : [];
const workbenchHtml=existsSync('dist/training-workbench/index.html') ? readFileSync('dist/training-workbench/index.html') : Buffer.alloc(0);
const companionFiles=['sprout','bunny','otter','cloud','bear','seal'].flatMap(id=>[`/companions/${id}.webp`,`/companions/${id}-thumb.webp`]);
const formFiles=existsSync('dist/companions/forms') ? readdirSync('dist/companions/forms').filter(name=>/^[0-9]+(?:-thumb)?\.webp$/.test(name)).map(name=>`/companions/forms/${name}`) : [];
const decoderFiles=existsSync('dist/companions/draco') ? readdirSync('dist/companions/draco').filter(name=>/^draco_(?:decoder\.wasm|wasm_wrapper\.js)$/.test(name)).map(name=>`/companions/draco/${name}`) : [];
const modelFiles=existsSync('dist/companions/models') ? readdirSync('dist/companions/models').filter(name=>/^[0-9]+\.glb$/.test(name)).map(name=>`/companions/models/${name}`) : [];
const portraitFiles=[...companionFiles,...formFiles];
const versionHash=createHash('sha256').update(readFileSync('dist/index.html')).update(workbenchHtml);
for(const file of [...portraitFiles,...decoderFiles,...modelFiles]) versionHash.update(file).update(readFileSync(`dist${file}`));
const version=versionHash.digest('hex').slice(0,16);
const assets=['/index.html',...files,...portraitFiles,...decoderFiles,...(workbenchHtml.length?['/training-workbench/index.html',...workbenchFiles]:[]),'/demo-meal.png','/favicon.svg','/licenses/free-exercise-db-Unlicense.txt','/licenses/opengym-NOTICE.txt','/licenses/opengym-AGPL-3.0.txt'];
writeFileSync('dist/sw.js', `// Forma static shell only. Private API and uploads are never cached.
const CACHE='forma-shell-${version}',FILES=${JSON.stringify(assets)};
// Wait for old clients to close instead of replacing the worker during an unsaved session.
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES.map(file=>new Request(file,{cache:'reload'})))));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>{const old=keys.filter(k=>k.startsWith('forma-shell-')&&k!==CACHE);return Promise.all(old.slice(0,-1).map(k=>caches.delete(k)));}).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{const req=event.request,url=new URL(req.url);if(req.method!=='GET'||url.origin!==self.location.origin||url.pathname==='/api'||url.pathname.startsWith('/api/')||url.pathname.toLowerCase().startsWith('/training-workbench/api/'))return;
if(req.mode==='navigate'){const fallback=url.pathname.startsWith('/training-workbench/')?'/training-workbench/index.html':'/index.html';event.respondWith(fetch(req).catch(()=>caches.open(CACHE).then(cache=>cache.match(fallback)).then(r=>r||Response.error())));return;}
if(${JSON.stringify(modelFiles)}.includes(url.pathname)&&(!url.search||url.search==='?v=evolution-20261022')){event.respondWith((async()=>{let cache;try{cache=await caches.open(CACHE);const cached=await cache.match(url.pathname);if(cached)return cached;}catch{}const response=await fetch(req);if(response.ok&&cache)try{await cache.put(url.pathname,response.clone());}catch{}return response;})());return;}
if(url.search){if(url.search==='?v=evolution-20261022'&&${JSON.stringify(portraitFiles)}.includes(url.pathname))event.respondWith(caches.open(CACHE).then(cache=>cache.match(url.pathname)).then(r=>r||fetch(req)));return;}
if(FILES.includes(url.pathname)||url.pathname.startsWith('/assets/'))event.respondWith(caches.open(CACHE).then(cache=>cache.match(req)).then(r=>r||fetch(req)));});
`);
console.log(`Offline shell ${version}: ${assets.length} static files. API excluded.`);
