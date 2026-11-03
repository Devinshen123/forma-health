import {test,type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {resolve,join,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID,generateKeyPairSync,sign} from 'node:crypto';
import {Store} from '../server/store';
import {BillingLedger,operationKey} from '../server/billing/ledger';
import {BillingService,paidForPeriod} from '../server/billing/service';
import {resolveBillingConfig,type BillingConfig} from '../server/billing/config';
import {LagoClient} from '../server/billing/client';
import {createApp} from '../server/app';
import type {FoodPhotoDraft} from '../src/types';

// Disposable databases and injected transports only. No real Lago, AI or health data.
const tempRoot=resolve(tmpdir());
mkdirSync(tempRoot,{recursive:true});
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const config:BillingConfig={mode:'sandbox',lagoUrl:'http://127.0.0.1:3442',publicBaseUrl:'http://127.0.0.1:3001',apiKey:'fixture-not-a-real-api-key',webhookPublicKey:publicKey.export({type:'spki',format:'pem'}).toString()};
const now=Date.parse('2026-11-03T12:00:00.617Z');
const period={start:'2026-11-03T12:00:00.500Z',end:'2026-12-03T23:59:59.999Z',subscription:'fixture-subscription',limit:1};
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
const unreachable:typeof fetch=async()=>{throw new Error('Unexpected external request');};
const errorCode=(code:string)=>(e:unknown)=>!!e&&typeof e==='object'&&'code' in e&&e.code===code;
const directory=()=>mkdtempSync(join(tempRoot,'forma-billing-regression-'));
function removeDirectory(dir:string){assert.ok(resolve(dir).startsWith(tempRoot+sep));rmSync(dir,{recursive:true,force:true});}
function fixture(t:TestContext){
 const dir=directory(),store=new Store(dir);
 const owner=store.createAccount(randomUUID()+'@example.test','Synthetic billing fixture','fake-hash','fake-salt').id;
 const id=store.addAsset(owner,'synthetic.png','image/png',Buffer.from('synthetic image')).id,asset=store.asset(owner,id)!;
 t.after(()=>{store.close();removeDirectory(dir);});return{dir,store,owner,asset,ledger:new BillingLedger(store.db)};
}
function draft(assetId:string,food=true):FoodPhotoDraft{return{id:randomUUID(),assetId,createdAt:new Date(now).toISOString(),provider:'openai',model:'synthetic-fixture',isFood:food,consent:{acceptedAt:new Date(now).toISOString(),version:'food-photo-v1',language:'en'},items:food?[{name:'Synthetic rice',grams:100,per100g:{kcal:130,protein:2,carbs:28,fat:0}}]:[],warnings:[]};}
function jwt(raw:Buffer,issuer='http://127.0.0.1:3442',alg='RS256'){
 const h=Buffer.from(JSON.stringify({alg,typ:'JWT'})).toString('base64url'),p=Buffer.from(JSON.stringify({iss:issuer,data:raw.toString()})).toString('base64url'),data=h+'.'+p;
 return data+'.'+sign('RSA-SHA256',Buffer.from(data),privateKey).toString('base64url');
}

test('adding billing tables preserves existing account, state, session and asset bytes',t=>{
 const {store,owner,asset}=fixture(t);store.createSession(owner,'synthetic-session',Date.now()+60000);
 const tables=['accounts','states','sessions','assets'];
 const before=tables.map(name=>JSON.stringify(store.db.prepare('SELECT * FROM '+name).all()));
 new BillingLedger(store.db);
 assert.deepEqual(tables.map(name=>JSON.stringify(store.db.prepare('SELECT * FROM '+name).all())),before);
 assert.equal(store.session('synthetic-session')?.id,owner);assert.equal(store.assetBytes(asset).toString(),'synthetic image');
 assert.equal(store.db.prepare('PRAGMA quick_check').get()?.quick_check,'ok');
});

test('disabled billing keeps the legacy flow; invalid enabled billing fails closed',async t=>{
 const {store,owner,asset}=fixture(t),off=new BillingService(store,{},unreachable),invalid=new BillingService(store,{mode:'sandbox'},unreachable);
 t.after(()=>{off.close();invalid.close();});const expected=draft(asset.id);let calls=0;
 const photo={analyze:async()=>{calls++;return expected;}} as any;
 assert.equal(await off.analyze(owner,asset,'en',photo),expected);
 await assert.rejects(invalid.analyze(owner,asset,'en',photo),errorCode('BILLING_UNAVAILABLE'));assert.equal(calls,1);
});

test('sandbox rejects remote endpoints, credentials in URLs, issuer substitution and weak signing keys',()=>{
 assert.equal(resolveBillingConfig(config).valid,true);
 for(const changed of [{lagoUrl:'https://example.com'},{publicBaseUrl:'https://example.com'},{lagoUrl:'http://user:pass@localhost:3442'},{lagoUrl:'http://localhost:3442/path'},{webhookIssuer:'http://attacker.invalid'},{webhookPublicKey:'invalid'},{timeoutMs:Infinity}])assert.equal(resolveBillingConfig({...config,...changed}).valid,false);
});

test('atomic final-slot reservation blocks another operation and duplicate in-flight requests',t=>{
 const {ledger,owner,asset}=fixture(t),a=operationKey(owner,asset.id,'en'),b=operationKey(owner,randomUUID(),'en');
 ledger.reserve(owner,a,asset,'en',period,now);
 assert.throws(()=>ledger.reserve(owner,a,asset,'en',period,now+1),errorCode('BILLING_IN_PROGRESS'));
 assert.throws(()=>ledger.reserve(owner,b,asset,'en',period,now+1),errorCode('BILLING_QUOTA_EXCEEDED'));
 ledger.fail(owner,a,now);assert.equal(ledger.reserve(owner,b,asset,'en',period,now+2),true);
});

test('non-food is cached without consuming quota or emitting any usage event',t=>{
 const {ledger,store,owner,asset}=fixture(t),key=operationKey(owner,asset.id,'en'),value=draft(asset.id,false);
 ledger.reserve(owner,key,asset,'en',period,now);ledger.complete(store,owner,key,value,'fixture-reservation',now+1,now);
 assert.equal(ledger.reserve(owner,key,asset,'en',period,now+2),false);
 assert.deepEqual(ledger.usage(owner,period.end,now+2),{used:0,reserved:0,pendingEvents:0});
 assert.equal(store.aiDraft(owner,value.id)?.isFood,false);
});

test('draft, quota and outbox roll back together if persistence fails',t=>{
 const {ledger,store,owner,asset}=fixture(t),key=operationKey(owner,asset.id,'en'),value=draft(asset.id);
 ledger.reserve(owner,key,asset,'en',period,now);
 store.db.exec("CREATE TRIGGER fail_billing_outbox BEFORE INSERT ON billing_outbox BEGIN SELECT RAISE(ABORT,'synthetic persistence failure'); END;");
 assert.throws(()=>ledger.complete(store,owner,key,value,'fixture',now+1,now));
 assert.equal(store.aiDraft(owner,value.id),undefined);assert.equal(ledger.existing(owner,key)?.status,'pending');
 assert.equal(ledger.usage(owner,period.end,now+2).used,0);
});

test('expired worker cannot finish or release a newer lease for the same photo',t=>{
 const {ledger,store,owner,asset}=fixture(t),key=operationKey(owner,asset.id,'en'),newer=now+300001;
 ledger.reserve(owner,key,asset,'en',period,now);ledger.reserve(owner,key,asset,'en',period,newer);
 assert.throws(()=>ledger.complete(store,owner,key,draft(asset.id),'old',newer+1,now),errorCode('BILLING_OPERATION_EXPIRED'));
 ledger.fail(owner,key,now);assert.equal(ledger.existing(owner,key)?.status,'pending');
 ledger.complete(store,owner,key,draft(asset.id),'new',newer+1,newer);assert.equal(ledger.usage(owner,period.end,newer+2).used,1);
});

test('successful usage preserves fractional seconds and quota across same-end plan changes',t=>{
 const {ledger,store,owner,asset}=fixture(t),key=operationKey(owner,asset.id,'en');
 ledger.reserve(owner,key,asset,'en',period,now);ledger.complete(store,owner,key,draft(asset.id),'fixture',now+2,now);
 const event=store.db.prepare('SELECT * FROM billing_outbox').get()!;
 assert.equal(event.timestamp_seconds,now/1000);assert.ok(Number(event.timestamp_seconds)>Date.parse(period.start)/1000);
 assert.equal(ledger.reserve(owner,key,asset,'en',period,now+3),false);
 assert.throws(()=>ledger.reserve(owner,'another-operation',asset,'en',{...period,start:new Date(now+100).toISOString()},now+200),errorCode('BILLING_QUOTA_EXCEEDED'));
 assert.equal(ledger.usage(owner,'2027-01-03T23:59:59.999Z',now+200).used,0);
});

test('reservation refuses stale or future periods before any provider work',t=>{
 const {ledger,owner,asset}=fixture(t);
 for(const clock of [Date.parse(period.start)-1,Date.parse(period.end)+1])assert.throws(()=>ledger.reserve(owner,'stale',asset,'en',period,clock),errorCode('BILLING_PERIOD_UNAVAILABLE'));
 assert.equal(ledger.existing(owner,'stale'),undefined);
});

test('only an owned current-period finalized paid subscription invoice grants Pro',()=>{
 const owner=randomUUID(),sub={lago_id:randomUUID(),external_id:'sub',external_customer_id:owner,plan_code:'pro_test' as const,status:'active',current_billing_period_started_at:period.start,current_billing_period_ending_at:period.end,plan_amount_cents:2000,plan_amount_currency:'USD' as const,entitlements:[]};
 const invoice={lago_id:randomUUID(),number:'synthetic',status:'finalized',payment_status:'succeeded',total_amount_cents:2000,currency:'USD' as const,created_at:period.start,customer:{external_id:owner},subscriptions:[{lago_id:sub.lago_id,external_id:sub.external_id}],billing_periods:[{lago_subscription_id:sub.lago_id,external_subscription_id:sub.external_id,subscription_from_datetime:'2026-11-03T00:00:00.000Z',subscription_to_datetime:period.end}],fees:[{lago_subscription_id:sub.lago_id,amount_cents:2000,item:{type:'subscription',code:'pro_test'}}]};
 assert.equal(paidForPeriod(invoice,sub,owner,now),true,'invoice midnight start may differ from subscription start');
 for(const changed of [{payment_status:'pending'},{status:'voided'},{customer:{external_id:randomUUID()}},{subscriptions:[]},{fees:[]},{billing_periods:[{...invoice.billing_periods[0],subscription_to_datetime:'2026-11-03T11:59:59Z'}]}])assert.equal(paidForPeriod({...invoice,...changed},sub,owner,now),false);
 assert.equal(paidForPeriod(invoice,{...sub,current_billing_period_ending_at:'2027-01-03T23:59:59.999Z'},owner,now),false,'previous paid invoice cannot grant the next period');
});

test('concurrent subscription changes issue one remote mutation and return a fresh snapshot',async t=>{
 const {store,owner}=fixture(t);let code='free_test',posts=0,clock=now,crossPeriod=false,raceAfterSub=false;
 const entitlements=(n:number)=>[{code:'photo_recognition',privileges:[{code:'monthly_limit',value:n}]}];
 const transport:typeof fetch=async(input,init)=>{
  const route=new URL(String(input)).pathname;
  if(route.includes('/plans/')){const p=route.split('/').at(-1)!;return json({plan:{code:p,name:p,amount_cents:p==='free_test'?0:2000,amount_currency:'USD',interval:'monthly',entitlements:entitlements(p==='free_test'?3:100)}});}
  if(init?.method==='POST'&&route.endsWith('/subscriptions')){posts++;code=JSON.parse(String(init.body)).subscription.plan_code;return json({});}
  if(route.endsWith('/entitlements'))throw new Error('Separate active entitlement lookup is racy');
  if(route.includes('/subscriptions/')){const response=json({subscription:{lago_id:randomUUID(),external_id:'forma_'+owner,external_customer_id:owner,plan_code:code,status:'active',current_billing_period_started_at:period.start,current_billing_period_ending_at:period.end,plan_amount_cents:code==='free_test'?0:2000,plan_amount_currency:'USD',entitlements:entitlements(code==='free_test'?3:100)}});if(raceAfterSub)code='pro_test';return response;}
  if(route.endsWith('/invoices'))return json({invoices:[]});
  if(route.endsWith('/current_usage')){if(crossPeriod)clock=Date.parse(period.end)+1;return json({customer_usage:{charges_usage:[]}});}
  if(route.includes('/customers/'))return json({customer:{external_id:owner,billing_configuration:{payment_provider:null}}});
  throw new Error('Unexpected fixture route');
 };
 const service=new BillingService(store,config,transport,()=>clock);t.after(()=>service.close());
 const first=service.select(owner,'pro_test');
 await assert.rejects(service.select(owner,'free_test'),errorCode('BILLING_IN_PROGRESS'));
 const result=await first;assert.equal(posts,1);assert.equal(result.subscription?.planCode,'pro_test');assert.equal(result.subscription?.paid,false);
 assert.equal(result.subscription?.effectivePlanCode,'free_test');assert.equal(result.usage.limit,3);
 code='free_test';raceAfterSub=true;const raced=await service.snapshot(owner);assert.equal(code,'pro_test');assert.equal(raced.subscription?.planCode,'free_test');assert.equal(raced.usage.limit,3,'an intervening unpaid Pro upgrade must not replace the Free snapshot allowance');
 crossPeriod=true;await assert.rejects(service.snapshot(owner),errorCode('BILLING_PERIOD_UNAVAILABLE'),'a slow remote read cannot return an expired allowance');
});

test('lost event response recovers after restart using original receipt, never reposting a stored event',async t=>{
 const {store,owner,asset,ledger}=fixture(t),key=operationKey(owner,asset.id,'en');
 ledger.reserve(owner,key,asset,'en',period,now);ledger.complete(store,owner,key,draft(asset.id),'fixture',now+1,now);
 let receipt:any=null,posts=0,failReceipt=true,clock=now;
 const transport:typeof fetch=async(input,init)=>{
  const url=String(input);
  if(init?.method==='POST'){posts++;assert.equal(posts,1,'duplicate POST would be rejected by Lago');const event=JSON.parse(String(init.body)).event;assert.equal(event.timestamp,now/1000);receipt={event:{...event,timestamp:new Date(event.timestamp*1000).toISOString()}};return json({event});}
  if(url.includes('/events/')){if(!receipt)return json({},404);if(failReceipt){failReceipt=false;throw new Error('Synthetic lost response');}return json(receipt);}
  throw new Error('Unexpected URL');
 };
 const first=new BillingService(store,config,transport,()=>clock);await first.flush(owner);first.close();
 assert.equal(store.db.prepare('SELECT status FROM billing_outbox').get()?.status,'pending');clock+=5000;
 const restarted=new BillingService(store,config,transport,()=>clock);t.after(()=>restarted.close());await restarted.flush(owner);
 assert.equal(store.db.prepare('SELECT status FROM billing_outbox').get()?.status,'accepted');assert.equal(posts,1);
 await restarted.flush(owner);assert.equal(posts,1);
});

test('ambiguous POST success is recovered by GET; conflicting receipt is not accepted',async t=>{
 const {store,owner,asset,ledger}=fixture(t),key=operationKey(owner,asset.id,'en');
 ledger.reserve(owner,key,asset,'en',period,now);ledger.complete(store,owner,key,draft(asset.id),'fixture',now+1,now);
 let event:any=null;
 const transport:typeof fetch=async(_input,init)=>{
  if(init?.method==='POST'){event=JSON.parse(String(init.body)).event;throw new Error('POST was stored but response disconnected');}
  return event?json({event:{...event,timestamp:new Date(event.timestamp*1000).toISOString()}}):json({},404);
 };
 const service=new BillingService(store,config,transport,()=>now);t.after(()=>service.close());await service.flush(owner);
 assert.equal(store.db.prepare('SELECT status FROM billing_outbox').get()?.status,'accepted');
 store.db.prepare("UPDATE billing_outbox SET status='pending',next_ms=0").run();event.timestamp=Math.floor(now/1000);
 await service.flush(owner);assert.equal(store.db.prepare('SELECT status FROM billing_outbox').get()?.status,'pending','bad precision cannot be silently repaired under an existing ID');
});

test('account deletion cascades billing locally and retries external cleanup without private account data',async t=>{
 const {store,owner,asset,ledger}=fixture(t),key=operationKey(owner,asset.id,'en');
 ledger.reserve(owner,key,asset,'en',period,now);ledger.save(owner,{safe:true},now);let deletes=0;
 const service=new BillingService(store,config,async(input,init)=>{assert.equal(init?.method,'DELETE');assert.equal(String(input),'http://127.0.0.1:3442/api/v1/customers/'+owner);deletes++;return new Response(null,{status:204});},()=>now);t.after(()=>service.close());
 service.scheduleDeletion(owner);await service.flush();assert.equal(deletes,0,'a failed local account deletion must not delete the remote customer');
 store.deleteAccount(owner);assert.equal(store.db.prepare('SELECT COUNT(*) n FROM billing_operations').get()?.n,0);
 assert.equal(store.db.prepare('SELECT COUNT(*) n FROM billing_memberships').get()?.n,0);
 assert.deepEqual(Object.keys(store.db.prepare('SELECT * FROM billing_deletions').get()!),['external_customer_id','created_ms']);
 await service.flush();assert.equal(deletes,1);assert.equal(store.db.prepare('SELECT COUNT(*) n FROM billing_deletions').get()?.n,0);
});

test('deletion queue and opaque tombstone commit atomically and old pending cleanup migrates on restart',t=>{
 const {store,owner,ledger}=fixture(t);
 store.db.exec("CREATE TRIGGER fail_deletion_fence BEFORE INSERT ON billing_deleted_owners BEGIN SELECT RAISE(ABORT,'synthetic persistence failure'); END;");
 assert.throws(()=>ledger.scheduleDeletion(owner,now));
 assert.equal(store.db.prepare('SELECT COUNT(*) n FROM billing_deletions').get()?.n,0,'a partial deletion intent must roll back');
 store.db.exec('DROP TRIGGER fail_deletion_fence; DROP TABLE billing_deleted_owners;');
 store.db.prepare('INSERT INTO billing_deletions VALUES (?,?)').run(owner,now);
 new BillingLedger(store.db);
 const fence=store.db.prepare('SELECT * FROM billing_deleted_owners').get()!;
 assert.equal(fence.external_customer_id,owner);assert.equal(fence.created_ms,now);assert.equal(fence.next_ms,0);
 assert.deepEqual(Object.keys(fence),['external_customer_id','created_ms','next_ms','checks']);
});

test('server client pins destination, rejects redirect/error bodies and never exposes provider secrets',async()=>{
 const client=new LagoClient(resolveBillingConfig(config),async(_input,init)=>{assert.equal(init?.redirect,'error');return json({secret:'provider-private-sentinel'},422);});
 try{
  await assert.rejects(client.request('GET','//attacker.invalid'),errorCode('BILLING_UNAVAILABLE'));
  await assert.rejects(client.request('POST','/events'),e=>errorCode('BILLING_SERVICE_UNAVAILABLE')(e)&&!String(e).includes('provider-private-sentinel'));
 }finally{client.close();}
});

test('signed exact raw webhook bypasses only its own Origin guard, dedupes body and rejects tampering',async t=>{
 const dir=directory(),service=createApp({dataDir:dir,auth:{},health:{},ai:{},billing:config,billingFetch:unreachable});
 const server=service.app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 t.after(async()=>{await new Promise<void>(r=>server.close(()=>r()));service.close();removeDirectory(dir);});
 const base='http://127.0.0.1:'+(server.address() as any).port;
 const raw=Buffer.from('{ "webhook_type":"subscription.updated" }'),signature=jwt(raw);
 const send=(path:string,body:Buffer,sig=signature,delivery='fixture')=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json','X-Lago-Signature':sig,'X-Lago-Unique-Key':delivery},body:body.toString()});
 assert.equal((await send('/api/billing/webhooks/lago',raw)).status,204);
 assert.equal((await send('/api/billing/webhooks/lago',raw,signature,'changed-unsigned-value')).status,204);
 assert.equal(service.store.db.prepare('SELECT COUNT(*) n FROM billing_webhook_receipts').get()?.n,1);
 assert.equal((await send('/api/billing/webhooks/lago',Buffer.from(raw.toString().replace('updated','started')))).status,401);
 assert.equal((await send('/api/billing/webhooks/lago',raw,jwt(raw,undefined,'HS256'))).status,401);
 assert.equal((await send('/api/billing/webhooks/lago',raw,jwt(raw,'http://attacker.invalid'))).status,401);
 const nullBody=Buffer.from('null');assert.equal((await send('/api/billing/webhooks/lago',nullBody,jwt(nullBody))).status,400);
 assert.equal((await send('/api/billing/webhooks/lago?extra=1',raw)).status,401);
 assert.equal((await send('/api/billing/subscribe',Buffer.from('{}'))).status,403);
 assert.equal((await fetch(base+'/api/billing/account')).status,401);
 const owner=service.store.createAccount(randomUUID()+'@example.test','Synthetic HTTP fixture','fake-hash','fake-salt').id;
 const session='a'.repeat(64);service.store.createSession(owner,session,Date.now()+60000);
 const mismatched=await fetch(base+'/api/billing/account',{headers:{Cookie:'forma_session='+session,'X-Forma-Account':randomUUID()}});
 assert.equal(mismatched.status,401,'an old UI owner cannot read the new session account');assert.equal((await mismatched.json()).code,'ACCOUNT_CHANGED');
});
