import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import { COMPANION_CHARACTERS } from '../src/companion';

test('new companion art invalidates the shell and an old retained cache cannot shadow current art', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'forma-companion-cache-'));
  t.after(() => {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
    rmSync(directory, { recursive: true, force: true });
  });
  mkdirSync(join(directory, 'dist/assets'), { recursive: true });
  mkdirSync(join(directory, 'dist/companions'));
  writeFileSync(join(directory, 'dist/index.html'), '<html>synthetic cache fixture</html>');
  writeFileSync(join(directory, 'dist/assets/test.js'), '/* synthetic */');
  for (const id of COMPANION_CHARACTERS) for (const suffix of ['', '-thumb'])
    writeFileSync(join(directory, 'dist/companions', id + suffix + '.webp'), 'synthetic first art');
  const build = () => {
    execFileSync(process.execPath, [resolve(import.meta.dirname, '../scripts/build-offline-shell.mjs')], { cwd: directory });
    return readFileSync(join(directory, 'dist/sw.js'), 'utf8');
  };
  const oldShell = build();
  writeFileSync(join(directory, 'dist/companions/bunny.webp'), 'synthetic revised art');
  const shell = build();
  assert.notEqual(shell.match(/forma-shell-[a-f0-9]+/)?.[0], oldShell.match(/forma-shell-[a-f0-9]+/)?.[0]);

  const origin = 'https://synthetic.forma.test';
  const currentCache = shell.match(/forma-shell-[a-f0-9]+/)![0];
  const handlers = new Map<string, (event: any) => void>();
  let installed: Request[] = [], activeReads = 0, globalReads = 0, networkReads = 0;
  class WorkerRequest extends Request {
    constructor(input: string | URL | Request, init?: RequestInit) { super(typeof input === 'string' ? new URL(input, origin) : input, init); }
  }
  runInNewContext(shell, {
    self: { location: { origin }, addEventListener: (name: string, handler: (event: any) => void) => handlers.set(name, handler), clients: { claim: async () => {} } },
    Request: WorkerRequest, URL, Response,
    caches: {
      // The global match would return an older retained cache's art.
      match: async () => { globalReads++; return new Response('stale art'); },
      open: async (name: string) => {
        assert.equal(name, currentCache);
        return {
          addAll: async (requests: Request[]) => { installed = requests; },
          match: async () => { activeReads++; return new Response('current art'); },
        };
      },
    },
    fetch: async () => { networkReads++; return new Response('network'); },
  });
  let install: Promise<unknown> | undefined;
  handlers.get('install')!({ waitUntil: (work: Promise<unknown>) => { install = work; } });
  await install;
  for (const id of COMPANION_CHARACTERS) for (const suffix of ['', '-thumb']) {
    const request = installed.find(req => new URL(req.url).pathname === `/companions/${id}${suffix}.webp`);
    assert.ok(request, 'all twelve public portraits must be precached');
    assert.equal(request.cache, 'reload', 'install must revalidate fixed image URLs against the network');
  }
  let reply: Promise<Response> | undefined;
  handlers.get('fetch')!({ request: new Request(origin + '/companions/bunny.webp'), respondWith: (work: Promise<Response>) => { reply = work; } });
  assert.equal(await (await reply!).text(), 'current art');
  assert.equal(activeReads, 1); assert.equal(globalReads, 0); assert.equal(networkReads, 0);
  handlers.get('fetch')!({ request: new Request(origin + '/companions/bunny.webp?v=pokedex151-20261023'), respondWith: (work: Promise<Response>) => { reply = work; } });
  assert.equal(await (await reply!).text(), 'current art', 'versioned portraits must work offline with the matching current cache');
  assert.equal(activeReads, 2); assert.equal(globalReads, 0); assert.equal(networkReads, 0);
  for (const path of ['/api/companion', '/api/assets/private', '/training-workbench/api/media']) {
    let intercepted = false;
    handlers.get('fetch')!({ request: new Request(origin + path), respondWith: () => { intercepted = true; } });
    assert.equal(intercepted, false, 'private requests must never enter static cache handling');
  }
});

test('public models cache on demand, survive cache denial, and never turn failed downloads into cached assets', async t => {
  const directory=mkdtempSync(join(tmpdir(),'forma-model-cache-'));
  t.after(()=>{assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));rmSync(directory,{recursive:true,force:true});});
  mkdirSync(join(directory,'dist/assets'),{recursive:true});mkdirSync(join(directory,'dist/companions/models'),{recursive:true});mkdirSync(join(directory,'dist/companions/forms'));
  writeFileSync(join(directory,'dist/index.html'),'<html>synthetic</html>');
  for(const id of COMPANION_CHARACTERS)for(const suffix of['','-thumb'])writeFileSync(join(directory,'dist/companions',id+suffix+'.webp'),'synthetic');
  writeFileSync(join(directory,'dist/companions/models/25.glb'),'synthetic model');writeFileSync(join(directory,'dist/companions/forms/25.webp'),'synthetic portrait');
  execFileSync(process.execPath,[resolve(import.meta.dirname,'../scripts/build-offline-shell.mjs')],{cwd:directory});
  const shell=readFileSync(join(directory,'dist/sw.js'),'utf8'),origin='https://synthetic.forma.test';
  for(const scenario of['new','cached','quota','denied','server-error']){
    const handlers=new Map<string,(event:any)=>void>();let writes=0,downloads=0,installed:string[]=[];
    runInNewContext(shell,{
      self:{location:{origin},addEventListener:(name:string,handler:(event:any)=>void)=>handlers.set(name,handler),clients:{claim:async()=>{}}},URL,Response,
      Request:class extends Request{constructor(input:string,init?:RequestInit){super(new URL(input,origin),init);}},
      caches:{open:async()=>{if(scenario==='denied')throw Error('Storage blocked');return{
        addAll:async(requests:Request[])=>{installed=requests.map(request=>new URL(request.url).pathname);},
        match:async()=>scenario==='cached'?new Response('cached-model'):undefined,
        put:async(key:string,response:Response)=>{assert.equal(key,'/companions/models/25.glb');assert.equal(await response.text(),'network-model');if(scenario==='quota')throw Error('Quota exceeded');writes++;},
      };}},fetch:async()=>{downloads++;return new Response('network-model',{status:scenario==='server-error'?503:200});},
    });
    if(scenario==='new'){
      let work:Promise<unknown>|undefined;handlers.get('install')!({waitUntil:(promise:Promise<unknown>)=>work=promise});await work;
      assert.ok(installed.includes('/companions/forms/25.webp'));assert.ok(!installed.some(path=>path.endsWith('.glb')),'install must not download all forms');
    }
    let response:Promise<Response>|undefined;
    handlers.get('fetch')!({request:new Request(origin+'/companions/models/25.glb?v=pokedex151-20261023'),respondWith:(promise:Promise<Response>)=>response=promise});
    assert.equal(await(await response!).text(),scenario==='cached'?'cached-model':'network-model');
    assert.equal(downloads,scenario==='cached'?0:1);assert.equal(writes,scenario==='new'?1:0);
    for(const path of['/api/companion','/training-workbench/api/export','/uploads/private.glb','/companions/models/999.glb']){
      let intercepted=false;handlers.get('fetch')!({request:new Request(origin+path),respondWith:()=>intercepted=true});assert.equal(intercepted,false);
    }
  }
});
