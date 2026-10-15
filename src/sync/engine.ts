import * as api from '../api';
import type { AppState, SyncMutation, SyncSnapshot, User } from '../types';
import { applyChanges, diffStates, versionKey } from './changes';
import { clearCached, readCached, writeCached } from './storage';
export interface SyncStatus { enabled:boolean; pending:number; online:boolean; connected?:boolean; busy:boolean; error:string; authRequired?:boolean; conflict:{keys:string[];local:AppState;remote:AppState}|null }
export class SyncEngine {
  private queue:SyncMutation[]=[];
  private stopped=false;
  private working=false;
  private writeChain:Promise<void>=Promise.resolve();
  private flushPromise:Promise<void>|null=null;
  private ready = new Set<string>();
  private snapshot:SyncSnapshot;
  private conflictSnapshot:SyncSnapshot|null=null;
  private conflictMutationId:string|null=null;
  private deciding=false;
  private generation:string|undefined;
  status:SyncStatus;
  constructor(public user:User,snapshot:SyncSnapshot,private changed:(state:AppState,status:SyncStatus)=>void) {
    this.snapshot=snapshot;this.status={enabled:localStorage.getItem(`forma-offline-${user.id}`)==='enabled',pending:0,online:navigator.onLine,busy:false,error:'',conflict:null};
  }
  async restore() { if(this.status.enabled){const cached=await readCached(this.user.id);if(cached){this.queue=cached.queue;this.generation=cached.generation;if(!cached.generation)await this.persist([],true);}else{this.status.enabled=false;localStorage.removeItem(`forma-offline-${this.user.id}`);}}this.ready=new Set(this.queue.map(x=>x.mutationId));this.emit(); }
  private view() {return this.queue.reduce((state,batch)=>applyChanges(state,batch.changes),this.snapshot.state);}
  context() {const versions={...this.snapshot.entityVersions};for(const batch of this.queue)for(const change of batch.changes){const key=versionKey(change.collection,change.id);versions[key]=(versions[key]??0)+1;}return {state:this.view(),versions};}
  private emit() {if(!this.stopped){this.status.pending=this.queue.length;this.status.online=navigator.onLine;this.changed(this.view(),{...this.status});}}
  private async persist(settleIds:string[] = [],grant=false) {
    if(!this.status.enabled||this.stopped)return;
    const data={user:this.user,snapshot:structuredClone(this.snapshot),queue:structuredClone(this.queue),updatedAt:new Date().toISOString(),generation:this.generation};
    this.writeChain=this.writeChain.catch(()=>{}).then(async()=>{if(this.stopped)return;const merged=await writeCached(data,settleIds,grant);if(this.stopped)return;this.generation=merged.generation;this.snapshot=merged.snapshot;this.queue=merged.queue;this.ready=new Set(this.queue.map(x=>x.mutationId));});await this.writeChain;
  }
  async enable(enabled:boolean) {
    if(!enabled&&this.queue.length)throw Error('Sync or export pending changes before disabling offline storage.');
    if(enabled){this.status.enabled=true;try{await this.persist([],true);localStorage.setItem(`forma-offline-${this.user.id}`,'enabled');}catch(e){this.status.enabled=false;throw e;}}
    else {await this.writeChain.catch(()=>{});await clearCached(this.user.id,true);this.status.enabled=false;this.generation=undefined;localStorage.removeItem(`forma-offline-${this.user.id}`);}
    this.emit();
  }
  async save(next:AppState,context=this.context()) {
    if(this.stopped)throw Error('Account changed. Sign in again.');
    if(this.status.conflict)throw Error('Review the sync conflict before saving more changes.');
    if(!this.status.enabled&&this.queue.length)throw Error(localStorage.getItem('forma-language')==='en'?'A save is awaiting confirmation. Retry Sync above or export the pending records before making another save.':'上一笔保存尚待确认。请使用顶部“同步”重试或导出待同步记录，再进行新的保存。');
    const changes=diffStates(context.state,next,context.versions);
    if(!changes.length)return;
    if(changes.length>1000)throw Error('Save at most 1,000 changes at a time.');
    if(!navigator.onLine&&!this.status.enabled)throw Error('Enable offline storage while online before logging offline.');
    const mutation={mutationId:crypto.randomUUID(),changes};this.queue.push(mutation);
    if(new TextEncoder().encode(JSON.stringify(mutation)).byteLength>1800000){this.queue.pop();throw Error(localStorage.getItem('forma-language')==='en'?'This batch is too large. Select fewer sessions or sets and try again.':'这一批记录过大。请减少所选训练或组数，再保存。');}
    try {await this.persist();this.ready.add(mutation.mutationId);} catch(e){this.queue=this.queue.filter(x=>x.mutationId!==mutation.mutationId);this.emit();throw e;}
    this.emit();
    try {await this.flush();} catch(e){
      if(this.status.enabled && !(e instanceof api.ApiError && [400,401,403,409,413].includes(e.status)))return;
      throw e;
    }
  }
  async flush():Promise<void> {
    if(this.flushPromise)return this.flushPromise;
    this.flushPromise=this.performFlush().finally(()=>{this.flushPromise=null;});return this.flushPromise;
  }
  private async performFlush() {
    if(this.stopped||this.status.conflict||!navigator.onLine)return;
    this.working=true;this.status.busy=true;this.status.error='';this.emit();
    let sendingId:string|null=null;
    try {
      const me=await api.getMe();
      if(me.user?.id!==this.user.id)throw new api.ApiError('Account changed. Sign in again.',401);
      this.status.connected=true;
      this.status.authRequired=false;
      while(this.queue.length&&!this.stopped&&this.ready.has(this.queue[0].mutationId)) {
        const batch=this.queue[0];
        sendingId=batch.mutationId;
        const remote=await api.syncMutation(batch,this.user.id);
        if(this.stopped)return;
        if(remote.revision>=this.snapshot.revision)this.snapshot=remote;this.queue=this.queue.filter(x=>x.mutationId!==batch.mutationId);this.ready.delete(batch.mutationId);await this.persist([batch.mutationId]);this.emit();
      }
      if(!this.stopped){const remote=await api.getSync(this.user.id);if(remote.revision>=this.snapshot.revision)this.snapshot=remote;await this.persist();}
    } catch(e) {
      if(this.stopped)return;
      this.status.error=e instanceof Error?e.message:'Sync failed';
      if(e instanceof TypeError || e instanceof DOMException && ['TimeoutError','AbortError'].includes(e.name)){this.status.connected=false;const en=localStorage.getItem('forma-language')==='en';this.status.error=this.status.enabled?(en?'Cannot reach the server. Pending changes remain on this device.':'暂时无法连接服务。待同步更改仍保留在此设备。'):(en?'Cannot reach the server. Keep this page open or export pending changes.':'暂时无法连接服务。请保持本页打开，或导出待同步更改。');}
      if(e instanceof api.ApiError && [401,403].includes(e.status))this.status.authRequired=true;
      if(e instanceof api.ApiError&&e.status===409&&e.details?.snapshot&&sendingId&&this.queue.some(x=>x.mutationId===sendingId)){this.conflictMutationId=sendingId;this.conflictSnapshot=e.details.snapshot;this.status.conflict={keys:e.details.conflicts??[],local:this.view(),remote:e.details.snapshot.state};}
      // Invalid writes are never acknowledged or silently discarded. Keep them for review/export.
      throw e;
    } finally {this.working=false;this.status.busy=false;this.emit();}
  }
  async refresh() {if(this.working||this.stopped||this.status.conflict)return;try{await this.flush();}catch{this.emit();}}
  async resolve(useLocal:boolean) {
    if(this.deciding)return;
    this.deciding=true;
    try {
    if(!this.conflictSnapshot)return;
    const keys=new Set(this.status.conflict?.keys??[]), old=this.queue;
    const oldSnapshot=this.snapshot,oldConflict=this.status.conflict,oldConflictSnapshot=this.conflictSnapshot,oldReady=new Set(this.ready),oldConflictId=this.conflictMutationId;
    const first=old[0]; if(!first)return;
    this.snapshot=this.conflictSnapshot;
    this.queue=old.map(batch=>({...batch,changes:batch.changes.filter(c=>useLocal||!keys.has(versionKey(c.collection,c.id))).map(c=>({...c}))})).filter(b=>b.changes.length);
    // Rebase all queued writes on the reviewed current snapshot, preserving their order.
    const versions={...this.snapshot.entityVersions};for(const batch of this.queue)for(const c of batch.changes){const key=versionKey(c.collection,c.id);if(keys.has(key)){c.baseVersion=versions[key]??0;versions[key]=c.baseVersion+1;}}
    const replaced=old.filter(batch=>JSON.stringify(batch.changes)!==JSON.stringify(this.queue.find(x=>x.mutationId===batch.mutationId)?.changes)).map(x=>x.mutationId);
    for(const batch of this.queue)if(replaced.includes(batch.mutationId))batch.mutationId=crypto.randomUUID();
    try {await this.persist(replaced);}catch(e){this.queue=old;this.snapshot=oldSnapshot;this.status.conflict=oldConflict;this.conflictSnapshot=oldConflictSnapshot;this.conflictMutationId=oldConflictId;this.ready=oldReady;this.emit();throw e;}
    this.conflictSnapshot=null;this.conflictMutationId=null;this.status.conflict=null;this.status.error='';this.ready=new Set(this.queue.map(x=>x.mutationId));this.emit();await this.flush();
    } finally {this.deciding=false;}
  }
  async discardInvalid() {if(this.working||this.deciding)throw Error('Wait for the current sync to finish.');const old=this.queue,discarded=old.map(x=>x.mutationId);this.queue=[];try{await this.persist(discarded);}catch(e){this.queue=old;this.emit();throw e;}this.ready=new Set(this.queue.map(x=>x.mutationId));this.status.conflict=null;this.conflictSnapshot=null;this.conflictMutationId=null;this.status.error='';this.emit();await this.refresh();}
  async reconcileCache() {if(this.stopped)return;await this.writeChain.catch(()=>{});const enabled=localStorage.getItem(`forma-offline-${this.user.id}`)==='enabled';if(!enabled){this.status.enabled=false;this.generation=undefined;this.emit();return;}this.status.enabled=true;const cached=await readCached(this.user.id);if(this.stopped||!cached)return;this.generation=cached.generation;const memory=this.queue.filter(x=>!this.ready.has(x.mutationId));this.queue=[...cached.queue,...memory.filter(x=>!cached.queue.some(y=>y.mutationId===x.mutationId))];if(cached.snapshot.revision>=this.snapshot.revision)this.snapshot=cached.snapshot;if(this.conflictMutationId&&cached.settled?.includes(this.conflictMutationId)){this.status.conflict=null;this.conflictSnapshot=null;this.conflictMutationId=null;this.status.error='';}this.ready=new Set(cached.queue.map(x=>x.mutationId));this.emit();}
  exportPending() {return {format:'forma-offline-backup-v1',userId:this.user.id,state:this.view(),pending:this.queue.length};}
  async stop(clear=false,force=false) {this.stopped=true;await this.writeChain.catch(()=>{});if(clear){await clearCached(this.user.id,!force);localStorage.removeItem(`forma-offline-${this.user.id}`);}}
}
