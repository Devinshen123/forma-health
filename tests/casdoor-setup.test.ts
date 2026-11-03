import {test,type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

// Core-Node-only CLI fixtures; no Docker, real provider, .env or health database.
function fixture(t:TestContext,environment:string){
 const root=resolve(tmpdir()),dir=mkdtempSync(join(root,'forma-casdoor-setup-'));
 mkdirSync(join(dir,'scripts'));const script=join(dir,'scripts/setup-casdoor-local.mjs');
 copyFileSync(fileURLToPath(new URL('../scripts/setup-casdoor-local.mjs',import.meta.url)),script);
 const envFile=join(dir,'.env');writeFileSync(envFile,environment);
 t.after(()=>{assert.ok(resolve(dir).startsWith(root+sep));rmSync(dir,{recursive:true,force:true});});
 const run=()=>spawnSync(process.execPath,[script,'--write-env'],{cwd:dir,env:{...process.env,FORMA_SERVICES_DIR:join(dir,'services')},encoding:'utf8',timeout:15000});
 return{dir,envFile,run};
}
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');

test('Casdoor setup accepts a fresh .env.example, preserves other settings and remains idempotent',t=>{
 const example=readFileSync(new URL('../.env.example',import.meta.url),'utf8');
 const {envFile,run}=fixture(t,example+'\nSYNTHETIC_UNRELATED_SETTING=preserve-me\n');
 assert.equal(run().status,0,'blank example settings must not prevent first-time setup');
 const after=readFileSync(envFile,'utf8');
 assert.ok(after.includes('SYNTHETIC_UNRELATED_SETTING=preserve-me'));
 assert.equal(after.match(/^FORMA_AUTH_CASDOOR_CLIENT_ID=/gm)?.length,1);
 assert.equal(after.match(/^FORMA_AUTH_CASDOOR_CLIENT_SECRET=/gm)?.length,1);
 assert.equal(run().status,0);assert.equal(hash(readFileSync(envFile,'utf8')),hash(after));
});

test('Casdoor setup refuses to replace an unmanaged non-empty configuration',t=>{
 const original='SYNTHETIC_UNRELATED_SETTING=preserve-me\nFORMA_AUTH_CASDOOR_CLIENT_ID=fixture-existing-client\n';
 const {envFile,run}=fixture(t,original);
 assert.notEqual(run().status,0);assert.equal(hash(readFileSync(envFile,'utf8')),hash(original));
});
