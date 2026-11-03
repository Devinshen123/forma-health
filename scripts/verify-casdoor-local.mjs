// Run with: node --import tsx scripts/verify-casdoor-local.mjs
// Real local Casdoor, actual local verification email, isolated synthetic Forma database.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,createHash} from 'node:crypto';
import {createApp} from '../server/app.ts';

const source=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const storage=path.resolve(source,'..');
const root=path.resolve(process.env.FORMA_SERVICES_DIR||path.join(storage,'services'),'casdoor');
const state=JSON.parse(fs.readFileSync(path.join(root,'private-state.json'),'utf8'));
const issuer='http://127.0.0.1:3440',application='forma-web',organization='forma-local';
const temp=path.join(storage,'cache','tmp');fs.mkdirSync(temp,{recursive:true});
const dir=fs.mkdtempSync(path.join(temp,'forma-real-casdoor-'));
const previous=process.argv.includes('--existing')?JSON.parse(fs.readFileSync(path.join(root,'acceptance-private.json'),'utf8')):undefined;
const email=previous?.email??`forma-${randomBytes(6).toString('hex')}@example.test`,username=previous?.username??`forma-${randomBytes(6).toString('hex')}`,password=previous?.password??randomBytes(24).toString('base64url')+'Aa1!';
const results=[];
function requireOk(condition,message){if(!condition)throw new Error(message);}
const app=createApp({dataDir:dir,auth:{publicBaseUrl:'http://127.0.0.1:3009',casdoor:{issuer,application,clientId:state.clientId,clientSecret:state.clientSecret}},secureCookies:false,ai:{},health:{}});
const server=app.app.listen(3009,'127.0.0.1');
await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
let providerCookies=previous?.providerCookies||'';
async function provider(route,body,form=false){
 const response=await fetch(issuer+route,{method:'POST',headers:{Origin:issuer,'Content-Type':form?'application/x-www-form-urlencoded':'application/json',...(providerCookies?{Cookie:providerCookies}:{})},body:form?new URLSearchParams(body):JSON.stringify(body),redirect:'manual',signal:AbortSignal.timeout(15000)});
 const cookies=response.headers.getSetCookie();if(cookies.length)providerCookies=cookies.map(x=>x.split(';')[0]).join('; ');
 const value=await response.json();return{response,value};
}
async function forma(route,body,cookie=''){
 const response=await fetch('http://127.0.0.1:3009'+route,{method:body===undefined?'GET':'POST',headers:{Origin:'http://127.0.0.1:3001','Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'manual',signal:AbortSignal.timeout(10000)});
 return response;
}
function failed(stage,value){fs.writeFileSync(path.join(dir,'provider-failure-private.json'),JSON.stringify({stage,value},null,2));throw new Error(stage+' failed; inspect private local test receipt.');}
function queryFrom(url){const p=url.searchParams;return new URLSearchParams({clientId:p.get('client_id'),responseType:'code',redirectUri:p.get('redirect_uri'),scope:p.get('scope'),state:p.get('state'),nonce:p.get('nonce'),code_challenge:p.get('code_challenge'),code_challenge_method:'S256'});}
try{
 if(previous?.providerCookies){
  const account=await(await fetch(issuer+'/api/get-account',{headers:{Cookie:previous.providerCookies},signal:AbortSignal.timeout(5000)})).json();
  requireOk(account.status==='ok'&&account.data?.name===username,'Casdoor file session did not survive container recreation');results.push('provider-session-persisted');
 }
 const options=await(await forma('/api/auth/options')).json();requireOk(options.providers.casdoor.available,'Isolated Casdoor config not ready');
 const start=await forma('/api/auth/casdoor/start',{intent:'login'}),body=await start.json();requireOk(start.ok,'Forma start failed');
 const flow=new URL(body.authorizationUrl),binding=start.headers.getSetCookie().find(x=>x.startsWith('forma_auth_oauth='))?.split(';')[0];requireOk(binding,'Browser binding missing');
 const signup={application,organization,username,password,name:'Forma local acceptance',email,emailCode:'',language:'en',captchaType:'none'};
 let authCode;
 if(!previous){
 const rejected=await provider('/api/signup',{...signup,emailCode:'not-a-valid-code'});requireOk(rejected.value.status!=='ok','Missing actual email verification was accepted');results.push('unverified-signup-rejected');
 const sent=await provider('/api/send-verification-code',{type:'email',dest:email,applicationId:'admin/'+application,method:'signup',captchaType:'none'},true);
 if(sent.value.status!=='ok')failed('Send local verification',sent.value);
 let code='';
 for(let attempt=0;attempt<20&&!code;attempt++){
  const inbox=await(await fetch('http://127.0.0.1:3441/api/v1/messages',{signal:AbortSignal.timeout(3000)})).json();
  const message=inbox.messages?.find(m=>m.To?.some(to=>to.Address===email));
  if(message){const full=await(await fetch('http://127.0.0.1:3441/api/v1/message/'+message.ID)).json();code=String(full.Text||full.HTML||'').match(/verification code is\s+([A-Za-z0-9]+)/i)?.[1]||'';}
  if(!code)await new Promise(r=>setTimeout(r,250));
 }
 requireOk(code,'Actual local email was not received');results.push('actual-local-verification-email');
 const signed=await provider('/api/signup?'+queryFrom(flow),{...signup,emailCode:code});
 if(signed.value.status!=='ok')failed('Actual verified signup',signed.value);
 authCode=signed.value.data;
 }
 if(typeof authCode!=='string'||authCode.includes('/')){
  const login=await provider('/api/login?'+queryFrom(flow),{...signup,type:'code',signinMethod:'Password',captchaType:'none',autoSignin:false});
  if(login.value.status!=='ok')failed('Real local login',login.value);authCode=login.value.data;
 }
 requireOk(typeof authCode==='string'&&!authCode.includes('/'),'Expected actual authorization code');
 const callback=await forma('/auth/callback/casdoor?'+new URLSearchParams({state:flow.searchParams.get('state'),code:authCode}));
 const location=new URL(callback.headers.get('location')||'about:blank');
 const fragment=new URLSearchParams(location.hash.slice(1));
 if(fragment.get('auth')!=='oauth')failed('Forma real token verification',{error:fragment.get('code')});
 const complete=await forma('/api/auth/oauth/complete',{ticket:fragment.get('ticket')},binding),user=await complete.json();
 requireOk(complete.ok&&user.user?.id,'Real signed identity could not complete');
 const security=app.store.db.prepare('SELECT email_verified_at FROM auth_account_security WHERE owner_id=?').get(user.user.id);
 requireOk(security?.email_verified_at,'Actual Casdoor verified email claim missing');
 const identity=app.store.db.prepare("SELECT subject FROM auth_identities WHERE owner_id=? AND provider='casdoor'").get(user.user.id);
 requireOk(/^[a-f0-9]{64}$/.test(identity?.subject||''),'Issuer-scoped identity was not persisted');
 const originalSubject=identity.subject;
 if(previous)requireOk(originalSubject===previous.originalSubject,'Casdoor identity changed on restart');
 if(previous)results.push('stable-subject-after-service-restart');
 results.push('real-signed-id-token-and-forma-session','issuer-scoped-identity','verified-email-persisted');
 // Verify the pinned provider's PKCE behavior independently, with fresh real login codes.
 for(const variant of ['wrong','missing']){
  const verifier=randomBytes(48).toString('base64url'),params=new URLSearchParams({clientId:state.clientId,responseType:'code',redirectUri:'http://127.0.0.1:3009/auth/callback/casdoor',scope:'openid email profile',state:randomBytes(32).toString('hex'),nonce:randomBytes(32).toString('hex'),code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'});
  const login=await provider('/api/login?'+params,{type:'code',signinMethod:'Password',application,organization,username,password,captchaType:'none',autoSignin:false});
  if(login.value.status!=='ok')failed('PKCE real login',login.value);
  const tokenBody=new URLSearchParams({grant_type:'authorization_code',client_id:state.clientId,client_secret:state.clientSecret,code:login.value.data,redirect_uri:'http://127.0.0.1:3009/auth/callback/casdoor'});
  if(variant==='wrong')tokenBody.set('code_verifier','deliberately-wrong-verifier');
  const token=await(await fetch(issuer+'/api/login/oauth/access_token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:tokenBody})).json();
  requireOk(!token.id_token&&!token.access_token,'Invalid PKCE verifier was accepted');results.push(variant+'-pkce-rejected-by-real-provider');
 }
 fs.writeFileSync(path.join(root,'acceptance-private.json'),JSON.stringify({verifiedAt:new Date().toISOString(),results,username,email,password,providerCookies,originalSubject,isolatedDataDirectory:dir},null,2),{mode:0o600});
 console.log(JSON.stringify({casdoor:'real-local-service',passed:results,tests:results.length,realEmailDelivery:false,realHealthDatabaseUsed:false,isolatedDataDirectory:dir}));
}finally{await new Promise(resolve=>server.close(resolve));app.close();}
