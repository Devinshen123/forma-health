import {createHash,verify} from 'node:crypto';
import {z} from 'zod';
import type {Store,Asset} from '../store';
import type {FoodPhotoService} from '../food-photo';
import type {FoodPhotoDraft} from '../../src/types';
import type {BillingInvoice,BillingPlan,BillingSnapshot} from '../../src/billing';
import {BillingError,PLAN_CODES,resolveBillingConfig,type BillingConfig} from './config';
import {LagoClient} from './client';
import {BillingLedger,operationKey} from './ledger';

const stamp=z.string().refine(s=>Number.isFinite(Date.parse(s)));
const subscriptionSchema=z.object({lago_id:z.string().uuid(),external_id:z.string(),external_customer_id:z.string(),plan_code:z.enum(PLAN_CODES),status:z.string(),current_billing_period_started_at:stamp,current_billing_period_ending_at:stamp,next_plan_code:z.string().nullable().optional(),plan_amount_cents:z.number().int().nonnegative(),plan_amount_currency:z.literal('USD'),entitlements:z.array(z.unknown())}).passthrough();
const invoiceSchema=z.object({lago_id:z.string().uuid(),number:z.string().max(200),status:z.string(),payment_status:z.string(),total_amount_cents:z.number().int().nonnegative(),currency:z.literal('USD'),created_at:stamp,customer:z.object({external_id:z.string(),billing_configuration:z.object({payment_provider:z.string().nullable().optional()}).passthrough().optional()}).passthrough(),subscriptions:z.array(z.object({lago_id:z.string(),external_id:z.string()}).passthrough()),billing_periods:z.array(z.object({lago_subscription_id:z.string(),external_subscription_id:z.string(),subscription_from_datetime:stamp.nullable(),subscription_to_datetime:stamp.nullable()}).passthrough()),fees:z.array(z.object({lago_subscription_id:z.string().nullable(),amount_cents:z.number().int(),item:z.object({type:z.string(),code:z.string().nullable()}).passthrough()}).passthrough())}).passthrough();
type Sub=z.infer<typeof subscriptionSchema>;type Invoice=z.infer<typeof invoiceSchema>;
function parse<T>(schema:z.ZodType<T>,value:unknown):T{const r=schema.safeParse(value);if(!r.success)throw new BillingError('BILLING_INVALID_RESPONSE',502);return r.data;}
function quota(entitlements:any):number{
 const values=parse(z.array(z.object({code:z.string(),privileges:z.array(z.object({code:z.string(),value:z.unknown()}).passthrough())}).passthrough()),entitlements);
 const value=values.find(e=>e.code==='photo_recognition')?.privileges.find(p=>p.code==='monthly_limit')?.value;
 return parse(z.number().int().min(0).max(1000000),value);
}
export function paidForPeriod(invoice:Invoice,sub:Sub,owner:string,now:number):boolean{
 if(invoice.customer.external_id!==owner||invoice.status!=='finalized'||invoice.payment_status!=='succeeded'||invoice.currency!==sub.plan_amount_currency)return false;
 if(!invoice.subscriptions.some(s=>s.lago_id===sub.lago_id&&s.external_id===sub.external_id))return false;
 if(!invoice.fees.some(f=>f.lago_subscription_id===sub.lago_id&&f.item.type==='subscription'&&f.item.code===sub.plan_code&&f.amount_cents>0))return false;
 return invoice.billing_periods.some(p=>p.lago_subscription_id===sub.lago_id&&p.external_subscription_id===sub.external_id&&p.subscription_from_datetime&&p.subscription_to_datetime&&Date.parse(p.subscription_from_datetime)<=now&&Date.parse(p.subscription_to_datetime)>=now&&Math.abs(Date.parse(p.subscription_to_datetime)-Date.parse(sub.current_billing_period_ending_at))<1000);
}
export class BillingService{
 readonly config:ReturnType<typeof resolveBillingConfig>;readonly ledger:BillingLedger;
 private readonly client:LagoClient;private closed=false;private flushing=false;private readonly refreshes=new Map<string,Promise<BillingSnapshot>>();private readonly mutations=new Set<string>();private timer?:ReturnType<typeof setInterval>;
 constructor(private readonly store:Store,config?:BillingConfig,transport:typeof fetch=fetch,private readonly now:()=>number=Date.now){
  this.config=resolveBillingConfig(config);this.client=new LagoClient(this.config,transport);this.ledger=new BillingLedger(store.db);
  if(this.config.valid){this.timer=setInterval(()=>{void this.flush().catch(()=>undefined);},15000);this.timer.unref();}
 }
 close(){this.closed=true;if(this.timer)clearInterval(this.timer);this.client.close();}
 private ready(){if(!this.config.enabled||!this.config.valid||this.closed)throw new BillingError('BILLING_UNAVAILABLE');}
 private liveOwner(owner:string){
  if(this.closed||!this.store.db.isOpen)throw new BillingError('BILLING_UNAVAILABLE');
  if(!this.store.db.prepare('SELECT 1 FROM accounts WHERE id=?').get(owner))throw new BillingError('BILLING_ACCOUNT_REMOVED',410);
 }
 options():BillingSnapshot{return{mode:this.config.enabled?'sandbox':'off',available:this.config.valid,reason:!this.config.enabled?'not_configured':this.config.valid?'ready':'invalid_configuration',plans:[],subscription:null,usage:{used:0,reserved:0,limit:0,remaining:0,lagoReported:null,pendingEvents:0},invoices:[]};}
 async plans():Promise<BillingPlan[]>{
  this.ready();return Promise.all(PLAN_CODES.map(async code=>{const {plan}=await this.client.request('GET','/plans/'+code);const p=parse(z.object({code:z.literal(code),name:z.string().max(160),amount_cents:z.number().int().min(code==='free_test'?0:1).max(code==='free_test'?0:100000000),amount_currency:z.literal('USD'),interval:z.literal('monthly'),entitlements:z.array(z.unknown())}).passthrough(),plan);return{code:p.code,name:p.name,amountCents:p.amount_cents,currency:p.amount_currency,monthlyPhotoLimit:quota(p.entitlements)};}));
 }
 private external(owner:string){parse(z.string().uuid(),owner);return'forma_'+owner;}
 private async customer(owner:string){
  this.liveOwner(owner);
  let response=await this.client.request('GET','/customers/'+encodeURIComponent(owner),undefined,true);
  this.liveOwner(owner);
  if(!response)response=await this.client.request('POST','/customers',{customer:{external_id:owner,currency:'USD',timezone:'UTC',billing_configuration:{payment_provider:null}}});
  this.liveOwner(owner);
  if(response.customer?.external_id!==owner||response.customer?.billing_configuration?.payment_provider)throw new BillingError('BILLING_NOT_SANDBOX_CUSTOMER',409);
 }
 private async sub(owner:string,create=true):Promise<Sub|null>{
  this.liveOwner(owner);
  const external=this.external(owner);let response=await this.client.request('GET','/subscriptions/'+external+'?status=active',undefined,true);
  this.liveOwner(owner);
  if(!response&&create){await this.customer(owner);response=await this.client.request('POST','/subscriptions',{subscription:{external_customer_id:owner,external_id:external,plan_code:'free_test',billing_time:'anniversary'}});}
  this.liveOwner(owner);
  if(!response)return null;const s=parse(subscriptionSchema,response.subscription);
  if(s.external_id!==external||s.external_customer_id!==owner)throw new BillingError('BILLING_ACCOUNT_MISMATCH',403);return s;
 }
 private async invoices(owner:string):Promise<Invoice[]>{
  const list=await this.client.request('GET','/invoices?external_customer_id='+encodeURIComponent(owner)+'&per_page=30');
  const ids=parse(z.array(z.object({lago_id:z.string().uuid()}).passthrough()).max(30),list.invoices);
  const all:Invoice[]=[];
  for(let offset=0;offset<ids.length;offset+=5){const part=await Promise.all(ids.slice(offset,offset+5).map(async row=>{const r=await this.client.request('GET','/invoices/'+row.lago_id);const i=parse(invoiceSchema,r.invoice);if(i.customer.external_id!==owner)throw new BillingError('BILLING_ACCOUNT_MISMATCH',403);return i;}));all.push(...part);}
  return all;
 }
 private displayInvoice(i:Invoice,sub:Sub):BillingInvoice{const p=i.billing_periods.find(p=>p.lago_subscription_id===sub.lago_id);return{id:i.lago_id,number:i.number,status:i.status,paymentStatus:i.payment_status,amountCents:i.total_amount_cents,currency:i.currency,createdAt:i.created_at,periodStart:p?.subscription_from_datetime??null,periodEnd:p?.subscription_to_datetime??null};}
 async snapshot(owner:string):Promise<BillingSnapshot>{
  if(!this.config.enabled)return this.options();this.ready();const pending=this.refreshes.get(owner);if(pending)return pending;
  const work=this.refresh(owner).finally(()=>this.refreshes.delete(owner));this.refreshes.set(owner,work);return work;
 }
 private async refresh(owner:string):Promise<BillingSnapshot>{
  this.liveOwner(owner);
  const plans=await this.plans(),sub=(await this.sub(owner))!,invoices=await this.invoices(owner),now=this.now();
  this.liveOwner(owner);
  if(sub.status!=='active'||Date.parse(sub.current_billing_period_started_at)>now||Date.parse(sub.current_billing_period_ending_at)<now)throw new BillingError('BILLING_PERIOD_UNAVAILABLE');
  const paid=sub.plan_code==='free_test'||invoices.some(i=>paidForPeriod(i,sub,owner,now)),effective=paid?sub.plan_code:'free_test';
  // Read entitlement values from the SAME subscription response as its identity/plan.
  // A separate active-entitlements GET can race an unpaid plan change.
  const limit=effective===sub.plan_code?quota(sub.entitlements):plans.find(p=>p.code==='free_test')!.monthlyPhotoLimit;
  let reported:number|null=null;
  try{const r=await this.client.request('GET','/customers/'+owner+'/current_usage?external_subscription_id='+this.external(owner));const entries=r.customer_usage?.charges_usage;if(Array.isArray(entries)){const metric=entries.find(e=>e?.billable_metric?.code==='photo_recognition_success');if(metric){const n=Number(metric.units);if(Number.isFinite(n)&&n>=0)reported=n;}}}catch{/* Current usage is async; atomic admission is the durable local ledger. */}
  this.liveOwner(owner);const checkedAt=this.now();if(Date.parse(sub.current_billing_period_started_at)>checkedAt||Date.parse(sub.current_billing_period_ending_at)<checkedAt)throw new BillingError('BILLING_PERIOD_UNAVAILABLE');
  const usage=this.ledger.usage(owner,sub.current_billing_period_ending_at,checkedAt);
  const snapshot:BillingSnapshot={mode:'sandbox',available:true,reason:'ready',plans,subscription:{planCode:sub.plan_code,effectivePlanCode:effective,status:sub.status,paid,periodStart:sub.current_billing_period_started_at,periodEnd:sub.current_billing_period_ending_at,cancelAtPeriodEnd:sub.next_plan_code==='free_test'},usage:{...usage,limit,remaining:Math.max(0,limit-usage.used-usage.reserved),lagoReported:reported},invoices:invoices.map(i=>this.displayInvoice(i,sub))};
  if(this.closed)throw new BillingError('BILLING_UNAVAILABLE');this.ledger.save(owner,snapshot,now);return snapshot;
 }
 private async mutate(owner:string,action:()=>Promise<void>){
  if(this.mutations.has(owner))throw new BillingError('BILLING_IN_PROGRESS',409);this.mutations.add(owner);
  try{await action();await this.refreshes.get(owner);return await this.snapshot(owner);}finally{this.mutations.delete(owner);}
 }
 async select(owner:string,code:typeof PLAN_CODES[number]){return this.mutate(owner,async()=>{
  this.ready();const current=(await this.snapshot(owner)).subscription!;await this.customer(owner);
  this.liveOwner(owner);
  if(current.planCode!==code)await this.client.request('POST','/subscriptions',{subscription:{external_customer_id:owner,external_id:this.external(owner),plan_code:code,billing_time:'anniversary'}});
 });}
 async settle(owner:string,id:string){return this.mutate(owner,async()=>{
  this.ready();parse(z.string().uuid(),id);await this.customer(owner);
  const {invoice}=await this.client.request('GET','/invoices/'+id),checked=parse(invoiceSchema,invoice),sub=(await this.sub(owner,false));
  if(checked.customer.external_id!==owner||!sub||!checked.subscriptions.some(s=>s.lago_id===sub.lago_id&&s.external_id===sub.external_id))throw new BillingError('BILLING_ACCOUNT_MISMATCH',403);
  if(checked.customer.billing_configuration?.payment_provider||checked.status!=='finalized'||checked.currency!=='USD'||checked.total_amount_cents>100000000)throw new BillingError('BILLING_NOT_SANDBOX_CUSTOMER',409);
  this.liveOwner(owner);
  if(checked.payment_status!=='succeeded')await this.client.request('PUT','/invoices/'+id,{invoice:{payment_status:'succeeded'}});
 });}
 async cancelRenewal(owner:string){return this.select(owner,'free_test');}
 async analyze(owner:string,asset:Asset,language:'zh'|'en',photo:FoodPhotoService):Promise<FoodPhotoDraft>{
  if(!this.config.enabled)return photo.analyze(owner,asset,language);this.ready();const key=operationKey(owner,asset.id,language),existing=this.ledger.existing(owner,key);
  if(existing?.status==='complete'||existing?.status==='no_charge'){const draft=this.store.aiDraft(owner,String(existing.draft_id));if(!draft)throw new BillingError('BILLING_RESULT_REMOVED',410);return draft;}
  const snapshot=await this.snapshot(owner),sub=snapshot.subscription!;
  const leaseMs=this.now(),reserved=this.ledger.reserve(owner,key,asset,language,{start:sub.periodStart,end:sub.periodEnd,subscription:this.external(owner),limit:snapshot.usage.limit},leaseMs);
  if(!reserved){const row=this.ledger.existing(owner,key),draft=this.store.aiDraft(owner,String(row?.draft_id));if(!draft)throw new BillingError('BILLING_RESULT_REMOVED',410);return draft;}
  try{const result=await photo.analyze(owner,asset,language,(draft,reservation)=>{if(this.closed)throw new BillingError('BILLING_UNAVAILABLE');this.ledger.complete(this.store,owner,key,draft,reservation,this.now(),leaseMs);});void this.flush(owner).catch(()=>undefined);return result;}
  catch(error){if(!this.closed&&this.store.db.isOpen)this.ledger.fail(owner,key,leaseMs);throw error;}
 }
 async flush(owner?:string){
  if(!this.config.valid||this.closed||this.flushing)return;this.flushing=true;
  try{
   const rows=owner?this.store.db.prepare("SELECT * FROM billing_outbox WHERE status='pending' AND next_ms<=? AND owner_id=? ORDER BY timestamp_seconds LIMIT 30").all(this.now(),owner):this.store.db.prepare("SELECT * FROM billing_outbox WHERE status='pending' AND next_ms<=? ORDER BY timestamp_seconds LIMIT 30").all(this.now());
   for(const row of rows){if(this.closed)break;try{
    const route='/events/'+String(row.transaction_id);
    let receipt=await this.client.request('GET',route,undefined,true);
    if(!receipt){
     try{await this.client.request('POST','/events',{event:{transaction_id:row.transaction_id,code:'photo_recognition_success',external_subscription_id:row.subscription_id,timestamp:row.timestamp_seconds,properties:{}}});}
     catch(error){receipt=await this.client.request('GET',route,undefined,true);if(!receipt)throw error;}
     receipt??=await this.client.request('GET',route);
    }
    if(receipt.event?.transaction_id!==row.transaction_id||receipt.event?.code!=='photo_recognition_success'||receipt.event?.external_subscription_id!==row.subscription_id||Date.parse(receipt.event?.timestamp)!==Math.round(Number(row.timestamp_seconds)*1000)||JSON.stringify(receipt.event?.properties)!=='{}')throw new BillingError('BILLING_EVENT_MISMATCH',502);
    // A raw receipt is acceptance, not a claim that async aggregation has finished.
    if(!this.closed)this.store.db.prepare("UPDATE billing_outbox SET status='accepted',attempts=attempts+1 WHERE transaction_id=?").run(String(row.transaction_id));
   }catch{if(!this.closed)this.store.db.prepare('UPDATE billing_outbox SET attempts=attempts+1,next_ms=? WHERE transaction_id=?').run(this.now()+Math.min(300000,1000*2**Math.min(Number(row.attempts),8)),String(row.transaction_id));}}
   if(!owner&&!this.closed)for(const row of this.store.db.prepare('SELECT external_customer_id FROM billing_deletions LIMIT 10').all()){
    const id=String(row.external_customer_id);if(this.store.db.prepare('SELECT 1 FROM accounts WHERE id=?').get(id))continue;
    try{
     await this.client.request('DELETE','/customers/'+encodeURIComponent(id),undefined,true);
     // A request already sent can commit after this DELETE. Keep the durable
     // intent until all tracked reads/mutations for that owner have settled,
     // then DELETE once more before acknowledging external cleanup.
     if(!this.closed&&!this.refreshes.has(id)&&!this.mutations.has(id))this.store.db.prepare('DELETE FROM billing_deletions WHERE external_customer_id=?').run(id);
    }catch{/* Durable cleanup retries without retaining names, email or health content. */}
   }
  }finally{this.flushing=false;}
 }
 async webhook(raw:Buffer,signature:string,delivery:string){
  this.ready();if(raw.length>256*1024||signature.length>400000||!this.config.key)throw new BillingError('BILLING_INVALID_SIGNATURE',401);
  const parts=signature.split('.');if(parts.length!==3||parts.some(s=>!/^[A-Za-z0-9_-]+$/.test(s)))throw new BillingError('BILLING_INVALID_SIGNATURE',401);
  let claims:any;try{const header=JSON.parse(Buffer.from(parts[0],'base64url').toString());if(header.alg!=='RS256'||header.crit!==undefined||!verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),this.config.key,Buffer.from(parts[2],'base64url')))throw new Error();claims=JSON.parse(Buffer.from(parts[1],'base64url').toString());if(claims.iss!==this.config.issuer||claims.data!==raw.toString('utf8'))throw new Error();}catch{throw new BillingError('BILLING_INVALID_SIGNATURE',401);}
  const digest=createHash('sha256').update(raw).digest('hex');
  if(this.store.db.prepare('SELECT 1 FROM billing_webhook_receipts WHERE body_hash=?').get(digest))return;
  let value:any;try{value=JSON.parse(raw.toString('utf8'));if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();}catch{throw new BillingError('BILLING_INVALID_RESPONSE',400);}
  const owner=value.invoice?.customer?.external_id??value.subscription?.external_customer_id;
  if(typeof owner==='string'&&z.string().uuid().safeParse(owner).success&&this.store.db.prepare('SELECT 1 FROM accounts WHERE id=?').get(owner))await this.snapshot(owner);
  if(this.closed)throw new BillingError('BILLING_UNAVAILABLE');
  this.store.db.prepare('INSERT OR IGNORE INTO billing_webhook_receipts VALUES (?,?,?)').run(digest,createHash('sha256').update(delivery).digest('hex'),this.now());
 }
 export(owner:string){return this.ledger.export(owner);}
 scheduleDeletion(owner:string){this.store.db.prepare('INSERT OR IGNORE INTO billing_deletions VALUES (?,?)').run(owner,this.now());}
}
