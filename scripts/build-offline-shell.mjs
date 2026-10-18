import {readdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const files=readdirSync('dist/assets').map(x=>`/assets/${x}`);
const workbenchFiles=existsSync('dist/training-workbench/assets') ? readdirSync('dist/training-workbench/assets').map(x=>`/training-workbench/assets/${x}`) : [];
const workbenchHtml=existsSync('dist/training-workbench/index.html') ? readFileSync('dist/training-workbench/index.html') : Buffer.alloc(0);
const version=createHash('sha256').update(readFileSync('dist/index.html')).update(workbenchHtml).digest('hex').slice(0,16);
const assets=['/index.html',...files,...(workbenchHtml.length?['/training-workbench/index.html',...workbenchFiles]:[]),'/demo-meal.png','/favicon.svg','/licenses/free-exercise-db-Unlicense.txt','/licenses/opengym-NOTICE.txt','/licenses/opengym-AGPL-3.0.txt'];
writeFileSync('dist/sw.js', `// Forma static shell only. Private API and uploads are never cached.
const CACHE='forma-shell-${version}',FILES=${JSON.stringify(assets)};
// Wait for old clients to close instead of replacing the worker during an unsaved session.
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>{const old=keys.filter(k=>k.startsWith('forma-shell-')&&k!==CACHE);return Promise.all(old.slice(0,-1).map(k=>caches.delete(k)));}).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{const req=event.request,url=new URL(req.url);if(req.method!=='GET'||url.origin!==self.location.origin||url.pathname==='/api'||url.pathname.startsWith('/api/')||url.pathname.toLowerCase().startsWith('/training-workbench/api/'))return;
if(req.mode==='navigate'){const fallback=url.pathname.startsWith('/training-workbench/')?'/training-workbench/index.html':'/index.html';event.respondWith(fetch(req).catch(()=>caches.open(CACHE).then(cache=>cache.match(fallback)).then(r=>r||Response.error())));return;}
if(url.search)return;
if(FILES.includes(url.pathname)||url.pathname.startsWith('/assets/'))event.respondWith(caches.match(req).then(r=>r||fetch(req)));});
`);
console.log(`Offline shell ${version}: ${assets.length} static files. API excluded.`);
