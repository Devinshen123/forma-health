import {BillingError,type ResolvedBillingConfig} from './config';
export class LagoClient{
 private readonly active=new Set<AbortController>();
 constructor(private readonly config:ResolvedBillingConfig,private readonly transport:typeof fetch=fetch){}
 close(){for(const c of this.active)c.abort();this.active.clear();}
 async request(method:string,route:string,body?:unknown,allow404=false):Promise<any>{
  if(!this.config.valid||!route.startsWith('/')||route.startsWith('//')||route.includes('..')||/[\r\n#]/.test(route))throw new BillingError('BILLING_UNAVAILABLE');
  const controller=new AbortController();this.active.add(controller);const timer=setTimeout(()=>controller.abort(),this.config.timeoutMs);
  try{
   const response=await this.transport(this.config.url+'/api/v1'+route,{method,redirect:'error',signal:controller.signal,headers:{Authorization:`Bearer ${this.config.apiKey}`,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
   if(allow404&&response.status===404){await response.body?.cancel();return null;}
   if(!response.ok){await response.body?.cancel();throw new BillingError(response.status===404?'BILLING_NOT_FOUND':'BILLING_SERVICE_UNAVAILABLE',response.status===404?404:503);}
   if(response.status===204)return{};
   if(!response.body||Number(response.headers.get('content-length'))>1024*1024)throw new BillingError('BILLING_INVALID_RESPONSE',502);
   const chunks:Uint8Array[]=[];let total=0;const reader=response.body.getReader();
   try{for(;;){const r=await reader.read();if(r.done)break;total+=r.value.length;if(total>1024*1024){await reader.cancel();throw new BillingError('BILLING_INVALID_RESPONSE',502);}chunks.push(r.value);}}finally{reader.releaseLock();}
   try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new BillingError('BILLING_INVALID_RESPONSE',502);}
  }catch(error){throw error instanceof BillingError?error:new BillingError('BILLING_SERVICE_UNAVAILABLE');}
  finally{clearTimeout(timer);this.active.delete(controller);}
 }
}
