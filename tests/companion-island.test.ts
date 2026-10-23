import {test} from 'node:test';
import assert from 'node:assert/strict';
import { islandResidentIds,validIslandScope,scopedIslandStorage } from '../vendor/pokemon-island/src/app/formaIntegration';
import { clearIslandCache } from '../src/island-storage';

class MemoryStorage {
  data=new Map<string,string>();get length(){return this.data.size;}
  getItem(key:string){return this.data.get(key)??null;}setItem(key:string,value:string){this.data.set(key,value);}
  removeItem(key:string){this.data.delete(key);}key(index:number){return [...this.data.keys()][index]??null;}
}
test('island keeps its complete native cast and only adds a valid selected catalog companion',()=>{
  const cast=['004','007','025','001'];
  assert.deepEqual(islandResidentIds(cast,'006'),[...cast,'006']);
  assert.deepEqual(islandResidentIds(cast,'025'),cast);
  for(const invalid of['999','0','-1','../../data','3.5','NaN'])assert.deepEqual(islandResidentIds(cast,invalid),cast);
  assert.deepEqual(cast,['004','007','025','001']);
});
test('island journals and recovery copies remain isolated by account with no shared unscoped writes',()=>{
  const storage=new MemoryStorage(),a=scopedIslandStorage(storage,'account-A'),b=scopedIslandStorage(storage,'account-B');
  a.setItem('natura.living-journal.v1','A photos');b.setItem('natura.living-journal.v1','B photos');
  a.setItem('natura.living-journal.v1.recovery.1','A backup');
  assert.equal(a.getItem('natura.living-journal.v1'),'A photos');assert.equal(b.getItem('natura.living-journal.v1'),'B photos');
  assert.equal(storage.getItem('natura.living-journal.v1'),null);
  for(const invalid of['../another','',null,'bad:id'])assert.equal(validIslandScope(invalid),'demo');
});
test('account deletion removes only that account island keepsakes and leaves other app caches intact',()=>{
  const local=new MemoryStorage(),session=new MemoryStorage();
  const beforeLocal=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),beforeSession=Object.getOwnPropertyDescriptor(globalThis,'sessionStorage');
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:local});Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:session});
  try{
    local.setItem('forma-island:account-A:journal','A');local.setItem('forma-island:account-B:journal','B');local.setItem('forma-active-account','B');
    session.setItem('forma-island:account-A:audio','A');session.setItem('forma-island:demo:journal','Demo');
    clearIslandCache('account-A');assert.equal(local.getItem('forma-island:account-A:journal'),null);assert.equal(session.getItem('forma-island:account-A:audio'),null);
    assert.equal(local.getItem('forma-island:account-B:journal'),'B');assert.equal(local.getItem('forma-active-account'),'B');assert.equal(session.getItem('forma-island:demo:journal'),'Demo');
  }finally{
    if(beforeLocal)Object.defineProperty(globalThis,'localStorage',beforeLocal);else Reflect.deleteProperty(globalThis,'localStorage');
    if(beforeSession)Object.defineProperty(globalThis,'sessionStorage',beforeSession);else Reflect.deleteProperty(globalThis,'sessionStorage');
  }
});
test('a stale island frame cannot recreate a deleted journal or read another account after switching',()=>{
  const storage=new MemoryStorage();let active=true;
  const scoped=scopedIslandStorage(storage,'account-A',()=>active);scoped.setItem('journal','A');
  storage.removeItem('forma-island:account-A:journal');active=false;
  assert.throws(()=>scoped.setItem('journal','stale'),/account changed/);assert.throws(()=>scoped.getItem('journal'),/account changed/);
  assert.equal(storage.getItem('forma-island:account-A:journal'),null);
});
