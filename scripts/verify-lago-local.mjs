// Real open-source Lago APIs; synthetic Forma account, images and injected AI only.
// No actual payment processor, email delivery, health database or OpenAI request.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {randomBytes,createHash,sign} from 'node:crypto';import sharp from 'sharp';
import {createApp} from '../server/app.ts';
const source=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),storage=path.resolve(source,'..');
const root=path.resolve(process.env.FORMA_SERVICES_DIR||path.join(storage,'services'),'lago'),state=JSON.parse(fs.readFileSync(path.join(root,'private-state.json')));
const dir=fs.mkdtempSync(path.join(storage,'cache','tmp','forma-real-lago-'));
const billing={mode:'sandbox',lagoUrl:'http://127.0.0.1:3442',apiKey:state.apiKey,publicBaseUrl:'http://127.0.0.1:3009',webhookIssuer:'http://127.0.0.1:3442',webhookPublicKey:state.publicKey,timeoutMs:10000};
let calls=0,modelMode='food';const results=[];
function check(value,message){if(!value)throw new Error(message);}
const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'Content-Type':'application/json'}});
const app=createApp({dataDir:dir,auth:{},health:{},billing,secureCookies:false,ai:{apiKey:'synthetic-injected-provider',dailyRequestLimit:100,dailyReservedUsdLimit:5,globalDailyReservedUsdLimit:10,retryDelayMs:0},aiFetch:async()=>{
 calls++;if(modelMode==='failure')return json({},400);
 const draft=modelMode==='food'?{isFood:true,name:'Synthetic rice',calories:130,protein:2.7,carbs:28,fat:0.3,serving_size_grams:100,ingredients:[],warnings:[]}:{isFood:false,name:null,calories:null,protein:null,carbs:null,fat:null,serving_size_grams:null,ingredients:[],warnings:['No visible food']};
 return json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(draft)}]}]});
}});
const server=app.app.listen(3009,'127.0.0.1');await new Promise((r,j)=>{server.once('listening',r);server.once('error',j);});
async function request(method,p,body,owner){const r=await fetch('http://127.0.0.1:3009/api'+p,{method,headers:{Origin:'http://127.0.0.1:3001','Content-Type':'application/json',...(owner?{Cookie:owner.cookie,'X-Forma-Account':owner.id}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(45000)});const value=await r.json();if(!r.ok)fs.writeFileSync(path.join(dir,'last-error-private.json'),JSON.stringify({p,status:r.status,value},null,2));return{status:r.status,value,headers:r.headers};}
async function lago(method,p,body){const r=await fetch('http://127.0.0.1:3442/api/v1'+p,{method,headers:{Authorization:'Bearer '+state.apiKey,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error('Lago test API failed: '+p);if(r.status===204)return{};return r.json();}
async function account(){const r=await request('POST','/auth/register',{email:'billing-'+randomBytes(6).toString('hex')+'@example.test',password:randomBytes(24).toString('base64url'),name:'Local billing acceptance'});check(r.status===201,'Synthetic account registration failed');return{id:r.value.user.id,cookie:r.headers.getSetCookie().find(x=>x.startsWith('forma_session='))?.split(';')[0]};}
const bytes=await sharp({create:{width:8,height:8,channels:3,background:'#fff'}}).png().toBuffer();
async function upload(owner){const r=await request('POST','/assets',{name:'synthetic.png',mime:'image/png',base64:bytes.toString('base64')},owner);check(r.status===201,'Synthetic image upload failed');return r.value.id;}
const photo=(owner,assetId)=>request('POST','/food-photo-drafts',{assetId,consent:true,language:'en'},owner);
async function snapshot(owner){const r=await request('GET','/billing/account',undefined,owner);check(r.status===200,'Billing snapshot failed; inspect private receipt');return r.value;}
let endpointId;
try{
 const registration=await lago('POST','/webhook_endpoints',{webhook_endpoint:{name:'Forma isolated '+randomBytes(4).toString('hex'),webhook_url:'http://host.docker.internal:3009/api/billing/webhooks/lago',signature_algo:'jwt',event_types:['invoice.created','invoice.payment_status_updated','subscription.started','subscription.updated','subscription.terminated']}});endpointId=registration.webhook_endpoint.lago_id;
 const owner=await account(),initialState=app.store.db.prepare('SELECT * FROM states WHERE owner_id=?').get(owner.id);
 let current=await snapshot(owner);check(current.usage.limit===3&&current.subscription.effectivePlanCode==='free_test','OSS Free entitlement unavailable');results.push('real-oss-entitlement-free');
 const firstAsset=await upload(owner),first=await photo(owner,firstAsset);check(first.status===201,'First synthetic recognition failed');const afterFirst=calls;
 const again=await photo(owner,firstAsset);check(again.status===201&&again.value.id===first.value.id&&calls===afterFirst,'Lost-response retry repeated AI or billing');results.push('lost-response-idempotency');
 modelMode='other';check((await photo(owner,await upload(owner))).status===201,'Non-food response failed');check((await snapshot(owner)).usage.used===1,'Non-food consumed photo quota');results.push('non-food-is-not-billed');
 modelMode='failure';check((await photo(owner,await upload(owner))).status===502,'Expected provider failure');check((await snapshot(owner)).usage.used===1,'Failed provider attempt consumed quota');results.push('provider-failure-releases-quota');modelMode='food';
 check((await photo(owner,await upload(owner))).status===201,'Second recognition failed');
 const assets=await Promise.all([upload(owner),upload(owner)]),parallel=await Promise.all(assets.map(a=>photo(owner,a)));
 check(parallel.filter(r=>r.status===201).length===1&&parallel.filter(r=>r.status===402).length===1,'Concurrent quota admission was not atomic');results.push('atomic-concurrent-last-unit');
 current=await snapshot(owner);check(current.usage.used===3&&current.usage.remaining===0,'Free usage mismatch');
 const beforeBlocked=calls;check((await photo(owner,await upload(owner))).status===402&&calls===beforeBlocked,'Exhausted quota reached provider');results.push('quota-blocks-before-provider');
 let delivered=false;for(let i=0;i<30;i++){await app.billing.flush(owner.id);const r=await snapshot(owner);if(r.usage.lagoReported===3){delivered=true;break;}await new Promise(r=>setTimeout(r,250));}
 check(delivered,'Actual Lago usage aggregation did not converge before plan change');results.push('actual-lago-events-aggregate-once');
 check(Number(app.store.db.prepare('SELECT COUNT(*) AS n FROM billing_webhook_receipts').get().n)>0,'Actual Lago signed webhook was not delivered');results.push('actual-lago-signed-webhook-delivery');
 const selected=await request('POST','/billing/subscribe',{planCode:'pro_test'},owner);check(selected.status===200,'Pro subscription failed');
 for(let i=0;i<30;i++){current=await snapshot(owner);if(current.invoices.some(i=>i.amountCents>0&&i.paymentStatus==='pending'))break;await new Promise(r=>setTimeout(r,200));}
 check(current.subscription.planCode==='pro_test'&&!current.subscription.paid&&current.usage.limit===3&&current.usage.used===3,'Unpaid subscription granted Pro or reset usage');results.push('pending-invoice-does-not-unlock-pro');
 const invoice=current.invoices.find(i=>i.amountCents>0&&i.paymentStatus==='pending');check(invoice,'No real Lago test invoice was created');
 const other=await account(),denied=await request('POST','/billing/simulate-payment',{invoiceId:invoice.id},other);check(denied.status===403,'Cross-account invoice mutation was permitted');results.push('cross-account-invoice-denied');
 // Validly signed stale/false notification must only cause authoritative reconciliation.
 const payload=Buffer.from(JSON.stringify({webhook_type:'invoice.payment_status_updated',invoice:{customer:{external_id:owner.id},payment_status:'succeeded'}}));
 const head=Buffer.from(JSON.stringify({alg:'RS256',typ:'JWT'})).toString('base64url'),body=Buffer.from(JSON.stringify({iss:billing.webhookIssuer,data:payload.toString()})).toString('base64url'),content=head+'.'+body,signature=content+'.'+sign('sha256',Buffer.from(content),state.privateKey).toString('base64url');
 async function notify(raw,sig,delivery){return fetch('http://127.0.0.1:3009/api/billing/webhooks/lago',{method:'POST',headers:{'Content-Type':'application/json','X-Lago-Signature':sig,'X-Lago-Unique-Key':delivery},body:raw});}
 check((await notify(payload,signature,'first')).status===204,'Signed webhook without browser Origin was rejected');check(!(await snapshot(owner)).subscription.paid,'Webhook body alone granted unpaid Pro');
 check((await notify(payload,signature,'changed-unsigned-key')).status===204,'Repeated verified webhook failed');
 const digest=createHash('sha256').update(payload).digest('hex');check(app.store.db.prepare('SELECT COUNT(*) AS n FROM billing_webhook_receipts WHERE body_hash=?').get(digest).n===1,'Changed unsigned delivery key bypassed deduplication');
 check((await notify(Buffer.from(payload.toString().replace('succeeded','pending')),signature,'tampered')).status===401,'Tampered webhook body was accepted');results.push('signed-raw-webhook-reconcile-dedup-and-tamper');
 const paid=await request('POST','/billing/simulate-payment',{invoiceId:invoice.id},owner);check(paid.status===200&&paid.value.subscription.paid&&paid.value.usage.limit===100&&paid.value.usage.used===3,'OSS simulated invoice settlement failed');results.push('oss-simulated-settlement-unlocks-test-pro');
 check((await request('POST','/billing/simulate-payment',{invoiceId:invoice.id},owner)).status===200,'Repeated simulation was not idempotent');
 const canceled=await request('POST','/billing/cancel-renewal',{},owner);check(canceled.status===200&&canceled.value.subscription.cancelAtPeriodEnd&&canceled.value.subscription.effectivePlanCode==='pro_test','Cancel renewal removed current paid period');results.push('cancel-renewal-keeps-paid-period');
 check((await snapshot(owner)).usage.used===3,'Plan change lost already consumed quota');results.push('usage-carries-across-plan-changes');
 check(JSON.stringify(app.store.db.prepare('SELECT * FROM states WHERE owner_id=?').get(owner.id))===JSON.stringify(initialState),'Recognition or billing changed saved health facts');results.push('no-meal-facts-auto-saved');
 const exported=await request('GET','/export',undefined,owner);check(exported.status===200&&exported.value.billing&&!JSON.stringify(exported.value).includes(state.apiKey),'Billing export missing or leaked key');results.push('account-export-includes-safe-billing');
 fs.writeFileSync(path.join(root,'acceptance-private.json'),JSON.stringify({verifiedAt:new Date().toISOString(),results,owner:owner.id,invoice:invoice.id,isolatedDataDirectory:dir,realMoney:false,realOpenAi:false},null,2),{mode:0o600});
 console.log(JSON.stringify({lago:'real-open-source-v1.56.0',checks:results,passed:results.length,realMoney:false,realOpenAi:false,realHealthDatabaseUsed:false,isolatedDataDirectory:dir}));
}finally{if(endpointId)await lago('DELETE','/webhook_endpoints/'+endpointId).catch(()=>undefined);await new Promise(r=>server.close(r));app.close();}
