import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {createApp} from '../server/app';

test('only the public island allows same-origin embedding and missing assets never return the health app',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'forma-island-headers-')),dist=join(directory,'dist');
  await mkdir(join(dist,'companion-island'),{recursive:true});
  await writeFile(join(dist,'index.html'),'<html>Forma synthetic</html>');await writeFile(join(dist,'companion-island/index.html'),'<html>Island synthetic</html>');
  const service=createApp({dataDir:join(directory,'data'),distDir:dist}),server=service.app.listen(0,'127.0.0.1');
  await new Promise<void>(done=>server.once('listening',done));
  t.after(async()=>{await new Promise<void>(done=>server.close(()=>done()));service.close();assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));await rm(directory,{recursive:true,force:true});});
  const address=server.address();assert.ok(address&&typeof address==='object');const base=`http://127.0.0.1:${address.port}`;
  const island=await fetch(base+'/companion-island/');assert.equal(island.status,200);assert.equal(island.headers.get('x-frame-options'),'SAMEORIGIN');assert.equal(island.headers.get('content-security-policy'),"frame-ancestors 'self'");
  const main=await fetch(base+'/');assert.equal(main.headers.get('x-frame-options'),'DENY');
  const missing=await fetch(base+'/companion-island/assets/not-a-file.js');assert.equal(missing.status,404);assert.ok(!(await missing.text()).includes('Forma synthetic'));
  const api=await fetch(base+'/api/capabilities');assert.equal(api.headers.get('x-frame-options'),'DENY');assert.equal(api.headers.get('cache-control'),'no-store');
});
