import type {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import type {Store,Asset} from '../store';
import type {FoodPhotoDraft} from '../../src/types';
import {BillingError} from './config';
export const operationKey=(owner:string,asset:string,language:string)=>createHash('sha256').update(JSON.stringify([owner,asset,language])).digest('hex');
export class BillingLedger{
 constructor(readonly db:DatabaseSync){db.exec(`
 CREATE TABLE IF NOT EXISTS billing_memberships(owner_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,snapshot_json TEXT NOT NULL,checked_ms INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS billing_operations(owner_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,operation_key TEXT NOT NULL,asset_id TEXT NOT NULL,language TEXT NOT NULL,status TEXT NOT NULL,period_start TEXT NOT NULL,period_end TEXT NOT NULL,subscription_id TEXT NOT NULL,created_ms INTEGER NOT NULL,expires_ms INTEGER NOT NULL,draft_id TEXT,PRIMARY KEY(owner_id,operation_key));
 CREATE INDEX IF NOT EXISTS billing_ops_period ON billing_operations(owner_id,period_end,status);
 CREATE TABLE IF NOT EXISTS billing_outbox(transaction_id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,subscription_id TEXT NOT NULL,timestamp_seconds REAL NOT NULL,status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,next_ms INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS billing_webhook_receipts(body_hash TEXT PRIMARY KEY,delivery_hash TEXT NOT NULL,received_ms INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS billing_deletions(external_customer_id TEXT PRIMARY KEY,created_ms INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS billing_deleted_owners(external_customer_id TEXT PRIMARY KEY,created_ms INTEGER NOT NULL,next_ms INTEGER NOT NULL DEFAULT 0,checks INTEGER NOT NULL DEFAULT 0);
 CREATE INDEX IF NOT EXISTS billing_deleted_owners_due ON billing_deleted_owners(next_ms);
 INSERT OR IGNORE INTO billing_deleted_owners(external_customer_id,created_ms) SELECT external_customer_id,created_ms FROM billing_deletions;
 `);}
 transaction<T>(action:()=>T):T{this.db.exec('BEGIN IMMEDIATE');try{const r=action();this.db.exec('COMMIT');return r;}catch(e){this.db.exec('ROLLBACK');throw e;}}
 existing(owner:string,key:string){return this.db.prepare('SELECT * FROM billing_operations WHERE owner_id=? AND operation_key=?').get(owner,key);}
 usage(owner:string,end:string,now:number){
  const row=this.db.prepare("SELECT SUM(CASE WHEN status='complete' THEN 1 ELSE 0 END) AS used,SUM(CASE WHEN status='pending' AND expires_ms>? THEN 1 ELSE 0 END) AS reserved FROM billing_operations WHERE owner_id=? AND period_end=?").get(now,owner,end)!;
  const pending=this.db.prepare("SELECT COUNT(*) AS n FROM billing_outbox WHERE owner_id=? AND status='pending'").get(owner)!;
  return{used:Number(row.used||0),reserved:Number(row.reserved||0),pendingEvents:Number(pending.n)};
 }
 reserve(owner:string,key:string,asset:Asset,language:string,period:{start:string;end:string;subscription:string;limit:number},now:number){
  return this.transaction(()=>{
   if(Date.parse(period.start)>now||Date.parse(period.end)<now||!Number.isFinite(Date.parse(period.start))||!Number.isFinite(Date.parse(period.end)))throw new BillingError('BILLING_PERIOD_UNAVAILABLE');
   const row=this.existing(owner,key);
   if(row?.status==='complete'||row?.status==='no_charge')return false;
   if(row?.status==='pending'&&Number(row.expires_ms)>now)throw new BillingError('BILLING_IN_PROGRESS',409);
   const counts=this.usage(owner,period.end,now);
   if(counts.used+counts.reserved>=period.limit)throw new BillingError('BILLING_QUOTA_EXCEEDED',402);
   this.db.prepare("INSERT INTO billing_operations(owner_id,operation_key,asset_id,language,status,period_start,period_end,subscription_id,created_ms,expires_ms) VALUES (?,?,?,?,'pending',?,?,?,?,?) ON CONFLICT(owner_id,operation_key) DO UPDATE SET status='pending',period_start=excluded.period_start,period_end=excluded.period_end,subscription_id=excluded.subscription_id,created_ms=excluded.created_ms,expires_ms=excluded.expires_ms,draft_id=NULL").run(owner,key,asset.id,language,period.start,period.end,period.subscription,now,now+5*60000);return true;
  });
 }
 complete(store:Store,owner:string,key:string,draft:FoodPhotoDraft,reservationId:string,now:number,leaseMs:number){
  this.transaction(()=>{
   const row=this.existing(owner,key);
   if(!row||row.status!=='pending'||Number(row.expires_ms)<=now||Number(row.created_ms)!==leaseMs)throw new BillingError('BILLING_OPERATION_EXPIRED',409);
   store.addAiDraft(owner,draft);store.finishAiAttempt(owner,reservationId,'success');
   const billable=draft.isFood&&draft.items.length>0;
   this.db.prepare('UPDATE billing_operations SET status=?,draft_id=? WHERE owner_id=? AND operation_key=?').run(billable?'complete':'no_charge',draft.id,owner,key);
   if(billable)this.db.prepare("INSERT INTO billing_outbox(transaction_id,owner_id,subscription_id,timestamp_seconds) VALUES (?,?,?,?)").run('forma_'+key,owner,String(row.subscription_id),Number(row.created_ms)/1000);
  });
 }
 fail(owner:string,key:string,leaseMs:number){this.db.prepare("UPDATE billing_operations SET status='failed' WHERE owner_id=? AND operation_key=? AND status='pending' AND created_ms=?").run(owner,key,leaseMs);}
 save(owner:string,snapshot:unknown,now:number){this.db.prepare('INSERT INTO billing_memberships VALUES (?,?,?) ON CONFLICT(owner_id) DO UPDATE SET snapshot_json=excluded.snapshot_json,checked_ms=excluded.checked_ms').run(owner,JSON.stringify(snapshot),now);}
 scheduleDeletion(owner:string,now:number){this.transaction(()=>{
  this.db.prepare('INSERT OR IGNORE INTO billing_deletions VALUES (?,?)').run(owner,now);
  this.db.prepare('INSERT OR IGNORE INTO billing_deleted_owners(external_customer_id,created_ms) VALUES (?,?)').run(owner,now);
 });}
 export(owner:string){return{membership:this.db.prepare('SELECT snapshot_json FROM billing_memberships WHERE owner_id=?').get(owner)?.snapshot_json??null,operations:this.db.prepare('SELECT operation_key,status,period_start,period_end,created_ms FROM billing_operations WHERE owner_id=? ORDER BY created_ms').all(owner)};}
}
