import {createPublicKey,type KeyObject} from 'node:crypto';
export class BillingError extends Error { constructor(readonly code:string,readonly status=503){super('Membership request could not complete');} }
export interface BillingConfig { mode?:'off'|'sandbox'; lagoUrl?:string; apiKey?:string; publicBaseUrl?:string; webhookIssuer?:string; webhookPublicKey?:string; timeoutMs?:number }
export interface ResolvedBillingConfig {enabled:boolean;valid:boolean;url:string;apiKey:string;issuer:string;key?:KeyObject;timeoutMs:number}
export const PLAN_CODES=['free_test','pro_test'] as const;
export function resolveBillingConfig(overrides?:BillingConfig):ResolvedBillingConfig{
 const c=overrides??{mode:process.env.FORMA_BILLING_MODE as BillingConfig['mode'],lagoUrl:process.env.FORMA_BILLING_LAGO_URL,apiKey:process.env.FORMA_BILLING_LAGO_API_KEY,publicBaseUrl:process.env.FORMA_BILLING_PUBLIC_BASE_URL,webhookIssuer:process.env.FORMA_BILLING_LAGO_WEBHOOK_ISSUER,webhookPublicKey:process.env.FORMA_BILLING_LAGO_WEBHOOK_PUBLIC_KEY};
 const enabled=!!c.mode&&c.mode!=='off',out:ResolvedBillingConfig={enabled,valid:false,url:'',apiKey:'',issuer:'',timeoutMs:c.timeoutMs??8000};
 if(!enabled)return out;
 try{
  if(c.mode!=='sandbox'||!c.lagoUrl||!c.publicBaseUrl||!c.apiKey||!c.webhookPublicKey)throw new Error();
  for(const value of [c.lagoUrl,c.publicBaseUrl]){const u=new URL(value);if(!['http:','https:'].includes(u.protocol)||!['127.0.0.1','localhost','[::1]'].includes(u.hostname)||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw new Error();}
  if(!/^[\x21-\x7e]{16,512}$/.test(c.apiKey)||!Number.isInteger(out.timeoutMs)||out.timeoutMs<50||out.timeoutMs>30000)throw new Error();
  out.url=new URL(c.lagoUrl).origin;out.issuer=c.webhookIssuer||out.url;if(out.issuer!==out.url)throw new Error();
  out.key=createPublicKey(c.webhookPublicKey.includes('-----BEGIN')?c.webhookPublicKey:Buffer.from(c.webhookPublicKey,'base64'));
  if(out.key.asymmetricKeyType!=='rsa'||(out.key.asymmetricKeyDetails?.modulusLength??0)<2048||(out.key.asymmetricKeyDetails?.modulusLength??0)>8192)throw new Error();
  out.apiKey=c.apiKey;out.valid=true;
 }catch{/* Invalid enabled billing blocks billable requests, but never crashes account/data access. */}
 return out;
}
