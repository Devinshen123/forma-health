// Creates only test templates in this project's private open-source Lago instance.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const source=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const root=path.resolve(process.env.FORMA_SERVICES_DIR||path.join(source,'..','services'),'lago');
const state=JSON.parse(fs.readFileSync(path.join(root,'private-state.json'),'utf8'));
const base='http://127.0.0.1:3442/api/v1';
async function api(method,route,body,notFound=false){
 const response=await fetch(base+route,{method,headers:{Authorization:`Bearer ${state.apiKey}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
 if(notFound&&response.status===404)return null;
 const value=await response.json();if(!response.ok){fs.writeFileSync(path.join(root,'provision-failure-private.json'),JSON.stringify({method,route,status:response.status,value},null,2));throw new Error('Local Lago provisioning failed; inspect private receipt (no key printed).');}return value;
}
let metric=(await api('GET','/billable_metrics')).billable_metrics.find(x=>x.code==='photo_recognition_success');
if(!metric)metric=(await api('POST','/billable_metrics',{billable_metric:{name:'Successful photo recognition',code:'photo_recognition_success',aggregation_type:'count_agg',recurring:false}})).billable_metric;
if(!await api('GET','/features/photo_recognition',undefined,true))await api('POST','/features',{feature:{code:'photo_recognition',name:'Photo recognition',privileges:[{code:'monthly_limit',name:'Monthly photo limit',value_type:'integer',config:{}}]}});
for(const [code,name,amount,quota] of [['free_test','Free local test',0,3],['pro_test','Pro local test',2000,100]]){
 if(!await api('GET','/plans/'+code,undefined,true))await api('POST','/plans',{plan:{name,code,interval:'monthly',amount_cents:amount,amount_currency:'USD',pay_in_advance:true,charges:[{code:'successful_photos',billable_metric_id:metric.lago_id,charge_model:'standard',pay_in_advance:false,properties:{amount:'0'}}]}});
 await api('PATCH','/plans/'+code+'/entitlements',{entitlements:{photo_recognition:{monthly_limit:quota}}});
}
const endpoints=await api('GET','/webhook_endpoints');
const webhookUrl='http://host.docker.internal:3001/api/billing/webhooks/lago';
if(!endpoints.webhook_endpoints?.some(x=>x.webhook_url===webhookUrl))await api('POST','/webhook_endpoints',{webhook_endpoint:{name:'Forma local sandbox',webhook_url:webhookUrl,signature_algo:'jwt',event_types:['invoice.created','invoice.payment_status_updated','subscription.started','subscription.updated','subscription.terminated']}});
if(process.argv.includes('--write-env')){
 const file=path.join(source,'.env'),text=fs.readFileSync(file,'utf8'),start='# BEGIN FORMA LOCAL LAGO',end='# END FORMA LOCAL LAGO';
 const block=[start,'FORMA_BILLING_MODE=sandbox','FORMA_BILLING_LAGO_URL=http://127.0.0.1:3442',`FORMA_BILLING_LAGO_API_KEY=${state.apiKey}`,`FORMA_BILLING_LAGO_WEBHOOK_PUBLIC_KEY=${Buffer.from(state.publicKey).toString('base64')}`,'FORMA_BILLING_LAGO_WEBHOOK_ISSUER=http://127.0.0.1:3442','FORMA_BILLING_PUBLIC_BASE_URL=http://127.0.0.1:3001',end].join('\n');
 const a=text.indexOf(start),b=text.indexOf(end);
 if(a>=0&&b>=a)fs.writeFileSync(file,text.slice(0,a)+block+text.slice(b+end.length),{mode:0o600});
 else{
  const lines=text.split(/\r?\n/),settings=lines.filter(line=>/^FORMA_BILLING_.*=/.test(line));
  if(settings.some(line=>{const [name,...rest]=line.split('=');const value=rest.join('=').trim();return value!==''&&!(name==='FORMA_BILLING_MODE'&&value==='off');}))throw new Error('Unmanaged billing configuration exists; refusing to overwrite.');
  // A fresh copy of .env.example contains only blank values and mode=off.
  fs.writeFileSync(file,lines.filter(line=>!/^FORMA_BILLING_.*=/.test(line)).join('\n')+'\n'+block+'\n',{mode:0o600});
 }
}
console.log(JSON.stringify({provisioned:true,edition:'open-source',mode:'sandbox',plans:['free_test','pro_test'],testPriceUsd:20,testQuotas:[3,100],webhookRegistered:true,privateConfigurationWritten:process.argv.includes('--write-env'),realMoney:false}));
